package downloader

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
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

	// 单次请求级别的最大重试次数（HEAD / chunk 内连接失败时）
	maxRequestRetries = 5
)

// requestBackoff 单次请求级别的重试退避（带抖动）：1s, 2s, 4s, 8s, 15s
func requestBackoff(attempt int) time.Duration {
	base := []time.Duration{
		1 * time.Second,
		2 * time.Second,
		4 * time.Second,
		8 * time.Second,
		15 * time.Second,
	}
	if attempt >= len(base) {
		attempt = len(base) - 1
	}
	d := base[attempt]
	// ±25% 抖动，避免雪崩
	jitter := time.Duration(rand.Int63n(int64(d) / 2))
	return d/4*3 + jitter
}

// isTransientErr 判断一个错误是否值得重试（网络/超时类错误）
func isTransientErr(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		// DeadlineExceeded 走重试；Canceled 不重试（是 pause/remove）
		return errors.Is(err, context.DeadlineExceeded)
	}
	if errors.Is(err, io.ErrUnexpectedEOF) || errors.Is(err, io.EOF) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return netErr.Timeout() || strings.Contains(err.Error(), "connection reset") ||
			strings.Contains(err.Error(), "broken pipe") || strings.Contains(err.Error(), "EOF")
	}
	msg := err.Error()
	// 兜底：常见的瞬时网络错误关键字
	// 注意 HTTP/2 stream error / PROTOCOL_ERROR 也算瞬时 —— GitHub 通过 release
	// 重定向到 Azure Blob 时，HTTP/2 流偶尔会被服务端 RST_STREAM。
	return strings.Contains(msg, "connection reset") ||
		strings.Contains(msg, "broken pipe") ||
		strings.Contains(msg, "no route to host") ||
		strings.Contains(msg, "i/o timeout") ||
		strings.Contains(msg, "operation timed out") ||
		strings.Contains(msg, "TLS handshake") ||
		strings.Contains(msg, "unexpected EOF") ||
		strings.Contains(msg, "EOF") ||
		strings.Contains(msg, "stream error") ||
		strings.Contains(msg, "PROTOCOL_ERROR") ||
		strings.Contains(msg, "INTERNAL_ERROR") ||
		strings.Contains(msg, "REFUSED_STREAM") ||
		strings.Contains(msg, "ENHANCE_YOUR_CALM") ||
		strings.Contains(msg, "GOAWAY") ||
		strings.Contains(msg, "use of closed network connection")
}

// retryableStatus 服务端临时不可用的状态码
func retryableStatus(code int) bool {
	return code == http.StatusRequestTimeout || // 408
		code == http.StatusTooManyRequests || // 429
		code == http.StatusInternalServerError || // 500
		code == http.StatusBadGateway || // 502
		code == http.StatusServiceUnavailable || // 503
		code == http.StatusGatewayTimeout // 504
}

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
//
// 关键点：所有阶段（DNS、TLS、首字节、读 body）必须有独立超时，避免单点卡死。
// 之前没设 DialContext/TLSHandshakeTimeout/ResponseHeaderTimeout，导致 GitHub
// 偶发慢/丢包时 HEAD 一卡就是 100+ 秒，最后才被 OS 的 TCP 默认超时打断。
func (d *HTTPDownloader) buildHTTPClient(proxy string) *http.Client {
	dialer := &net.Dialer{
		Timeout:   15 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	transport := &http.Transport{
		DialContext:           dialer.DialContext,
		TLSHandshakeTimeout:   15 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		ForceAttemptHTTP2:     true,
		DisableCompression:    false,
		TLSClientConfig:       &tls.Config{InsecureSkipVerify: true}, //nolint:gosec — 下载工具需支持自签名证书
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
				if socksDialer, err := buildSOCKS5Dialer(proxyURL); err == nil {
					transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
						// 仍受 15s 超时限制
						type contextDialer interface {
							DialContext(ctx context.Context, network, addr string) (net.Conn, error)
						}
						if cd, ok := socksDialer.(contextDialer); ok {
							return cd.DialContext(ctx, network, addr)
						}
						return socksDialer.Dial(network, addr)
					}
				}
			default:
				transport.Proxy = http.ProxyURL(proxyURL)
			}
		}
	}

	return &http.Client{
		Transport: transport,
		Timeout:   0, // 单个 chunk 可能要下很久；超时在 transport 层控制
	}
}

// doRequestWithRetry 对一个请求构造函数做重试，处理瞬时网络错误和 5xx/429
//
// makeReq 应每次返回一个新的 *http.Request（不能复用，因为 body 可能被消费）。
// 返回值：调用方负责关闭 resp.Body。
func doRequestWithRetry(ctx context.Context, client *http.Client, makeReq func() (*http.Request, error), label string) (*http.Response, error) {
	var lastErr error
	for attempt := 0; attempt <= maxRequestRetries; attempt++ {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		req, err := makeReq()
		if err != nil {
			return nil, err
		}
		resp, err := client.Do(req)
		if err == nil {
			if !retryableStatus(resp.StatusCode) {
				return resp, nil
			}
			// 服务端瞬时错误：丢弃 body 后重试
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("%s: status %d", label, resp.StatusCode)
		} else {
			if !isTransientErr(err) {
				return nil, fmt.Errorf("%s: %w", label, err)
			}
			lastErr = err
		}
		if attempt == maxRequestRetries {
			break
		}
		wait := requestBackoff(attempt)
		slog.Warn("request failed, retrying", "label", label, "attempt", attempt+1, "wait", wait, "err", lastErr)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(wait):
		}
	}
	return nil, fmt.Errorf("%s: gave up after %d retries: %w", label, maxRequestRetries, lastErr)
}

// Download 执行下载，支持断点续传 + 多线程 + 多镜像源
func (d *HTTPDownloader) Download(ctx context.Context, task *types.Task, onProgress func()) error {
	cfg := d.getConfig()
	client := d.buildHTTPClient(task.Proxy)

	// 镜像源列表：主 URL + task.Mirrors
	allURLs := []string{task.URL}
	for _, m := range task.Mirrors {
		m = strings.TrimSpace(m)
		if m != "" && m != task.URL {
			allURLs = append(allURLs, m)
		}
	}

	// HEAD 请求主 URL 获取文件信息（带重试，处理 GitHub 偶发的 reset/timeout）
	resp, err := doRequestWithRetry(ctx, client, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodHead, task.URL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "unfetch/1.0")
		return req, nil
	}, "HEAD "+task.URL)
	if err != nil {
		return err
	}
	resp.Body.Close()

	totalSize := resp.ContentLength
	acceptRanges := resp.Header.Get("Accept-Ranges") == "bytes"

	// 部分 CDN（GitHub release 重定向后的 Azure Blob）HEAD 不返回 Content-Length
	// 但返回 Accept-Ranges: bytes。这种情况下用 Range 探测真实大小。
	if totalSize <= 0 && acceptRanges {
		if size, ok := probeSizeViaRange(ctx, client, task.URL); ok {
			totalSize = size
			slog.Info("size probed via Range", "url", task.URL, "size", size)
		}
	}

	// 探活：剩余镜像必须 size 一致且支持 Range，否则剔除
	validURLs := []string{task.URL}
	if len(allURLs) > 1 && totalSize > 0 && acceptRanges {
		for _, u := range allURLs[1:] {
			mResp, mErr := doRequestWithRetry(ctx, client, func() (*http.Request, error) {
				mReq, err := http.NewRequestWithContext(ctx, http.MethodHead, u, nil)
				if err != nil {
					return nil, err
				}
				mReq.Header.Set("User-Agent", "unfetch/1.0")
				return mReq, nil
			}, "HEAD "+u)
			if mErr != nil {
				slog.Warn("mirror HEAD failed, skip", "url", u, "err", mErr)
				continue
			}
			mResp.Body.Close()
			if mResp.ContentLength != totalSize {
				slog.Warn("mirror size mismatch, skip", "url", u, "size", mResp.ContentLength, "expected", totalSize)
				continue
			}
			if mResp.Header.Get("Accept-Ranges") != "bytes" {
				slog.Warn("mirror does not support Range, skip", "url", u)
				continue
			}
			validURLs = append(validURLs, u)
		}
		if len(validURLs) > 1 {
			slog.Info("multi-mirror download", "count", len(validURLs))
		}
	}

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

	// 启动多线程下载（chunk i 优先用 mirror[i % N]，失败时 fallback 到下一个）
	g, gctx := errgroup.WithContext(ctx)
	for i := range state.Chunks {
		chunkIdx := i
		preferredURL := validURLs[chunkIdx%len(validURLs)]
		g.Go(func() error {
			return d.downloadChunkMulti(
				gctx, client, preferredURL, validURLs,
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

// downloadChunkMulti 单 chunk 尝试 preferredURL，失败时按 mirrors 顺序 fallback
// chunk.Downloaded 在失败重试时保留，新请求用 Range 续传
func (d *HTTPDownloader) downloadChunkMulti(
	ctx context.Context,
	client *http.Client,
	preferredURL string,
	mirrors []string,
	file *os.File,
	chunk *chunkState,
	doneBytes *int64,
	tb *tokenBucket,
	onSave func(),
) error {
	// 候选 URL 序列：preferred 先，其他按原序
	tried := map[string]bool{}
	queue := []string{preferredURL}
	tried[preferredURL] = true
	for _, m := range mirrors {
		if !tried[m] {
			queue = append(queue, m)
			tried[m] = true
		}
	}

	var lastErr error
	for _, u := range queue {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		err := d.downloadChunk(ctx, client, u, file, chunk, doneBytes, tb, onSave)
		if err == nil {
			return nil
		}
		// ctx 取消不算镜像失败
		if ctx.Err() != nil {
			return err
		}
		slog.Warn("chunk failed on mirror, falling back", "url", u, "err", err)
		lastErr = err
	}
	return lastErr
}

// downloadChunk 拉取一个 chunk 的数据。
// 如果 body 读到一半网络中断（GitHub/CDN 常见），会自动重连并从 chunk.Downloaded 续传，
// 最多重试 maxRequestRetries 次，每次重试都从已落盘的位置继续。
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
	for attempt := 0; ; attempt++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// 已完成的 chunk 跳过
		remaining := (chunk.End - chunk.Start + 1) - atomic.LoadInt64(&chunk.Downloaded)
		if remaining <= 0 {
			return nil
		}

		err := d.downloadChunkOnce(ctx, client, rawURL, file, chunk, doneBytes, tb, onSave)
		if err == nil {
			return nil
		}
		if ctx.Err() != nil {
			return err
		}
		if !isTransientErr(err) || attempt >= maxRequestRetries {
			return err
		}
		wait := requestBackoff(attempt)
		slog.Warn("chunk read failed, will resume",
			"url", rawURL,
			"attempt", attempt+1,
			"wait", wait,
			"downloaded", atomic.LoadInt64(&chunk.Downloaded),
			"chunk_size", chunk.End-chunk.Start+1,
			"err", err,
		)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(wait):
		}
	}
}

// downloadChunkOnce 执行一次 chunk 拉取尝试；失败会带原始 error 返回，由 downloadChunk 决定是否重试
func (d *HTTPDownloader) downloadChunkOnce(
	ctx context.Context,
	client *http.Client,
	rawURL string,
	file *os.File,
	chunk *chunkState,
	doneBytes *int64,
	tb *tokenBucket,
	onSave func(),
) error {
	rangeStart := chunk.Start + atomic.LoadInt64(&chunk.Downloaded)
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
		if retryableStatus(resp.StatusCode) {
			// 包装成可重试的错误
			return fmt.Errorf("server transient status: %d (i/o timeout)", resp.StatusCode)
		}
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

// probeSizeViaRange 用 Range: bytes=0-0 探测文件大小（适用于 HEAD 不返回 Content-Length 的 CDN）
func probeSizeViaRange(ctx context.Context, client *http.Client, rawURL string) (int64, bool) {
	resp, err := doRequestWithRetry(ctx, client, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", "unfetch/1.0")
		req.Header.Set("Range", "bytes=0-0")
		return req, nil
	}, "probe-range "+rawURL)
	if err != nil {
		return 0, false
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	// Content-Range: bytes 0-0/12345
	cr := resp.Header.Get("Content-Range")
	if cr == "" {
		return 0, false
	}
	slashIdx := strings.LastIndex(cr, "/")
	if slashIdx < 0 || slashIdx == len(cr)-1 {
		return 0, false
	}
	sizeStr := cr[slashIdx+1:]
	if sizeStr == "*" {
		return 0, false
	}
	var size int64
	if _, err := fmt.Sscanf(sizeStr, "%d", &size); err != nil || size <= 0 {
		return 0, false
	}
	return size, true
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
