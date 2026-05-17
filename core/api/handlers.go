package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"

	"unfetch/core/downloader"
	"unfetch/core/queue"
	"unfetch/core/types"
)

// videoHostnames 是已知的视频平台域名
var videoHostnames = []string{
	"youtube.com", "youtu.be",
	"bilibili.com",
	"tiktok.com", "douyin.com",
	"twitter.com", "x.com",
	"instagram.com",
	"facebook.com",
	"twitch.tv",
	"vimeo.com",
	"dailymotion.com",
	"nicovideo.jp",
	"weibo.com",
	"ixigua.com",
	"v.qq.com",
}

// detectURLType 根据 URL 判断下载类型
func detectURLType(url string) types.TaskType {
	lower := strings.ToLower(url)

	// BT 判断
	if strings.HasPrefix(lower, "magnet:") {
		return types.TaskTypeBT
	}
	if strings.HasSuffix(lower, ".torrent") {
		return types.TaskTypeBT
	}

	// 视频平台判断
	for _, host := range videoHostnames {
		if strings.Contains(lower, host) {
			return types.TaskTypeYtdlp
		}
	}

	return types.TaskTypeHTTP
}

// sseClient 代表一个 SSE 连接
type sseClient struct {
	ch chan []byte
}

// Handlers 持有所有 HTTP handler 的依赖
type Handlers struct {
	mgr      *queue.Manager
	cfg      *types.Config
	cfgMu    sync.RWMutex
	saveCfg  func(*types.Config) error
	sseMu    sync.Mutex
	sseClients map[string]*sseClient
}

func NewHandlers(mgr *queue.Manager, cfg *types.Config, saveCfg func(*types.Config) error) *Handlers {
	h := &Handlers{
		mgr:        mgr,
		cfg:        cfg,
		saveCfg:    saveCfg,
		sseClients: make(map[string]*sseClient),
	}
	// 订阅任务更新，转发给所有 SSE 客户端
	go h.broadcastLoop()
	return h
}

func (h *Handlers) broadcastLoop() {
	ch := h.mgr.Subscribe()
	for task := range ch {
		data, err := json.Marshal(task)
		if err != nil {
			slog.Error("sse marshal error", "err", err)
			continue
		}
		msg := append([]byte("data: "), data...)
		msg = append(msg, '\n', '\n')

		h.sseMu.Lock()
		for _, c := range h.sseClients {
			select {
			case c.ch <- msg:
			default:
				// 客户端消费太慢，丢弃该消息
			}
		}
		h.sseMu.Unlock()
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("write json error", "err", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// Health GET /health
func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}

// Shutdown POST /shutdown — 优雅关闭 daemon：先保存任务状态再退出进程
func (h *Handlers) Shutdown(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "shutting down"})
	go func() {
		// 让响应先返回客户端
		time.Sleep(150 * time.Millisecond)
		slog.Info("shutdown requested via API")
		h.mgr.Shutdown()
		os.Exit(0)
	}()
}

// AddTask POST /tasks
func (h *Handlers) AddTask(w http.ResponseWriter, r *http.Request) {
	var req types.AddTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
		return
	}
	if req.URL == "" {
		writeError(w, http.StatusBadRequest, "url is required")
		return
	}

	h.cfgMu.RLock()
	cfg := h.cfg
	h.cfgMu.RUnlock()

	// 解析任务模板：仅补全用户未显式提供的字段
	if req.Template != "" {
		for _, t := range cfg.TaskTemplates {
			if t.Name == req.Template {
				if req.Cookies == "" {
					req.Cookies = t.Cookies
				}
				// User-Agent 和 Headers 透传给 downloader（依赖下载器实现）；先合并到 Cookies 行内是不合适的
				// 此处仅做 Cookies 合并，UA/Headers 暂未在下载器中接入，留待后续扩展
				_ = t.UserAgent
				_ = t.Headers
				break
			}
		}
	}

	taskType := detectURLType(req.URL)

	saveDir := req.SaveDir
	if saveDir == "" {
		saveDir = cfg.DownloadDir
	}

	threads := req.Threads
	if threads <= 0 {
		threads = cfg.HTTPThreads
	}

	quality := req.Quality
	if quality == "" && taskType == types.TaskTypeYtdlp {
		quality = "best"
	}

	filename := req.Filename
	if filename == "" && taskType == types.TaskTypeHTTP {
		// 从 URL 中推断文件名
		parts := strings.Split(strings.Split(req.URL, "?")[0], "/")
		if len(parts) > 0 {
			filename = parts[len(parts)-1]
		}
		if filename == "" {
			filename = "download"
		}
	}

	task, err := h.mgr.AddTask(types.AddTaskRequest{
		URL:            req.URL,
		SaveDir:        saveDir,
		Filename:       filename,
		Threads:        threads,
		Proxy:          req.Proxy,
		Quality:        quality,
		Cookies:        req.Cookies,
		PlayAfter:      req.PlayAfter,
		StartAt:        req.StartAt,
		Tags:           req.Tags,
		ExpectedSHA256: req.ExpectedSHA256,
		ExpectedMD5:    req.ExpectedMD5,
		SelectedFiles:  req.SelectedFiles,
		CustomTrackers: req.CustomTrackers,
		Mirrors:        req.Mirrors,
		DependsOn:      req.DependsOn,
	}, taskType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("add task failed: %v", err))
		return
	}

	slog.Info("task added", "id", task.ID, "url", task.URL, "type", task.Type)
	writeJSON(w, http.StatusCreated, task)
}

// ListTasks GET /tasks
func (h *Handlers) ListTasks(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")

	tasks := h.mgr.ListTasks()
	if statusFilter != "" {
		filtered := make([]*types.Task, 0, len(tasks))
		for _, t := range tasks {
			if string(t.Status) == statusFilter {
				filtered = append(filtered, t)
			}
		}
		tasks = filtered
	}

	writeJSON(w, http.StatusOK, tasks)
}

// GetTask GET /tasks/{id}
func (h *Handlers) GetTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	task, err := h.mgr.GetTask(id)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("task not found: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, task)
}

// PauseTask PATCH /tasks/{id}/pause
func (h *Handlers) PauseTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.mgr.PauseTask(id); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("pause failed: %v", err))
		return
	}
	task, _ := h.mgr.GetTask(id)
	writeJSON(w, http.StatusOK, task)
}

// ResumeTask PATCH /tasks/{id}/resume
func (h *Handlers) ResumeTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.mgr.ResumeTask(id); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("resume failed: %v", err))
		return
	}
	task, _ := h.mgr.GetTask(id)
	writeJSON(w, http.StatusOK, task)
}

// DeleteTask DELETE /tasks/{id}
func (h *Handlers) DeleteTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	deleteFile := r.URL.Query().Get("delete_file") == "true"

	task, err := h.mgr.GetTask(id)
	if err != nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("task not found: %v", err))
		return
	}

	if err := h.mgr.RemoveTask(id); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("remove task failed: %v", err))
		return
	}

	if deleteFile && task.SavePath != "" && task.Filename != "" {
		filePath := filepath.Join(task.SavePath, task.Filename)
		if err := removeFileIfExists(filePath); err != nil {
			slog.Warn("failed to delete file", "path", filePath, "err", err)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// EmptyTrash DELETE /tasks/trash — 彻底删除所有垃圾桶任务（含文件）
func (h *Handlers) EmptyTrash(w http.ResponseWriter, r *http.Request) {
	trashed := h.mgr.ListTrashed()
	var deleted int
	for _, t := range trashed {
		if err := h.mgr.RemoveTask(t.ID); err != nil {
			slog.Warn("empty trash: remove", "id", t.ID, "err", err)
			continue
		}
		if t.SavePath != "" && t.Filename != "" {
			filePath := filepath.Join(t.SavePath, t.Filename)
			if err := removeFileIfExists(filePath); err != nil {
				slog.Warn("empty trash: delete file", "path", filePath, "err", err)
			}
		}
		deleted++
	}
	writeJSON(w, http.StatusOK, map[string]int{"deleted": deleted})
}

// RestoreAllTrashed PATCH /tasks/trash/restore-all
func (h *Handlers) RestoreAllTrashed(w http.ResponseWriter, r *http.Request) {
	trashed := h.mgr.ListTrashed()
	var restored int
	for _, t := range trashed {
		if err := h.mgr.RestoreTask(t.ID); err == nil {
			restored++
		}
	}
	writeJSON(w, http.StatusOK, map[string]int{"restored": restored})
}

// TrashTask PATCH /tasks/{id}/trash
func (h *Handlers) TrashTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.mgr.TrashTask(id); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("trash failed: %v", err))
		return
	}
	task, _ := h.mgr.GetTask(id)
	writeJSON(w, http.StatusOK, task)
}

// RestoreTask PATCH /tasks/{id}/restore
func (h *Handlers) RestoreTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.mgr.RestoreTask(id); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("restore failed: %v", err))
		return
	}
	task, _ := h.mgr.GetTask(id)
	writeJSON(w, http.StatusOK, task)
}

// GetConfig GET /config
func (h *Handlers) GetConfig(w http.ResponseWriter, r *http.Request) {
	h.cfgMu.RLock()
	cfg := h.cfg
	h.cfgMu.RUnlock()
	writeJSON(w, http.StatusOK, cfg)
}

// UpdateConfig PATCH /config
func (h *Handlers) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	h.cfgMu.Lock()
	defer h.cfgMu.Unlock()

	// JSON merge patch：先 marshal 现有配置，再用请求 body 覆盖
	existing, err := json.Marshal(h.cfg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "marshal config failed")
		return
	}

	var merged map[string]any
	if err := json.Unmarshal(existing, &merged); err != nil {
		writeError(w, http.StatusInternalServerError, "unmarshal config failed")
		return
	}

	var patch map[string]any
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid request body: %v", err))
		return
	}
	for k, v := range patch {
		merged[k] = v
	}

	mergedBytes, err := json.Marshal(merged)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "marshal merged config failed")
		return
	}

	var newCfg types.Config
	if err := json.Unmarshal(mergedBytes, &newCfg); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid config: %v", err))
		return
	}

	if newCfg.MaxConcurrent <= 0 {
		newCfg.MaxConcurrent = 5
	}
	if newCfg.HTTPThreads <= 0 {
		newCfg.HTTPThreads = 16
	}

	h.cfg = &newCfg
	h.mgr.UpdateConfig(&newCfg)

	if err := h.saveCfg(&newCfg); err != nil {
		slog.Warn("failed to save config", "err", err)
	}

	writeJSON(w, http.StatusOK, h.cfg)
}

// TasksEvents GET /tasks/events  (SSE)
func (h *Handlers) TasksEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	clientID := fmt.Sprintf("%d", time.Now().UnixNano())
	client := &sseClient{
		ch: make(chan []byte, 64),
	}

	h.sseMu.Lock()
	h.sseClients[clientID] = client
	h.sseMu.Unlock()

	defer func() {
		h.sseMu.Lock()
		delete(h.sseClients, clientID)
		h.sseMu.Unlock()
	}()

	// 先推送一次当前所有任务快照
	tasks := h.mgr.ListTasks()
	for _, t := range tasks {
		data, err := json.Marshal(t)
		if err != nil {
			continue
		}
		fmt.Fprintf(w, "data: %s\n\n", data)
	}
	flusher.Flush()

	// 发送心跳注释保活
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case msg := <-client.ch:
			if _, err := w.Write(msg); err != nil {
				return
			}
			flusher.Flush()
		case <-ticker.C:
			if _, err := fmt.Fprintf(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

// PreviewTorrent POST /torrent/preview
// body: { url: "magnet:..." 或 .torrent URL/路径 }
// 返回 TorrentPreview，让前端选完文件后再走 POST /tasks
func (h *Handlers) PreviewTorrent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid body: %v", err))
		return
	}
	if req.URL == "" {
		writeError(w, http.StatusBadRequest, "url is required")
		return
	}

	h.cfgMu.RLock()
	cfg := h.cfg
	h.cfgMu.RUnlock()

	ctx, cancel := context.WithTimeout(r.Context(), 100*time.Second)
	defer cancel()
	preview, err := downloader.PreviewTorrent(ctx, req.URL, cfg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("preview failed: %v", err))
		return
	}
	writeJSON(w, http.StatusOK, preview)
}

// GetSystemProxy GET /system-proxy
func (h *Handlers) GetSystemProxy(w http.ResponseWriter, r *http.Request) {
	proxy := downloader.ReadSystemProxy()
	writeJSON(w, http.StatusOK, map[string]any{
		"proxy":   proxy,
		"enabled": proxy != "",
	})
}

func removeFileIfExists(path string) error {
	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return os.Remove(path)
}
