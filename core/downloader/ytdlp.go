package downloader

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/net/proxy"

	"unfetch/core/types"
)

// ytdlp 进度行的正则：[download]  50.0% of   1.23GiB at    5.00MiB/s ETA 00:02
var progressRe = regexp.MustCompile(
	`\[download\]\s+([\d.]+)%\s+of\s+([\d.]+)(KiB|MiB|GiB|TiB|B)\s+at\s+([\d.]+)(KiB|MiB|GiB|TiB|B)/s`,
)

// videoHostnamesSet 用于快速检查
var videoHostnamesSet = map[string]bool{
	"youtube.com": true, "youtu.be": true,
	"bilibili.com": true,
	"tiktok.com": true, "douyin.com": true,
	"twitter.com": true, "x.com": true,
	"instagram.com": true,
	"facebook.com": true,
	"twitch.tv": true,
	"vimeo.com": true,
	"dailymotion.com": true,
	"nicovideo.jp": true,
	"weibo.com": true,
	"ixigua.com": true,
	"v.qq.com": true,
}

// DetectURLType 检测 URL 是否是 yt-dlp 支持的视频网站
func DetectURLType(rawURL string) types.TaskType {
	lower := strings.ToLower(rawURL)
	if strings.HasPrefix(lower, "magnet:") {
		return types.TaskTypeBT
	}
	if strings.HasSuffix(lower, ".torrent") {
		return types.TaskTypeBT
	}
	for host := range videoHostnamesSet {
		if strings.Contains(lower, host) {
			return types.TaskTypeYtdlp
		}
	}
	return types.TaskTypeHTTP
}

// qualityToFormat 将质量选项转换为 yt-dlp -f 参数
func qualityToFormat(quality string) []string {
	switch quality {
	case "1080p":
		return []string{"-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]"}
	case "720p":
		return []string{"-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]"}
	case "480p":
		return []string{"-f", "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]"}
	case "audio":
		return []string{"-f", "bestaudio[ext=m4a]/bestaudio", "-x", "--audio-format", "mp3"}
	default: // "best" 或空
		return []string{"-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"}
	}
}

// YtdlpDownloader 调用系统 yt-dlp 执行下载
type YtdlpDownloader struct {
	mu     sync.RWMutex
	config *types.Config
}

func NewYtdlpDownloader(config *types.Config) *YtdlpDownloader {
	return &YtdlpDownloader{config: config}
}

func (d *YtdlpDownloader) UpdateConfig(cfg *types.Config) {
	d.mu.Lock()
	d.config = cfg
	d.mu.Unlock()
}

func (d *YtdlpDownloader) getConfig() *types.Config {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.config
}

// findYtdlp 在 daemon 同目录和 PATH 中查找 yt-dlp
func findYtdlp() (string, error) {
	binaryName := "yt-dlp"
	if runtime.GOOS == "windows" {
		binaryName = "yt-dlp.exe"
	}

	// 先查找与 daemon 同目录
	if exe, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(exe), binaryName)
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}

	// 再从 PATH 查找
	path, err := exec.LookPath(binaryName)
	if err == nil {
		return path, nil
	}

	// Windows 还可能叫 yt-dlp（无.exe）
	if runtime.GOOS == "windows" {
		path, err = exec.LookPath("yt-dlp")
		if err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("yt-dlp not found in daemon directory or PATH; please install yt-dlp: https://github.com/yt-dlp/yt-dlp")
}

// ytdlpMeta yt-dlp --dump-json 输出的部分字段
type ytdlpMeta struct {
	Title     string  `json:"title"`
	Uploader  string  `json:"uploader"`
	Duration  float64 `json:"duration"`
	Ext       string  `json:"ext"`
	Thumbnail string  `json:"thumbnail"`
	WebpageURL string `json:"webpage_url_domain"`
}

// fetchMetadata 调用 yt-dlp --dump-json 获取视频元数据
func fetchMetadata(ctx context.Context, ytdlpPath, rawURL string, extraArgs []string) (*ytdlpMeta, error) {
	args := []string{"--dump-json", "--no-playlist"}
	args = append(args, extraArgs...)
	args = append(args, rawURL)

	cmd := exec.CommandContext(ctx, ytdlpPath, args...)
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("yt-dlp --dump-json: %w", err)
	}

	var meta ytdlpMeta
	if err := json.Unmarshal(out, &meta); err != nil {
		return nil, fmt.Errorf("parse metadata: %w", err)
	}
	return &meta, nil
}

// Download 用 yt-dlp 下载视频
func (d *YtdlpDownloader) Download(ctx context.Context, task *types.Task, onProgress func()) error {
	ytdlpPath, err := findYtdlp()
	if err != nil {
		return err
	}

	cfg := d.getConfig()
	slog.Info("ytdlp: found binary", "path", ytdlpPath)

	// 构建 --dump-json 的额外参数
	var metaExtraArgs []string
	if p := resolveProxy(task.Proxy, cfg); p != "" {
		metaExtraArgs = append(metaExtraArgs, "--proxy", p)
	}
	if task.Cookies != "" {
		metaExtraArgs = append(metaExtraArgs, "--cookies-from-browser", task.Cookies)
	}

	// 获取元数据
	meta, err := fetchMetadata(ctx, ytdlpPath, task.URL, metaExtraArgs)
	if err != nil {
		slog.Warn("ytdlp: metadata fetch failed (continuing without metadata)", "err", err)
	} else {
		if task.Metadata == nil {
			task.Metadata = &types.TaskMeta{}
		}
		task.Metadata.Title = meta.Title
		task.Metadata.Thumbnail = meta.Thumbnail
		task.Metadata.Site = meta.WebpageURL
		task.Metadata.Duration = int(meta.Duration)
		onProgress()
	}

	// 构建输出模板
	outputTemplate := filepath.Join(task.SavePath, "%(title)s.%(ext)s")

	// 构建下载命令
	args := []string{
		"--newline",        // 每行输出进度（便于解析）
		"--no-playlist",
		"-o", outputTemplate,
	}

	// 质量格式选项
	args = append(args, qualityToFormat(task.Quality)...)

	// 代理
	if p := resolveProxy(task.Proxy, cfg); p != "" {
		args = append(args, "--proxy", p)
	}

	// Cookie
	if task.Cookies != "" {
		args = append(args, "--cookies-from-browser", task.Cookies)
	}

	// 启用断点续传
	args = append(args, "--continue")

	// 打印文件名（方便解析最终文件名）
	args = append(args, "--print", "after_move:filepath")

	args = append(args, task.URL)

	slog.Info("ytdlp: starting download", "args", strings.Join(args, " "))

	cmd := exec.CommandContext(ctx, ytdlpPath, args...)
	cmd.Dir = task.SavePath

	// 把 daemon 所在目录加到 PATH 最前面，确保 ffmpeg/ffprobe 能被找到
	if exe, err := os.Executable(); err == nil {
		daemonDir := filepath.Dir(exe)
		currentPath := os.Getenv("PATH")
		cmd.Env = append(os.Environ(), "PATH="+daemonDir+string(os.PathListSeparator)+currentPath)
	}

	// 通过管道读取标准输出（进度 + 文件名）
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start yt-dlp: %w", err)
	}

	var finalFile string

	// 读取 stderr（仅记录日志）
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			if line != "" {
				slog.Debug("ytdlp stderr", "line", line)
			}
		}
	}()

	// 读取 stdout：解析进度 + 文件名
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		// 检查是否是 --print after_move:filepath 输出的文件路径
		// （该行不含 [download] 前缀）
		if !strings.HasPrefix(line, "[") && !strings.HasPrefix(line, "ERROR") &&
			!strings.HasPrefix(line, "WARNING") && filepath.IsAbs(line) {
			finalFile = line
			slog.Info("ytdlp: output file", "path", finalFile)
			continue
		}

		// 解析进度行
		if strings.HasPrefix(line, "[download]") {
			d.parseProgressLine(line, task)
			onProgress()
		}

		slog.Debug("ytdlp stdout", "line", line)
	}

	if err := cmd.Wait(); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return fmt.Errorf("yt-dlp exited with error: %w", err)
	}

	// 更新文件名
	if finalFile != "" {
		task.Filename = filepath.Base(finalFile)
		task.SavePath = filepath.Dir(finalFile)
	} else if meta != nil {
		// 回退：根据元数据推断
		ext := meta.Ext
		if task.Quality == "audio" {
			ext = "mp3"
		}
		task.Filename = sanitizeFilename(meta.Title) + "." + ext
	}

	task.DoneBytes = task.TotalBytes
	onProgress()

	slog.Info("ytdlp: download complete", "file", task.Filename)
	return nil
}

// parseProgressLine 解析 yt-dlp 的进度输出行
func (d *YtdlpDownloader) parseProgressLine(line string, task *types.Task) {
	matches := progressRe.FindStringSubmatch(line)
	if matches == nil {
		return
	}

	// matches[1] = percent, matches[2] = size value, matches[3] = size unit
	// matches[4] = speed value, matches[5] = speed unit

	pct, err := strconv.ParseFloat(matches[1], 64)
	if err != nil {
		return
	}

	totalSize := parseSize(matches[2], matches[3])
	if totalSize > 0 {
		task.TotalBytes = totalSize
		task.DoneBytes = int64(float64(totalSize) * pct / 100.0)
	}

	speed := parseSize(matches[4], matches[5])
	task.Speed = speed

	remaining := task.TotalBytes - task.DoneBytes
	if speed > 0 && remaining > 0 {
		task.ETA = int(remaining / speed)
	} else {
		task.ETA = -1
	}
}

// parseSize 将 "1.23" + "MiB" 转换为字节数
func parseSize(value, unit string) int64 {
	v, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}
	switch unit {
	case "B":
		return int64(v)
	case "KiB":
		return int64(v * 1024)
	case "MiB":
		return int64(v * 1024 * 1024)
	case "GiB":
		return int64(v * 1024 * 1024 * 1024)
	case "TiB":
		return int64(v * 1024 * 1024 * 1024 * 1024)
	}
	return 0
}

// resolveProxy returns the effective proxy for a task: task-level > config-level > system proxy.
func resolveProxy(taskProxy string, cfg *types.Config) string {
	if taskProxy != "" {
		return taskProxy
	}
	if cfg.Proxy != "" {
		return cfg.Proxy
	}
	if cfg.UseSystemProxy {
		return ReadSystemProxy()
	}
	return ""
}

// buildSOCKS5Dialer 从 socks5:// URL 构建代理拨号器
func buildSOCKS5Dialer(proxyURL *url.URL) (proxy.Dialer, error) {
	var auth *proxy.Auth
	if proxyURL.User != nil {
		password, _ := proxyURL.User.Password()
		auth = &proxy.Auth{
			User:     proxyURL.User.Username(),
			Password: password,
		}
	}
	return proxy.SOCKS5("tcp", proxyURL.Host, auth, proxy.Direct)
}

// sanitizeFilename 去除文件名中不合法的字符
func sanitizeFilename(name string) string {
	replacer := strings.NewReplacer(
		"/", "-", "\\", "-", ":", "-", "*", "-",
		"?", "", "\"", "", "<", "", ">", "", "|", "-",
	)
	result := replacer.Replace(name)
	if len(result) > 200 {
		result = result[:200]
	}
	return strings.TrimSpace(result)
}
