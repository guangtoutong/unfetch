---
name: unfetch-grab
description: >-
  Download a single URL with unfetch and report when it's done. Use when the user
  pastes a link or says "download this", "grab this file", "save this", "下这个",
  "帮我下载", especially when they want to be told when it finishes. Handles HTTP/HTTPS
  direct links, magnet links, and torrent URLs. For video/audio sites with quality
  choices use unfetch-media instead; for many URLs at once use unfetch-batch.
---

# unfetch-grab — 下载单个链接并回报结果

通过 unfetch MCP server 下载一个链接，并在完成后给出文件位置和结果。

## 何时用

- 用户贴了一个直链 / 磁力链接 / 种子 URL 让你下载
- 用户说"下完告诉我" —— 需要阻塞等待并回报
- 不涉及视频清晰度选择（那种用 `unfetch-media`）、也不是一次下很多个（那种用 `unfetch-batch`）

## 步骤

1. **加任务**：调用 `add_task`，至少传 `url`。
   - 用户指定了保存位置/文件名 → 带上 `save_dir` / `filename`。
   - 用户在意完整性且给了校验值 → 带上 `expected_sha256` 或 `expected_md5`。
   - 用户说"等会儿/几点再下" → 带 `start_at`（RFC3339）。
   - 返回里拿到任务 `id`。
2. **等完成**：调用 `wait_for_task(id)`。
   - 它会阻塞直到 `done` / `error`，期间持续推送 `notifications/progress`。
   - 大文件可调大 `timeout_seconds`（默认 1800 秒）。
3. **回报**：
   - 成功 → 告诉用户最终文件名、保存路径、大小；如果设了校验值，确认校验通过。
   - 失败（`status: error`）→ 把 `error` 字段念给用户，给出常见原因（链接失效 / 需要 cookie / 网络）。
   - 超时（返回里 `_wait_timeout: true`）→ 说明仍在下载，可稍后用 `get_task(id)` 再查。

## 注意

- 不要轮询 `get_task` 来等完成 —— 直接用 `wait_for_task`，进度由它推。
- 同一个链接重复添加前，可先 `list_tasks` 看是否已存在。
- magnet/种子是 BT，初期可能 0 速度（在找 peer），属正常，耐心等。
