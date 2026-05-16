package downloader

import (
	"context"
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
	"time"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/storage"

	"unfetch/core/types"
)

// publicTrackers 是常用的公共 tracker 列表，用于补全无 tracker 的磁力链接
var publicTrackers = []string{
	"udp://tracker.opentrackr.org:1337/announce",
	"udp://open.tracker.cl:1337/announce",
	"udp://tracker.openbittorrent.com:6969/announce",
	"https://tracker.opentrackr.org:443/announce",
	"https://tracker1.bt.moack.co.kr:443/announce",
	"http://tracker.openbittorrent.com:80/announce",
	"udp://exodus.desync.com:6969/announce",
	"udp://tracker.torrent.eu.org:451/announce",
}

// BTDownloader BT 下载器，基于 anacrolix/torrent
type BTDownloader struct {
	mu     sync.RWMutex
	config *types.Config
}

func NewBTDownloader(config *types.Config) *BTDownloader {
	return &BTDownloader{config: config}
}

func (d *BTDownloader) UpdateConfig(cfg *types.Config) {
	d.mu.Lock()
	d.config = cfg
	d.mu.Unlock()
}

func (d *BTDownloader) getConfig() *types.Config {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.config
}

// Download 下载 BT 任务（magnet 或 .torrent 文件 URL）
func (d *BTDownloader) Download(ctx context.Context, task *types.Task, onProgress func()) error {
	cfg := d.getConfig()

	// 确保下载目录存在
	if err := os.MkdirAll(task.SavePath, 0755); err != nil {
		return fmt.Errorf("create save dir: %w", err)
	}

	// 配置 torrent client
	clientCfg := torrent.NewDefaultClientConfig()
	clientCfg.DefaultStorage = storage.NewFileByInfoHash(task.SavePath)
	clientCfg.DataDir = task.SavePath
	clientCfg.NoUpload = false // 允许上传，遵循 BT 协议
	clientCfg.Seed = false     // 下载完成后不做种
	clientCfg.ListenPort = 0   // 随机端口（默认 42069 容易撞库 / 端口占用）

	// 代理：按协议分别处理 HTTP proxy 和 SOCKS5
	effectiveProxy := resolveProxy(task.Proxy, cfg)
	if effectiveProxy != "" {
		_ = os.Setenv("ALL_PROXY", effectiveProxy)
		defer os.Unsetenv("ALL_PROXY")
		if proxyURL, err := url.Parse(effectiveProxy); err == nil {
			switch proxyURL.Scheme {
			case "socks5", "socks5h":
				if dialer, err := buildSOCKS5Dialer(proxyURL); err == nil {
					dialCtx := func(ctx context.Context, network, addr string) (net.Conn, error) {
						return dialer.Dial(network, addr)
					}
					clientCfg.TrackerDialContext = dialCtx
					clientCfg.HTTPDialContext = dialCtx
				}
			default:
				clientCfg.HTTPProxy = http.ProxyURL(proxyURL)
			}
		}
	}

	client, err := newTorrentClientWithRetry(clientCfg)
	if err != nil {
		return fmt.Errorf("BT 客户端启动失败：%w（可能是端口被占用或防火墙拦截）", err)
	}
	defer client.Close()

	// 添加 torrent
	var t *torrent.Torrent
	rawURL := task.URL

	if isMagnet(rawURL) {
		enriched := enrichMagnet(rawURL)
		t, err = client.AddMagnet(enriched)
		if err != nil {
			return fmt.Errorf("add magnet: %w", err)
		}
	} else if localPath, ok := parseLocalTorrentURL(rawURL); ok {
		// 本地 .torrent 文件
		t, err = client.AddTorrentFromFile(localPath)
		if err != nil {
			return fmt.Errorf("add torrent from local file: %w", err)
		}
	} else {
		// 远程 .torrent 文件：先下载到临时文件
		torrentPath, err := downloadTorrentFile(ctx, rawURL, task.SavePath)
		if err != nil {
			return fmt.Errorf("download torrent file: %w", err)
		}
		defer os.Remove(torrentPath)

		t, err = client.AddTorrentFromFile(torrentPath)
		if err != nil {
			return fmt.Errorf("add torrent from file: %w", err)
		}
	}

	slog.Info("bt: waiting for torrent info", "id", task.ID)

	// 等待 torrent metadata
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.GotInfo():
	case <-time.After(2 * time.Minute):
		return fmt.Errorf("timeout waiting for torrent info")
	}

	info := t.Info()
	if info == nil {
		return fmt.Errorf("failed to get torrent info")
	}

	// 更新任务元数据
	task.Filename = info.BestName()
	task.TotalBytes = t.Length()

	if task.Metadata == nil {
		task.Metadata = &types.TaskMeta{}
	}
	task.Metadata.Title = info.BestName()

	slog.Info("bt: torrent info received",
		"name", info.BestName(),
		"size", t.Length(),
		"files", len(info.Files),
	)

	onProgress()

	// 开始下载所有文件
	t.DownloadAll()

	// 监控进度
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			t.Drop()
			return ctx.Err()
		case <-ticker.C:
			stats := t.Stats()
			done := t.BytesCompleted()

			task.DoneBytes = done
			_ = stats

			if t.Complete.Bool() {
				task.DoneBytes = task.TotalBytes
				onProgress()
				slog.Info("bt: download complete", "name", info.BestName())

				// 找到实际下载的文件路径
				if len(info.Files) == 1 {
					task.Filename = filepath.Join(info.BestName(), info.Files[0].DisplayPath(info))
				} else {
					task.Filename = info.BestName()
				}

				return nil
			}

			onProgress()
		}
	}
}

func isMagnet(u string) bool {
	return len(u) >= 7 && u[:7] == "magnet:"
}

// newTorrentClientWithRetry 创建 torrent client，端口被占时换随机端口重试
func newTorrentClientWithRetry(cfg *torrent.ClientConfig) (*torrent.Client, error) {
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		c, err := torrent.NewClient(cfg)
		if err == nil {
			return c, nil
		}
		lastErr = err
		// 端口冲突相关错误：重试时显式换端口
		msg := err.Error()
		if strings.Contains(msg, "bind") || strings.Contains(msg, "address already in use") || strings.Contains(msg, "listen") {
			cfg.ListenPort = 0 // 让 OS 选随机端口
			time.Sleep(150 * time.Millisecond)
			continue
		}
		// 非端口冲突直接退出
		return nil, err
	}
	return nil, lastErr
}

// parseLocalTorrentURL 检测 file:// URL，返回可读的本地 .torrent 文件路径
func parseLocalTorrentURL(raw string) (string, bool) {
	if !strings.HasPrefix(raw, "file:") {
		return "", false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", false
	}
	p := u.Path
	// Windows: 形如 /C:/foo/bar.torrent → C:/foo/bar.torrent
	if len(p) >= 3 && p[0] == '/' && p[2] == ':' {
		p = p[1:]
	}
	p = filepath.FromSlash(p)
	if _, err := os.Stat(p); err != nil {
		return "", false
	}
	return p, true
}

// enrichMagnet 为磁力链接补充公共 tracker，提高无 DHT 环境下的连接成功率
func enrichMagnet(magnet string) string {
	// 检查已有哪些 tracker
	existing := make(map[string]bool)
	if idx := strings.Index(magnet, "?"); idx >= 0 {
		for _, part := range strings.Split(magnet[idx+1:], "&") {
			if strings.HasPrefix(part, "tr=") {
				decoded, err := url.QueryUnescape(strings.TrimPrefix(part, "tr="))
				if err == nil {
					existing[decoded] = true
				}
			}
		}
	}

	var sb strings.Builder
	sb.WriteString(magnet)
	for _, tr := range publicTrackers {
		if !existing[tr] {
			sb.WriteString("&tr=")
			sb.WriteString(url.QueryEscape(tr))
		}
	}
	return sb.String()
}

// downloadTorrentFile 下载远程 .torrent 文件到临时文件
func downloadTorrentFile(ctx context.Context, url, saveDir string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "unfetch/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("download torrent: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download torrent: status %d", resp.StatusCode)
	}

	tmpFile, err := os.CreateTemp(saveDir, "*.torrent")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	defer tmpFile.Close()

	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("write torrent file: %w", err)
	}

	return tmpFile.Name(), nil
}
