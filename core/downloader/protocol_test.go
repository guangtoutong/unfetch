//go:build !masbuild

package downloader

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"unfetch/core/types"
)

func TestParseMetalinkAndDownload(t *testing.T) {
	payload := bytes.Repeat([]byte("unfetch-metalink-chunk-"), 1024)
	sum := sha256.Sum256(payload)
	expectedSHA256 := hex.EncodeToString(sum[:])

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ubuntu.iso.meta4":
			w.Header().Set("Content-Type", "application/metalink4+xml")
			_, _ = fmt.Fprintf(w, `<?xml version="1.0" encoding="UTF-8"?>
<metalink xmlns="urn:ietf:params:xml:ns:metalink">
  <file name="ubuntu-minimal.bin">
    <size>%d</size>
    <hash type="sha-256">%s</hash>
    <url priority="1">%s/mirror1/ubuntu-minimal.bin</url>
    <url priority="2">%s/mirror2/ubuntu-minimal.bin</url>
  </file>
</metalink>`, len(payload), expectedSHA256, srv.URL, srv.URL)
		case "/mirror1/ubuntu-minimal.bin", "/mirror2/ubuntu-minimal.bin":
			http.ServeContent(w, r, "ubuntu-minimal.bin", time.Time{}, bytes.NewReader(payload))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	// 1. 直接解析测试
	spec, err := ParseMetalink([]byte(fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<metalink xmlns="urn:ietf:params:xml:ns:metalink">
  <file name="test.iso">
    <size>1234</size>
    <hash type="sha-256">%s</hash>
    <url priority="2">https://mirror-b.example.com/test.iso</url>
    <url priority="1">https://mirror-a.example.com/test.iso</url>
  </file>
</metalink>`, expectedSHA256)))
	if err != nil {
		t.Fatalf("ParseMetalink failed: %v", err)
	}
	if spec.Filename != "test.iso" || spec.SHA256 != expectedSHA256 || len(spec.URLs) != 2 {
		t.Fatalf("unexpected spec: %+v", spec)
	}
	if spec.URLs[0] != "https://mirror-a.example.com/test.iso" {
		t.Fatalf("expected priority 1 URL first, got %v", spec.URLs)
	}

	// 2. HTTPDownloader 端到端下载 .meta4 并自动注入 Mirrors + SHA256 校验
	tmpDir := t.TempDir()
	cfg := &types.Config{
		DownloadDir: tmpDir,
		HTTPThreads: 4,
	}
	dl := NewHTTPDownloader(cfg)
	task := &types.Task{
		ID:       "metalink-1",
		URL:      srv.URL + "/ubuntu.iso.meta4",
		Filename: "ubuntu.iso.meta4",
		SavePath: tmpDir,
		Type:     types.TaskTypeHTTP,
		Status:   types.StatusDownloading,
		Threads:  4,
	}

	if err := dl.Download(context.Background(), task, func() {}); err != nil {
		t.Fatalf("HTTPDownloader.Download(.meta4) failed: %v", err)
	}
	if task.Filename != "ubuntu-minimal.bin" {
		t.Fatalf("expected filename updated to ubuntu-minimal.bin, got %s", task.Filename)
	}
	if task.ExpectedSHA256 != expectedSHA256 {
		t.Fatalf("expected ExpectedSHA256=%s, got %s", expectedSHA256, task.ExpectedSHA256)
	}
	if len(task.Mirrors) != 1 {
		t.Fatalf("expected 1 backup mirror injected, got %v", task.Mirrors)
	}
	gotBytes, err := os.ReadFile(filepath.Join(task.SavePath, task.Filename))
	if err != nil {
		t.Fatalf("read downloaded file: %v", err)
	}
	if !bytes.Equal(gotBytes, payload) {
		t.Fatalf("downloaded payload mismatch: len=%d want=%d", len(gotBytes), len(payload))
	}
}

func TestParseDASHAndDownload(t *testing.T) {
	initSeg := []byte("INIT_MP4_BOX_")
	seg1 := []byte("FRAGMENT_1_")
	seg2 := []byte("FRAGMENT_2_")

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/live/manifest.mpd":
			w.Header().Set("Content-Type", "application/dash+xml")
			_, _ = fmt.Fprintf(w, `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" mediaPresentationDuration="PT4S">
  <Period>
    <AdaptationSet mimeType="video/mp4" contentType="video">
      <Representation id="v720" bandwidth="1500000" width="1280" height="720">
        <SegmentTemplate initialization="init-$RepresentationID$.mp4" media="chunk-$RepresentationID$-$Number$.m4s" startNumber="1" timescale="1000" duration="2000"/>
      </Representation>
      <Representation id="v1080" bandwidth="3000000" width="1920" height="1080">
        <SegmentTemplate initialization="init-$RepresentationID$.mp4" media="chunk-$RepresentationID$-$Number$.m4s" startNumber="1" timescale="1000" duration="2000"/>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`)
		case "/live/init-v1080.mp4":
			_, _ = w.Write(initSeg)
		case "/live/chunk-v1080-1.m4s":
			_, _ = w.Write(seg1)
		case "/live/chunk-v1080-2.m4s":
			_, _ = w.Write(seg2)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	tmpDir := t.TempDir()
	cfg := &types.Config{
		DownloadDir: tmpDir,
		HTTPThreads: 2,
	}
	dl := NewHLSDownloader(cfg)
	task := &types.Task{
		ID:       "dash-1",
		URL:      srv.URL + "/live/manifest.mpd",
		Filename: "manifest.mpd",
		SavePath: tmpDir,
		Type:     types.TaskTypeHLS,
		Status:   types.StatusDownloading,
		Threads:  2,
	}

	if err := dl.Download(context.Background(), task, func() {}); err != nil {
		t.Fatalf("HLSDownloader.Download(.mpd) failed: %v", err)
	}
	if !strings.HasSuffix(task.Filename, ".mp4") {
		t.Fatalf("expected .mpd normalized to .mp4, got %s", task.Filename)
	}
	got, err := os.ReadFile(filepath.Join(task.SavePath, task.Filename))
	if err != nil {
		t.Fatalf("read merged mp4: %v", err)
	}
	want := append(append([]byte{}, initSeg...), append(seg1, seg2...)...)
	if !bytes.Equal(got, want) {
		t.Fatalf("merged DASH output = %q, want %q", string(got), string(want))
	}
}
