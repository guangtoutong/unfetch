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
}
