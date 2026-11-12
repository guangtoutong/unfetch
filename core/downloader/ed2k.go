//go:build !masbuild

package downloader

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"unfetch/core/types"
)

// Ed2kInfo 解析后的 ed2k 链接元信息
type Ed2kInfo struct {
	Filename   string
	Size       int64
	Hash       string
	WebSources []string
}

// ParseEd2kURL 解析标准 ed2k://|file|<name>|<size>|<hash>|.../ 链接
func ParseEd2kURL(raw string) (*Ed2kInfo, error) {
	trimmed := strings.TrimSpace(raw)
	if !strings.HasPrefix(strings.ToLower(trimmed), "ed2k://") {
		return nil, fmt.Errorf("not an ed2k URL")
	}
	parts := strings.Split(trimmed, "|")
	// ed2k:// | file | <name> | <size> | <hash> | ...
	if len(parts) < 5 || !strings.EqualFold(parts[1], "file") {
		return nil, fmt.Errorf("invalid ed2k file link format")
	}
	name, err := url.PathUnescape(parts[2])
	if err != nil || name == "" {
		name = parts[2]
	}
	size, err := strconv.ParseInt(parts[3], 10, 64)
	if err != nil || size < 0 {
		size = 0
	}
	hash := strings.ToLower(parts[4])

	var webSources []string
	for _, seg := range parts[5:] {
		lower := strings.ToLower(seg)
		if strings.HasPrefix(lower, "s,http://") || strings.HasPrefix(lower, "s,https://") {
			u := strings.TrimSpace(seg[2:])
			if u != "" {
				webSources = append(webSources, u)
			}
		}
	}

	return &Ed2kInfo{
		Filename:   name,
		Size:       size,
		Hash:       hash,
		WebSources: webSources,
	}, nil
}

// Ed2kDownloader 支持 ed2k:// 协议下载（优先使用内嵌 WebSeed/镜像，否则调用 aMule CLI）
type Ed2kDownloader struct {
	mu     sync.RWMutex
	config *types.Config
	httpDL *HTTPDownloader
}

func NewEd2kDownloader(config *types.Config) *Ed2kDownloader {
	return &Ed2kDownloader{
		config: config,
		httpDL: NewHTTPDownloader(config),
	}
}

func (d *Ed2kDownloader) UpdateConfig(cfg *types.Config) {
	d.mu.Lock()
	d.config = cfg
	d.httpDL.UpdateConfig(cfg)
	d.mu.Unlock()
}

func (d *Ed2kDownloader) Download(ctx context.Context, task *types.Task, onProgress func()) error {
	info, err := ParseEd2kURL(task.URL)
	if err != nil {
		return err
	}
	if (task.Filename == "" || task.Filename == "unknown") && info.Filename != "" {
		task.Filename = info.Filename
	}
	if info.Size > 0 {
		atomic.StoreInt64(&task.TotalBytes, info.Size)
	}
	onProgress()

	// 1. 如果 ed2k 链接内嵌了 HTTP/HTTPS WebSeed（|s,http...|）或用户配置了 HTTP 镜像，直接走多线程 HTTP 下载
	var httpCandidates []string
	httpCandidates = append(httpCandidates, info.WebSources...)
	for _, m := range task.Mirrors {
		if strings.HasPrefix(strings.ToLower(m), "http://") || strings.HasPrefix(strings.ToLower(m), "https://") {
			httpCandidates = append(httpCandidates, m)
		}
	}
	if len(httpCandidates) > 0 {
		origURL := task.URL
		origMirrors := task.Mirrors
		task.URL = httpCandidates[0]
		if len(httpCandidates) > 1 {
			task.Mirrors = httpCandidates[1:]
		} else {
			task.Mirrors = nil
		}
		err := d.httpDL.Download(ctx, task, onProgress)
		task.URL = origURL
		task.Mirrors = origMirrors
		if err == nil {
			return nil
		}
		slog.Warn("ed2k webseed download failed, trying aMule CLI", "err", err)
	}

	// 2. 尝试通过本地 aMule CLI (amulecmd / ed2k) 投递并监控目标文件
	amuleBin, err := findAmuleBinary()
	if err != nil {
		return fmt.Errorf("未检测到 aMule CLI（ed2k 协议需安装 aMule 并启用 amulecmd/ed2k，或在高级选项中提供 HTTP 镜像源）")
	}

	slog.Info("submitting ed2k link via aMule", "bin", amuleBin, "file", task.Filename, "size", info.Size)
	var cmd *exec.Cmd
	if strings.HasSuffix(amuleBin, "amulecmd") || strings.HasSuffix(amuleBin, "amulecmd.exe") {
		cmd = exec.CommandContext(ctx, amuleBin, "-c", "Add "+task.URL)
	} else {
		cmd = exec.CommandContext(ctx, amuleBin, task.URL)
	}
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("调用 %s 失败: %v (%s)", filepath.Base(amuleBin), err, strings.TrimSpace(string(out)))
	}

	targetPath := filepath.Join(task.SavePath, task.Filename)
	home, _ := os.UserHomeDir()
	candidatePaths := []string{
		targetPath,
		filepath.Join(home, ".aMule", "Incoming", task.Filename),
		filepath.Join(home, "Library", "Application Support", "aMule", "Incoming", task.Filename),
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			for _, p := range candidatePaths {
				st, err := os.Stat(p)
				if err != nil {
					continue
				}
				curSize := st.Size()
				atomic.StoreInt64(&task.DoneBytes, curSize)
				onProgress()

				if info.Size > 0 && curSize >= info.Size {
					if p != targetPath {
						_ = copyOrMoveFile(p, targetPath)
					}
					return verifyChecksum(targetPath, task)
				}
			}
		}
	}
}

func findAmuleBinary() (string, error) {
	for _, name := range []string{"amulecmd", "ed2k"} {
		if p, err := exec.LookPath(name); err == nil {
			return p, nil
		}
	}
	return "", fmt.Errorf("amule not found")
}

func copyOrMoveFile(src, dst string) error {
	if err := os.Rename(src, dst); err == nil {
		return nil
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = out.ReadFrom(in)
	return err
}
