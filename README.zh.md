<div align="center">

# unfetch

**为人和 AI 设计的下载管理器**

[![GitHub Release](https://img.shields.io/github/v/release/guangtoutong/unfetch?label=release&color=7c3aed&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/releases/latest)
[![下载量](https://img.shields.io/github/downloads/guangtoutong/unfetch/total?label=downloads&color=8b5cf6&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/releases)
[![Stars](https://img.shields.io/github/stars/guangtoutong/unfetch?color=a78bfa&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/stargazers)

[官网](https://unfetch.org) · [下载](https://unfetch.org/#download) · [赞助](https://unfetch.org/#sponsor) · [English](README.md)

</div>

---

unfetch 是把浏览器没下完的活接走的下载引擎。多镜像 HTTP + Metalink 高速并发、原生 BT/磁力（支持**边下边播**与**木马文件自动拦截**）、原生 HLS (`.m3u8`) 与 MPEG-DASH (`.mpd`) 流媒体合并、yt-dlp 集成的 1000+ 视频网站、RSS 自动订阅、完成钩子、token 鉴权的远程 Web UI —— GUI、CLI、AI (MCP) 都能驱动。约 8 MB 安装包，MIT 许可，默认零遥测。

## 为什么选择 unfetch？

| 能力对比 | **unfetch** | Motrix | IDM | Downie | qBittorrent |
|---|:---:|:---:|:---:|:---:|:---:|
| **多线程 / 多镜像 HTTP 与 Metalink (`.meta4`)** | ✅ (最高 32 线程) | ✅ | ✅ (仅 Windows) | ❌ | ❌ |
| **BT / 磁力链接 + 做种分享率控制** | ✅ | ⚠️ (仅基础 aria2) | ❌ | ❌ | ✅ |
| **BT 伪装木马（`.mp4.exe`/`.scr`）自动拦截** | ✅ | ❌ | ❌ | ❌ | 需手动配置 |
| **边下边播 (`206 Range` 实时流网关)** | ✅ (`unfetch stream`) | ❌ | ❌ | ❌ | 仅顺序下载 |
| **原生 HLS (`.m3u8` 解密) & MPEG-DASH (`.mpd`)** | ✅ 原生内置 | ❌ | ⚠️ | ✅ (仅 macOS) | ❌ |
| **1000+ 视频网站 (`yt-dlp`)** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **FTP / FTPS / SFTP 与 ed2k** | ✅ | ⚠️ 仅 FTP | ⚠️ 仅 FTP | ❌ | ❌ |
| **AI Agent 原生 (MCP Server + Claude Skills)** | ✅ (19 个工具) | ❌ | ❌ | ❌ | ❌ |
| **活跃维护与安装包体积** | ✅ (~8 MB, Tauri 2 + Go) | ❌ (已停更, Electron) | 付费 | 付费 | ✅ (~40 MB Qt) |

## 核心功能

- **多镜像 HTTP、Metalink (`.meta4`)、原生 HLS (`.m3u8`)、MPEG-DASH (`.mpd`) 与 FTP/SFTP** — 最多 32 线程 × 多镜像 URL 并发，RFC 5854 Metalink 自动提取镜像与哈希校验，原生 HLS (`.m3u8` AES-128 解密) 与 MPEG-DASH (`.mpd`) 多线程分片拉取合并，断点续传，SHA256/MD5 校验，原生支持 FTP/FTPS/SFTP 与 ed2k。
- **Sequential 边下边播网关 (`unfetch stream`)** — 下载过程中即可通过本地 HTTP `206 Partial Content` 流网关（`GET /tasks/:id/stream`）实时观看 BT/磁力与 HTTP 视频，自动提权视频首尾 2% 分片（秒读 MP4 `moov` 索引头），一键调用 **Unflick** 或 mpv/IINA/VLC 边下边播并支持拖动进度条。
- **BT / 磁力、做种控制与木马文件自动拦截** — 35 个公共 tracker、IPv6 + WebTorrent、下载前文件预览选择、自动识别并取消勾选高危伪装木马文件（`.scr/.pif/.vbs/.bat/.cmd/.hta/.lnk/.ps1`、`.mp4.exe` 双后缀伪装及影视种子夹带的 `.exe/.msi`）、可配置目标分享率与做种时长自动停止、ISP 干扰时自动切 uTP。
- **动态队列优先级与安全智能归档** — 支持 `-1`（低）到 `2`（紧急置顶插队）四级动态优先级调度；支持按扩展名自动分流至 `Videos`、`Music`、`Archives`、`Programs`、`Documents`、`Images`、`ISO` 子目录，**绝不自动解包压缩文件**，杜绝解压炸弹与木马释放风险。
- **1000+ 视频网站** — 通过内置 yt-dlp 集成支持 YouTube、B 站、抖音、X 等，并提供 `/deps/status` 依赖自检。
- **AI 原生 (MCP)** — 内置 19 个工具（`add_task`、`stream_task`、`set_task_priority`、`list_tasks`、`wait_for_task`、实时进度通知），任意 MCP 宿主（Claude Desktop、Claude Code、Cursor、Codex、Unterm）开箱即用。
- **远程 Web UI** — `0.0.0.0` + token 鉴权 —— 手机或远程 NAS/服务器都能管下载，支持扫码访问。
- **RSS 自动订阅** — 订阅源加正则过滤，新条目自动入队，GUID 去重。
- **完成钩子** — Webhook POST 或 Shell exec —— 任务完成接 Home Assistant / n8n / 任意自动化流程。
- **任务模板和依赖链** — 按站点预设 Cookie / UA，任务依赖链等待前置完成，定时启动，按小时带宽计划。
- **6 套主题与 14 种语言** — 乳白（新用户默认）、深邃靛蓝、亮色纸张、森林暗夜、赛博朋克、极简灰白 —— 一键切换无需重启。
- **隐私至上** — 无广告、无遥测、无登录、不上传 infohash。

## 安装

| 平台 | 下载 |
|---|---|
| macOS(Apple Silicon + Intel,已 Apple 公证) | [`unfetch_*_universal.dmg`](https://github.com/guangtoutong/unfetch/releases/latest) |
| Windows 10/11(NSIS 安装器) | [`unfetch_*_x64-setup.exe`](https://github.com/guangtoutong/unfetch/releases/latest) |
| Linux x64(AppImage / deb / rpm) | [Release 页面](https://github.com/guangtoutong/unfetch/releases/latest) |

**Homebrew 一键安装（macOS）** —— Cask 配方见 [`packaging/homebrew/unfetch.rb`](packaging/homebrew/unfetch.rb)：
```bash
brew install --cask guangtoutong/tap/unfetch
```

或访问 <https://unfetch.org/#download> 一键下载。

## 三个前端,一个 daemon

unfetch 用 Go daemon + Tauri 外壳实现。**三个前端共享一个 daemon,通过 `localhost:19543` 上的 REST API 通信**:

- **GUI** — Tauri 窗口(默认应用图标启动这个)
- **CLI** — `unfetch add <url>`、`unfetch list`、`unfetch pause <id>` …
- **MCP** — `unfetch --mcp`(stdio JSON-RPC,放进 Claude Desktop 配置即可)
- **浏览器扩展** — 见 `extension/` 目录,Chrome / Edge 嗅探器

```
┌──────────────────────────────────────────────────────────┐
│ Tauri 2 应用(Rust + React + 6 套主题)                    │
│   ├─ 主窗口 / 迷你悬浮窗                                  │
│   ├─ 托盘、剪贴板嗅探、deep-link 处理                     │
│   └─ 把参数/事件转发给 daemon                             │
└─────────────────────────────┬────────────────────────────┘
                              │ localhost:19543 (REST + SSE)
                              ▼
┌──────────────────────────────────────────────────────────┐
│ Go daemon(anacrolix/torrent + HTTP 下载器 + yt-dlp)     │
│   ├─ SQLite 任务库(重启后续传)                          │
│   ├─ 速度调度、重试队列、哈希校验                          │
│   ├─ 0.0.0.0 上的远程 Web UI(token 鉴权)                │
│   └─ GUI / CLI / MCP / 扩展 共用同一份 API                │
└──────────────────────────────────────────────────────────┘
```

## 在 AI 里使用(MCP)

把这段塞进 Claude Desktop / Cursor 配置(macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "unfetch": {
      "command": "/Applications/unfetch.app/Contents/MacOS/unfetch",
      "args": ["--mcp"]
    }
  }
}
```

然后你的 AI 就可以 `add_task` / `list_tasks` / `wait_for_task` 等。完整工具列表见 [mcp/README.md](mcp/README.md) 或 <https://unfetch.org/mcp>。

**19 个 MCP 工具**(完整 Schema、Resources 与各市场发布材料见 [`mcp/`](mcp/)): `add_task`、`detect_url`、`preview_torrent`、`wait_for_task`、`wait_for_all`、`list_tasks`、`get_task`、`pause_task`、`resume_task`、`set_task_priority`、`stream_task`、`remove_task`、`trash_task`、`restore_task`、`empty_trash`、`restore_all_trashed`、`get_config`、`set_config`、`play_in_unflick`。

### Skills 与一键安装

仓库内置了一套搭配 MCP 使用的 [Claude Skills](skills/) —— `unfetch-grab`(单文件下载)、`unfetch-batch`(批量下载)、`unfetch-media`(音视频画质选择)、`unfetch-watch`(队列监控管理)。在 Claude Code 中可作为插件一键安装(同时装好 MCP Server 与 Skills):

```
/plugin marketplace add guangtoutong/unfetch
/plugin install unfetch@unfetch
```

## 从源码构建

依赖:**pnpm**、**Rust** 工具链、**Go 1.23+**、**Node 20+**。

```bash
# 1. 前端
pnpm install
pnpm build

# 2. Go daemon(按平台编 —— Tauri externalBin 要求平台后缀)
cd core
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" \
  -o ../src-tauri/binaries/unfetch-daemon-aarch64-apple-darwin .
# (其他目标重复:x86_64、linux、windows)

# 3. Tauri 发布构建
cd ..
pnpm tauri build              # 当前平台
pnpm tauri build --target universal-apple-darwin   # macOS universal
```

macOS 发版构建+公证完整流程见 [scripts/build-mac.sh](scripts/build-mac.sh)。

## 发版流程

```bash
./scripts/release.sh 0.3.0      # bump → commit → tag → push(触发 CI 构建 Win/Linux)
./scripts/build-mac.sh 0.3.0    # 本地 universal 构建 + Apple 公证 + 上传 dmg
```

CI(`.github/workflows/release.yml`)**只构建 Windows + Linux** —— macOS 在本地公证,因为 Apple Developer 凭据不应该放在 CI 里。

## 支持开发

unfetch 由一位开发者业余维护。如果它帮你省了时间,欢迎赞助让项目继续走下去:

- [**GitHub Sponsors**](https://github.com/sponsors/zhitongblog) — 面向国际,月付或一次性(Stripe)
- [**PayPal**](https://paypal.me/solomdapp) — 海外一次性打赏
- **支付宝 / 微信支付** — 二维码见 <https://unfetch.org/#sponsor>

## 许可证

MIT 许可。见 [LICENSE](LICENSE)。

欢迎向上游贡献 —— unfetch 维护者也是 [`anacrolix/torrent`](https://github.com/anacrolix/torrent) 的活跃 contributor。
