//go:build !masbuild

// 完整版（官网 / GitHub Release）支持 HLS (.m3u8) 原生多线程分片并发下载与 AES-128 解密合并。
// Mac App Store 版（-tags masbuild）由 edition_stub.go 提供空桩以符合 Apple Review Guideline 5.2.3。

package downloader

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/errgroup"

	"unfetch/core/types"
)

// HLSDownloader 原生 HLS (.m3u8) 多线程分片下载器
type HLSDownloader struct {
	mu     sync.RWMutex
	config *types.Config
}

func NewHLSDownloader(config *types.Config) *HLSDownloader {
	return &HLSDownloader{config: config}
}

func (d *HLSDownloader) UpdateConfig(cfg *types.Config) {
	d.mu.Lock()
	d.config = cfg
	d.mu.Unlock()
}

func (d *HLSDownloader) getConfig() *types.Config {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.config
}

// Download 执行 HLS (.m3u8) 多线程分片下载、解密与合并
func (d *HLSDownloader) Download(ctx context.Context, task *types.Task, onProgress func()) error {
	cfg := d.getConfig()
	effectiveProxy := resolveProxy(task.Proxy, cfg)
	httpDL := NewHTTPDownloader(cfg)
	client := httpDL.buildHTTPClient(effectiveProxy)

	// 1. 拉取入口 m3u8
	playlistURL := task.URL
	body, err := d.fetchBytes(ctx, client, task, playlistURL, false, 0, 0)
	if err != nil {
		return fmt.Errorf("fetch m3u8 playlist: %w", err)
	}

	variants, media, err := ParseHLSMasterOrMedia(playlistURL, string(body))
	if err != nil {
		return fmt.Errorf("parse m3u8: %w", err)
	}

	// 如果是 Master Playlist，挑选对应画质的子播放列表再拉一次
	if len(variants) > 0 {
		chosen := SelectHLSVariant(variants, task.Quality)
		slog.Info("hls: selected variant", "id", task.ID, "uri", chosen.URI, "res", chosen.Resolution, "bw", chosen.Bandwidth)
		playlistURL = chosen.URI
		body, err = d.fetchBytes(ctx, client, task, playlistURL, false, 0, 0)
		if err != nil {
			return fmt.Errorf("fetch variant playlist: %w", err)
		}
		_, media, err = ParseHLSMasterOrMedia(playlistURL, string(body))
		if err != nil {
			return fmt.Errorf("parse media playlist: %w", err)
		}
	}

	if media == nil || len(media.Segments) == 0 {
		return fmt.Errorf("empty HLS media playlist")
	}

	// 更新任务元数据与输出文件名
	if task.Metadata == nil {
		task.Metadata = &types.TaskMeta{}
	}
	if media.TotalDuration > 0 {
		task.Metadata.Duration = int(media.TotalDuration)
	}
	task.Filename = normalizeHLSFilename(task.Filename, task.URL)
	onProgress()

	if err := os.MkdirAll(task.SavePath, 0755); err != nil {
		return fmt.Errorf("create save dir: %w", err)
	}

	// 临时分片目录：<SavePath>/.<Filename>.hls
	partsDir := filepath.Join(task.SavePath, "."+task.Filename+".hls")
	if err := os.MkdirAll(partsDir, 0755); err != nil {
		return fmt.Errorf("create hls parts dir: %w", err)
	}

	var tb *tokenBucket
	if cfg != nil && cfg.SpeedLimit > 0 {
		tb = newTokenBucket(cfg.SpeedLimit)
	}

	// 密钥缓存（避免每个分片重复请求同一个 key URI）
	var keyMu sync.Mutex
	keyCache := make(map[string][]byte)
	getKey := func(keyURI string) ([]byte, error) {
		keyMu.Lock()
		if k, ok := keyCache[keyURI]; ok {
			keyMu.Unlock()
			return k, nil
		}
		keyMu.Unlock()

		kData, err := d.fetchBytes(ctx, client, task, keyURI, false, 0, 0)
		if err != nil {
			return nil, fmt.Errorf("fetch AES-128 key: %w", err)
		}
		if len(kData) != 16 {
			return nil, fmt.Errorf("invalid AES-128 key size (%d bytes) from %s", len(kData), keyURI)
		}

		keyMu.Lock()
		keyCache[keyURI] = kData
		keyMu.Unlock()
		return kData, nil
	}

	// 2. 如果有 fMP4 Init Segment (#EXT-X-MAP)，先下载 init.part
	initPath := filepath.Join(partsDir, "init.part")
	if media.InitSegment != nil {
		if st, err := os.Stat(initPath); err != nil || st.Size() == 0 {
			seg := media.InitSegment
			raw, err := d.fetchBytes(ctx, client, task, seg.URI, seg.HasRange, seg.RangeStart, seg.RangeLen)
			if err != nil {
				return fmt.Errorf("fetch init segment: %w", err)
			}
			if seg.Key != nil && seg.Key.Method == "AES-128" {
				k, err := getKey(seg.Key.URI)
				if err != nil {
					return err
				}
				raw, err = DecryptAES128CBC(raw, k, seg.Key.IV, 0)
				if err != nil {
					return fmt.Errorf("decrypt init segment: %w", err)
				}
			}
			if err := os.WriteFile(initPath, raw, 0644); err != nil {
				return fmt.Errorf("write init segment: %w", err)
			}
		}
	}

	// 3. 统计已存在的分片（支持断点续传）
	totalSegs := int64(len(media.Segments))
	var completedSegs int64
	var doneBytes int64

	for _, seg := range media.Segments {
		partPath := filepath.Join(partsDir, fmt.Sprintf("seg_%06d.part", seg.Index))
		if st, err := os.Stat(partPath); err == nil && st.Size() > 0 {
			completedSegs++
			doneBytes += st.Size()
		}
	}
	atomic.StoreInt64(&task.DoneBytes, doneBytes)
	if completedSegs > 0 {
		avg := doneBytes / completedSegs
		atomic.StoreInt64(&task.TotalBytes, avg*totalSegs)
	}
	onProgress()

	// 4. 并发下载剩余分片
	threads := task.Threads
	if threads <= 0 {
		threads = 8
	}
	if threads > 32 {
		threads = 32
	}

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(threads)

	for _, seg := range media.Segments {
		seg := seg
		partPath := filepath.Join(partsDir, fmt.Sprintf("seg_%06d.part", seg.Index))
		if st, err := os.Stat(partPath); err == nil && st.Size() > 0 {
			continue
		}

		g.Go(func() error {
			raw, err := d.fetchBytesWithRetry(gctx, client, task, seg.URI, seg.HasRange, seg.RangeStart, seg.RangeLen, tb)
			if err != nil {
				return fmt.Errorf("segment %d: %w", seg.Index, err)
			}

			if seg.Key != nil && seg.Key.Method == "AES-128" {
				k, err := getKey(seg.Key.URI)
				if err != nil {
					return err
				}
				raw, err = DecryptAES128CBC(raw, k, seg.Key.IV, seg.SeqNum)
				if err != nil {
					return fmt.Errorf("decrypt segment %d: %w", seg.Index, err)
				}
			}

			tmpPart := partPath + ".tmp"
			if err := os.WriteFile(tmpPart, raw, 0644); err != nil {
				return fmt.Errorf("write segment %d: %w", seg.Index, err)
			}
			if err := os.Rename(tmpPart, partPath); err != nil {
				return fmt.Errorf("rename segment %d: %w", seg.Index, err)
			}

			newDone := atomic.AddInt64(&task.DoneBytes, int64(len(raw)))
			newCompleted := atomic.AddInt64(&completedSegs, 1)
			if newCompleted > 0 {
				avg := newDone / newCompleted
				estTotal := avg * totalSegs
				if estTotal < newDone {
					estTotal = newDone
				}
				atomic.StoreInt64(&task.TotalBytes, estTotal)
			}
			onProgress()
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return err
	}

	// 5. 合并所有分片到最终文件
	finalPath := filepath.Join(task.SavePath, task.Filename)
	mergedPath := finalPath + ".merged"
	outFile, err := os.Create(mergedPath)
	if err != nil {
		return fmt.Errorf("create merged file: %w", err)
	}

	var exactTotal int64
	copyPart := func(p string) error {
		f, err := os.Open(p)
		if err != nil {
			return err
		}
		defer f.Close()
		n, err := io.Copy(outFile, f)
		exactTotal += n
		return err
	}

	if media.InitSegment != nil {
		if err := copyPart(initPath); err != nil {
			outFile.Close()
			return fmt.Errorf("merge init segment: %w", err)
		}
	}
	for _, seg := range media.Segments {
		partPath := filepath.Join(partsDir, fmt.Sprintf("seg_%06d.part", seg.Index))
		if err := copyPart(partPath); err != nil {
			outFile.Close()
			return fmt.Errorf("merge segment %d: %w", seg.Index, err)
		}
	}
	if err := outFile.Close(); err != nil {
		return fmt.Errorf("close merged file: %w", err)
	}

	// 如果目标是 .mp4 且本机安装了 ffmpeg，且流以 MPEG-TS sync byte (0x47) 开头，无损封装为 mp4
	if strings.HasSuffix(strings.ToLower(finalPath), ".mp4") && media.InitSegment == nil && isMPEGTSFile(mergedPath) {
		if ffmpegPath, err := exec.LookPath("ffmpeg"); err == nil {
			remuxTmp := finalPath + ".remux.mp4"
			cmd := exec.CommandContext(ctx, ffmpegPath, "-y", "-loglevel", "error", "-i", mergedPath, "-c", "copy", "-bsf:a", "aac_adtstoasc", remuxTmp)
			if err := cmd.Run(); err == nil {
				if st, statErr := os.Stat(remuxTmp); statErr == nil && st.Size() > 0 {
					_ = os.Remove(mergedPath)
					mergedPath = remuxTmp
					exactTotal = st.Size()
				}
			} else {
				_ = os.Remove(remuxTmp)
			}
		}
	}

	if err := os.Rename(mergedPath, finalPath); err != nil {
		return fmt.Errorf("rename final file: %w", err)
	}

	// 清理分片临时目录
	_ = os.RemoveAll(partsDir)

	atomic.StoreInt64(&task.DoneBytes, exactTotal)
	atomic.StoreInt64(&task.TotalBytes, exactTotal)
	onProgress()

	// 6. 校验 SHA256 / MD5（若指定）
	if err := verifyChecksum(finalPath, task); err != nil {
		return err
	}

	return nil
}

func (d *HLSDownloader) fetchBytesWithRetry(
	ctx context.Context,
	client *http.Client,
	task *types.Task,
	targetURL string,
	hasRange bool,
	rangeStart, rangeLen int64,
	tb *tokenBucket,
) ([]byte, error) {
	var lastErr error
	for attempt := 0; attempt < maxRequestRetries; attempt++ {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(requestBackoff(attempt - 1)):
			}
		}
		data, err := d.fetchBytes(ctx, client, task, targetURL, hasRange, rangeStart, rangeLen)
		if err == nil {
			if tb != nil && len(data) > 0 {
				tb.consume(ctx, int64(len(data)))
			}
			return data, nil
		}
		lastErr = err
		if errors.Is(err, context.Canceled) {
			return nil, err
		}
	}
	return nil, lastErr
}

func (d *HLSDownloader) fetchBytes(
	ctx context.Context,
	client *http.Client,
	task *types.Task,
	targetURL string,
	hasRange bool,
	rangeStart, rangeLen int64,
) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	applyTaskHeaders(req, task)
	if hasRange && rangeLen > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", rangeStart, rangeStart+rangeLen-1))
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, targetURL)
	}

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, resp.Body); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
