---
name: unfetch-batch
description: >-
  Queue many downloads at once with unfetch and wait for the whole batch to finish.
  Use when the user provides multiple URLs, a list/file of links, or says "download
  all of these", "批量下载", "下载这个列表", "把这些都下了". Adds every URL as a task, then
  blocks on the whole queue and reports a summary. For a single link use unfetch-grab.
---

# unfetch-batch — 批量下载并汇总

把一组链接全部排入 unfetch 队列，等整批跑完，给出汇总报告。

## 何时用

- 用户给了多个 URL（粘贴一堆、给一个清单/文件、或 RSS 里的一批）
- 用户说"全部下载 / 批量下 / 这些都下了"

## 步骤

1. **解析清单**：从用户输入里抽出所有链接（每行一个、逗号分隔、或文件内容）。去重。
2. **逐个加任务**：对每个 URL 调 `add_task`。
   - 全局选项（保存目录、代理、线程、清晰度）对每个任务都带上，保持一致。
   - 给整批打同一个 `tags`（如 `["batch-2026-05-31"]`），方便之后筛选/管理。
   - 收集每个返回的 `id`。
   - 某条加失败不要中断，记下来，继续加剩下的。
3. **等整批**：调用 `wait_for_all`。
   - 它会等到没有 queued/downloading/paused 的任务，期间推送"已完成 N/总数"进度。
   - 批量大/文件大时调大 `timeout_seconds`（默认 3600 秒）。
4. **汇总**：`wait_for_all` 返回后，用 `list_tasks(status:"done")` 和 `list_tasks(status:"error")` 核对，报告：
   - 成功 X 个（列文件名/路径）
   - 失败 Y 个（列 URL + error 原因）
   - 如超时（返回 `timeout: true`）→ 说明还有 N 个在进行，可稍后再查。

## 注意

- 并发数由 daemon 的 `max_concurrent` 控制；用户嫌慢可先 `set_config(max_concurrent)` 调高再开下。
- 不要为每个任务单独 `wait_for_task` 串行等 —— 一次性全加进去，再 `wait_for_all`，并发跑得更快。
- 给整批统一 `tags` 后，清理时可配合 `unfetch-watch` 按标签批量处理。
