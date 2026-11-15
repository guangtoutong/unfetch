<div align="center">

# unfetch

**A modern download manager for humans and AI**

[![GitHub Release](https://img.shields.io/github/v/release/guangtoutong/unfetch?label=release&color=7c3aed&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/guangtoutong/unfetch/total?color=8b5cf6&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/releases)
[![Stars](https://img.shields.io/github/stars/guangtoutong/unfetch?color=a78bfa&labelColor=ede9fe&style=for-the-badge)](https://github.com/guangtoutong/unfetch/stargazers)

[Website](https://unfetch.org) · [Download](https://unfetch.org/#download) · [Sponsor](https://unfetch.org/#sponsor) · [中文](README.zh.md)

</div>

---

unfetch is the download engine that finishes what your browser starts. Fast multi-mirror HTTP + Metalink, real BT/magnet support with **live sequential streaming** and **malware file filtering**, native HLS (`.m3u8`) & MPEG-DASH (`.mpd`), 1000+ video sites via yt-dlp, RSS subscriptions, completion hooks, and a token-secured remote Web UI — all driven by GUI, CLI, or AI through MCP. ~8 MB installer. MIT license. Zero telemetry.

## Why unfetch?

| Capability | **unfetch** | Motrix | IDM | Downie | qBittorrent |
|---|:---:|:---:|:---:|:---:|:---:|
| **Multi-thread / Multi-mirror HTTP & Metalink (`.meta4`)** | ✅ (up to 32 threads) | ✅ | ✅ (Windows only) | ❌ | ❌ |
| **BitTorrent / Magnet + Seeding Control** | ✅ | ⚠️ (aria2 basic) | ❌ | ❌ | ✅ |
| **BT Trojan / `.mp4.exe` Auto-Blocker** | ✅ | ❌ | ❌ | ❌ | Manual |
| **Watch While Downloading (`206 Range` Stream)** | ✅ (`unfetch stream`) | ❌ | ❌ | ❌ | Sequential only |
| **HLS (`.m3u8` AES-128) & MPEG-DASH (`.mpd`)** | ✅ Native | ❌ | ⚠️ | ✅ (macOS only) | ❌ |
| **1000+ Video Sites (`yt-dlp`)** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **FTP / FTPS / SFTP & ed2k** | ✅ | ⚠️ FTP only | ⚠️ FTP only | ❌ | ❌ |
| **AI Agent Native (MCP Server + Claude Skills)** | ✅ (19 tools) | ❌ | ❌ | ❌ | ❌ |
| **Active Maintenance & Installer Size** | ✅ (~8 MB, Tauri 2 + Go) | ❌ (Stalled, Electron) | Paid | Paid | ✅ (~40 MB Qt) |

## Features

- **Multi-mirror HTTP, Metalink (`.meta4`), HLS (`.m3u8`), MPEG-DASH (`.mpd`) & FTP/SFTP** — up to 32 threads × multiple mirror URLs, RFC 5854 Metalink auto-mirror + checksum extraction, native HLS (`.m3u8` with AES-128 CBC decryption) and MPEG-DASH (`.mpd`) concurrent segment downloading & remuxing, automatic fallback, resume, SHA256/MD5 verification, plus native FTP/FTPS/SFTP and ed2k support.
- **Sequential Live Streaming (`unfetch stream`)** — watch BitTorrent/magnet and HTTP videos *while downloading* via a local HTTP `206 Partial Content` Range gateway (`GET /tasks/:id/stream`), with automatic first/last 2% piece priority boosting (`moov` header fast-start) and one-click playback in **Unflick** or mpv/IINA/VLC.
- **BT / Magnet, Seeding Control & Trojan Blocker** — 35 public trackers, IPv6 + WebTorrent, file picker before download, automatic detection & deselection of suspicious trojan files (`.scr`, `.vbs`, `.bat`, `.lnk`, `.ps1`, `.mp4.exe` double extensions, and `.exe` bundled inside video torrents), configurable target seed ratio & seed time limits, and auto uTP fallback.
- **Dynamic Queue Priority & Safe Smart Categorization** — 4-level priority scheduling (`-1` low to `2` urgent top-priority slot preemption), plus automatic extension-based folder routing (`Videos`, `Music`, `Archives`, `Programs`, `Documents`, `Images`, `ISO`) that never auto-extracts archives.
- **1000+ video sites** — YouTube, Bilibili, TikTok, X, and the rest via yt-dlp integration + `/deps/status` health probe.
- **AI-native (MCP)** — 19 tools (`add_task`, `stream_task`, `set_task_priority`, `list_tasks`, `wait_for_task`, live progress notifications) from any MCP host (Claude Desktop, Claude Code, Cursor, Codex, Unterm). No vendor lock-in.
- **Remote Web UI** — token-secured Web UI on `0.0.0.0` — manage downloads from your phone or remote box. QR-shareable.
- **RSS auto-fetch** — subscribe with regex filters, new items queued automatically, GUID deduped.
- **Completion hooks** — webhook POST or shell exec on done — pipe into Home Assistant / n8n / anything.
- **Task templates & dependency chains** — per-site Cookie/UA presets, wait-for-other-task, scheduled start times, per-hour bandwidth schedule.
- **6 themes & 14 languages** — Cream Light (default for new users), Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — switch live without restart.
- **Privacy first** — no ads, no telemetry, no login, no infohash uploads.

## Install

| Platform | Download |
|---|---|
| macOS (Apple Silicon + Intel, Notarized) | [`unfetch_*_universal.dmg`](https://github.com/guangtoutong/unfetch/releases/latest) |
| Windows 10/11 (NSIS installer) | [`unfetch_*_x64-setup.exe`](https://github.com/guangtoutong/unfetch/releases/latest) |
| Linux x64 (AppImage / deb / rpm) | [Releases page](https://github.com/guangtoutong/unfetch/releases/latest) |

**Homebrew (macOS)** — Cask formula included in [`packaging/homebrew/unfetch.rb`](packaging/homebrew/unfetch.rb):
```bash
brew install --cask guangtoutong/tap/unfetch
```

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

Then your AI can `add_task`, `list_tasks`, `wait_for_task`, etc. See [mcp/README.md](mcp/README.md) for the full tool schema, or visit <https://unfetch.org/mcp>.

**19 MCP tools** (full schemas, resources, and per-marketplace publishing materials live in [`mcp/`](mcp/)): `add_task`, `detect_url`, `preview_torrent`, `wait_for_task`, `wait_for_all`, `list_tasks`, `get_task`, `pause_task`, `resume_task`, `set_task_priority`, `stream_task`, `remove_task`, `trash_task`, `restore_task`, `empty_trash`, `restore_all_trashed`, `get_config`, `set_config`, `play_in_unflick`.

### Skills & one-command install

A set of [Claude skills](skills/) ships alongside the MCP server — `unfetch-grab` (single download), `unfetch-batch` (bulk), `unfetch-media` (video/audio + quality), and `unfetch-watch` (queue management). Install everything (MCP server + skills) as a Claude Code plugin:

```
/plugin marketplace add guangtoutong/unfetch
/plugin install unfetch@unfetch
```

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

MIT License. See [LICENSE](LICENSE).

Contributions to upstream are encouraged — unfetch's maintainer is also an active contributor to [`anacrolix/torrent`](https://github.com/anacrolix/torrent).
