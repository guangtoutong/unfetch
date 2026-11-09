---
name: unfetch-media
description: >-
  Download video or audio from YouTube, Bilibili, TikTok, X and 1000+ sites via
  unfetch (yt-dlp), with quality/format selection and optional play-after. Use when
  the user shares a video/streaming-site link or says "download this video", "rip the
  audio", "下载这个视频", "下载音频/mp3", "下高清", "下完直接播放". Picks the right quality and
  can hand off to Unflick for playback. For plain file/HTTP links use unfetch-grab.
---

# unfetch-media — 视频/音频下载（含清晰度与播放）

通过 unfetch（内置 yt-dlp）从 1000+ 视频站下载，处理清晰度/格式选择，可下完直接播放。

## 何时用

- 用户给了视频站/流媒体链接（YouTube、Bilibili、TikTok、X 等）
- 用户说要"高清/某清晰度""只要音频/mp3""下完播放"

## 步骤

1. **判断清晰度/格式**：映射到 `add_task` 的 `quality` 枚举：
   - "最高清/原画/4K/最好" → `best`
   - 明确分辨率 → `1080p` / `720p` / `480p`
   - "只要声音/音频/mp3/播客" → `audio`
   - 用户没说 → 默认 `best`，并在回报里说明可改。
2. **加任务**：`add_task`，传 `url` + `quality`。
   - 站点需要登录 → 让用户在 app 设置里配好该站 cookie/UA 预设（task templates），或提示用户。
   - 用户要直接播放 → 加 `play_after: true`（daemon 下完会调 Unflick），或走第 4 步手动播。
3. **等完成**：`wait_for_task(id)`。视频通常大，按需调大 `timeout_seconds`。
4. **（可选）播放**：若用户要看且没用 `play_after`，下完后用 `play_in_unflick(path)` 打开。
5. **回报**：文件名、清晰度/格式、大小、路径；失败则念 `error`（视频站常见：地区限制、需登录、yt-dlp 需更新）。

## 注意

- yt-dlp / ffmpeg 是外部依赖，不打包在 app 里。若报错提示缺失，引导用户安装（README 的"开发经验"有推荐位置）。
- `audio` 会抽取音轨；用户要特定音频格式时在回报里说明当前由 yt-dlp 默认决定。
- 合集/播放列表链接可能展开成多个任务 —— 配合 `unfetch-batch` 的 `wait_for_all` 等整批。
