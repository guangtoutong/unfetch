package types

import (
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type TaskType string

const (
	TaskTypeHTTP  TaskType = "http"
	TaskTypeBT    TaskType = "bt"
	TaskTypeYtdlp TaskType = "ytdlp"
	TaskTypeFTP   TaskType = "ftp"
	TaskTypeEd2k  TaskType = "ed2k"
	TaskTypeHLS   TaskType = "hls"
)

type Status string

const (
	StatusQueued      Status = "queued"
	StatusDownloading Status = "downloading"
	StatusPaused      Status = "paused"
	StatusDone        Status = "done"
	StatusError       Status = "error"
)

// OnAllDoneAction 全部任务完成后的动作
type OnAllDoneAction string

const (
	OnDoneNone     OnAllDoneAction = ""        // 默认：什么都不做
	OnDoneNotify   OnAllDoneAction = "notify"  // 桌面通知
	OnDoneOpenDir  OnAllDoneAction = "open_dir"
	OnDoneShutdown OnAllDoneAction = "shutdown"
	OnDoneSleep    OnAllDoneAction = "sleep"
)

type TaskMeta struct {
	Title     string `json:"title,omitempty"`
	Thumbnail string `json:"thumbnail,omitempty"`
	Site      string `json:"site,omitempty"`
	Duration  int    `json:"duration,omitempty"` // seconds
}

// TorrentFile 一个 torrent 内单个文件的元数据
type TorrentFile struct {
	Index      int    `json:"index"`
	Path       string `json:"path"`
	Length     int64  `json:"length"`
	Selected   bool   `json:"selected"`
	Suspicious bool   `json:"suspicious,omitempty"` // 可疑可执行/脚本文件（如伪装在视频种子中的 .scr/.bat/.exe）
}

// TorrentPreview 种子元信息（用于 /torrent/preview）
type TorrentPreview struct {
	Name       string        `json:"name"`
	InfoHash   string        `json:"info_hash"`
	TotalBytes int64         `json:"total_bytes"`
	Files      []TorrentFile `json:"files"`
}

type Task struct {
	ID         string     `json:"id"`
	URL        string     `json:"url"`
	Filename   string     `json:"filename"`
	SavePath   string     `json:"save_path"`
	Type       TaskType   `json:"type"`
	Status     Status     `json:"status"`
	TotalBytes int64      `json:"total_bytes"`
	DoneBytes  int64      `json:"done_bytes"`
	Speed      int64      `json:"speed"` // bytes/sec
	ETA        int        `json:"eta"`   // seconds, -1 = unknown
	Threads    int        `json:"threads"`
	Priority   int        `json:"priority"` // 任务优先级：-1 低 / 0 普通 / 1 高 / 2 置顶优先
	Proxy      string     `json:"proxy,omitempty"`
	Quality    string     `json:"quality,omitempty"` // for ytdlp: best/1080p/720p/480p/audio
	Cookies    string     `json:"cookies,omitempty"` // browser name, cookie file path, or raw Cookie header
	UserAgent  string     `json:"user_agent,omitempty"`
	Headers    map[string]string `json:"headers,omitempty"`
	PlayAfter  bool       `json:"play_after"`
	Trashed    bool       `json:"trashed"`
	RetryCount int        `json:"retry_count"`            // 已重试次数
	StartAt    *time.Time `json:"start_at,omitempty"`     // 定时下载：不早于此时间开始
	Tags       []string   `json:"tags,omitempty"`         // 标签
	ExpectedSHA256 string `json:"expected_sha256,omitempty"`
	ExpectedMD5    string `json:"expected_md5,omitempty"`
	ActualSHA256   string `json:"actual_sha256,omitempty"`
	SelectedFiles  []int  `json:"selected_files,omitempty"` // BT 任务：仅下载这些下标的文件
	CustomTrackers []string `json:"custom_trackers,omitempty"` // 额外的 tracker URL（BT 任务）
	Mirrors        []string `json:"mirrors,omitempty"` // HTTP 任务：额外的镜像 URL（同一文件的多个来源）
	DependsOn      []string `json:"depends_on,omitempty"` // 依赖任务 ID，全部 done 后才开始下载
	// BT 运行时统计（不持久化）
	PeersConnected int     `json:"peers_connected,omitempty"`
	PeersTotal     int     `json:"peers_total,omitempty"`
	Seeders        int     `json:"seeders,omitempty"`
	UploadedBytes  int64   `json:"uploaded_bytes,omitempty"`
	SeedRatio      float64 `json:"seed_ratio,omitempty"`
	Seeding        bool    `json:"seeding,omitempty"`
	// BT：daemon 检测速度低自动切到 uTP-only 后置 true，仅本次任务有效
	AutoUTPTriggered bool `json:"auto_utp_triggered,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	Error      string     `json:"error,omitempty"`
	Metadata   *TaskMeta  `json:"metadata,omitempty"`
}

type AddTaskRequest struct {
	URL           string     `json:"url"`
	SaveDir       string     `json:"save_dir,omitempty"`
	Filename      string     `json:"filename,omitempty"`
	Threads       int        `json:"threads,omitempty"`
	Priority      int        `json:"priority,omitempty"`
	Proxy         string     `json:"proxy,omitempty"`
	Quality       string     `json:"quality,omitempty"`
	Cookies       string     `json:"cookies,omitempty"`
	UserAgent     string     `json:"user_agent,omitempty"`
	Headers       map[string]string `json:"headers,omitempty"`
	PlayAfter     bool       `json:"play_after,omitempty"`
	StartAt       *time.Time `json:"start_at,omitempty"`
	Tags          []string   `json:"tags,omitempty"`
	ExpectedSHA256 string    `json:"expected_sha256,omitempty"`
	ExpectedMD5    string    `json:"expected_md5,omitempty"`
	// BT 任务专用：仅下载这些文件下标（空数组 = 全部）
	SelectedFiles []int      `json:"selected_files,omitempty"`
	// BT 任务专用：额外 tracker URL
	CustomTrackers []string  `json:"custom_trackers,omitempty"`
	// HTTP 任务专用：额外镜像 URL（同一文件多源并发下载）
	Mirrors        []string  `json:"mirrors,omitempty"`
	// 任务依赖：列出的任务 ID 全部 done 后才开始
	DependsOn      []string  `json:"depends_on,omitempty"`
	// 任务模板名（从 Config.TaskTemplates 中查找，覆盖未显式提供的字段）
	Template       string    `json:"template,omitempty"`
}

// SpeedScheduleEntry 分时段限速：在 [StartHour, EndHour) 时段内使用 Limit
type SpeedScheduleEntry struct {
	StartHour int   `json:"start_hour"` // 0-23
	EndHour   int   `json:"end_hour"`   // 1-24
	Limit     int64 `json:"limit"`      // bytes/sec, 0 = 不限
}

// CategoryRule 智能目录分类归档规则（仅分目录保存，不自动解压）
type CategoryRule struct {
	Name        string   `json:"name"`
	Extensions  []string `json:"extensions,omitempty"`   // 扩展名列表，如 [".mp4", ".mkv"]
	DomainRegex string   `json:"domain_regex,omitempty"` // URL 正则匹配
	SubDir      string   `json:"sub_dir"`                // 相对于 DownloadDir 的子目录名（或绝对路径）
}

type Config struct {
	DownloadDir     string `json:"download_dir"`
	MaxConcurrent   int    `json:"max_concurrent"`
	HTTPThreads     int    `json:"http_threads"`
	Proxy           string `json:"proxy,omitempty"`
	UseSystemProxy  bool   `json:"use_system_proxy"`
	SpeedLimit      int64  `json:"speed_limit"` // 全局基础限速；优先级低于 SpeedSchedule
	SpeedSchedule   []SpeedScheduleEntry `json:"speed_schedule,omitempty"`
	AutoPlayUnflick bool   `json:"auto_play_unflick"`
	AutoRetry       bool   `json:"auto_retry"`
	MaxRetries      int    `json:"max_retries"`  // 默认 3
	OnAllDone       OnAllDoneAction `json:"on_all_done"`
	BTForceUTP             bool    `json:"bt_force_utp"`              // 强制 uTP（关闭 TCP），绕开 ISP BT 端口屏蔽
	BTAutoUTPFallback      bool    `json:"bt_auto_utp_fallback"`      // 速度低时自动切 uTP-only 重连
	BTSeedRatio            float64 `json:"bt_seed_ratio"`             // 目标分享率（如 1.0），0 = 下载完立即停止
	BTSeedTimeMin          int     `json:"bt_seed_time_min"`          // 最长做种分钟数（如 60），0 = 下载完立即停止
	BTBlockSuspiciousFiles bool    `json:"bt_block_suspicious_files"` // 自动拦截 BT 种子内的可疑木马/脚本文件

	// 智能分类归档
	AutoCategorize bool           `json:"auto_categorize"`          // 按扩展名/规则自动路由到子目录
	CategoryRules  []CategoryRule `json:"category_rules,omitempty"` // 自定义分类规则；为空时使用内置默认规则

	// 远程 Web UI
	RemoteEnabled bool   `json:"remote_enabled"` // true 时绑定 0.0.0.0 + 强制 token
	RemoteToken   string `json:"remote_token,omitempty"`

	// RSS 订阅
	RSSFeeds []RSSFeed `json:"rss_feeds,omitempty"`

	// 任务完成钩子
	OnCompleteWebhook string `json:"on_complete_webhook,omitempty"` // POST {id, filename, save_path, url}
	OnCompleteExec    string `json:"on_complete_exec,omitempty"`    // 支持 {id} {filename} {save_path} 占位

	// 任务模板（Cookie / UA / Header 预设）
	TaskTemplates []TaskTemplate `json:"task_templates,omitempty"`
}

// RSSFeed 一个 RSS 订阅源
type RSSFeed struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	FilterRegex string `json:"filter_regex,omitempty"` // 匹配 item title；空 = 全部接受
	IntervalMin int    `json:"interval_min"`           // 轮询间隔，默认 15
	Enabled     bool   `json:"enabled"`
	SaveDir     string `json:"save_dir,omitempty"`
	Tags        []string `json:"tags,omitempty"`
}

// TaskTemplate 网站访问模板
type TaskTemplate struct {
	Name      string            `json:"name"`
	Cookies   string            `json:"cookies,omitempty"`
	UserAgent string            `json:"user_agent,omitempty"`
	Headers   map[string]string `json:"headers,omitempty"`
}

// DefaultCategoryRules 返回内置的安全分目录归档规则（仅归档原文件，绝不自动拆包）
func DefaultCategoryRules() []CategoryRule {
	return []CategoryRule{
		{
			Name:       "Videos",
			Extensions: []string{".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".ts", ".m2ts", ".mpeg", ".mpg", ".m3u8"},
			SubDir:     "Videos",
		},
		{
			Name:       "Music",
			Extensions: []string{".mp3", ".flac", ".wav", ".aac", ".ogg", ".m4a", ".opus", ".wma", ".ape"},
			SubDir:     "Music",
		},
		{
			Name:       "Archives",
			Extensions: []string{".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".zst"},
			SubDir:     "Archives",
		},
		{
			Name:       "Programs",
			Extensions: []string{".dmg", ".pkg", ".exe", ".msi", ".deb", ".rpm", ".appimage", ".apk", ".ipa"},
			SubDir:     "Programs",
		},
		{
			Name:       "Documents",
			Extensions: []string{".pdf", ".epub", ".mobi", ".azw3", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".md", ".csv"},
			SubDir:     "Documents",
		},
		{
			Name:       "Images",
			Extensions: []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".heic", ".avif"},
			SubDir:     "Images",
		},
		{
			Name:       "DiskImages",
			Extensions: []string{".iso", ".img", ".qcow2", ".vmdk", ".ova"},
			SubDir:     "ISO",
		},
	}
}

// ResolveCategoryDir 根据配置与文件名/URL/任务类型解析最终保存目录。
// 仅当 cfg.AutoCategorize 为 true 时启用；若不匹配任何规则则返回 baseDir。
func ResolveCategoryDir(baseDir, filename, rawURL string, taskType TaskType, quality string, cfg *Config) string {
	if cfg == nil || !cfg.AutoCategorize || baseDir == "" {
		return baseDir
	}

	rules := cfg.CategoryRules
	if len(rules) == 0 {
		rules = DefaultCategoryRules()
	}

	lowerName := strings.ToLower(strings.TrimSpace(filename))
	ext := strings.ToLower(filepath.Ext(lowerName))

	for _, rule := range rules {
		if rule.SubDir == "" {
			continue
		}
		if rule.DomainRegex != "" && rawURL != "" {
			if matched, err := regexp.MatchString(rule.DomainRegex, rawURL); err == nil && matched {
				return joinCategorySubDir(baseDir, rule.SubDir)
			}
		}
		for _, candidate := range rule.Extensions {
			c := strings.ToLower(strings.TrimSpace(candidate))
			if c == "" {
				continue
			}
			if !strings.HasPrefix(c, ".") {
				c = "." + c
			}
			if ext == c || (lowerName != "" && strings.HasSuffix(lowerName, c)) {
				return joinCategorySubDir(baseDir, rule.SubDir)
			}
		}
	}

	// 视频站点 (yt-dlp) 或 HLS 在尚未解析出带扩展名的文件名时，默认归入 Videos（或 audio → Music）
	if taskType == TaskTypeHLS {
		return joinCategorySubDir(baseDir, "Videos")
	}
	if taskType == TaskTypeYtdlp {
		if strings.EqualFold(quality, "audio") {
			return joinCategorySubDir(baseDir, "Music")
		}
		return joinCategorySubDir(baseDir, "Videos")
	}

	return baseDir
}

func joinCategorySubDir(baseDir, subDir string) string {
	if filepath.IsAbs(subDir) {
		return filepath.Clean(subDir)
	}
	return filepath.Join(baseDir, filepath.Clean(subDir))
}

var mediaExtensions = map[string]bool{
	".mp4": true, ".mkv": true, ".avi": true, ".mov": true, ".wmv": true,
	".flv": true, ".webm": true, ".m4v": true, ".ts": true, ".m2ts": true,
	".mpeg": true, ".mpg": true, ".mp3": true, ".flac": true, ".wav": true,
	".aac": true, ".ogg": true, ".m4a": true, ".opus": true, ".wma": true,
}

// highRiskExtensions 无论在什么种子中都属于高危脚本/木马载体
var highRiskExtensions = map[string]bool{
	".scr": true, ".pif": true, ".vbs": true, ".vbe": true,
	".wsf": true, ".wsh": true, ".hta": true, ".cpl": true,
	".lnk": true, ".bat": true, ".cmd": true, ".ps1": true,
	".reg": true, ".com": true, ".msi": false,
}

// HasMediaFilesInPaths 判断文件列表中是否包含音视频媒体文件
func HasMediaFilesInPaths(paths []string) bool {
	for _, p := range paths {
		ext := strings.ToLower(filepath.Ext(strings.TrimSpace(p)))
		if mediaExtensions[ext] {
			return true
		}
	}
	return false
}

// IsSuspiciousTorrentFile 检测 BT 种子中的可疑木马/脚本文件：
//  1. 任何情况下高危脚本/屏保木马扩展名（.scr/.pif/.vbs/.bat/.cmd/.hta/.lnk/.ps1/.reg/.com 等）
//  2. 双重扩展名伪装（如 movie.mp4.exe、photo.jpg.scr、doc.pdf.exe）
//  3. 当种子主体包含音视频媒体文件（hasMediaFiles=true）时，夹带的 .exe/.msi/.dmg/.pkg/.jar/.command 可执行文件
func IsSuspiciousTorrentFile(filePath string, _ int64, hasMediaFiles bool) bool {
	base := strings.ToLower(filepath.Base(strings.TrimSpace(filePath)))
	if base == "" {
		return false
	}
	ext := filepath.Ext(base)
	if highRiskExtensions[ext] {
		return true
	}

	// 检测双重扩展名伪装（例如 video.mp4.exe）
	if ext == ".exe" || ext == ".msi" || ext == ".app" || ext == ".dmg" {
		stem := strings.TrimSuffix(base, ext)
		innerExt := filepath.Ext(stem)
		if mediaExtensions[innerExt] || innerExt == ".pdf" || innerExt == ".jpg" || innerExt == ".png" || innerExt == ".txt" || innerExt == ".doc" || innerExt == ".docx" || innerExt == ".zip" || innerExt == ".rar" {
			return true
		}
	}

	// 媒体种子里夹带可执行安装器（常见“专用播放器/解码器.exe”木马）
	if hasMediaFiles {
		switch ext {
		case ".exe", ".msi", ".jar", ".command", ".sh", ".vbs":
			return true
		}
	}

	return false
}
