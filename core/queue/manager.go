package queue

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"

	"unfetch/core/downloader"
	"unfetch/core/hooks"
	"unfetch/core/types"
)

// Manager 管理所有下载任务
type Manager struct {
	mu          sync.RWMutex
	tasks       map[string]*types.Task
	cancels     map[string]context.CancelFunc
	cfg         *types.Config
	cfgMu       sync.RWMutex
	store       *Store
	eventCh     chan *types.Task  // 任务更新广播
	subscribers []chan *types.Task
	subMu       sync.Mutex
	semaphore   chan struct{}      // 并发控制
	saveCfg     func(*types.Config) error

	// 下载器
	httpDL  *downloader.HTTPDownloader
	btDL    *downloader.BTDownloader
	ytdlpDL *downloader.YtdlpDownloader
}

// NewManager 创建 Manager，从数据库恢复历史任务
func NewManager(cfg *types.Config, saveCfg func(*types.Config) error) (*Manager, error) {
	store, err := NewStore()
	if err != nil {
		return nil, fmt.Errorf("init store: %w", err)
	}

	m := &Manager{
		tasks:     make(map[string]*types.Task),
		cancels:   make(map[string]context.CancelFunc),
		cfg:       cfg,
		store:     store,
		eventCh:   make(chan *types.Task, 256),
		semaphore: make(chan struct{}, max(1, cfg.MaxConcurrent)),
		saveCfg:   saveCfg,
		httpDL:    downloader.NewHTTPDownloader(cfg),
		btDL:      downloader.NewBTDownloader(cfg),
		ytdlpDL:   downloader.NewYtdlpDownloader(cfg),
	}

	// 从数据库恢复任务
	saved, err := store.LoadActiveTasks()
	if err != nil {
		slog.Warn("failed to load tasks from db", "err", err)
	} else {
		for _, t := range saved {
			m.tasks[t.ID] = t
			slog.Info("restored task", "id", t.ID, "status", t.Status, "url", t.URL)
		}
	}

	// 启动事件广播 goroutine
	go m.broadcastEvents()

	// 启动速度计算 goroutine
	go m.speedTicker()

	// 启动分时段限速 goroutine
	go m.speedScheduleTicker()

	// 恢复 queued 状态的任务（自动开始下载）
	for _, t := range saved {
		if t.Status == types.StatusQueued {
			go m.startDownload(t)
		}
	}

	return m, nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Subscribe 返回一个接收任务更新的 channel
func (m *Manager) Subscribe() <-chan *types.Task {
	ch := make(chan *types.Task, 128)
	m.subMu.Lock()
	m.subscribers = append(m.subscribers, ch)
	m.subMu.Unlock()
	return ch
}

func (m *Manager) broadcastEvents() {
	for task := range m.eventCh {
		m.subMu.Lock()
		for _, ch := range m.subscribers {
			select {
			case ch <- task:
			default:
			}
		}
		m.subMu.Unlock()
	}
}

// notify 发送任务状态变更通知
func (m *Manager) notify(task *types.Task) {
	// 复制一份，避免并发修改
	cp := *task
	select {
	case m.eventCh <- &cp:
	default:
	}
}

// AddTask 添加新任务并入队
func (m *Manager) AddTask(req types.AddTaskRequest, taskType types.TaskType) (*types.Task, error) {
	m.cfgMu.RLock()
	cfg := m.cfg
	m.cfgMu.RUnlock()

	saveDir := req.SaveDir
	if saveDir == "" {
		saveDir = cfg.DownloadDir
	}
	if err := os.MkdirAll(saveDir, 0755); err != nil {
		return nil, fmt.Errorf("create save dir: %w", err)
	}

	threads := req.Threads
	if threads <= 0 {
		threads = cfg.HTTPThreads
	}

	filename := req.Filename
	// BT/ytdlp 的 filename 由下载器填充
	if filename == "" {
		filename = "unknown"
	}

	task := &types.Task{
		ID:        uuid.New().String(),
		URL:       req.URL,
		Filename:  filename,
		SavePath:  saveDir,
		Type:      taskType,
		Status:    types.StatusQueued,
		ETA:       -1,
		Threads:   threads,
		Proxy:     req.Proxy,
		Quality:   req.Quality,
		Cookies:   req.Cookies,
		PlayAfter: req.PlayAfter,
		StartAt:   req.StartAt,
		Tags:      req.Tags,
		ExpectedSHA256: req.ExpectedSHA256,
		ExpectedMD5:    req.ExpectedMD5,
		SelectedFiles:  req.SelectedFiles,
		CustomTrackers: req.CustomTrackers,
		CreatedAt: time.Now(),
	}

	m.mu.Lock()
	m.tasks[task.ID] = task
	m.mu.Unlock()

	if err := m.store.SaveTask(task); err != nil {
		slog.Warn("failed to persist task", "id", task.ID, "err", err)
	}

	m.notify(task)

	// 异步启动下载（通过信号量控制并发）
	go m.startDownload(task)

	return task, nil
}

// startDownload 在信号量控制下启动下载
func (m *Manager) startDownload(task *types.Task) {
	// 等待信号量（控制并发数）
	m.semaphore <- struct{}{}
	defer func() { <-m.semaphore }()

	// 定时下载：未到 StartAt 之前一直等
	if task.StartAt != nil {
		for {
			delay := time.Until(*task.StartAt)
			if delay <= 0 {
				break
			}
			// 限定单次最多等 60s，便于检查状态
			if delay > 60*time.Second {
				delay = 60 * time.Second
			}
			time.Sleep(delay)
			// 检查任务是否还存在且未被暂停/垃圾箱
			m.mu.RLock()
			cur, ok := m.tasks[task.ID]
			m.mu.RUnlock()
			if !ok || cur.Trashed || cur.Status == types.StatusPaused {
				return
			}
		}
	}

	// 检查任务是否仍然有效且处于可下载状态
	m.mu.Lock()
	current, ok := m.tasks[task.ID]
	if !ok || current.Trashed || (current.Status != types.StatusQueued && current.Status != types.StatusDownloading) {
		m.mu.Unlock()
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.cancels[task.ID] = cancel
	current.Status = types.StatusDownloading
	m.mu.Unlock()

	if err := m.store.SaveTask(current); err != nil {
		slog.Warn("save task status", "id", task.ID, "err", err)
	}
	m.notify(current)

	// 选择下载器
	var dlErr error
	switch current.Type {
	case types.TaskTypeHTTP:
		m.cfgMu.RLock()
		m.httpDL.UpdateConfig(m.cfg)
		m.cfgMu.RUnlock()
		dlErr = m.httpDL.Download(ctx, current, func() {
			m.notify(current)
		})
	case types.TaskTypeBT:
		m.cfgMu.RLock()
		m.btDL.UpdateConfig(m.cfg)
		m.cfgMu.RUnlock()
		dlErr = m.btDL.Download(ctx, current, func() {
			m.notify(current)
		})
	case types.TaskTypeYtdlp:
		m.cfgMu.RLock()
		m.ytdlpDL.UpdateConfig(m.cfg)
		m.cfgMu.RUnlock()
		dlErr = m.ytdlpDL.Download(ctx, current, func() {
			m.notify(current)
		})
	default:
		dlErr = fmt.Errorf("unknown task type: %s", current.Type)
	}

	m.mu.Lock()
	// 再次检查：可能在下载过程中被删除或暂停
	current, ok = m.tasks[task.ID]
	if !ok {
		m.mu.Unlock()
		return
	}
	delete(m.cancels, task.ID)

	shouldAutoRetry := false
	if ctx.Err() != nil {
		// 被取消（pause 或 remove）
		if current.Status == types.StatusDownloading {
			current.Status = types.StatusPaused
		}
	} else if dlErr != nil {
		current.Status = types.StatusError
		current.Error = dlErr.Error()
		slog.Error("download error", "id", task.ID, "err", dlErr)

		m.cfgMu.RLock()
		auto := m.cfg.AutoRetry
		maxR := m.cfg.MaxRetries
		m.cfgMu.RUnlock()
		if maxR <= 0 {
			maxR = 3
		}
		if auto && current.RetryCount < maxR {
			shouldAutoRetry = true
			current.RetryCount++
		}
	} else {
		current.Status = types.StatusDone
		now := time.Now()
		current.FinishedAt = &now
		current.Speed = 0
		current.ETA = 0
		slog.Info("download done", "id", task.ID, "file", filepath.Join(current.SavePath, current.Filename))

		if current.PlayAfter && current.Filename != "" {
			go openFile(filepath.Join(current.SavePath, current.Filename))
		}

		// 触发完成钩子（webhook + exec）
		m.cfgMu.RLock()
		hookCfg := *m.cfg
		m.cfgMu.RUnlock()
		hooks.FireCompletion(current, &hookCfg)
	}
	m.mu.Unlock()

	if err := m.store.SaveTask(current); err != nil {
		slog.Warn("save task after download", "id", task.ID, "err", err)
	}
	m.notify(current)

	// 自动重试：按退避策略延迟后重新入队
	if shouldAutoRetry {
		go func(t *types.Task) {
			backoff := []time.Duration{60 * time.Second, 3 * time.Minute, 10 * time.Minute}
			idx := t.RetryCount - 1
			if idx >= len(backoff) {
				idx = len(backoff) - 1
			}
			if idx < 0 {
				idx = 0
			}
			slog.Info("auto retry scheduled", "id", t.ID, "in", backoff[idx], "attempt", t.RetryCount)
			time.Sleep(backoff[idx])
			m.mu.Lock()
			c, ok := m.tasks[t.ID]
			if !ok || c.Trashed {
				m.mu.Unlock()
				return
			}
			c.Status = types.StatusQueued
			c.Error = ""
			m.mu.Unlock()
			_ = m.store.SaveTask(c)
			m.notify(c)
			go m.startDownload(c)
		}(current)
	}

	// 触发 on_all_done 检查
	go m.checkAllDone()
}

// checkAllDone 检查是否所有非垃圾桶任务都完成了，若是则执行 OnAllDone 动作
func (m *Manager) checkAllDone() {
	m.cfgMu.RLock()
	action := m.cfg.OnAllDone
	m.cfgMu.RUnlock()
	if action == "" || action == types.OnDoneNone {
		return
	}

	m.mu.RLock()
	allDone := true
	var anyTask bool
	for _, t := range m.tasks {
		if t.Trashed {
			continue
		}
		anyTask = true
		if t.Status != types.StatusDone {
			allDone = false
			break
		}
	}
	m.mu.RUnlock()
	if !anyTask || !allDone {
		return
	}

	// 防止重复触发：每次触发后清空 OnAllDone
	m.cfgMu.Lock()
	if m.cfg.OnAllDone != action {
		// 已被改了
		m.cfgMu.Unlock()
		return
	}
	m.cfg.OnAllDone = types.OnDoneNone
	cfgCopy := *m.cfg
	m.cfgMu.Unlock()
	if m.saveCfg != nil {
		_ = m.saveCfg(&cfgCopy)
	}

	slog.Info("all tasks done, triggering action", "action", action)
	go executeAllDoneAction(action)
}

// PauseTask 暂停一个正在下载的任务
func (m *Manager) PauseTask(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	task, ok := m.tasks[id]
	if !ok {
		return fmt.Errorf("task %s not found", id)
	}
	if task.Status != types.StatusDownloading && task.Status != types.StatusQueued {
		return fmt.Errorf("task %s is not running (status: %s)", id, task.Status)
	}

	// 取消 context 停止下载
	if cancel, ok := m.cancels[id]; ok {
		cancel()
		delete(m.cancels, id)
	}

	task.Status = types.StatusPaused
	task.Speed = 0
	task.ETA = -1

	if err := m.store.SaveTask(task); err != nil {
		slog.Warn("save paused task", "id", id, "err", err)
	}
	m.notify(task)
	return nil
}

// ResumeTask 恢复一个暂停的任务
func (m *Manager) ResumeTask(id string) error {
	m.mu.Lock()
	task, ok := m.tasks[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("task %s not found", id)
	}
	if task.Status != types.StatusPaused && task.Status != types.StatusError {
		m.mu.Unlock()
		return fmt.Errorf("task %s is not paused (status: %s)", id, task.Status)
	}
	task.Status = types.StatusQueued
	task.Error = ""
	m.mu.Unlock()

	if err := m.store.SaveTask(task); err != nil {
		slog.Warn("save resumed task", "id", id, "err", err)
	}
	m.notify(task)

	go m.startDownload(task)
	return nil
}

// RemoveTask 删除任务（先停止下载）
func (m *Manager) RemoveTask(id string) error {
	m.mu.Lock()
	task, ok := m.tasks[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("task %s not found", id)
	}

	// 停止下载
	if cancel, ok := m.cancels[id]; ok {
		cancel()
		delete(m.cancels, id)
	}

	delete(m.tasks, id)
	m.mu.Unlock()

	_ = task // 保留引用避免 GC

	if err := m.store.DeleteTask(id); err != nil {
		slog.Warn("delete task from db", "id", id, "err", err)
	}
	return nil
}

// TrashTask 将任务移入垃圾桶（不删除文件，不删除记录）
func (m *Manager) TrashTask(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	task, ok := m.tasks[id]
	if !ok {
		return fmt.Errorf("task %s not found", id)
	}

	// 停止正在下载的任务
	if cancel, ok := m.cancels[id]; ok {
		cancel()
		delete(m.cancels, id)
	}

	task.Trashed = true
	task.Speed = 0
	task.ETA = -1
	if task.Status == types.StatusDownloading || task.Status == types.StatusQueued {
		task.Status = types.StatusPaused
	}

	if err := m.store.SaveTask(task); err != nil {
		slog.Warn("save trashed task", "id", id, "err", err)
	}
	m.notify(task)
	return nil
}

// RestoreTask 从垃圾桶恢复任务
func (m *Manager) RestoreTask(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	task, ok := m.tasks[id]
	if !ok {
		return fmt.Errorf("task %s not found", id)
	}
	if !task.Trashed {
		return fmt.Errorf("task %s is not in trash", id)
	}

	task.Trashed = false

	if err := m.store.SaveTask(task); err != nil {
		slog.Warn("save restored task", "id", id, "err", err)
	}
	m.notify(task)
	return nil
}

// ListTrashed 返回所有垃圾桶任务（拷贝）
func (m *Manager) ListTrashed() []*types.Task {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*types.Task
	for _, t := range m.tasks {
		if t.Trashed {
			cp := *t
			result = append(result, &cp)
		}
	}
	return result
}

// GetTask 获取单个任务
func (m *Manager) GetTask(id string) (*types.Task, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	task, ok := m.tasks[id]
	if !ok {
		return nil, fmt.Errorf("task %s not found", id)
	}
	cp := *task
	return &cp, nil
}

// ListTasks 返回所有任务（按创建时间升序）
func (m *Manager) ListTasks() []*types.Task {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*types.Task, 0, len(m.tasks))
	for _, t := range m.tasks {
		cp := *t
		result = append(result, &cp)
	}

	// 按创建时间排序
	for i := 1; i < len(result); i++ {
		for j := i; j > 0 && result[j].CreatedAt.Before(result[j-1].CreatedAt); j-- {
			result[j], result[j-1] = result[j-1], result[j]
		}
	}
	return result
}

// UpdateConfig 更新配置（动态调整并发数）
func (m *Manager) UpdateConfig(cfg *types.Config) {
	m.cfgMu.Lock()
	m.cfg = cfg
	m.httpDL.UpdateConfig(cfg)
	m.btDL.UpdateConfig(cfg)
	m.ytdlpDL.UpdateConfig(cfg)
	m.cfgMu.Unlock()

	// 重建信号量（调整并发数）
	newCap := max(1, cfg.MaxConcurrent)
	newSem := make(chan struct{}, newCap)
	// 尽量迁移现有占用（简单处理：新 semaphore 会自然生效）
	_ = newSem
	// 注：运行中的 goroutine 仍持有旧 semaphore 的 slot，
	// 新请求会使用新 semaphore。此处采用简单替换，不做精确迁移。
	m.semaphore = newSem
}

// speedTicker 每秒更新一次运行中任务的速度和 ETA
func (m *Manager) speedTicker() {
	type snapshot struct {
		bytes int64
		ts    time.Time
	}
	// 每个任务的历史快照（用于滑动窗口计算速度）
	history := make(map[string][]snapshot)
	const windowSec = 3

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()

		m.mu.Lock()
		for id, task := range m.tasks {
			if task.Status != types.StatusDownloading {
				delete(history, id)
				continue
			}

			done := atomic.LoadInt64(&task.DoneBytes)
			hist := history[id]
			hist = append(hist, snapshot{done, now})

			// 保留最近 windowSec+1 个快照
			cutoff := now.Add(-time.Duration(windowSec) * time.Second)
			for len(hist) > 1 && hist[0].ts.Before(cutoff) {
				hist = hist[1:]
			}
			history[id] = hist

			// 计算速度
			if len(hist) >= 2 {
				oldest := hist[0]
				dt := now.Sub(oldest.ts).Seconds()
				if dt > 0 {
					task.Speed = int64(float64(done-oldest.bytes) / dt)
					if task.Speed < 0 {
						task.Speed = 0
					}
				}
			}

			// 计算 ETA
			total := atomic.LoadInt64(&task.TotalBytes)
			remaining := total - done
			if task.Speed > 0 && remaining > 0 {
				task.ETA = int(remaining / task.Speed)
			} else if total == 0 {
				task.ETA = -1
			} else {
				task.ETA = -1
			}

			// 推送进度更新
			cp := *task
			select {
			case m.eventCh <- &cp:
			default:
			}
		}
		m.mu.Unlock()
	}
}

// speedScheduleTicker 每分钟根据当前小时应用对应限速
func (m *Manager) speedScheduleTicker() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		m.applyScheduledSpeedLimit()
		<-ticker.C
	}
}

func (m *Manager) applyScheduledSpeedLimit() {
	m.cfgMu.RLock()
	schedule := m.cfg.SpeedSchedule
	base := m.cfg.SpeedLimit
	m.cfgMu.RUnlock()

	if len(schedule) == 0 {
		return // 没有调度，保持原值
	}

	hour := time.Now().Hour()
	var matched *int64
	for i := range schedule {
		e := schedule[i]
		// 支持跨夜（end 小于 start）
		if e.StartHour <= e.EndHour {
			if hour >= e.StartHour && hour < e.EndHour {
				lim := e.Limit
				matched = &lim
				break
			}
		} else {
			if hour >= e.StartHour || hour < e.EndHour {
				lim := e.Limit
				matched = &lim
				break
			}
		}
	}

	target := base
	if matched != nil {
		target = *matched
	}

	m.cfgMu.Lock()
	if m.cfg.SpeedLimit != target {
		m.cfg.SpeedLimit = target
		cfgCopy := *m.cfg
		m.httpDL.UpdateConfig(&cfgCopy)
		m.btDL.UpdateConfig(&cfgCopy)
		m.ytdlpDL.UpdateConfig(&cfgCopy)
		m.cfgMu.Unlock()
		slog.Info("speed limit applied by schedule", "hour", hour, "limit", target)
	} else {
		m.cfgMu.Unlock()
	}
}

// executeAllDoneAction 执行"所有任务完成后"的系统动作
func executeAllDoneAction(action types.OnAllDoneAction) {
	switch action {
	case types.OnDoneShutdown:
		switch runtime.GOOS {
		case "windows":
			_ = exec.Command("shutdown", "/s", "/t", "30", "/c", "unfetch: 所有下载已完成，30 秒后关机").Start()
		case "linux":
			_ = exec.Command("shutdown", "-h", "+1").Start()
		case "darwin":
			_ = exec.Command("osascript", "-e", `tell application "System Events" to shut down`).Start()
		}
	case types.OnDoneSleep:
		switch runtime.GOOS {
		case "windows":
			_ = exec.Command("rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0").Start()
		case "linux":
			_ = exec.Command("systemctl", "suspend").Start()
		case "darwin":
			_ = exec.Command("pmset", "sleepnow").Start()
		}
	case types.OnDoneOpenDir:
		// 由调用方处理：daemon 不知道具体目录，可以传当前下载目录
		// 这里不实现
	}
	// OnDoneNotify 由前端处理
}

// Shutdown 优雅关闭：取消所有正在进行的下载
func (m *Manager) Shutdown() {
	m.mu.Lock()
	for id, cancel := range m.cancels {
		slog.Info("cancelling task on shutdown", "id", id)
		cancel()
	}
	m.mu.Unlock()

	// 保存所有任务状态
	m.mu.RLock()
	for _, task := range m.tasks {
		if task.Status == types.StatusDownloading {
			task.Status = types.StatusPaused
		}
		if err := m.store.SaveTask(task); err != nil {
			slog.Warn("save task on shutdown", "id", task.ID, "err", err)
		}
	}
	m.mu.RUnlock()

	if err := m.store.Close(); err != nil {
		slog.Warn("close store", "err", err)
	}
	close(m.eventCh)
}
