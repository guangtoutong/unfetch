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

// publicTrackers 公共 tracker 列表（基于 ngosang/trackerslist 的高速节点）
// 用于补全无 tracker 的磁力链接以提高 peer 发现成功率
var publicTrackers = []string{
	// 主力 UDP
	"udp://tracker.opentrackr.org:1337/announce",
	"udp://tracker.openbittorrent.com:6969/announce",
	"udp://open.tracker.cl:1337/announce",
	"udp://9.rarbg.com:2810/announce",
	"udp://exodus.desync.com:6969/announce",
	"udp://tracker.torrent.eu.org:451/announce",
	"udp://open.demonii.com:1337/announce",
	"udp://open.stealth.si:80/announce",
	"udp://tracker.tiny-vps.com:6969/announce",
	"udp://tracker.dler.org:6969/announce",
	"udp://tracker.bittor.pw:1337/announce",
	"udp://tracker.theoks.net:6969/announce",
	"udp://tracker.skyts.net:6969/announce",
	"udp://retracker01-msk-virt.corbina.net:80/announce",
	"udp://opentracker.io:6969/announce",
	"udp://moonburrow.club:6969/announce",
	"udp://leet-tracker.moe:1337/announce",
	"udp://isk.richardsw.club:6969/announce",
	"udp://fe.dealclub.de:6969/announce",
	"udp://explodie.org:6969/announce",
	"udp://discord.heihachi.pw:6969/announce",
	"udp://bt2.archive.org:6969/announce",
	"udp://bt1.archive.org:6969/announce",
	// HTTPS 备份
	"https://tracker.tamersunion.org:443/announce",
	"https://tracker.gcrenwp.top:443/announce",
	"https://tracker1.520.jp:443/announce",
	"https://tracker.lilithraws.org:443/announce",
	// HTTP 备份
	"http://tracker.openbittorrent.com:80/announce",
	"http://tracker.opentrackr.org:1337/announce",
	"http://tracker.skyts.net:6969/announce",
	// WSS (websocket) 用于 WebTorrent 互通（浏览器端 peer）
	"wss://tracker.openwebtorrent.com",
	"wss://tracker.webtorrent.dev",
	"wss://tracker.btorrent.xyz",
	// IPv6（部分 tracker 仅 IPv6 节点，扩大 peer 池）
	"udp://ipv6.tracker.harry.lu:80/announce",
	"udp://ipv6.tracker.cl-pl.org:1337/announce",
	"udp://[2001:67c:6ec:203:218:71ff:fe04:8466]:6969/announce",
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
	clientCfg.NoUpload = false // 允许上传，遵循 BT 协议，提升 swarm 收 peer
	clientCfg.Seed = false     // 下载完成后不做种
	clientCfg.ListenPort = 0   // 随机端口
	// 加大 peer 并发池
	clientCfg.TorrentPeersLowWater = 200
	clientCfg.TorrentPeersHighWater = 2000
	clientCfg.HalfOpenConnsPerTorrent = 100
	clientCfg.TotalHalfOpenConns = 500
	clientCfg.EstablishedConnsPerTorrent = 200
	// 协议
	clientCfg.DisableUTP = false
	clientCfg.DisablePEX = false           // peer exchange
	clientCfg.NoDHT = false                // DHT 是无 tracker 时关键
	clientCfg.DisableIPv6 = false          // IPv6 peer 池
	clientCfg.DisableIPv4 = false
	clientCfg.DisableWebtorrent = false    // WebTorrent peer (浏览器端)
	clientCfg.AcceptPeerConnections = true
	clientCfg.DropMutuallyCompletePeers = true
	// uTP-only 模式：绕开 ISP 对 BT TCP 端口的屏蔽
	if cfg != nil && cfg.BTForceUTP {
		clientCfg.DisableTCP = true
		slog.Info("bt: uTP-only mode enabled")
	} else {
		clientCfg.DisableTCP = false
	}

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

	// 合并自定义 tracker
	if len(task.CustomTrackers) > 0 {
		groups := make([][]string, 0, len(task.CustomTrackers))
		for _, tr := range task.CustomTrackers {
			tr = strings.TrimSpace(tr)
			if tr != "" {
				groups = append(groups, []string{tr})
			}
		}
		if len(groups) > 0 {
			t.AddTrackers(groups)
			slog.Info("bt: added custom trackers", "count", len(groups))
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

	// 按 SelectedFiles 选择性下载；空切片或 nil 代表下载全部
	if len(task.SelectedFiles) == 0 {
		t.DownloadAll()
	} else {
		selected := make(map[int]bool, len(task.SelectedFiles))
		for _, idx := range task.SelectedFiles {
			selected[idx] = true
		}
		files := t.Files()
		// 重新累加真实下载字节数（被排除的文件不算）
		var realTotal int64
		for i, f := range files {
			if selected[i] {
				f.SetPriority(torrent.PiecePriorityNormal)
				realTotal += f.Length()
			} else {
				f.SetPriority(torrent.PiecePriorityNone)
			}
		}
		if realTotal > 0 {
			task.TotalBytes = realTotal
		}
		slog.Info("bt: selective download", "id", task.ID, "selected", len(task.SelectedFiles), "of", len(files), "size", realTotal)
	}

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

			// 上报 peer 统计：active = 正在交换数据的连接，total = 已知 + 半开
			task.PeersConnected = stats.ActivePeers
			task.PeersTotal = stats.TotalPeers
			task.Seeders = stats.ConnectedSeeders

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

// PreviewTorrent 只取元数据，不真正开始下载。用于"选哪些文件"前置交互。
// 完成或超时后会自动关闭 client。
func PreviewTorrent(ctx context.Context, rawURL string, cfg *types.Config) (*types.TorrentPreview, error) {
	clientCfg := torrent.NewDefaultClientConfig()
	tmpDir, err := os.MkdirTemp("", "unfetch-preview-*")
	if err != nil {
		return nil, fmt.Errorf("temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)
	clientCfg.DataDir = tmpDir
	clientCfg.NoUpload = true
	clientCfg.Seed = false
	clientCfg.ListenPort = 0

	// 复用代理逻辑
	if cfg != nil {
		effectiveProxy := resolveProxy("", cfg)
		if effectiveProxy != "" {
			if proxyURL, err := url.Parse(effectiveProxy); err == nil {
				switch proxyURL.Scheme {
				case "socks5", "socks5h":
					if dialer, err := buildSOCKS5Dialer(proxyURL); err == nil {
						dialCtx := func(_ context.Context, network, addr string) (net.Conn, error) {
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
	}

	client, err := newTorrentClientWithRetry(clientCfg)
	if err != nil {
		return nil, fmt.Errorf("torrent client: %w", err)
	}
	defer client.Close()

	var t *torrent.Torrent
	if isMagnet(rawURL) {
		enriched := enrichMagnet(rawURL)
		t, err = client.AddMagnet(enriched)
		if err != nil {
			return nil, fmt.Errorf("add magnet: %w", err)
		}
	} else if localPath, ok := parseLocalTorrentURL(rawURL); ok {
		t, err = client.AddTorrentFromFile(localPath)
		if err != nil {
			return nil, fmt.Errorf("add torrent: %w", err)
		}
	} else {
		// 远程 .torrent
		torrentPath, err := downloadTorrentFile(ctx, rawURL, tmpDir)
		if err != nil {
			return nil, fmt.Errorf("download torrent file: %w", err)
		}
		defer os.Remove(torrentPath)
		t, err = client.AddTorrentFromFile(torrentPath)
		if err != nil {
			return nil, fmt.Errorf("add torrent file: %w", err)
		}
	}

	// 等元数据，最多 90 秒
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-t.GotInfo():
	case <-time.After(90 * time.Second):
		return nil, fmt.Errorf("timeout waiting for torrent metadata")
	}

	info := t.Info()
	files := t.Files()
	preview := &types.TorrentPreview{
		Name:       info.BestName(),
		InfoHash:   t.InfoHash().String(),
		TotalBytes: t.Length(),
		Files:      make([]types.TorrentFile, len(files)),
	}
	for i, f := range files {
		preview.Files[i] = types.TorrentFile{
			Index:    i,
			Path:     f.DisplayPath(),
			Length:   f.Length(),
			Selected: true,
		}
	}
	return preview, nil
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
