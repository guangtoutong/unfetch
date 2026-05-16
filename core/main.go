package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"unfetch/core/api"
	"unfetch/core/queue"
	"unfetch/core/rss"
	"unfetch/core/types"
)

const (
	defaultPort = 19543
	configFile  = "config.json"
)

func listenAddr(cfg *types.Config) string {
	if cfg.RemoteEnabled {
		return fmt.Sprintf("0.0.0.0:%d", defaultPort)
	}
	return fmt.Sprintf("127.0.0.1:%d", defaultPort)
}

func configDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return filepath.Join(home, ".config", "unfetch")
}

func loadConfig() (*types.Config, error) {
	dir := configDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create config dir: %w", err)
	}

	path := filepath.Join(dir, configFile)
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		// 创建默认配置
		home, _ := os.UserHomeDir()
		cfg := &types.Config{
			DownloadDir:   filepath.Join(home, "Downloads"),
			MaxConcurrent: 5,
			HTTPThreads:   16,
			SpeedLimit:    0,
		}
		if err := saveConfig(cfg); err != nil {
			slog.Warn("failed to save default config", "err", err)
		}
		return cfg, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg types.Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	// 补全零值
	if cfg.MaxConcurrent <= 0 {
		cfg.MaxConcurrent = 5
	}
	if cfg.HTTPThreads <= 0 {
		cfg.HTTPThreads = 16
	}
	if cfg.DownloadDir == "" {
		home, _ := os.UserHomeDir()
		cfg.DownloadDir = filepath.Join(home, "Downloads")
	}
	return &cfg, nil
}

func saveConfig(cfg *types.Config) error {
	dir := configDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	return os.WriteFile(filepath.Join(dir, configFile), data, 0644)
}

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})))

	slog.Info("unfetch daemon starting")

	cfg, err := loadConfig()
	if err != nil {
		slog.Error("failed to load config", "err", err)
		os.Exit(1)
	}
	addr := listenAddr(cfg)
	slog.Info("config loaded",
		"download_dir", cfg.DownloadDir,
		"max_concurrent", cfg.MaxConcurrent,
		"remote_enabled", cfg.RemoteEnabled,
		"addr", addr,
	)
	if cfg.RemoteEnabled && cfg.RemoteToken == "" {
		slog.Error("remote_enabled=true 但 remote_token 为空，拒绝启动（远程模式必须设 token）")
		os.Exit(1)
	}

	// 确保下载目录存在
	if err := os.MkdirAll(cfg.DownloadDir, 0755); err != nil {
		slog.Error("failed to create download dir", "err", err, "path", cfg.DownloadDir)
		os.Exit(1)
	}

	mgr, err := queue.NewManager(cfg, saveConfig)
	if err != nil {
		slog.Error("failed to create queue manager", "err", err)
		os.Exit(1)
	}

	router := api.NewRouter(mgr, cfg, saveConfig)

	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0, // SSE 需要长连接，不设超时
		IdleTimeout:  120 * time.Second,
	}

	// 启动 RSS poller
	rssCtx, rssCancel := context.WithCancel(context.Background())
	defer rssCancel()
	rssPoller := rss.NewPoller(mgr, func() *types.Config { return cfg })
	rssPoller.Start(rssCtx)

	// 启动 HTTP 服务
	go func() {
		slog.Info("HTTP server listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "err", err)
			os.Exit(1)
		}
	}()

	// 等待退出信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	slog.Info("shutdown signal received", "signal", sig)

	// 优雅关闭
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("HTTP server shutdown error", "err", err)
	}

	mgr.Shutdown()
	slog.Info("unfetch daemon stopped")
}
