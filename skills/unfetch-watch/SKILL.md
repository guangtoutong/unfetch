---
name: unfetch-watch
description: >-
  Inspect and manage the unfetch download queue — check progress, pause/resume,
  reorder priorities via config, and clean up finished or unwanted tasks (trash /
  restore / remove). Use when the user asks "what's downloading", "how's the download
  going", "pause/resume that", "stop all downloads", "清理已完成", "删掉这个任务",
  "下载到哪了", "暂停/恢复". For starting new downloads use unfetch-grab / unfetch-batch.
---

# unfetch-watch — 查看与管理下载队列

只读巡检 + 队列管理：进度、暂停/恢复、限速/并发调整、垃圾箱清理。

## 何时用

- 用户问"下载到哪了 / 在下什么 / 还要多久"
- 用户要暂停、恢复、停止、删除、清理任务
- 用户要调下载行为（并发、限速、完成后动作）

## 能力地图

| 用户意图 | 工具 |
|---|---|
| 看全部/某状态任务 | `list_tasks(status)` |
| 看单个任务进度详情 | `get_task(id)` |
| 暂停 / 恢复 | `pause_task(id)` / `resume_task(id)` |
| 暂停全部 | 先 `list_tasks(status:"downloading")`，逐个 `pause_task` |
| 移入垃圾箱（可恢复，不删文件） | `trash_task(id)` |
| 从垃圾箱恢复 | `restore_task(id)` / `restore_all_trashed` |
| 彻底删除任务 | `remove_task(id, delete_file?)` |
| 清空垃圾箱（删任务+文件） | `empty_trash` |
| 调并发/线程/代理/限速/完成动作 | `set_config(...)` |
| 看当前配置 | `get_config` |

## 关键安全规则（破坏性操作）

- `remove_task(delete_file:true)`、`empty_trash` 会**删本地文件**，不可恢复。执行前**必须先确认**：把要删的任务名/数量列给用户，得到明确同意再做。
- 用户只说"删掉/清理"且语气不强时，**优先 `trash_task`**（可恢复），而不是 `remove_task` / `empty_trash`。
- 批量操作前先 `list_tasks` 把目标范围念清楚，避免误删。

## 进度查询建议

- 一次性快照：`list_tasks` / `get_task` 即可，不要循环刷。
- 用户想"盯着直到下完"：用 `unfetch-grab` / `unfetch-batch` 的 `wait_for_task` / `wait_for_all`，会自动推进度。
- MCP host 支持 resources 时，可 `resources/subscribe` 到 `task://{id}`，状态变化会主动推送。

## set_config 可调项

`download_dir`、`max_concurrent`、`http_threads`、`proxy`、`speed_limit`、`auto_play_unflick`、`auto_retry`、`on_all_done`（``/`notify`/`open_dir`/`shutdown`/`sleep`）。改完可 `get_config` 回读确认。
