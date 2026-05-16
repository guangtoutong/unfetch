package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"unfetch/core/queue"
	"unfetch/core/types"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func NewRouter(mgr *queue.Manager, cfg *types.Config, saveCfg func(*types.Config) error) http.Handler {
	h := NewHandlers(mgr, cfg, saveCfg)

	r := chi.NewRouter()
	r.Use(corsMiddleware)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)

	r.Get("/health", h.Health)
	r.Post("/shutdown", h.Shutdown)

	// SSE 必须在 /tasks/{id} 之前注册，否则 {id} 会匹配 "events"
	r.Get("/tasks/events", h.TasksEvents)

	r.Post("/tasks", h.AddTask)
	r.Get("/tasks", h.ListTasks)

	// 批量接口必须在 /{id} 之前注册
	r.Delete("/tasks/trash", h.EmptyTrash)
	r.Patch("/tasks/trash/restore-all", h.RestoreAllTrashed)

	r.Get("/tasks/{id}", h.GetTask)
	r.Patch("/tasks/{id}/pause", h.PauseTask)
	r.Patch("/tasks/{id}/resume", h.ResumeTask)
	r.Patch("/tasks/{id}/trash", h.TrashTask)
	r.Patch("/tasks/{id}/restore", h.RestoreTask)
	r.Delete("/tasks/{id}", h.DeleteTask)

	r.Get("/config", h.GetConfig)
	r.Patch("/config", h.UpdateConfig)

	r.Get("/system-proxy", h.GetSystemProxy)
	r.Post("/torrent/preview", h.PreviewTorrent)

	return r
}
