# unfetch skills

一套驱动 [unfetch](https://github.com/guangtoutong/unfetch) 下载引擎的 Claude skills。
每个 skill 是一段高层工作流，底层调用 unfetch 的 **MCP 工具**（`unfetch --mcp`）。

> 前提：装好 unfetch 桌面 app 并在 MCP host 里配好 `unfetch` server（见 [`../mcp/README.md`](../mcp/README.md)）。
> skills 本身不下载文件，它们编排 MCP 工具去做。

| Skill | 触发场景 | 主要工具 |
|---|---|---|
| [`unfetch-grab`](unfetch-grab/SKILL.md) | "下这个链接 / 下完告诉我" | `add_task` → `wait_for_task` |
| [`unfetch-batch`](unfetch-batch/SKILL.md) | 一次性下一堆 URL / 一个清单 | `add_task` ×N → `wait_for_all` |
| [`unfetch-media`](unfetch-media/SKILL.md) | 下视频/音频、选清晰度、下完播放 | `add_task(quality)` → `play_in_unflick` |
| [`unfetch-watch`](unfetch-watch/SKILL.md) | 看进度、暂停/恢复、清理队列 | `list_tasks` / `pause` / `resume` / `trash` |

## 安装方式

**方式一：Claude Code 插件（推荐，连 MCP 一起装）**

```
/plugin marketplace add guangtoutong/unfetch
/plugin install unfetch@unfetch
```

**方式二：手动放进 skills 目录**

把任意 skill 目录复制到：
- 项目级：`<repo>/.claude/skills/<skill-name>/SKILL.md`
- 用户级：`~/.claude/skills/<skill-name>/SKILL.md`

## 给其他应用作者

这套 skills 是"app 能力 → MCP 工具 → skill 工作流"的范例：
1. 先把核心能力做成 MCP server（read 默认开放，write 显式开关）；
2. 再为高频用户意图写薄薄一层 skill，把多个工具编排成一句话能触发的流程；
3. 用 Claude 插件把两者打包，一条命令分发。
