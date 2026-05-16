# unfetch

A modern download manager for humans and AI.

## What it does

- **HTTP / HTTPS multi-thread download** with resume support
- **BT / Magnet links** via the anacrolix/torrent engine
- **1000+ video sites** via the bundled yt-dlp integration (YouTube, Bilibili, Twitter/X, TikTok, etc.)
- **Browser extension** (Chrome / Edge) to intercept and offload downloads to the desktop
- **MCP server** so AI agents can drive downloads (`add_task`, `list_tasks`, `pause_task`, ...)
- **CLI** for terminal-driven workflows (`unfetch add <url>`)

## Highlights

| | unfetch |
|---|---|
| Magnet / `.torrent` association | ✓ |
| System tray + minimize to tray | ✓ |
| Mini floating window | ✓ |
| Clipboard URL sniffer | ✓ |
| Drag & drop links / torrent files | ✓ |
| Scheduled downloads (`start_at`) | ✓ |
| Per-hour bandwidth schedule | ✓ |
| File hash verification (SHA256 / MD5) | ✓ |
| Auto retry on failure with backoff | ✓ |
| Task tags / trash bin with bulk ops | ✓ |
| Action after all downloads done (notify / open dir / sleep / shutdown) | ✓ |
| SOCKS5 proxy support | ✓ |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Tauri 2 app (Rust + React)                               │
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
│   └─ Same API consumed by GUI / CLI / MCP / extension    │
└──────────────────────────────────────────────────────────┘
```

Three frontends share one daemon:
- **GUI** — Tauri window
- **CLI** — `unfetch add <url>` and friends
- **MCP** — `unfetch --mcp` (stdio JSON-RPC)
- **Browser extension** — `extension/` directory, loadable in Chrome / Edge

## Build

Prerequisites: pnpm, Rust toolchain, Go 1.21+.

```bash
# Go daemon
cd core
go build -ldflags="-H windowsgui -s -w" -o unfetch-daemon.exe .
cp unfetch-daemon.exe ../src-tauri/binaries/unfetch-daemon-x86_64-pc-windows-msvc.exe

# Tauri release build (NSIS installer for Windows)
cd ..
pnpm install
pnpm tauri build
```

Output: `src-tauri/target/release/bundle/nsis/unfetch_0.1.0_x64-setup.exe`

## License

TBD.
