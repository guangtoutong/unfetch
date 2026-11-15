# unfetch v0.4.0 首发推广文案包（复制即用）

本文件汇总了 `unfetch v0.4.0` 在国内外各大渠道的**定制首发文案**。不同社区的读者口味差异很大，已按各平台高赞帖的叙事风格分别撰写，直接复制对应章节即可发布。

---

## 渠道 1：阮一峰《科技爱好者周刊》投稿（性价比最高，必投）

- **投稿地址**：https://github.com/ruanyf/weekly/issues （点击 `New issue`）
- **最佳提交时间**：周二 ～ 周四（周刊每周五早上发布）

**Issue 标题：**
```text
推荐开源项目：unfetch —— 为人和 AI 设计的全协议下载管理器（Go + Tauri 2，内置边下边播与 MCP）
```

**Issue 正文：**
```markdown
阮老师好，自荐一个独立开发的开源跨平台下载工具 **unfetch**：

- **GitHub 仓库**：https://github.com/guangtoutong/unfetch
- **官网**：https://unfetch.org

### 为什么做这个工具？
市面上现有的下载工具大多偏科或停更：Motrix 长期未更新、IDM 仅限 Windows、Downie 只支持视频且收费、迅雷广告臃肿。因此我用 **Go（后台下载引擎 daemon）+ Rust/Tauri 2（桌面 GUI + CLI + MCP）** 写了一个只有约 8MB 的全协议现代下载器。

### 核心亮点（v0.4.0）：
1. **全协议覆盖**：单应用原生支持多线程/多镜像 HTTP、Metalink (`.meta4`)、BT/磁力链接、HLS (`.m3u8` AES-128 解密)、MPEG-DASH (`.mpd`)、FTP/FTPS/SFTP、ed2k，以及通过 `yt-dlp` 支持 1000+ 视频网站。
2. **磁力/HTTP 边下边播 (`unfetch stream`)**：内置本地 HTTP `206 Partial Content` 流网关，下载 BT 视频时自动提权首尾 2% 分片（秒读 MP4 `moov` 头），支持一键调用播放器边下边播并随意拖动进度条。
3. **BT 恶意文件自动拦截**：解析种子时自动识别并取消勾选 `.scr/.vbs/.bat/.lnk/.ps1`、`.mp4.exe` 双后缀伪装及影视种子中夹带的木马可执行文件。
4. **AI Agent 原生（CLI + MCP First）**：`unfetch --mcp` 直接暴露 19 个 MCP 工具和 4 个 Claude Skills，在 Claude Desktop / Claude Code / Cursor 中用一句话即可完成嗅探、批量下载、优先级插队和按扩展名安全归档。
5. **NAS 与极客友好**：支持无头 `unfetch daemon`、Token 鉴权的远程 Web UI（手机扫码管理）、RSS 正则追番订阅与 Webhook/Shell 完成钩子。

附上主界面截图（内置 6 套主题与 14 种语言，MIT 开源，零遥测）：
（在此处拖入 1~2 张 unfetch 界面截图）
```

---

## 渠道 2：V2EX（`/go/create` 分享创造 / `/go/macos`）& Linux.do

- **发布节点**：V2EX `/go/create`（分享创造）或 Linux.do「开发调优 / 搞七捻三」
- **最佳发布时间**：工作日 10:00 - 11:30 或 14:00 - 15:30

**帖子标题：**
```text
受够了迅雷臃肿和 Motrix 停更，我用 Go + Rust (Tauri 2) 写了个 ~8MB 的全协议下载器 unfetch：支持磁力边下边播、自动拦截种子里的 .mp4.exe 木马，还内置了 19 个 MCP 工具给 AI 调用
```

**帖子正文：**
```markdown
大家好，过去几个月一直在打磨一个开源跨平台下载工具 **unfetch**，刚发了 `v0.4.0`，来和大家汇报一下进展。

- GitHub：https://github.com/guangtoutong/unfetch （求个 Star ⭐️）
- 官网与下载：https://unfetch.org （支持 macOS Universal / Windows / Linux）

### 起因：为什么造这个轮子？
平时重度使用下载工具，但痛点一直很割裂：
- 下大文件用 IDM / Motrix（但 Motrix 已经很久不维护，Electron 内存占用也大）
- 下磁力/种子得开 qBittorrent，想边下边看还得等或者折腾顺序下载
- 网页遇到 `.m3u8` / `.mpd` 流媒体或者 YouTube/B 站视频，又得切 Downie 或命令行敲 `yt-dlp`
- 在 Claude Code / Cursor 里想让 AI 帮我拉一批大数据集并校验 SHA-256，现有的下载器都没有原生 MCP 接口

所以我决定做一个**「All-in-One 但依然只有 ~8MB」**的下载器。

### 架构：Go Daemon + Rust/Tauri 2 双进程
- **Go 负责核心下载引擎 (`unfetch-daemon`)**：基于 `anacrolix/torrent`（我也是上游 contributor）+ 自研多线程多镜像 HTTP + 原生 HLS/DASH 分片解密器 + FTP/SFTP/ed2k + SQLite 持久化。关掉 GUI 窗口不影响后台下载。
- **Rust + Tauri 2 + React 18 负责外壳**：同一个二进制同时是 **GUI 窗口**、**CLI 命令行 (`unfetch add/list/stream`)** 和 **MCP Server (`unfetch --mcp`)**。

### v0.4.0 刚上线的几个好玩功能：
1. **真正的「边下边播」(`unfetch stream`)**：
   无论是在下 BT 磁力还是 HTTP 大视频，点一下任务栏的「边下边播」（或敲 `unfetch stream <id> --play`），本地会起一个支持 `206 Partial Content` Range 请求的流网关。BT 引擎会自动提权视频文件首尾 2% 的分片（优先下完 MP4 的 `moov` 索引头），直接拉起播放器秒开，而且可以拖动进度条！
2. **BT 伪装木马自动拦截**：
   老司机下种子经常遇到里面夹带 `电影名.mp4.exe`、`播放解码器.scr`、`.lnk`、`.vbs`、`.ps1` 这种木马文件。`unfetch` 现在会在预览和下载阶段自动扫描所有文件，一旦发现影视种子里夹带可执行文件或高危脚本，直接红字警告并默认取消勾选。
3. **安全智能归档（不做危险的自动解压）**：
   之前考虑过做「下载完自动解压」，但评估后发现自动解压极易踩中 Zip Bomb（解压炸弹）、路径穿越和绕过 macOS Gatekeeper 隔离属性的安全大坑。所以 `v0.4.0` 做成了安全的**智能目录分流**——按扩展名自动归入 `Videos / Music / Archives / Programs / Documents / Images / ISO`。
4. **AI 原生（19 个 MCP 工具 + 4 个 Claude Skills）**：
   在 Claude Code 里执行：
   ```bash
   /plugin marketplace add guangtoutong/unfetch
   /plugin install unfetch@unfetch
   ```
   然后直接跟 AI 说：「帮我把这个磁力链接里最大的视频下下来，设为最高优先级，并打开边下边播」，AI 就会调 `preview_torrent` → `add_task` → `stream_task` 全自动搞定。
5. **NAS 远程 Web UI + RSS 追番**：
   支持 `unfetch daemon` 无头运行，开启远程模式后用手机扫码就能管下载；支持 RSS 订阅 + 正则过滤自动入队。

项目采用 MIT 协议开源，无广告、无账号体系、零遥测。欢迎大家试用提 Issue！
```

---

## 渠道 3：Hacker News (`Show HN`) & Reddit 英文社区

- **发布地址**：
  - Hacker News: https://news.ycombinator.com/submit
  - Reddit: `r/macapps`, `r/selfhosted`, `r/commandline`, `r/ClaudeAI`
- **最佳发布时间**：北京时间晚上 21:30 - 23:30（对应美东时间早上 8:30 - 10:30）

**Show HN Title (严格限制 80 字符内)：**
```text
Show HN: Unfetch – Go+Rust download engine for humans and AI (HTTP/BT/HLS/MCP)
```

**Show HN / Reddit Text：**
```markdown
Hi HN,

I built **unfetch** (https://github.com/guangtoutong/unfetch), a lightweight (~8 MB), cross-platform download manager written in Go (daemon engine) and Rust/Tauri 2 (GUI + CLI + MCP server).

### Why another download manager?
Most desktop download managers are either abandoned Electron apps (like Motrix), Windows-only proprietary tools (IDM), single-purpose tools (qBittorrent for torrents, Downie for video streams), or bloated with ads/telemetry. None of them were designed to be driven by both humans and AI agents.

### How unfetch works:
It splits into two processes communicating over a local REST + SSE API (`127.0.0.1:19543`):
1. **Go daemon**: Handles multi-mirror chunked HTTP/HTTPS, RFC 5854 Metalink (`.meta4`), BitTorrent/Magnet (`anacrolix/torrent` with auto uTP fallback), native HLS (`.m3u8` with AES-128 CBC decryption) & MPEG-DASH (`.mpd`), FTP/FTPS/SFTP, ed2k, and 1000+ video sites via `yt-dlp`, backed by SQLite persistence.
2. **Rust/Tauri 2 binary**: Acts simultaneously as the native desktop GUI (with 6 live-switchable themes), the CLI (`unfetch add/list/priority/stream`), and an **MCP server** (`unfetch --mcp`) exposing 19 tools and live `task://{id}` resource subscriptions.

### What's new in v0.4.0:
- **Sequential Live Streaming (`unfetch stream`)**: Exposes an HTTP `206 Partial Content` Range endpoint (`GET /tasks/:id/stream`) for in-progress BitTorrent and HTTP downloads. For torrents, it automatically boosts priority on the first and last 2% pieces so MP4 `moov` atoms arrive first, letting you watch and seek while downloading.
- **BT Trojan & Malware Blocker**: Automatically flags and deselects `.scr`, `.vbs`, `.bat`, `.lnk`, `.ps1`, double-extension traps (`.mp4.exe`), and `.exe`/`.msi` files bundled inside media torrents.
- **Preemptive Queue Priority & Safe Smart Categorization**: 4-level dynamic queue priority (`-1` to `2`) and automatic extension-based folder routing (`Videos`, `Music`, `Archives`, etc.) without risky auto-extraction.
- **Headless / Self-hosted friendly**: Run `unfetch daemon` on a home server with a token-gated Web UI, RSS regex auto-downloader, and webhook/shell completion hooks.

Repo: https://github.com/guangtoutong/unfetch
Website: https://unfetch.org

MIT licensed, zero telemetry. Happy to answer any questions about the Go/Rust dual-process architecture or `anacrolix/torrent` internals!
```

---

## 渠道 4：小众软件 (Appinn) / 少数派自荐文案

- **发布地址**：https://meta.appinn.net （小众软件论坛「发现频道」）

**标题：**
```text
[自荐] unfetch v0.4.0 —— 仅 8MB 的全协议下载器（HTTP多线程 / BT磁力边下边播 / m3u8与mpd流媒体 / 种子木马拦截 / AI MCP）
```

**正文：**
```markdown
**软件名称**：unfetch
**支持平台**：macOS (Apple Silicon & Intel) / Windows 10, 11 / Linux
**开源协议**：MIT（完全免费、无广告、零遥测）
**项目主页**：https://unfetch.org
**GitHub**：https://github.com/guangtoutong/unfetch

### 一句话简介
**unfetch** 是一款用 Go + Rust (Tauri 2) 构建的现代全协议下载管理器，安装包仅 ~8MB，同时替代多线程下载器、BT 客户端和流媒体嗅探工具，并原生支持 AI (MCP) 调用。

### 核心特色
1. **几乎通吃所有下载协议**：32 线程多镜像 HTTP/HTTPS、Metalink (`.meta4`)、BT 种子与磁力链接、原生 `.m3u8` (HLS AES-128 解密) 与 `.mpd` (MPEG-DASH) 流媒体并发合并、FTP/SFTP、ed2k，以及通过 `yt-dlp` 下载 1000+ 视频网站。
2. **磁力与大视频「边下边播」**：无需苦等下载完成，点击任务卡片上的「边下边播」即可通过本地 HTTP 206 流网关直接调用播放器观看，BT 任务会自动优先下载视频首尾分片，支持拖动进度条。
3. **自动拦截种子里的伪装木马**：针对影视种子常见的 `.mp4.exe` 双后缀伪装、`.scr` 屏保木马、`.vbs/.bat/.lnk/.ps1` 脚本，在选文件阶段自动红字预警并取消勾选。
4. **安全智能分类归档**：开启后自动按文件类型归入 `Videos / Music / Archives / Programs / Documents / Images / ISO` 文件夹。
5. **高颜值与极客能力兼备**：内置 6 套精致主题（默认温暖乳白配色）、迷你悬浮窗、浏览器嗅探扩展、RSS 自动追番、远程 Web UI（手机扫码管理）以及 19 个 MCP 工具（支持 Claude / Cursor 一句话控制下载）。
```

---

## 渠道 5：小红书 / B 站 / X 20 秒爆款短视频脚本

短视频平台不看文字参数，只看**「前 3 秒痛点 + 15 秒丝滑演示」**。建议用 macOS 录屏（开启「赛博朋克」或「乳白」主题）录以下 2 条：

### 视频脚本 A（主打「告别迅雷 + 边下边播 + 防木马」，适合小红书/B站）
- **0~3 秒（黄金钩子）**：「还在忍受迅雷满屏广告、Motrix 停更下不动磁力？试试这个只有 8MB 的开源全能下载器 `unfetch`！」
- **3~8 秒（防木马爽点）**：画面展示拖入一个种子，弹窗瞬间红字标出 `电影.mp4.exe` 可疑文件并自动取消勾选 —— 字幕：「自动识别种子里的伪装木马，安全感拉满」。
- **8~15 秒（边下边播爽点）**：点击正在下载的磁力视频右侧「边下边播」按钮，播放器秒开画面并随意拖动进度条 —— 字幕：「内置首尾分片提权，磁力链接也能丝滑边下边播」。
- **15~20 秒（收尾引导）**：快速切换 6 套主题皮肤 + 展示浏览器扩展一键嗅探 `.m3u8` 视频 —— 字幕：「支持 Mac/Win/Linux，GitHub 搜索 `unfetch` 免费下载」。

### 视频脚本 B（主打「AI 自动下载助理」，适合 X / 即刻 / B站科技区）
- **0~3 秒**：「当你给 Claude Code 装上全协议下载引擎会发生什么？」
- **3~12 秒**：在终端/Claude 中输入一句自然语言：「帮我预览这个磁力链接，挑出最大的视频文件设为最高优先级下载，并开启边下边播」，屏幕分屏显示右侧 `unfetch` 自动弹出任务、置顶插队并拉起播放器。
- **12~18 秒**：展示 `unfetch` 完整支持 HTTP 多镜像、BT、`.m3u8`/`.mpd` 与 1000+ 视频网站，一行 `/plugin install` 即可接入。
