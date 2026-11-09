<div align="center">

# unfetch MCP — 上架与分发材料

**把 unfetch 的下载能力做成可被任意 AI 调用的 MCP server + 一套 Claude skills**

[主仓库](https://github.com/guangtoutong/unfetch) · [官网](https://unfetch.org) · [English README](../README.md)

</div>

---

这个目录是 unfetch 提交到各大 MCP / skills 市场的**全套材料**，也方便其他应用照着学怎么把一个桌面下载工具暴露成 AI 可用的能力。

| 文件 | 用途 |
|---|---|
| `README.md`（本文件） | 总览 + 各市场提交步骤 |
| `server.json` | MCP 官方 registry 的标准 manifest |
| `smithery.yaml` | Smithery 一键安装配置 |
| `awesome-entry.md` | mcp.so / awesome-mcp-servers / 社交平台的复制粘贴文案 |
| `../skills/` | 一整套驱动 unfetch 的 Claude skills（4 个） |
| `../.claude-plugin/` + `../.mcp.json` | Claude Code 插件市场打包（MCP + skills 一起装） |

---

## 1. 这是什么

unfetch 是一个桌面下载管理器（Go daemon + Tauri 壳），它把同一套下载能力暴露成 **GUI / CLI / MCP** 三个前端。MCP server 就是 app 二进制本身，用 `--mcp` 启动：

```
unfetch --mcp        # stdio JSON-RPC 2.0，自动拉起本地 daemon（localhost:19543）
```

- **协议版本**：`2024-11-05`
- **serverInfo.name**：`unfetch`
- **能力**：`tools` + `resources`（支持 subscribe / listChanged）+ `logging`
- **传输**：stdio（行分隔 JSON）

> ⚠️ **版本对齐提醒**：`serverInfo.version` 取的是 `CARGO_PKG_VERSION`，目前 `src-tauri/Cargo.toml` 是 `0.2.1`，而产品公开版是 `0.2.4`。上架材料统一按 `0.2.4` 写，建议把 Cargo.toml 也 bump 到 `0.2.4`，否则市场上看到的版本会是 0.2.1。

## 2. 客户端接入配置

Claude Desktop / Cursor / Codex 等任意 MCP host：

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

- macOS 配置文件：`~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows：把 `command` 换成 `unfetch.exe` 的绝对路径（或确保在 PATH 上直接写 `"unfetch"`）
- Linux：`unfetch` 二进制路径

不需要任何 API key —— 所有状态在本地 daemon。

## 3. 工具清单（17 个）

| 工具 | 说明 | 必填参数 |
|---|---|---|
| `add_task` | 添加下载（HTTP/HTTPS、`magnet:`、1000+ 视频站） | `url` |
| `wait_for_task` | 阻塞等单个任务完成/失败，期间推 `notifications/progress` | `id` |
| `wait_for_all` | 等所有未完成任务（queued/downloading/paused）跑完或超时 | — |
| `list_tasks` | 列任务，可按 `status` 过滤 | — |
| `get_task` | 单任务详情 + 实时进度 | `id` |
| `pause_task` | 暂停 | `id` |
| `resume_task` | 恢复 | `id` |
| `remove_task` | 彻底删除（可选 `delete_file`） | `id` |
| `trash_task` | 移入垃圾箱（可恢复，不删文件） | `id` |
| `restore_task` | 从垃圾箱恢复 | `id` |
| `empty_trash` | 清空垃圾箱（删任务+文件） | — |
| `restore_all_trashed` | 恢复所有垃圾箱任务 | — |
| `get_config` | 读配置 | — |
| `set_config` | 改配置（下载目录/并发/线程/代理/限速/完成动作…） | — |
| `play_in_unflick` | 用 Unflick 播放本地文件 | `path` |

`add_task` 完整参数：`url`(必填)、`save_dir`、`filename`、`threads`、`quality`(`best`/`1080p`/`720p`/`480p`/`audio`)、`proxy`、`play_after`、`tags[]`、`start_at`(RFC3339 定时)、`expected_sha256`、`expected_md5`。

### Resources（任务即资源）

每个任务暴露为 `task://{id}` 资源：

- `resources/list` —— 列出所有任务
- `resources/read` —— 读单任务完整 JSON
- `resources/subscribe` —— 每 2s 轮询，状态/进度变化时推 `notifications/resources/updated`

### 典型对话流

> "帮我下这个 4K 视频，下完告诉我" → `add_task(url, quality:"best")` → `wait_for_task(id)`（进度实时回传）→ 完成。

## 4. 各市场提交步骤

> 你要自己提交，下面是每个市场要做的事 + 用哪个文件。

### A. MCP 官方 registry（registry.modelcontextprotocol.io）

官方 registry 用 `server.json` + `mcp-publisher` CLI 发布，按 GitHub namespace 验证所有权。

```bash
# 1. 装发布器
brew install mcp-publisher        # 或见官方 repo 的安装说明

# 2. 在 mcp/server.json 所在目录登录（GitHub OAuth，验证 io.github.guangtoutong/* 命名空间）
mcp-publisher login github

# 3. 发布
mcp-publisher publish ./mcp/server.json
```

⚠️ **注意**：官方 registry 的 `packages` 目前主要认 npm / pypi / nuget / oci / **mcpb** 这几类。unfetch 是桌面 app（dmg/exe 安装），不在包管理器里。`server.json` 里我用了 `registryType: "mcpb"` 并在 `runtimeHint` 说明"需先装桌面 app"。**最干净的做法**是后续在 GitHub Release 里附一个 `.mcpb` bundle（MCP Bundle），再把 `server.json` 指向它。在那之前，下面 B/C/D 三个渠道对桌面型 server 更友好，建议优先。

### B. mcp.so（最大的中文友好 MCP 目录）

1. 打开 https://mcp.so/submit
2. 用 `awesome-entry.md` 里"mcp.so"小节的字段直接填
3. GitHub URL 填主仓库，它会自动抓 README

### C. awesome-mcp-servers（GitHub 社区清单，曝光高）

1. Fork https://github.com/punkpeye/awesome-mcp-servers
2. 在合适分类（建议 *Browser Automation* 或 *File Systems*）加一行 —— 文案见 `awesome-entry.md`
3. 提 PR

### D. Smithery（https://smithery.ai）

1. 在 Smithery 上 "Add Server"，关联 GitHub 仓库
2. 它会读取仓库里的 `smithery.yaml`（我放在 `mcp/smithery.yaml`，若 Smithery 要求在仓库根目录，复制一份到根目录即可）
3. unfetch 是 local stdio server，用户装好桌面 app 后即可一键接入

### E. Claude Code 插件市场（捆绑 MCP + skills，一条命令安装）

见 `../.claude-plugin/`。其他人只需：

```
/plugin marketplace add guangtoutong/unfetch
/plugin install unfetch@unfetch
```

装完同时获得：unfetch MCP server + 4 个 skills。详见 `../skills/README.md`。

## 5. 上架前检查清单

- [x] `LICENSE`（MIT）已创建 —— 多数市场要求明确 license
- [x] 主仓库 README 有 MCP 章节
- [x] `mcp/server.json` 结构化元信息齐全
- [ ] 把 `Cargo.toml` 版本 bump 到 `0.2.4`，让 `serverInfo.version` 对齐
- [ ] （可选，官方 registry 用）出一个 `.mcpb` bundle 挂到 Release
- [ ] 截图 / GIF：AI 下载并回报进度的演示（市场详情页转化率高）
