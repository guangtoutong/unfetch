//go:build masbuild

// Mac App Store 版（-tags masbuild）专用桩。
//
// 这里用空实现顶替 bt.go / ytdlp.go，保证：
//   1. MAS 二进制不链接 anacrolix/torrent，也不内置任何 yt-dlp 调用逻辑；
//   2. 即便上层误把任务派发过来，下载器也只会返回明确错误，绝不下载；
//
// 真正的拦截在 api 层（AddTask 直接拒绝非 HTTP 任务），这里是第二道防线。
// 目的：符合 App Store Review Guideline 5.2.3 —— MAS 版只是一个 HTTP/HTTPS
// 多线程直链下载器，不具备 BT / 磁力 / 视频网站抓取能力。

package downloader

import (
	"context"
	"errors"

	"unfetch/core/types"
)

// ErrNotInAppStoreEdition 在 MAS 版被调用受限下载器时返回。
var ErrNotInAppStoreEdition = errors.New("当前版本仅支持 HTTP/HTTPS 与 FTP/SFTP 直链下载")

// ---------- BT / 磁力 桩 ----------

type BTDownloader struct{}

func NewBTDownloader(_ *types.Config) *BTDownloader { return &BTDownloader{} }

func (d *BTDownloader) UpdateConfig(_ *types.Config) {}

func (d *BTDownloader) Download(_ context.Context, _ *types.Task, _ func()) error {
	return ErrNotInAppStoreEdition
}

// PreviewTorrent 桩：MAS 版不解析种子。
func PreviewTorrent(_ context.Context, _ string, _ *types.Config) (*types.TorrentPreview, error) {
	return nil, ErrNotInAppStoreEdition
}

// ---------- yt-dlp 视频站 桩 ----------

type YtdlpDownloader struct{}

func NewYtdlpDownloader(_ *types.Config) *YtdlpDownloader { return &YtdlpDownloader{} }

func (d *YtdlpDownloader) UpdateConfig(_ *types.Config) {}

func (d *YtdlpDownloader) Download(_ context.Context, _ *types.Task, _ func()) error {
	return ErrNotInAppStoreEdition
}

// ---------- ed2k 桩 ----------

type Ed2kDownloader struct{}

func NewEd2kDownloader(_ *types.Config) *Ed2kDownloader { return &Ed2kDownloader{} }

func (d *Ed2kDownloader) UpdateConfig(_ *types.Config) {}

func (d *Ed2kDownloader) Download(_ context.Context, _ *types.Task, _ func()) error {
	return ErrNotInAppStoreEdition
}

// ---------- HLS (.m3u8) 桩 ----------

type HLSDownloader struct{}

func NewHLSDownloader(_ *types.Config) *HLSDownloader { return &HLSDownloader{} }

func (d *HLSDownloader) UpdateConfig(_ *types.Config) {}

func (d *HLSDownloader) Download(_ context.Context, _ *types.Task, _ func()) error {
	return ErrNotInAppStoreEdition
}
