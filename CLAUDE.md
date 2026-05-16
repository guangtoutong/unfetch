# unfetch — 开发指南

## 产品定位

unfetch 是一个**专注于下载**的工具，是 Unflick 生态的下载引擎层。

**核心问题**：Unflick 内置的视频下载能力很弱——它只是调用 yt-dlp 提取流媒体 URL 然后用 mpv 播放，并没有真正的下载管理：无断点续传、无多线程加速、无队列管理、无 BT/磁力链接支持。unfetch 填补这个缺口。

**定位关系**：
```
Unflick  →  播放（libmpv，本地文件 + 流媒体）
unfetch  →  获取（HTTP 多线程 + BT + 磁力 + ed2k + 1000+ 视频网站）
```

**联动方式**：unfetch 下载完成后，可一键调用 `unflick play <file>`；Unflick 中"另存为"按钮调用 `unfetch add <url>`。

---

## 架构决策

### CLI/MCP First（继承自 Unflick）

**每个功能必须先通过 CLI 和 MCP 可用，然后才考虑 GUI。**

GUI 是可选的，daemon 是必须的。关掉 GUI 窗口不影响正在进行的下载任务。

### 双进程架构

```
Go daemon（下载引擎）  ←── REST API ──→  Rust/Tauri shell（GUI + CLI + MCP）
     ↑                                          ↑
     └── unfetch add <url>                      └── unfetch --mcp
          (CLI 直接调用 daemon API)                  (AI 工具)
```

- **Go daemon**：负责所有下载逻辑（HTTP、BT、yt-dlp 集成）。以独立进程运行，暴露本地 REST API（默认端口 `19543`）。Go 二进制打包进 Tauri 的 resources 目录。
- **Rust/Tauri shell**：负责 GUI 窗口、CLI 命令解析（clap）、MCP 服务器。所有操作都通过 REST API 转发给 Go daemon，自身不包含任何下载逻辑。

### 为什么用 Go 做 daemon，而不是纯 Rust？

- `go-ytdlp`（Go 绑定）比 Rust 的 yt-dlp 集成成熟得多
- `anacrolix/torrent`（Go BT 库）功能完整，是业界标准
- Go 的 goroutine 天然适合并发下载任务管理
- Unflick 已经用了 Rust，两个项目技术栈互补而不重复

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 下载引擎 | Go 1.23+ | daemon 进程，REST API |
| BT 协议 | `anacrolix/torrent` | 支持 BT + 磁力链接 |
| 视频网站下载 | `go-ytdlp` (go-ytdlp/go-ytdlp) | 包装 yt-dlp 二进制 |
| HTTP 下载 | 自研，基于 Go `net/http` | 多线程分片 + 断点续传 |
| ed2k 协议 | `go-ed2k` 或调用 aMule CLI | 可选，后期支持 |
| GUI 框架 | Tauri 2 + React 18 + TypeScript | 与 Unflick 一致 |
| 前端状态 | Zustand | 与 Unflick 一致 |
| 前端样式 | Tailwind CSS + Framer Motion | 与 Unflick 一致 |
| CLI 解析 | clap 4（Rust） | 与 Unflick 一致 |
| MCP 服务器 | Rust（JSON-RPC 2.0 over stdio） | 与 Unflick 一致 |
| 配置持久化 | JSON（`~/.config/unfetch/config.json`）| |
| 任务持久化 | SQLite（Go 侧，`~/.local/share/unfetch/tasks.db`）| |
| 包管理（前端）| pnpm | 全局约定 |

---

## 目录结构

```
unfetch/
├── CLAUDE.md
├── README.md
├── .gitignore
│
├── core/                          # Go daemon（下载引擎）
│   ├── go.mod
│   ├── go.sum
│   ├── main.go                    # daemon 入口，启动 HTTP 服务器
│   ├── api/
│   │   ├── router.go              # REST API 路由（chi 或 gin）
│   │   ├── tasks.go               # /tasks 端点
│   │   └── config.go              # /config 端点
│   ├── downloader/
│   │   ├── http.go                # 多线程 HTTP 下载（分片 + 续传）
│   │   ├── bt.go                  # BT + 磁力链接（anacrolix/torrent）
│   │   └── ytdlp.go               # yt-dlp 集成（go-ytdlp）
│   ├── queue/
│   │   ├── manager.go             # 任务队列（并发控制、优先级）
│   │   └── store.go               # SQLite 持久化
│   └── types/
│       └── task.go                # Task、Status、Config 数据结构
│
├── src/                           # React 前端
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── components/
│   │   ├── TaskList/
│   │   │   ├── TaskList.tsx       # 下载任务列表
│   │   │   └── TaskItem.tsx       # 单个任务（进度条、速度、ETA）
│   │   ├── AddTask/
│   │   │   └── AddTaskDialog.tsx  # 添加任务对话框（URL 输入 + 选项）
│   │   ├── Settings/
│   │   │   └── SettingsPanel.tsx
│   │   └── TitleBar.tsx
│   ├── stores/
│   │   ├── taskStore.ts           # 下载任务状态
│   │   └── settingsStore.ts
│   └── lib/
│       └── api.ts                 # 调用 daemon REST API 的封装
│
└── src-tauri/                     # Rust/Tauri shell
    ├── Cargo.toml
    ├── tauri.conf.json
    └── src/
        ├── main.rs                # 模式检测（GUI / CLI / MCP）
        ├── lib.rs
        ├── daemon/
        │   └── mod.rs             # 启动/检测 Go daemon 进程
        ├── cli/
        │   ├── mod.rs
        │   └── commands.rs        # clap 命令定义 → 调用 daemon REST API
        ├── mcp/
        │   ├── mod.rs
        │   ├── server.rs          # JSON-RPC 2.0 over stdio
        │   └── tools.rs           # MCP 工具定义
        └── gui/
            └── commands.rs        # Tauri commands（主要是代理给 daemon）
```

---

## 运行模式

```bash
unfetch                            # 启动 GUI（自动启动 daemon）
unfetch daemon                     # 仅启动 daemon（无头，适合服务器/开机自启）
unfetch add <url> [options]        # CLI：添加下载任务
unfetch list                       # CLI：列出所有任务
unfetch pause <id>                 # CLI：暂停任务
unfetch resume <id>                # CLI：恢复任务
unfetch remove <id> [--delete]     # CLI：删除任务（--delete 同时删文件）
unfetch status <id>                # CLI：查看任务详情（JSON 输出）
unfetch config get <key>           # CLI：查看配置
unfetch config set <key> <value>   # CLI：修改配置
unfetch --mcp                      # MCP 服务器模式（stdio JSON-RPC）
```

### main.rs 模式检测逻辑

```
unfetch（无参数）        → 启动 GUI（Tauri 窗口）
unfetch daemon           → 转发给 Go daemon 进程（直接启动 core/unfetch-core）
unfetch <subcommand>     → CLI 模式（调用 daemon REST API）
unfetch --mcp            → MCP 服务器（调用 daemon REST API）
```

---

## CLI 命令完整定义

```rust
#[derive(Parser)]
#[command(name = "unfetch", about = "A download manager for humans and AI")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,

    #[arg(long)]
    pub mcp: bool,
}

#[derive(Subcommand)]
pub enum Commands {
    /// 启动后台 daemon
    Daemon,

    /// 添加下载任务
    Add {
        url: String,
        #[arg(long, short = 'o')]
        output: Option<String>,       // 输出路径
        #[arg(long)]
        filename: Option<String>,     // 指定文件名
        #[arg(long, default_value = "8")]
        threads: u8,                  // HTTP 分片线程数
        #[arg(long)]
        quality: Option<String>,      // 视频质量（best/1080p/720p/audio）
        #[arg(long)]
        proxy: Option<String>,        // 代理
        #[arg(long)]
        cookies: Option<String>,      // cookie 文件或浏览器名称
        #[arg(long)]
        play_after: bool,             // 下载完成后在 Unflick 中播放
    },

    /// 列出所有任务
    List {
        #[arg(long, default_value = "all")]
        status: String,               // all/downloading/paused/done/error
        #[arg(long)]
        json: bool,
    },

    /// 查看任务详情
    Status { id: String },

    /// 暂停任务
    Pause { id: String },

    /// 恢复任务
    Resume { id: String },

    /// 取消并删除任务
    Remove {
        id: String,
        #[arg(long)]
        delete: bool,                 // 同时删除已下载的文件
    },

    /// 配置管理
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
}

#[derive(Subcommand)]
pub enum ConfigAction {
    Get { key: String },
    Set { key: String, value: String },
    List,
}
```

---

## MCP 工具列表

MCP 服务器暴露以下工具，供 Claude / Cursor 等 AI 使用：

| 工具名 | 描述 |
|--------|------|
| `add_task` | 添加下载任务（URL + 选项） |
| `list_tasks` | 列出所有任务（可按状态过滤） |
| `get_task` | 获取单个任务详情和进度 |
| `pause_task` | 暂停下载任务 |
| `resume_task` | 恢复下载任务 |
| `remove_task` | 删除任务 |
| `get_config` | 获取配置项 |
| `set_config` | 修改配置项 |
| `detect_url` | 检测 URL 类型（HTTP/BT/yt-dlp 可识别的网站） |
| `play_in_unflick` | 用 Unflick 播放已下载的文件 |

---

## Go Daemon REST API

Daemon 监听 `127.0.0.1:19543`，所有接口返回 JSON。

```
POST   /tasks                  # 添加任务
GET    /tasks                  # 列出任务（?status=all|downloading|paused|done|error）
GET    /tasks/:id              # 获取任务详情
PATCH  /tasks/:id/pause        # 暂停
PATCH  /tasks/:id/resume       # 恢复
DELETE /tasks/:id              # 删除（?delete_file=true）
GET    /config                 # 获取所有配置
PATCH  /config                 # 更新配置
GET    /health                 # 健康检查（用于判断 daemon 是否在运行）
```

### Task 数据结构

```go
type Task struct {
    ID          string    `json:"id"`
    URL         string    `json:"url"`
    Filename    string    `json:"filename"`
    SavePath    string    `json:"save_path"`
    Type        TaskType  `json:"type"`    // http / bt / ytdlp
    Status      Status    `json:"status"`  // queued / downloading / paused / done / error
    TotalBytes  int64     `json:"total_bytes"`
    DoneBytes   int64     `json:"done_bytes"`
    Speed       int64     `json:"speed"`   // bytes/sec
    ETA         int       `json:"eta"`     // 秒
    CreatedAt   time.Time `json:"created_at"`
    FinishedAt  *time.Time `json:"finished_at,omitempty"`
    Error       string    `json:"error,omitempty"`
    Metadata    TaskMeta  `json:"metadata"` // 标题、封面、来源网站等
}
```

---

## 协议支持矩阵

| 协议 | 实现方式 | 状态 |
|------|---------|------|
| HTTP/HTTPS 多线程 | 自研（Go `net/http` + goroutine 分片） | Phase 1 |
| BT 种子文件 | `anacrolix/torrent` | Phase 1 |
| 磁力链接 | `anacrolix/torrent`（DHT） | Phase 1 |
| 视频网站（1000+） | `go-ytdlp`（包装 yt-dlp 二进制） | Phase 1 |
| ed2k | `go-ed2k` 或 aMule CLI 包装 | Phase 3 |
| FTP/SFTP | Go 标准库 | Phase 2 |

---

## 与 Unflick 的联动

### unfetch → Unflick（下载完播放）

```go
// 下载完成后，如果设置了 play_after，调用 unflick
func playInUnflick(filePath string) error {
    unflickPath, err := exec.LookPath("unflick")
    if err != nil {
        return err
    }
    return exec.Command(unflickPath, "play", filePath).Start()
}
```

### Unflick → unfetch（另存为）

Unflick 通过 CLI 调用：
```bash
unfetch add "<stream_url>" --filename "video_title.mp4" --play-after
```

### 配置联动

两个工具共享 `~/.config/un-suite/` 下的部分配置（代理、默认下载目录）。

---

## 开发阶段

### Phase 0：脚手架（当前）
- [ ] 项目目录初始化
- [ ] Go daemon 骨架（HTTP 服务器 + /health 端点）
- [ ] Rust/Tauri 骨架（三模式检测：GUI/CLI/MCP）
- [ ] React 前端骨架（空白任务列表）
- [ ] Rust CLI 骨架（`unfetch add`、`unfetch list`）
- [ ] 确认三个进程能正常通信

### Phase 1：核心下载能力
- [ ] HTTP 多线程下载（分片 + 断点续传）
- [ ] BT + 磁力链接下载（anacrolix/torrent）
- [ ] yt-dlp 集成（go-ytdlp，支持 1000+ 网站）
- [ ] 任务队列（并发控制：最多同时 N 个任务）
- [ ] SQLite 任务持久化（重启恢复任务状态）
- [ ] 前端：任务列表 + 实时进度条（轮询 /tasks）
- [ ] 前端：添加任务对话框（URL 输入 + 质量选择）

### Phase 2：体验打磨
- [ ] 浏览器扩展（Chrome/Edge/Firefox，右键"用 unfetch 下载"）
- [ ] 系统托盘（最小化到托盘，不退出 daemon）
- [ ] 下载完成通知（系统通知）
- [ ] Unflick 联动（下载完播放按钮）
- [ ] FTP/SFTP 支持

### Phase 3：高级功能
- [ ] 调度下载（定时开始/限速时段）
- [ ] 全局限速（上传/下载带宽上限）
- [ ] ed2k 协议
- [ ] MCP 工具完整实现
- [ ] CLI 补全（bash/zsh/fish/powershell）

---

## 代码规范

### Go（daemon）
- 错误处理：明确返回 `error`，不 panic
- 日志：`log/slog`（结构化日志）
- 并发：goroutine + channel，避免全局锁
- HTTP 框架：`chi`（轻量，标准库友好）
- 命名：Go 标准（驼峰，导出大写）

### Rust（shell）
- 错误处理：`anyhow::Result<T>` + `thiserror`，与 Unflick 一致
- CLI 输出：JSON 格式（`--json` 选项），`success`/`message`/`data` 字段
- 与 daemon 通信：`reqwest`（异步 HTTP 客户端）

### TypeScript（前端）
- 严格模式 TypeScript
- 组件：PascalCase，文件名：kebab-case
- 状态：Zustand store
- API 调用：统一封装在 `src/lib/api.ts`，通过 Tauri `invoke` 或直接 fetch daemon

### 通用
- Git 提交信息：中文，conventional commits 格式
- 每个功能优先实现 CLI，再考虑 GUI

---

## 自测要求

每次开发完成后必须自测：

1. **daemon 启动**：`unfetch daemon` 启动后 `curl http://127.0.0.1:19543/health` 返回 200
2. **CLI 基本流程**：`unfetch add <url>` → `unfetch list` → 能看到任务
3. **HTTP 下载**：下载一个公开文件，验证断点续传（中途 pause/resume）
4. **BT 下载**：用磁力链接或种子文件测试
5. **yt-dlp 下载**：测试至少一个视频网站 URL（如 YouTube、Bilibili）
6. **GUI**：任务列表实时更新进度，添加任务对话框正常
7. **MCP**：`unfetch --mcp` 启动后用 Claude 调用 `add_task` 工具

---

## 开发经验（持续更新）

### yt-dlp 依赖管理
- yt-dlp 需要单独安装，不打包进应用（体积太大）
- 应用启动时检测 yt-dlp 是否存在，提示用户安装
- 推荐位置：与 unfetch 可执行文件同目录 > PATH > `~/.local/bin/yt-dlp`
- Windows 上还需要 ffmpeg（yt-dlp 合并音视频流用）

### Go daemon 端口冲突
- 启动前先 `GET /health`，已在运行则直接复用
- 开发时注意 kill 残留进程：`taskkill /F /IM unfetch-core.exe`（Windows）

### Tauri 与 Go 进程通信
- Go daemon 作为 sidecar 打包（`tauri.conf.json` → `bundle.externalBin`）
- Rust 通过 `tauri-plugin-shell` 启动 Go 进程，或直接 `std::process::Command`
- 不要用 stdin/stdout 通信，用 REST API（更容易调试）
