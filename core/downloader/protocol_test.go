//go:build !masbuild

package downloader

import (
	"bufio"
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"unfetch/core/types"
)

func TestParseEd2kURL(t *testing.T) {
	raw := "ed2k://|file|ubuntu-24.04-desktop-amd64.iso|5071200256|a1b2c3d4e5f60718293a4b5c6d7e8f90|s,https://releases.ubuntu.com/24.04/ubuntu.iso|/"
	info, err := ParseEd2kURL(raw)
	if err != nil {
		t.Fatalf("ParseEd2kURL error: %v", err)
	}
	if info.Filename != "ubuntu-24.04-desktop-amd64.iso" {
		t.Errorf("unexpected filename: %s", info.Filename)
	}
	if info.Size != 5071200256 {
		t.Errorf("unexpected size: %d", info.Size)
	}
	if info.Hash != "a1b2c3d4e5f60718293a4b5c6d7e8f90" {
		t.Errorf("unexpected hash: %s", info.Hash)
	}
	if len(info.WebSources) != 1 || info.WebSources[0] != "https://releases.ubuntu.com/24.04/ubuntu.iso" {
		t.Errorf("unexpected web sources: %v", info.WebSources)
	}
}

func TestApplyTaskHeaders(t *testing.T) {
	req, err := http.NewRequest(http.MethodGet, "https://example.com/file.zip", nil)
	if err != nil {
		t.Fatal(err)
	}
	task := &types.Task{
		UserAgent: "Mozilla/5.0 CustomUA",
		Cookies:   "session=abc123; theme=dark",
		Headers: map[string]string{
			"Referer":       "https://example.com/",
			"Authorization": "Bearer tok_xyz",
		},
	}
	applyTaskHeaders(req, task)

	if got := req.Header.Get("User-Agent"); got != "Mozilla/5.0 CustomUA" {
		t.Errorf("User-Agent = %q", got)
	}
	if got := req.Header.Get("Cookie"); got != "session=abc123; theme=dark" {
		t.Errorf("Cookie = %q", got)
	}
	if got := req.Header.Get("Referer"); got != "https://example.com/" {
		t.Errorf("Referer = %q", got)
	}
	if got := req.Header.Get("Authorization"); got != "Bearer tok_xyz" {
		t.Errorf("Authorization = %q", got)
	}
}

func TestFTPDownloaderResumeAndChecksum(t *testing.T) {
	payload := []byte("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-unfetch-ftp-test-payload!")
	sum := sha256.Sum256(payload)
	expectedHash := hex.EncodeToString(sum[:])

	// 启动极简内存 FTP 测试服务器（支持 USER/PASS/TYPE/SIZE/EPSV/REST/RETR）
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()

	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_, _ = fmt.Fprintf(conn, "220 mock ftp ready\r\n")
		scanner := bufio.NewScanner(conn)
		var dataLn net.Listener
		var restOffset int
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			cmd := strings.ToUpper(strings.Fields(line)[0])
			switch cmd {
			case "USER":
				_, _ = fmt.Fprintf(conn, "331 user ok\r\n")
			case "PASS":
				_, _ = fmt.Fprintf(conn, "230 login ok\r\n")
			case "TYPE":
				_, _ = fmt.Fprintf(conn, "200 binary mode\r\n")
			case "SIZE":
				_, _ = fmt.Fprintf(conn, "213 %d\r\n", len(payload))
			case "EPSV":
				dataLn, _ = net.Listen("tcp", "127.0.0.1:0")
				_, portStr, _ := net.SplitHostPort(dataLn.Addr().String())
				_, _ = fmt.Fprintf(conn, "229 Entering Extended Passive Mode (|||%s|)\r\n", portStr)
			case "REST":
				fields := strings.Fields(line)
				restOffset, _ = strconv.Atoi(fields[1])
				_, _ = fmt.Fprintf(conn, "350 Restarting at %d\r\n", restOffset)
			case "RETR":
				_, _ = fmt.Fprintf(conn, "150 Opening binary data connection\r\n")
				dconn, err := dataLn.Accept()
				if err == nil {
					_, _ = dconn.Write(payload[restOffset:])
					dconn.Close()
				}
				dataLn.Close()
				_, _ = fmt.Fprintf(conn, "226 Transfer complete\r\n")
				return
			}
		}
	}()

	tmpDir := t.TempDir()
	saveFile := filepath.Join(tmpDir, "test.bin")
	// 预先写入前 10 字节以测试 REST 断点续传
	if err := os.WriteFile(saveFile, payload[:10], 0644); err != nil {
		t.Fatal(err)
	}

	dl := NewFTPDownloader(&types.Config{})
	task := &types.Task{
		ID:             "ftp-test-1",
		URL:            fmt.Sprintf("ftp://%s/pub/test.bin", ln.Addr().String()),
		Filename:       "test.bin",
		SavePath:       tmpDir,
		Type:           types.TaskTypeFTP,
		ExpectedSHA256: expectedHash,
	}

	if err := dl.Download(context.Background(), task, func() {}); err != nil {
		t.Fatalf("FTP Download failed: %v", err)
	}

	got, err := os.ReadFile(saveFile)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(payload) {
		t.Fatalf("downloaded content mismatch: got %q, want %q", string(got), string(payload))
	}
	if task.ActualSHA256 != expectedHash {
		t.Errorf("ActualSHA256 = %s, want %s", task.ActualSHA256, expectedHash)
	}
}

func encryptAES128CBCForTest(plain, key []byte, seqNum uint64) []byte {
	padLen := aes.BlockSize - (len(plain) % aes.BlockSize)
	padded := make([]byte, len(plain)+padLen)
	copy(padded, plain)
	for i := len(plain); i < len(padded); i++ {
		padded[i] = byte(padLen)
	}
	iv := make([]byte, 16)
	binary.BigEndian.PutUint64(iv[8:], seqNum)
	block, _ := aes.NewCipher(key)
	out := make([]byte, len(padded))
	cipher.NewCBCDecrypter(block, iv)
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(out, padded)
	return out
}

func TestHLSPlaylistParserAndAES128Download(t *testing.T) {
	aesKey := []byte("0123456789abcdef") // 16 bytes
	seg0Plain := []byte("HLS-SEGMENT-0-PAYLOAD-ABCDEFGHIJKLMNOPQRSTUVWXYZ")
	seg1Plain := []byte("HLS-SEGMENT-1-PAYLOAD-0123456789abcdefghijklmnop")
	seg2Plain := []byte("HLS-SEGMENT-2-PAYLOAD-FINAL-CHUNK-DATA!")

	expectedMerged := append(append([]byte{}, seg0Plain...), seg1Plain...)
	expectedMerged = append(expectedMerged, seg2Plain...)
	sum := sha256.Sum256(expectedMerged)
	expectedSHA := hex.EncodeToString(sum[:])

	seg0Enc := encryptAES128CBCForTest(seg0Plain, aesKey, 100)
	seg1Enc := encryptAES128CBCForTest(seg1Plain, aesKey, 101)
	seg2Enc := encryptAES128CBCForTest(seg2Plain, aesKey, 102)

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/master.m3u8":
			_, _ = fmt.Fprintf(w, "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720\n720p/prog.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080\n1080p/prog.m3u8\n")
		case "/720p/prog.m3u8":
			_, _ = fmt.Fprintf(w, "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA-SEQUENCE:100\n#EXT-X-KEY:METHOD=AES-128,URI=\"%s/enc.key\"\n#EXTINF:4.0,\nseg0.ts\n#EXTINF:4.0,\nseg1.ts\n#EXTINF:2.5,\nseg2.ts\n#EXT-X-ENDLIST\n", srv.URL)
		case "/enc.key":
			_, _ = w.Write(aesKey)
		case "/720p/seg0.ts":
			_, _ = w.Write(seg0Enc)
		case "/720p/seg1.ts":
			_, _ = w.Write(seg1Enc)
		case "/720p/seg2.ts":
			_, _ = w.Write(seg2Enc)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	tmpDir := t.TempDir()
	dl := NewHLSDownloader(&types.Config{})
	task := &types.Task{
		ID:             "hls-test-1",
		URL:            srv.URL + "/master.m3u8",
		Filename:       "video.ts",
		SavePath:       tmpDir,
		Type:           types.TaskTypeHLS,
		Quality:        "720p",
		Threads:        4,
		ExpectedSHA256: expectedSHA,
	}

	if err := dl.Download(context.Background(), task, func() {}); err != nil {
		t.Fatalf("HLS Download failed: %v", err)
	}

	got, err := os.ReadFile(filepath.Join(tmpDir, "video.ts"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, expectedMerged) {
		t.Fatalf("HLS merged output mismatch: got %q, want %q", string(got), string(expectedMerged))
	}
	if task.ActualSHA256 != expectedSHA {
		t.Errorf("ActualSHA256 = %s, want %s", task.ActualSHA256, expectedSHA)
	}
	if task.Metadata == nil || task.Metadata.Duration != 10 {
		t.Errorf("unexpected duration metadata: %+v", task.Metadata)
	}
}

func TestParseScutilProxy(t *testing.T) {
	sample := `<dictionary> {
  HTTPEnable : 1
  HTTPPort : 7890
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 1
  HTTPSPort : 7890
  HTTPSProxy : 127.0.0.1
  SOCKSEnable : 1
  SOCKSPort : 7891
  SOCKSProxy : 127.0.0.1
}`
	kv := parseScutilProxy(sample)
	if kv["HTTPSEnable"] != "1" || kv["HTTPSProxy"] != "127.0.0.1" || kv["HTTPSPort"] != "7890" {
		t.Fatalf("unexpected scutil parsed map: %+v", kv)
	}
}
