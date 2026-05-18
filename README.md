<div align="center">

# unfetch

**A modern download manager for humans and AI**

[![GitHub Release](https://img.shields.io/github/v/release/guangtoutong/unfetch?label=release&color=7c3aed&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/guangtoutong/unfetch/total?color=8b5cf6&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/releases)
[![Stars](https://img.shields.io/github/stars/guangtoutong/unfetch?color=a78bfa&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/stargazers)

[Website](https://unfetch.org) · [Download](https://unfetch.org/#download) · [Sponsor](https://unfetch.org/#sponsor) · [中文](README.zh.md)

</div>

---

unfetch is the download engine that finishes what your browser starts. Fast multi-mirror HTTP, real BT/magnet support, 1000+ video sites via yt-dlp, RSS subscriptions, completion hooks, and a token-secured remote Web UI — all driven by GUI, CLI, or AI through MCP. ~8 MB installer. MIT-style license. Zero telemetry.

## Features

- **Multi-mirror HTTP** — up to 32 threads × multiple mirror URLs, automatic fallback, resume, SHA256/MD5 verification.
- **BT / Magnet** — 35 public trackers, IPv6 + WebTorrent, file picker before download, peer/seeder stats, auto uTP fallback when your ISP throttles.
- **1000+ video sites** — YouTube, Bilibili, TikTok, X, and the rest via bundled yt-dlp.
- **AI-native (MCP)** — `add_task`, `list_tasks`, `wait_for_task`, progress notifications — from any MCP host (Claude Desktop, Cursor, Codex, …). No vendor lock-in.
- **Remote Web UI** — token-secured Web UI on `0.0.0.0` — manage downloads from your phone or remote box. QR-shareable.
- **RSS auto-fetch** — subscribe with regex filters, new items queued automatically, GUID deduped.
- **Completion hooks** — webhook POST or shell exec on done — pipe into Home Assistant / n8n / anything.
- **Task templates & dependency chains** — per-site Cookie/UA presets, wait-for-other-task, scheduled start times, per-hour bandwidth schedule.
- **6 themes** — Cream Light (default for new users), Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — switch live without restart.
- **Privacy first** — no ads, no telemetry, no login, no infohash uploads.

## Install

| Platform | Download |
|---|---|
| macOS (Apple Silicon + Intel, Notarized) | [`unfetch_*_universal.dmg`](https://github.com/guangtoutong/unfetch/releases/latest) |
| Windows 10/11 (NSIS installer) | [`unfetch_*_x64-setup.exe`](https://github.com/guangtoutong/unfetch/releases/latest) |
| Linux x64 (AppImage / deb / rpm) | [Releases page](https://github.com/guangtoutong/unfetch/releases/latest) |

Or grab the latest from <https://unfetch.org/#download>.

## Three frontends, one daemon

unfetch ships as a Go daemon + a Tauri shell. **Three frontends share one daemon, all backed by the same REST API on `localhost:19543`**:

- **GUI** — Tauri window (the default app icon launches this)
- **CLI** — `unfetch add <url>`, `unfetch list`, `unfetch pause <id>`, …
- **MCP** — `unfetch --mcp` (stdio JSON-RPC, drop into Claude Desktop config)
- **Browser extension** — see `extension/` for Chrome/Edge sniffer

```
┌──────────────────────────────────────────────────────────┐
│ Tauri 2 app (Rust + React + 6 themes)                    │
│   ├─ Main window / mini floating window                  │
│   ├─ Tray, clipboard sniffer, deep-link handler          │
│   └─ Forwards arguments / events to the daemon           │
└─────────────────────────────┬────────────────────────────┘
                              │ localhost:19543 (REST + SSE)
                              ▼
┌──────────────────────────────────────────────────────────┐
│ Go daemon (anacrolix/torrent + http downloader + yt-dlp) │
│   ├─ SQLite store of all tasks (resumes across restarts) │
│   ├─ Speed scheduler, retry queue, hash verifier         │
│   ├─ Remote Web UI on 0.0.0.0 (token-gated)              │
│   └─ Same API consumed by GUI / CLI / MCP / extension    │
└──────────────────────────────────────────────────────────┘
```

## Use with AI (MCP)

Drop this into your Claude Desktop / Cursor config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

Then your AI can `add_task`, `list_tasks`, `wait_for_task`, etc. See [docs/mcp.md](docs/mcp.md) for the full tool schema, or visit <https://unfetch.org/mcp>.

## Build from source

Prerequisites: **pnpm**, **Rust** toolchain, **Go 1.23+**, **Node 20+**.

```bash
# 1. Frontend
pnpm install
pnpm build

# 2. Go daemon (per-platform — Tauri externalBin requires platform-suffixed names)
cd core
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" \
  -o ../src-tauri/binaries/unfetch-daemon-aarch64-apple-darwin .
# (repeat for x86_64, linux, windows targets)

# 3. Tauri release build
cd ..
pnpm tauri build              # native target only
pnpm tauri build --target universal-apple-darwin   # macOS universal
```

For macOS release builds with notarization, see [scripts/build-mac.sh](scripts/build-mac.sh).

## Release workflow

```bash
./scripts/release.sh 0.3.0      # bump → commit → tag → push (triggers CI for Win/Linux)
./scripts/build-mac.sh 0.3.0    # local universal build + Apple notarize + upload dmg
```

CI in `.github/workflows/release.yml` only builds **Windows + Linux** — macOS is notarized locally because Apple Developer credentials should not live in CI.

## Support development

unfetch is built and maintained by one developer. If it saves you time, sponsorship helps keep it alive:

- [**GitHub Sponsors**](https://github.com/sponsors/zhitongblog) — international, monthly or one-time (Stripe)
- [**PayPal**](https://paypal.me/solomdapp) — worldwide one-time tip
- **Alipay / WeChat Pay** — scan QR at <https://unfetch.org/#sponsor>

## License

MIT-style license. See [LICENSE](LICENSE) (forthcoming — currently de-facto MIT).

Contributions to upstream are encouraged — unfetch's maintainer is also an active contributor to [`anacrolix/torrent`](https://github.com/anacrolix/torrent).
