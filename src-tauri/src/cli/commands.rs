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

    /// 阻塞等待任务完成或失败，期间打印进度
    Wait {
        id: String,
        /// 最长等待秒数（默认 1800）
        #[arg(long, default_value = "1800")]
        timeout: u64,
    },

    /// 等所有未完成任务全部跑完
    WaitAll {
        /// 最长等待秒数（默认 3600）
        #[arg(long, default_value = "3600")]
        timeout: u64,
    },

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

        Commands::Wait { id, timeout } => {
            ensure_daemon()?;
            let started = std::time::Instant::now();
            let deadline = started + std::time::Duration::from_secs(timeout);
            let mut last_pct: f64 = -1.0;
            loop {
                let task = get(&format!("/tasks/{id}"))?;
                if task.get("error").is_some() {
                    println!("{}", serde_json::to_string_pretty(&task)?);
                    return Ok(1);
                }
                let status = task["status"].as_str().unwrap_or("");
                let total = task["total_bytes"].as_i64().unwrap_or(0);
                let done = task["done_bytes"].as_i64().unwrap_or(0);
                let speed = task["speed"].as_i64().unwrap_or(0);
                let pct = if total > 0 { (done as f64) / (total as f64) * 100.0 } else { 0.0 };

                if (pct - last_pct).abs() >= 0.1 || status != "downloading" {
                    if total > 0 {
                        eprint!("\r[{status:>11}] {pct:5.1}%  {}/s   ", human_bytes(speed));
                    } else {
                        eprint!("\r[{status:>11}] {}/s   ", human_bytes(speed));
                    }
                    use std::io::Write;
                    let _ = std::io::stderr().flush();
                    last_pct = pct;
                }

                match status {
                    "done" => {
                        eprintln!();
                        print_json(&task);
                        return Ok(0);
                    }
                    "error" => {
                        eprintln!();
                        print_json(&task);
                        return Ok(2);
                    }
                    _ => {}
                }
                if std::time::Instant::now() >= deadline {
                    eprintln!("\n超时");
                    return Ok(124);
                }
                std::thread::sleep(std::time::Duration::from_millis(800));
            }
        }

        Commands::WaitAll { timeout } => {
            ensure_daemon()?;
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout);
            loop {
                let tasks_v = get("/tasks")?;
                let tasks = tasks_v.as_array().cloned().unwrap_or_default();
                let active: Vec<&Value> = tasks.iter().filter(|t| {
                    !t["trashed"].as_bool().unwrap_or(false)
                        && matches!(t["status"].as_str().unwrap_or(""), "queued" | "downloading" | "paused")
                }).collect();
                let total = tasks.len();
                let done = total.saturating_sub(active.len());
                eprint!("\r[{done}/{total}] active={}   ", active.len());
                use std::io::Write;
                let _ = std::io::stderr().flush();

                if active.is_empty() {
                    eprintln!();
                    println!("{{\"tasks\":{},\"finished\":true}}", total);
                    return Ok(0);
                }
                if std::time::Instant::now() >= deadline {
                    eprintln!("\n超时");
                    println!("{{\"tasks\":{},\"finished\":false,\"active\":{}}}", total, active.len());
                    return Ok(124);
                }
                std::thread::sleep(std::time::Duration::from_secs(1));
            }
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

fn human_bytes(b: i64) -> String {
    let f = b.max(0) as f64;
    if f >= 1024.0 * 1024.0 * 1024.0 {
        format!("{:.2} GB", f / 1024.0 / 1024.0 / 1024.0)
    } else if f >= 1024.0 * 1024.0 {
        format!("{:.2} MB", f / 1024.0 / 1024.0)
    } else if f >= 1024.0 {
        format!("{:.1} KB", f / 1024.0)
    } else {
        format!("{} B", b)
    }
}
