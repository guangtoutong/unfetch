use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use serde_json::Value;

use crate::daemon;

#[derive(Parser)]
#[command(name = "unfetch", version, about = "A download manager for humans and AI")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,

    /// 启动 MCP 服务器（JSON-RPC 2.0 over stdio）
    #[arg(long)]
    pub mcp: bool,
}

#[derive(Subcommand)]
pub enum Commands {
    /// 启动后台下载 daemon
    Daemon,

    /// 添加下载任务
    Add {
        url: String,
        /// 保存目录
        #[arg(long, short = 'o')]
        output: Option<String>,
        /// 指定文件名
        #[arg(long)]
        filename: Option<String>,
        /// HTTP 分片线程数（默认 8）
        #[arg(long, default_value = "8")]
        threads: u8,
        /// 视频质量：best / 1080p / 720p / 480p / audio
        #[arg(long)]
        quality: Option<String>,
        /// 代理地址
        #[arg(long)]
        proxy: Option<String>,
        /// Cookie：浏览器名称或 cookie 文件路径
        #[arg(long)]
        cookies: Option<String>,
        /// 下载完成后用 Unflick 播放
        #[arg(long)]
        play_after: bool,
    },

    /// 列出所有下载任务
    List {
        /// 按状态过滤：all / downloading / paused / done / error
        #[arg(long, default_value = "all")]
        status: String,
    },

    /// 查看任务详情
    Status { id: String },

    /// 暂停任务
    Pause { id: String },

    /// 恢复任务
    Resume { id: String },

    /// 删除任务
    Remove {
        id: String,
        /// 同时删除已下载的文件
        #[arg(long)]
        delete_file: bool,
    },

    /// 将任务移入垃圾箱（可恢复，不删除文件）
    Trash { id: String },

    /// 从垃圾箱恢复任务
    Restore { id: String },

    /// 清空垃圾箱（彻底删除所有垃圾桶任务及文件）
    EmptyTrash,

    /// 恢复所有垃圾桶任务
    RestoreAll,

    /// 查看或修改配置
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
}

#[derive(Subcommand)]
pub enum ConfigAction {
    /// 列出所有配置
    List,
    /// 获取某个配置项
    Get { key: String },
    /// 修改某个配置项（值为 JSON）
    Set { key: String, value: String },
}

pub fn run(cli: Cli) -> i32 {
    match _run(cli) {
        Ok(code) => code,
        Err(e) => {
            eprintln!("错误：{e:#}");
            1
        }
    }
}

fn _run(cli: Cli) -> Result<i32> {
    let Some(cmd) = cli.command else {
        return Ok(0);
    };

    match cmd {
        Commands::Daemon => {
            // 直接在前台启动 daemon binary（由 shell 负责后台化）
            if let Some(bin) = daemon::find_binary() {
                let status = std::process::Command::new(bin)
                    .status()
                    .context("启动 daemon 失败")?;
                return Ok(status.code().unwrap_or(1));
            }
            bail!("daemon binary 未找到，请确认 unfetch-daemon 已安装");
        }

        Commands::Add { url, output, filename, threads, quality, proxy, cookies, play_after } => {
            ensure_daemon()?;
            let body = serde_json::json!({
                "url":       url,
                "save_dir":  output,
                "filename":  filename,
                "threads":   threads,
                "quality":   quality,
                "proxy":     proxy,
                "cookies":   cookies,
                "play_after": play_after,
            });
            let resp = post("/tasks", &body)?;
            print_json(&resp);
        }

        Commands::List { status } => {
            ensure_daemon()?;
            let url = if status == "all" {
                "/tasks".to_string()
            } else {
                format!("/tasks?status={status}")
            };
            let resp = get(&url)?;
            print_json(&resp);
        }

        Commands::Status { id } => {
            ensure_daemon()?;
            let resp = get(&format!("/tasks/{id}"))?;
            print_json(&resp);
        }

        Commands::Pause { id } => {
            ensure_daemon()?;
            let resp = patch(&format!("/tasks/{id}/pause"))?;
            print_json(&resp);
        }

        Commands::Resume { id } => {
            ensure_daemon()?;
            let resp = patch(&format!("/tasks/{id}/resume"))?;
            print_json(&resp);
        }

        Commands::Remove { id, delete_file } => {
            ensure_daemon()?;
            let url = if delete_file {
                format!("/tasks/{id}?delete_file=true")
            } else {
                format!("/tasks/{id}")
            };
            delete(&url)?;
            println!("{{\"ok\":true}}");
        }

        Commands::Trash { id } => {
            ensure_daemon()?;
            let resp = patch(&format!("/tasks/{id}/trash"))?;
            print_json(&resp);
        }

        Commands::Restore { id } => {
            ensure_daemon()?;
            let resp = patch(&format!("/tasks/{id}/restore"))?;
            print_json(&resp);
        }

        Commands::EmptyTrash => {
            ensure_daemon()?;
            let url = format!("{}/tasks/trash", daemon::DAEMON_URL);
            let resp = client().delete(&url).send().context("请求失败")?;
            let v: Value = resp.json().context("解析响应失败")?;
            print_json(&v);
        }

        Commands::RestoreAll => {
            ensure_daemon()?;
            let resp = patch("/tasks/trash/restore-all")?;
            print_json(&resp);
        }

        Commands::Config { action } => {
            ensure_daemon()?;
            match action {
                ConfigAction::List => {
                    let resp = get("/config")?;
                    print_json(&resp);
                }
                ConfigAction::Get { key } => {
                    let resp = get("/config")?;
                    if let Some(v) = resp.get(&key) {
                        println!("{}", serde_json::to_string_pretty(v)?);
                    } else {
                        bail!("配置项 '{}' 不存在", key);
                    }
                }
                ConfigAction::Set { key, value } => {
                    let parsed: Value = serde_json::from_str(&value)
                        .unwrap_or_else(|_| Value::String(value));
                    let body = serde_json::json!({ key: parsed });
                    let resp = patch_json("/config", &body)?;
                    print_json(&resp);
                }
            }
        }
    }

    Ok(0)
}

fn ensure_daemon() -> Result<()> {
    if !daemon::is_running() {
        daemon::ensure_running();
        if !daemon::is_running() {
            bail!("无法连接到 unfetch daemon，请先运行 `unfetch daemon`");
        }
    }
    Ok(())
}

fn client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap()
}

fn get(path: &str) -> Result<Value> {
    let url = format!("{}{}", daemon::DAEMON_URL, path);
    let resp = client().get(&url).send().context("请求失败")?;
    let v: Value = resp.json().context("解析响应失败")?;
    Ok(v)
}

fn post(path: &str, body: &Value) -> Result<Value> {
    let url = format!("{}{}", daemon::DAEMON_URL, path);
    let resp = client()
        .post(&url)
        .json(body)
        .send()
        .context("请求失败")?;
    let v: Value = resp.json().context("解析响应失败")?;
    Ok(v)
}

fn patch(path: &str) -> Result<Value> {
    let url = format!("{}{}", daemon::DAEMON_URL, path);
    let resp = client().patch(&url).send().context("请求失败")?;
    let v: Value = resp.json().context("解析响应失败")?;
    Ok(v)
}

fn patch_json(path: &str, body: &Value) -> Result<Value> {
    let url = format!("{}{}", daemon::DAEMON_URL, path);
    let resp = client()
        .patch(&url)
        .json(body)
        .send()
        .context("请求失败")?;
    let v: Value = resp.json().context("解析响应失败")?;
    Ok(v)
}

fn delete(path: &str) -> Result<()> {
    let url = format!("{}{}", daemon::DAEMON_URL, path);
    client().delete(&url).send().context("请求失败")?;
    Ok(())
}

fn print_json(v: &Value) {
    println!("{}", serde_json::to_string_pretty(v).unwrap_or_default());
}
