package downloader

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/crypto/ssh"

	"unfetch/core/types"
)

// FTPDownloader 支持 FTP / FTPS / SFTP 协议下载（支持断点续传与限速）
type FTPDownloader struct {
	mu     sync.RWMutex
	config *types.Config
}

func NewFTPDownloader(config *types.Config) *FTPDownloader {
	return &FTPDownloader{config: config}
}

func (d *FTPDownloader) UpdateConfig(cfg *types.Config) {
	d.mu.Lock()
	d.config = cfg
	d.mu.Unlock()
}

func (d *FTPDownloader) getConfig() *types.Config {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.config
}

func (d *FTPDownloader) Download(ctx context.Context, task *types.Task, onProgress func()) error {
	parsed, err := url.Parse(task.URL)
	if err != nil {
		return fmt.Errorf("invalid ftp/sftp url: %w", err)
	}

	if task.Filename == "" || task.Filename == "unknown" {
		base := filepath.Base(parsed.Path)
		if base == "" || base == "." || base == "/" {
			base = "download"
		}
		task.Filename = base
	}

	scheme := strings.ToLower(parsed.Scheme)
	switch scheme {
	case "sftp":
		return d.downloadSFTP(ctx, parsed, task, onProgress)
	case "ftp", "ftps":
		return d.downloadFTP(ctx, parsed, scheme == "ftps", task, onProgress)
	default:
		return fmt.Errorf("unsupported scheme for FTPDownloader: %s", scheme)
	}
}

// ──────────────────────────────────────────────────────────────────────
// FTP / FTPS 实现（基于 RFC 959 / RFC 2428 EPSV / RFC 3659 SIZE & REST）
// ──────────────────────────────────────────────────────────────────────

type ftpConn struct {
	conn   net.Conn
	reader *bufio.Reader
	host   string
	useTLS bool
}

func (c *ftpConn) close() {
	_ = c.conn.Close()
}

func (c *ftpConn) readResponse() (int, string, error) {
	line, err := c.reader.ReadString('\n')
	if err != nil {
		return 0, "", err
	}
	if len(line) < 3 {
		return 0, line, fmt.Errorf("short ftp response: %q", line)
	}
	code, err := strconv.Atoi(line[:3])
	if err != nil {
		return 0, line, fmt.Errorf("invalid ftp code in %q: %w", line, err)
	}
	var sb strings.Builder
	sb.WriteString(strings.TrimRight(line, "\r\n"))

	// 多行响应以 "NNN-" 开头，直到 "NNN " 结束
	if len(line) >= 4 && line[3] == '-' {
		prefix := line[:3] + " "
		for {
			nextLine, err := c.reader.ReadString('\n')
			if err != nil {
				return code, sb.String(), err
			}
			sb.WriteByte('\n')
			sb.WriteString(strings.TrimRight(nextLine, "\r\n"))
			if strings.HasPrefix(nextLine, prefix) {
				break
			}
		}
	}
	return code, sb.String(), nil
}

func (c *ftpConn) cmd(expectPrefix int, format string, args ...any) (int, string, error) {
	line := fmt.Sprintf(format, args...) + "\r\n"
	if _, err := io.WriteString(c.conn, line); err != nil {
		return 0, "", err
	}
	code, msg, err := c.readResponse()
	if err != nil {
		return code, msg, err
	}
	if expectPrefix > 0 && code/100 != expectPrefix {
		return code, msg, fmt.Errorf("ftp %s failed: %s", strings.Split(format, " ")[0], msg)
	}
	return code, msg, nil
}

var (
	epsvRe = regexp.MustCompile(`\(\|\|\|(\d+)\|\)`)
	pasvRe = regexp.MustCompile(`\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)`)
)

func (c *ftpConn) openDataConn(ctx context.Context) (net.Conn, error) {
	dialer := &net.Dialer{Timeout: 15 * time.Second}

	// 优先尝试 EPSV（兼容 IPv4/IPv6 与 NAT）
	code, msg, err := c.cmd(0, "EPSV")
	if err == nil && code == 229 {
		if m := epsvRe.FindStringSubmatch(msg); len(m) == 2 {
			addr := net.JoinHostPort(c.host, m[1])
			dconn, derr := dialer.DialContext(ctx, "tcp", addr)
			if derr == nil {
				if c.useTLS {
					tlsConn := tls.Client(dconn, &tls.Config{InsecureSkipVerify: true, ServerName: c.host})
					if err := tlsConn.HandshakeContext(ctx); err != nil {
						dconn.Close()
						return nil, err
					}
					return tlsConn, nil
				}
				return dconn, nil
			}
		}
	}

	// Fallback 到 PASV
	code, msg, err = c.cmd(2, "PASV")
	if err != nil {
		return nil, fmt.Errorf("PASV failed (%d): %w", code, err)
	}
	m := pasvRe.FindStringSubmatch(msg)
	if len(m) != 7 {
		return nil, fmt.Errorf("cannot parse PASV response: %s", msg)
	}
	p1, _ := strconv.Atoi(m[5])
	p2, _ := strconv.Atoi(m[6])
	port := p1*256 + p2
	addr := net.JoinHostPort(c.host, strconv.Itoa(port))
	dconn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, err
	}
	if c.useTLS {
		tlsConn := tls.Client(dconn, &tls.Config{InsecureSkipVerify: true, ServerName: c.host})
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			dconn.Close()
			return nil, err
		}
		return tlsConn, nil
	}
	return dconn, nil
}

func (d *FTPDownloader) downloadFTP(ctx context.Context, u *url.URL, useTLS bool, task *types.Task, onProgress func()) error {
	cfg := d.getConfig()
	host := u.Hostname()
	port := u.Port()
	if port == "" {
		if useTLS {
			port = "990"
		} else {
			port = "21"
		}
	}

	dialer := &net.Dialer{Timeout: 15 * time.Second}
	rawConn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(host, port))
	if err != nil {
		return fmt.Errorf("ftp dial: %w", err)
	}
	var conn net.Conn = rawConn
	if useTLS {
		tlsConn := tls.Client(rawConn, &tls.Config{InsecureSkipVerify: true, ServerName: host})
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			rawConn.Close()
			return fmt.Errorf("ftps handshake: %w", err)
		}
		conn = tlsConn
	}

	fc := &ftpConn{
		conn:   conn,
		reader: bufio.NewReader(conn),
		host:   host,
		useTLS: useTLS,
	}
	defer fc.close()

	// 读取 220 欢迎语
	if code, msg, err := fc.readResponse(); err != nil || code/100 != 2 {
		return fmt.Errorf("ftp greeting (%d): %v %s", code, err, msg)
	}

	user := "anonymous"
	pass := "anonymous@unfetch.org"
	if u.User != nil {
		if un := u.User.Username(); un != "" {
			user = un
		}
		if pw, ok := u.User.Password(); ok {
			pass = pw
		}
	}

	code, msg, err := fc.cmd(0, "USER %s", user)
	if err != nil {
		return fmt.Errorf("ftp USER: %w", err)
	}
	if code == 331 {
		if _, _, err := fc.cmd(2, "PASS %s", pass); err != nil {
			return fmt.Errorf("ftp PASS: %w", err)
		}
	} else if code/100 != 2 {
		return fmt.Errorf("ftp login failed: %s", msg)
	}

	if useTLS {
		_, _, _ = fc.cmd(0, "PBSZ 0")
		_, _, _ = fc.cmd(0, "PROT P")
	}

	// 二进制传输模式
	if _, _, err := fc.cmd(2, "TYPE I"); err != nil {
		return fmt.Errorf("ftp TYPE I: %w", err)
	}

	remotePath := strings.TrimPrefix(u.Path, "/")
	if remotePath == "" {
		return fmt.Errorf("ftp path is empty")
	}

	// 查询文件大小（SIZE）
	var totalSize int64
	if scode, smsg, serr := fc.cmd(0, "SIZE %s", remotePath); serr == nil && scode == 213 {
		parts := strings.Fields(smsg)
		if len(parts) >= 2 {
			if sz, perr := strconv.ParseInt(parts[len(parts)-1], 10, 64); perr == nil && sz > 0 {
				totalSize = sz
			}
		}
	}
	atomic.StoreInt64(&task.TotalBytes, totalSize)

	savePath := filepath.Join(task.SavePath, task.Filename)
	var resumeOffset int64
	if st, err := os.Stat(savePath); err == nil && st.Size() > 0 {
		if totalSize <= 0 || st.Size() < totalSize {
			resumeOffset = st.Size()
		}
	}

	// 打开被动数据连接
	dataConn, err := fc.openDataConn(ctx)
	if err != nil {
		return fmt.Errorf("ftp data conn: %w", err)
	}
	defer dataConn.Close()

	// 尝试 REST 断点续传
	if resumeOffset > 0 {
		if rcode, _, rerr := fc.cmd(0, "REST %d", resumeOffset); rerr != nil || rcode != 350 {
			resumeOffset = 0
		}
	}

	// 发起 RETR
	if rcode, rmsg, rerr := fc.cmd(0, "RETR %s", remotePath); rerr != nil || (rcode != 150 && rcode != 125) {
		return fmt.Errorf("ftp RETR failed (%d): %v %s", rcode, rerr, rmsg)
	}

	flag := os.O_CREATE | os.O_WRONLY
	if resumeOffset > 0 {
		flag |= os.O_APPEND
	} else {
		flag |= os.O_TRUNC
	}
	file, err := os.OpenFile(savePath, flag, 0644)
	if err != nil {
		return fmt.Errorf("open local file: %w", err)
	}
	defer file.Close()

	atomic.StoreInt64(&task.DoneBytes, resumeOffset)
	onProgress()

	var tb *tokenBucket
	if cfg.SpeedLimit > 0 {
		tb = newTokenBucket(cfg.SpeedLimit)
	}

	slog.Info("ftp download start", "url", task.URL, "size", totalSize, "resume", resumeOffset)

	buf := make([]byte, 32*1024)
	counter := 0
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		_ = dataConn.SetReadDeadline(time.Now().Add(30 * time.Second))
		n, rerr := dataConn.Read(buf)
		if n > 0 {
			if tb != nil {
				tb.consume(ctx, int64(n))
			}
			if _, werr := file.Write(buf[:n]); werr != nil {
				return fmt.Errorf("write file: %w", werr)
			}
			atomic.AddInt64(&task.DoneBytes, int64(n))
			counter++
			if counter >= 50 {
				counter = 0
				onProgress()
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			return fmt.Errorf("ftp data read: %w", rerr)
		}
	}
	dataConn.Close()
	_, _, _ = fc.readResponse() // 226 Transfer complete
	onProgress()

	slog.Info("ftp download complete", "file", savePath)
	return verifyChecksum(savePath, task)
}

// ──────────────────────────────────────────────────────────────────────
// SFTP 实现（基于 golang.org/x/crypto/ssh + SFTP v3 协议子系统）
// ──────────────────────────────────────────────────────────────────────

const (
	sshFxpInit   = 1
	sshFxpVersion = 2
	sshFxpOpen   = 3
	sshFxpClose  = 4
	sshFxpRead   = 5
	sshFxpStat   = 17
	sshFxpStatus = 101
	sshFxpHandle = 102
	sshFxpData   = 103
	sshFxpAttrs  = 105

	sshFxfRead = 0x00000001
	sshFxEof   = 1
	sshFileXferAttrSize = 0x00000001
)

func sftpSendPacket(w io.Writer, pktType byte, payload []byte) error {
	length := uint32(1 + len(payload))
	header := make([]byte, 5)
	binary.BigEndian.PutUint32(header[0:4], length)
	header[4] = pktType
	if _, err := w.Write(header); err != nil {
		return err
	}
	_, err := w.Write(payload)
	return err
}

func sftpRecvPacket(r io.Reader) (byte, []byte, error) {
	header := make([]byte, 5)
	if _, err := io.ReadFull(r, header); err != nil {
		return 0, nil, err
	}
	length := binary.BigEndian.Uint32(header[0:4])
	if length < 1 || length > 1024*1024 {
		return 0, nil, fmt.Errorf("invalid sftp packet length: %d", length)
	}
	pktType := header[4]
	payload := make([]byte, length-1)
	if _, err := io.ReadFull(r, payload); err != nil {
		return 0, nil, err
	}
	return pktType, payload, nil
}

func putString(b []byte, s string) []byte {
	var lenBuf [4]byte
	binary.BigEndian.PutUint32(lenBuf[:], uint32(len(s)))
	b = append(b, lenBuf[:]...)
	return append(b, s...)
}

func loadUserSSHKeys() []ssh.Signer {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	var signers []ssh.Signer
	for _, name := range []string{"id_ed25519", "id_rsa", "id_ecdsa"} {
		keyBytes, err := os.ReadFile(filepath.Join(home, ".ssh", name))
		if err != nil {
			continue
		}
		if signer, err := ssh.ParsePrivateKey(keyBytes); err == nil {
			signers = append(signers, signer)
		}
	}
	return signers
}

func (d *FTPDownloader) downloadSFTP(ctx context.Context, u *url.URL, task *types.Task, onProgress func()) error {
	cfg := d.getConfig()
	host := u.Hostname()
	port := u.Port()
	if port == "" {
		port = "22"
	}

	user := "root"
	var authMethods []ssh.AuthMethod
	if u.User != nil {
		if un := u.User.Username(); un != "" {
			user = un
		}
		if pw, ok := u.User.Password(); ok {
			authMethods = append(authMethods, ssh.Password(pw))
		}
	}
	if signers := loadUserSSHKeys(); len(signers) > 0 {
		authMethods = append(authMethods, ssh.PublicKeys(signers...))
	}

	sshCfg := &ssh.ClientConfig{
		User:            user,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint:gosec — 下载工具直连
		Timeout:         15 * time.Second,
	}

	dialer := &net.Dialer{Timeout: 15 * time.Second}
	rawConn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(host, port))
	if err != nil {
		return fmt.Errorf("sftp dial: %w", err)
	}
	c, chans, reqs, err := ssh.NewClientConn(rawConn, net.JoinHostPort(host, port), sshCfg)
	if err != nil {
		rawConn.Close()
		return fmt.Errorf("sftp ssh handshake: %w", err)
	}
	client := ssh.NewClient(c, chans, reqs)
	defer client.Close()

	sess, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("sftp session: %w", err)
	}
	defer sess.Close()

	stdin, err := sess.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := sess.StdoutPipe()
	if err != nil {
		return err
	}
	if err := sess.RequestSubsystem("sftp"); err != nil {
		return fmt.Errorf("request sftp subsystem: %w", err)
	}

	// 1. SSH_FXP_INIT (version 3)
	var initPayload [4]byte
	binary.BigEndian.PutUint32(initPayload[:], 3)
	if err := sftpSendPacket(stdin, sshFxpInit, initPayload[:]); err != nil {
		return fmt.Errorf("sftp init: %w", err)
	}
	if pktType, _, err := sftpRecvPacket(stdout); err != nil || pktType != sshFxpVersion {
		return fmt.Errorf("sftp version reply (%d): %w", pktType, err)
	}

	remotePath := u.Path
	if strings.HasPrefix(remotePath, "/~/") {
		remotePath = strings.TrimPrefix(remotePath, "/~/")
	}

	var reqID uint32 = 1
	nextID := func() uint32 {
		reqID++
		return reqID
	}

	// 2. SSH_FXP_STAT 获取文件大小
	var statPayload []byte
	var idBuf [4]byte
	binary.BigEndian.PutUint32(idBuf[:], nextID())
	statPayload = append(statPayload, idBuf[:]...)
	statPayload = putString(statPayload, remotePath)
	var totalSize int64
	if err := sftpSendPacket(stdin, sshFxpStat, statPayload); err == nil {
		if pktType, resp, rerr := sftpRecvPacket(stdout); rerr == nil && pktType == sshFxpAttrs && len(resp) >= 16 {
			flags := binary.BigEndian.Uint32(resp[4:8])
			if flags&sshFileXferAttrSize != 0 {
				totalSize = int64(binary.BigEndian.Uint64(resp[8:16]))
			}
		}
	}
	atomic.StoreInt64(&task.TotalBytes, totalSize)

	// 3. SSH_FXP_OPEN 打开远程文件
	var openPayload []byte
	binary.BigEndian.PutUint32(idBuf[:], nextID())
	openPayload = append(openPayload, idBuf[:]...)
	openPayload = putString(openPayload, remotePath)
	var pflags [8]byte
	binary.BigEndian.PutUint32(pflags[0:4], sshFxfRead) // pflags = SSH_FXF_READ, attrs flags = 0
	openPayload = append(openPayload, pflags[:]...)
	if err := sftpSendPacket(stdin, sshFxpOpen, openPayload); err != nil {
		return fmt.Errorf("sftp open: %w", err)
	}
	pktType, resp, err := sftpRecvPacket(stdout)
	if err != nil {
		return fmt.Errorf("sftp open reply: %w", err)
	}
	if pktType != sshFxpHandle || len(resp) < 8 {
		return fmt.Errorf("sftp open failed (packet %d)", pktType)
	}
	hLen := binary.BigEndian.Uint32(resp[4:8])
	if int(8+hLen) > len(resp) {
		return fmt.Errorf("corrupt sftp handle")
	}
	handle := string(resp[8 : 8+hLen])
	defer func() {
		var closePayload []byte
		binary.BigEndian.PutUint32(idBuf[:], nextID())
		closePayload = append(closePayload, idBuf[:]...)
		closePayload = putString(closePayload, handle)
		_ = sftpSendPacket(stdin, sshFxpClose, closePayload)
	}()

	savePath := filepath.Join(task.SavePath, task.Filename)
	var offset int64
	if st, err := os.Stat(savePath); err == nil && st.Size() > 0 {
		if totalSize <= 0 || st.Size() < totalSize {
			offset = st.Size()
		}
	}

	flag := os.O_CREATE | os.O_WRONLY
	if offset > 0 {
		flag |= os.O_APPEND
	} else {
		flag |= os.O_TRUNC
	}
	file, err := os.OpenFile(savePath, flag, 0644)
	if err != nil {
		return fmt.Errorf("open local file: %w", err)
	}
	defer file.Close()

	atomic.StoreInt64(&task.DoneBytes, offset)
	onProgress()

	var tb *tokenBucket
	if cfg.SpeedLimit > 0 {
		tb = newTokenBucket(cfg.SpeedLimit)
	}

	slog.Info("sftp download start", "url", task.URL, "size", totalSize, "resume", offset)

	const readChunk = 32 * 1024
	counter := 0
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		var readPayload []byte
		binary.BigEndian.PutUint32(idBuf[:], nextID())
		readPayload = append(readPayload, idBuf[:]...)
		readPayload = putString(readPayload, handle)
		var offLen [12]byte
		binary.BigEndian.PutUint64(offLen[0:8], uint64(offset))
		binary.BigEndian.PutUint32(offLen[8:12], readChunk)
		readPayload = append(readPayload, offLen[:]...)

		if err := sftpSendPacket(stdin, sshFxpRead, readPayload); err != nil {
			return fmt.Errorf("sftp read req: %w", err)
		}
		pt, rdata, err := sftpRecvPacket(stdout)
		if err != nil {
			return fmt.Errorf("sftp read resp: %w", err)
		}
		if pt == sshFxpStatus {
			if len(rdata) >= 8 && binary.BigEndian.Uint32(rdata[4:8]) == sshFxEof {
				break
			}
			return fmt.Errorf("sftp read status error")
		}
		if pt != sshFxpData || len(rdata) < 8 {
			return fmt.Errorf("unexpected sftp packet %d", pt)
		}
		dLen := binary.BigEndian.Uint32(rdata[4:8])
		if int(8+dLen) > len(rdata) {
			return fmt.Errorf("corrupt sftp data packet")
		}
		chunk := rdata[8 : 8+dLen]
		if len(chunk) == 0 {
			break
		}
		if tb != nil {
			tb.consume(ctx, int64(len(chunk)))
		}
		if _, err := file.Write(chunk); err != nil {
			return fmt.Errorf("write local file: %w", err)
		}
		offset += int64(len(chunk))
		atomic.StoreInt64(&task.DoneBytes, offset)
		counter++
		if counter >= 32 {
			counter = 0
			onProgress()
		}
	}

	onProgress()
	slog.Info("sftp download complete", "file", savePath)
	return verifyChecksum(savePath, task)
}
