package downloader

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/errgroup"

	"unfetch/core/types"
)

const (
	minChunkSize = 4 * 1024 * 1024 // 4 MB
)

// chunkState 记录单个 chunk 的下载进度（用于断点续传）
type chunkState struct {
	Start    int64 `json:"start"`
	End      int64 `json:"end"`
	Downloaded int64 `json:"downloaded"`
}

// downloadState 完整的断点续传状态文件
type downloadState struct {
	URL    string       `json:"url"`
	Total  int64        `json:"total"`
	Chunks []chunkState `json:"chunks"`
}

// HTTPDownloader 多线程 HTTP 下载器
type HTTPDownloader struct {
	mu     sync.RWMutex
	config *types.Config
}

func NewHTTPDownloader(config *types.Config) *HTTPDownloader {
	return &HTTPDownloader{config: config}
}

func (d *HTTPDownloader) UpdateConfig(cfg *types.Config) {
	d.mu.Lock()
	d.config = cfg
	d.mu.Unlock()
}

func (d *HTTPDownloader) getConfig() *types.Config {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.config
}

// buildHTTPClient 根据配置创建 HTTP client
func (d *HTTPDownloader) buildHTTPClient(proxy string) *http.Client {
	transport := &http.Transport{
		MaxIdleConns:       100,
		IdleConnTimeout:    90 * time.Second,
		DisableCompression: false,
		TLSClientConfig:    &tls.Config{InsecureSkipVerify: true}, //nolint:gosec — 下载工具需支持自签名证书
	}

	effectiveProxy := proxy
	if effectiveProxy == "" {
		cfg := d.getConfig()
		if cfg.Proxy != "" {
			effectiveProxy = cfg.Proxy
		} else if cfg.UseSystemProxy {
			effectiveProxy = ReadSystemProxy()
		}
	}
	if effectiveProxy != "" {
		if proxyURL, err := url.Parse(effectiveProxy); err == nil {
			switch proxyURL.Scheme {
			case "socks5", "socks5h":
				if dialer, err := buildSOCKS5Dialer(proxyURL); err == nil {
					transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
						return dialer.Dial(network, addr)
					}
				}
			default:
				transport.Proxy = http.ProxyURL(proxyURL)
			}
		}
	}

	return &http.Client{
		Transport: transport,
		Timeout:   0, // 下载大文件不设超时
	}
}

// Download 执行下载，支持断点续传和多线程
func (d *HTTPDownloader) Download(ctx context.Context, task *types.Task, onProgress func()) error {
	cfg := d.getConfig()
	client := d.buildHTTPClient(task.Proxy)

	// HEAD 请求获取文件信息
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, task.URL, nil)
	if err != nil {
		return fmt.Errorf("create HEAD request: %w", err)
	}
	req.Header.Set("User-Agent", "unfetch/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("HEAD request failed: %w", err)
	}
	resp.Body.Close()

	totalSize := resp.ContentLength
	acceptRanges := resp.Header.Get("Accept-Ranges") == "bytes"

	// 确定文件名
	filename := task.Filename
	if filename == "" || filename == "unknown" {
		filename = guessFilename(task.URL, resp)
		task.Filename = filename
	}

	atomic.StoreInt64(&task.TotalBytes, totalSize)

	savePath := filepath.Join(task.SavePath, filename)
	statePath := savePath + ".unfetch_state"

	slog.Info("http download start",
		"url", task.URL,
		"file", savePath,
		"size", totalSize,
		"accept_ranges", acceptRanges,
	)

	// 大小未知（Content-Length: -1）→ 流式单线程下载
	if totalSize <= 0 {
		atomic.StoreInt64(&task.TotalBytes, 0)
		atomic.StoreInt64(&task.DoneBytes, 0)
		onProgress()
		var tb *tokenBucket
		if cfg.SpeedLimit > 0 {
			tb = newTokenBucket(cfg.SpeedLimit)
		}
		if err := d.downloadStreaming(ctx, client, task.URL, savePath, &task.DoneBytes, tb, onProgress); err != nil {
			return err
		}
		slog.Info("http streaming download complete", "file", savePath)
		return verifyChecksum(savePath, task)
	}

	// 决定线程数
	threads := task.Threads
	if threads <= 0 {
		threads = cfg.HTTPThreads
	}
	if !acceptRanges {
		threads = 1
	} else {
		// 根据文件大小限制线程数
		maxChunks := int(totalSize / minChunkSize)
		if maxChunks < 1 {
			maxChunks = 1
		}
		if threads > maxChunks {
			threads = maxChunks
		}
	}

	// 加载或创建断点续传状态
	state, err := d.loadOrCreateState(statePath, task.URL, totalSize, threads)
	if err != nil {
		return fmt.Errorf("prepare state: %w", err)
	}

	// 打开（或创建）输出文件
	file, err := os.OpenFile(savePath, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer file.Close()

	// 预分配文件大小
	if err := file.Truncate(totalSize); err != nil {
		slog.Warn("truncate file failed", "err", err)
	}

	// 计算已下载字节数（初始化 DoneBytes）
	var initialDone int64
	for _, chunk := range state.Chunks {
		initialDone += chunk.Downloaded
	}
	atomic.StoreInt64(&task.DoneBytes, initialDone)
	onProgress()

	// 创建 token bucket（速度限制）
	var tb *tokenBucket
	if cfg.SpeedLimit > 0 {
		tb = newTokenBucket(cfg.SpeedLimit)
	}

	// 状态保存 mutex
	var stateMu sync.Mutex

	// 启动多线程下载
	g, gctx := errgroup.WithContext(ctx)
	for i := range state.Chunks {
		chunkIdx := i
		g.Go(func() error {
			return d.downloadChunk(
				gctx, client, task.URL,
				file, &state.Chunks[chunkIdx],
				&task.DoneBytes, tb,
				func() {
					stateMu.Lock()
					_ = saveState(statePath, state)
					stateMu.Unlock()
					onProgress()
				},
			)
		})
	}

	if err := g.Wait(); err != nil {
		if ctx.Err() != nil {
			// 被暂停/取消，保存状态
			stateMu.Lock()
			_ = saveState(statePath, state)
			stateMu.Unlock()
			return ctx.Err()
		}
		return fmt.Errorf("download chunk error: %w", err)
	}

	// 完成：删除状态文件
	_ = os.Remove(statePath)
	slog.Info("http download complete", "file", savePath)
	return verifyChecksum(savePath, task)
}

// verifyChecksum 如果任务声明了期望哈希，下载完成后做校验并写入 actual_sha256
func verifyChecksum(savePath string, task *types.Task) error {
	if task.ExpectedSHA256 == "" && task.ExpectedMD5 == "" {
		return nil
	}
	f, err := os.Open(savePath)
	if err != nil {
		return fmt.Errorf("verify open: %w", err)
	}
	defer f.Close()

	hs := sha256.New()
	hm := md5.New()
	if _, err := io.Copy(io.MultiWriter(hs, hm), f); err != nil {
		return fmt.Errorf("verify hash read: %w", err)
	}
	sum256 := hex.EncodeToString(hs.Sum(nil))
	sum128 := hex.EncodeToString(hm.Sum(nil))
	task.ActualSHA256 = sum256

	if task.ExpectedSHA256 != "" && !strings.EqualFold(sum256, task.ExpectedSHA256) {
		return fmt.Errorf("SHA256 校验失败：期望 %s，实际 %s", task.ExpectedSHA256, sum256)
	}
	if task.ExpectedMD5 != "" && !strings.EqualFold(sum128, task.ExpectedMD5) {
		return fmt.Errorf("MD5 校验失败：期望 %s，实际 %s", task.ExpectedMD5, sum128)
	}
	slog.Info("checksum ok", "sha256", sum256)
	return nil
}

func (d *HTTPDownloader) downloadChunk(
	ctx context.Context,
	client *http.Client,
	rawURL string,
	file *os.File,
	chunk *chunkState,
	doneBytes *int64,
	tb *tokenBucket,
	onSave func(),
) error {
	// 已完成的 chunk 跳过
	remaining := (chunk.End - chunk.Start + 1) - chunk.Downloaded
	if remaining <= 0 {
		return nil
	}

	rangeStart := chunk.Start + chunk.Downloaded
	rangeEnd := chunk.End

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return fmt.Errorf("create GET request: %w", err)
	}
	req.Header.Set("User-Agent", "unfetch/1.0")
	if chunk.Start > 0 || chunk.Downloaded > 0 || rangeEnd > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", rangeStart, rangeEnd))
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("GET request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	buf := make([]byte, 32*1024) // 32 KB buffer
	offset := rangeStart
	saveCounter := 0

	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		n, err := resp.Body.Read(buf)
		if n > 0 {
			// 速度限制
			if tb != nil {
				tb.consume(ctx, int64(n))
			}

			if _, werr := file.WriteAt(buf[:n], offset); werr != nil {
				return fmt.Errorf("write at %d: %w", offset, werr)
			}
			offset += int64(n)
			atomic.AddInt64(&chunk.Downloaded, int64(n))
			atomic.AddInt64(doneBytes, int64(n))

			saveCounter++
			if saveCounter >= 100 { // 每 100 次写操作保存一次状态
				saveCounter = 0
				onSave()
			}
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read body: %w", err)
		}
	}

	onSave()
	return nil
}

func (d *HTTPDownloader) loadOrCreateState(statePath, rawURL string, totalSize int64, threads int) (*downloadState, error) {
	// 尝试读取现有状态
	if data, err := os.ReadFile(statePath); err == nil {
		var state downloadState
		if err := json.Unmarshal(data, &state); err == nil && state.URL == rawURL && state.Total == totalSize {
			slog.Info("resume from state", "path", statePath, "chunks", len(state.Chunks))
			return &state, nil
		}
	}

	// 创建新状态
	state := &downloadState{
		URL:   rawURL,
		Total: totalSize,
	}

	if threads <= 1 || totalSize <= 0 {
		state.Chunks = []chunkState{{Start: 0, End: totalSize - 1}}
	} else {
		chunkSize := totalSize / int64(threads)
		for i := 0; i < threads; i++ {
			start := int64(i) * chunkSize
			end := start + chunkSize - 1
			if i == threads-1 {
				end = totalSize - 1
			}
			state.Chunks = append(state.Chunks, chunkState{Start: start, End: end})
		}
	}

	return state, nil
}

// downloadStreaming handles servers that don't provide Content-Length.
// It streams the body directly to a file without pre-allocation or Range requests.
func (d *HTTPDownloader) downloadStreaming(
	ctx context.Context,
	client *http.Client,
	rawURL, savePath string,
	doneBytes *int64,
	tb *tokenBucket,
	onProgress func(),
) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return fmt.Errorf("create GET request: %w", err)
	}
	req.Header.Set("User-Agent", "unfetch/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("GET request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	file, err := os.Create(savePath)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer file.Close()

	buf := make([]byte, 32*1024)
	counter := 0
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if tb != nil {
				tb.consume(ctx, int64(n))
			}
			if _, werr := file.Write(buf[:n]); werr != nil {
				return fmt.Errorf("write: %w", werr)
			}
			atomic.AddInt64(doneBytes, int64(n))
			counter++
			if counter >= 50 {
				counter = 0
				onProgress()
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read body: %w", err)
		}
	}
	onProgress()
	return nil
}

func saveState(path string, state *downloadState) error {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func guessFilename(rawURL string, resp *http.Response) string {
	// 尝试从 Content-Disposition 获取
	if cd := resp.Header.Get("Content-Disposition"); cd != "" {
		if i := indexOf(cd, "filename="); i >= 0 {
			name := cd[i+len("filename="):]
			name = trimQuotes(name)
			if name != "" {
				return name
			}
		}
	}

	// 从 URL 路径推断
	parsed, err := url.Parse(rawURL)
	if err == nil {
		base := filepath.Base(parsed.Path)
		if base != "" && base != "." && base != "/" {
			return base
		}
	}

	return "download"
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func trimQuotes(s string) string {
	if len(s) >= 2 && s[0] == '"' {
		if end := indexOf(s[1:], "\""); end >= 0 {
			return s[1 : end+1]
		}
	}
	// 去掉分号后面的部分
	for i, c := range s {
		if c == ';' || c == '\r' || c == '\n' {
			return s[:i]
		}
	}
	return s
}

// tokenBucket 令牌桶，用于限速
type tokenBucket struct {
	mu       sync.Mutex
	tokens   int64
	limit    int64 // bytes per second
	lastFill time.Time
}

func newTokenBucket(limit int64) *tokenBucket {
	return &tokenBucket{
		tokens:   limit,
		limit:    limit,
		lastFill: time.Now(),
	}
}

func (tb *tokenBucket) consume(ctx context.Context, n int64) {
	for {
		tb.mu.Lock()
		now := time.Now()
		elapsed := now.Sub(tb.lastFill).Seconds()
		tb.tokens += int64(elapsed * float64(tb.limit))
		if tb.tokens > tb.limit {
			tb.tokens = tb.limit
		}
		tb.lastFill = now

		if tb.tokens >= n {
			tb.tokens -= n
			tb.mu.Unlock()
			return
		}
		needed := n - tb.tokens
		tb.tokens = 0
		tb.mu.Unlock()

		// 等待足够的 token
		waitDur := time.Duration(float64(needed)/float64(tb.limit)*1000) * time.Millisecond
		if waitDur < time.Millisecond {
			waitDur = time.Millisecond
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(waitDur):
		}
	}
}
