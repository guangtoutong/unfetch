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

func suiteConfigPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".config", "un-suite", configFile)
}

// loadSuiteDefaults 从 ~/.config/un-suite/config.json 读取共享的默认下载目录与代理
func loadSuiteDefaults() (downloadDir, proxy string) {
	p := suiteConfigPath()
	if p == "" {
		return "", ""
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return "", ""
	}
	var shared struct {
		DownloadDir string `json:"download_dir"`
		Proxy       string `json:"proxy"`
	}
	if err := json.Unmarshal(data, &shared); err != nil {
		return "", ""
	}
	return shared.DownloadDir, shared.Proxy
}

// syncSuiteConfig 将 download_dir 与 proxy 同步写入 ~/.config/un-suite/config.json（保留其他字段）
func syncSuiteConfig(cfg *types.Config) {
	if types.AppStoreEdition || cfg == nil {
		return
	}
	p := suiteConfigPath()
	if p == "" {
		return
	}
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return
	}
	merged := make(map[string]any)
	if existing, err := os.ReadFile(p); err == nil {
		_ = json.Unmarshal(existing, &merged)
	}
	merged["download_dir"] = cfg.DownloadDir
	if cfg.Proxy != "" {
		merged["proxy"] = cfg.Proxy
	} else {
		delete(merged, "proxy")
	}
	if data, err := json.MarshalIndent(merged, "", "  "); err == nil {
		_ = os.WriteFile(p, data, 0644)
	}
}

func loadConfig() (*types.Config, error) {
	dir := configDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create config dir: %w", err)
	}

	path := filepath.Join(dir, configFile)
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		// 创建默认配置（优先继承 ~/.config/un-suite/config.json 的共享配置）
		home, _ := os.UserHomeDir()
		sharedDir, sharedProxy := loadSuiteDefaults()
		if sharedDir == "" {
			sharedDir = filepath.Join(home, "Downloads")
		}
		cfg := &types.Config{
			DownloadDir:   sharedDir,
			Proxy:         sharedProxy,
			MaxConcurrent: 5,
			HTTPThreads:   16,
			SpeedLimit:    0,
			AutoRetry:     true,
			MaxRetries:    5,
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
	sharedDir, sharedProxy := loadSuiteDefaults()
	// 补全零值
	if cfg.MaxConcurrent <= 0 {
		cfg.MaxConcurrent = 5
	}
	if cfg.HTTPThreads <= 0 {
		cfg.HTTPThreads = 16
	}
	if cfg.DownloadDir == "" {
		if sharedDir != "" {
			cfg.DownloadDir = sharedDir
		} else {
			home, _ := os.UserHomeDir()
			cfg.DownloadDir = filepath.Join(home, "Downloads")
		}
	}
	if cfg.Proxy == "" && sharedProxy != "" {
		cfg.Proxy = sharedProxy
	}
	if cfg.MaxRetries <= 0 {
		cfg.MaxRetries = 5
	}
	// 旧配置升级：auto_retry 缺省字段（false）视为未设置 → 默认打开。
	// 这里没法区分"用户显式设了 false"还是"字段不存在"，但默认开重试对绝大多数
	// 用户都更友好；不想要重试可以在设置里关掉。
	if !cfg.AutoRetry {
		// 仅在初次升级时翻转：用一个 sentinel 文件标记已升级过
		marker := filepath.Join(dir, ".retry-default-upgraded")
		if _, err := os.Stat(marker); os.IsNotExist(err) {
			cfg.AutoRetry = true
			_ = saveConfig(&cfg)
			_ = os.WriteFile(marker, []byte("1"), 0644)
			slog.Info("auto_retry defaulted to true for existing config")
		}
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
	if err := os.WriteFile(filepath.Join(dir, configFile), data, 0644); err != nil {
		return err
	}
	syncSuiteConfig(cfg)
	return nil
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

	// 确保下载目录存在（在 macOS App Sandbox 中 ~/Downloads 可能是容器软链，若用户曾选过无权限目录则回退）
	if _, statErr := os.Stat(cfg.DownloadDir); statErr != nil {
		if err := os.MkdirAll(cfg.DownloadDir, 0755); err != nil {
			slog.Warn("failed to create download dir, falling back to ~/Downloads", "err", err, "path", cfg.DownloadDir)
			if home, hErr := os.UserHomeDir(); hErr == nil {
				cfg.DownloadDir = filepath.Join(home, "Downloads")
				_ = os.MkdirAll(cfg.DownloadDir, 0755)
			}
		}
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
