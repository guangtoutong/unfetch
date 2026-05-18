<div align="center">

# unfetch

**为人和 AI 设计的下载管理器**

[![GitHub Release](https://img.shields.io/github/v/release/guangtoutong/unfetch?label=release&color=7c3aed&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/releases/latest)
[![下载量](https://img.shields.io/github/downloads/guangtoutong/unfetch/total?label=downloads&color=8b5cf6&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/releases)
[![Stars](https://img.shields.io/github/stars/guangtoutong/unfetch?color=a78bfa&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/stargazers)

[官网](https://unfetch.org) · [下载](https://unfetch.org/#download) · [赞助](https://unfetch.org/#sponsor) · [English](README.md)

</div>

---

unfetch 是把浏览器没下完的活接走的下载引擎。多镜像 HTTP 高速并发、原生 BT/磁力、yt-dlp 集成的 1000+ 视频网站、RSS 自动订阅、完成钩子、token 鉴权的远程 Web UI —— GUI、CLI、AI(MCP)都能驱动。约 8 MB 安装包,MIT 风格许可,默认零遥测。

## 核心功能

- **多镜像 HTTP** — 最多 32 线程 × 多镜像 URL 并发,失败自动 fallback,断点续传,SHA256/MD5 校验。
- **BT / 磁力** — 35 个公共 tracker、IPv6 + WebTorrent、下载前选文件、显示 peer 和做种数、ISP 屏蔽时自动切 uTP。
- **1000+ 视频网站** — 通过内置 yt-dlp 支持 YouTube、B 站、抖音、X 等。
- **AI 原生(MCP)** — `add_task` / `list_tasks` / `wait_for_task` / 进度通知 —— 任意 MCP 宿主(Claude Desktop、Cursor、Codex …)都能调用,无锁定。
- **远程 Web UI** — `0.0.0.0` + token 鉴权 —— 手机或远程机器都能管下载,可生成访问链接二维码。
- **RSS 自动订阅** — 订阅源加正则过滤,新条目自动入队,GUID 去重。
- **完成钩子** — Webhook POST 或 Shell exec —— 任务完成接 Home Assistant / n8n / 任何自动化流程。
- **任务模板和依赖链** — 按站点预设 Cookie / UA,任务依赖链等待前置完成,定时启动,按小时带宽计划。
- **6 套主题** — 乳白(新用户默认)、深堡野、亮色纸、护眼绿、赛博朋克、极简灰白 —— 一键切换无需重启。
- **隐私至上** — 无广告、无遥测、无登录、不上传 infohash。

## 安装

| 平台 | 下载 |
|---|---|
| macOS(Apple Silicon + Intel,已 Apple 公证) | [`unfetch_*_universal.dmg`](https://github.com/guangtoutong/unfetch/releases/latest) |
| Windows 10/11(NSIS 安装器) | [`unfetch_*_x64-setup.exe`](https://github.com/guangtoutong/unfetch/releases/latest) |
| Linux x64(AppImage / deb / rpm) | [Release 页面](https://github.com/guangtoutong/unfetch/releases/latest) |

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

然后你的 AI 就可以 `add_task` / `list_tasks` / `wait_for_task` 等。完整工具列表见 [docs/mcp.md](docs/mcp.md) 或 <https://unfetch.org/mcp>。

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

MIT 风格许可。见 [LICENSE](LICENSE)(待补 —— 当前事实上 MIT)。

欢迎向上游贡献 —— unfetch 维护者也是 [`anacrolix/torrent`](https://github.com/anacrolix/torrent) 的活跃 contributor。
