# Copy-paste listing entries

Ready-made blurbs for community lists and directories. Pick the one that matches
the target's format.

---

## awesome-mcp-servers (one-line PR entry)

> Category suggestion: **Browser Automation** or **File Systems / Download**.
> File: `README.md` in https://github.com/punkpeye/awesome-mcp-servers (or any fork you submit to).

```markdown
- [guangtoutong/unfetch](https://github.com/guangtoutong/unfetch) 🦀 🖥️ - AI-native download manager: HTTP multi-threaded, BT/magnet, and 1000+ video sites via yt-dlp. Add tasks, wait for completion with live progress, and manage the queue over MCP.
```

Legend used by that list: 🦀 = Rust, 🖥️ = local/desktop service.

---

## mcp.so (submit form: https://mcp.so/submit)

**Name:** unfetch

**Title:** unfetch — download manager for humans and AI

**Description (short):**
```
AI-native download manager. Add HTTP / BT-magnet / 1000+ video-site downloads,
wait for them to finish with live progress notifications, manage the queue, and
subscribe to per-task resources — all over MCP stdio. Desktop app, zero telemetry,
MIT licensed.
```

**GitHub URL:** https://github.com/guangtoutong/unfetch
**Website:** https://unfetch.org
**Category:** Utilities / File Management
**Tags:** `download-manager`, `torrent`, `yt-dlp`, `http`, `rust`, `tauri`, `desktop`

**Config snippet to paste:**
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

---

## Glama / PulseMCP / other directories

Most accept the GitHub URL and auto-scrape the README. Make sure the repo root
README has an MCP section (it does) and that `mcp/server.json` is present so the
crawler can read structured metadata.

---

## Short social blurb (X / Reddit / HN)

```
unfetch now speaks MCP. Point Claude / Cursor / Codex at your download manager and
say "grab this and tell me when it's done" — HTTP, magnet links, and 1000+ video
sites, with live progress streamed back to the model. Desktop app, no telemetry,
MIT. https://github.com/guangtoutong/unfetch
```
