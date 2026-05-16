package hooks

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"unfetch/core/types"
)

// FireCompletion 任务完成时调用，异步触发 webhook 和 exec
func FireCompletion(task *types.Task, cfg *types.Config) {
	if cfg.OnCompleteWebhook != "" {
		go fireWebhook(task, cfg.OnCompleteWebhook)
	}
	if cfg.OnCompleteExec != "" {
		go fireExec(task, cfg.OnCompleteExec)
	}
}

func fireWebhook(task *types.Task, url string) {
	payload := map[string]any{
		"id":          task.ID,
		"filename":    task.Filename,
		"save_path":   task.SavePath,
		"url":         task.URL,
		"total_bytes": task.TotalBytes,
		"type":        string(task.Type),
		"finished_at": task.FinishedAt,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		slog.Warn("webhook build req", "err", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "unfetch-hook/1.0")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Warn("webhook post failed", "url", url, "err", err)
		return
	}
	defer resp.Body.Close()
	slog.Info("webhook fired", "url", url, "status", resp.StatusCode, "task", task.ID)
}

func fireExec(task *types.Task, tmpl string) {
	// 占位替换：{id} {filename} {save_path} {url}
	fullPath := filepath.Join(task.SavePath, task.Filename)
	r := strings.NewReplacer(
		"{id}", task.ID,
		"{filename}", task.Filename,
		"{save_path}", task.SavePath,
		"{full_path}", fullPath,
		"{url}", task.URL,
	)
	cmdLine := r.Replace(tmpl)

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd", "/C", cmdLine)
	} else {
		cmd = exec.Command("sh", "-c", cmdLine)
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		slog.Warn("exec hook failed", "cmd", cmdLine, "err", err, "out", string(out))
		return
	}
	slog.Info("exec hook fired", "cmd", cmdLine, "task", task.ID)
}
