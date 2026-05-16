package types

import "time"

type TaskType string

const (
	TaskTypeHTTP  TaskType = "http"
	TaskTypeBT    TaskType = "bt"
	TaskTypeYtdlp TaskType = "ytdlp"
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
	Index    int    `json:"index"`
	Path     string `json:"path"`
	Length   int64  `json:"length"`
	Selected bool   `json:"selected"`
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
	Proxy      string     `json:"proxy,omitempty"`
	Quality    string     `json:"quality,omitempty"` // for ytdlp: best/1080p/720p/480p/audio
	Cookies    string     `json:"cookies,omitempty"` // browser name or cookie file path
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
	// BT 运行时统计（不持久化）
	PeersConnected int `json:"peers_connected,omitempty"`
	PeersTotal     int `json:"peers_total,omitempty"`
	Seeders        int `json:"seeders,omitempty"`
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
	Proxy         string     `json:"proxy,omitempty"`
	Quality       string     `json:"quality,omitempty"`
	Cookies       string     `json:"cookies,omitempty"`
	PlayAfter     bool       `json:"play_after,omitempty"`
	StartAt       *time.Time `json:"start_at,omitempty"`
	Tags          []string   `json:"tags,omitempty"`
	ExpectedSHA256 string    `json:"expected_sha256,omitempty"`
	ExpectedMD5    string    `json:"expected_md5,omitempty"`
	// BT 任务专用：仅下载这些文件下标（空数组 = 全部）
	SelectedFiles []int      `json:"selected_files,omitempty"`
	// BT 任务专用：额外 tracker URL
	CustomTrackers []string  `json:"custom_trackers,omitempty"`
	// 任务模板名（从 Config.TaskTemplates 中查找，覆盖未显式提供的字段）
	Template       string    `json:"template,omitempty"`
}

// SpeedScheduleEntry 分时段限速：在 [StartHour, EndHour) 时段内使用 Limit
type SpeedScheduleEntry struct {
	StartHour int   `json:"start_hour"` // 0-23
	EndHour   int   `json:"end_hour"`   // 1-24
	Limit     int64 `json:"limit"`      // bytes/sec, 0 = 不限
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
	BTForceUTP      bool   `json:"bt_force_utp"` // 强制 uTP（关闭 TCP），绕开 ISP BT 端口屏蔽

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
