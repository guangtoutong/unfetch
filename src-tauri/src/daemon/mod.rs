use std::{
    env, fs,
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
    thread,
    time::Duration,
};

pub const DAEMON_URL: &str = "http://127.0.0.1:19543";

/// 把诊断日志追加到 unfetch.log（与 daemon.log 同目录）
pub fn debug_log(msg: &str) {
    let path = dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("unfetch")
        .join("unfetch.log");
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let _ = writeln!(f, "[ts={ts}] {msg}");
    }
}

pub fn is_running() -> bool {
    reqwest::blocking::get(format!("{DAEMON_URL}/health"))
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

/// 将一个 URL 或文件路径作为下载任务发送给 daemon。
/// 对 magnet:// URL 直接发送；对本地 .torrent 文件路径以 file:// URL 发送。
/// 自动等待 daemon 就绪并重试，最多 6 次（共约 6 秒）。
pub fn submit_url(input: &str) -> Result<(), String> {
    let url = if input.starts_with("magnet:") || input.starts_with("http://") || input.starts_with("https://") || input.starts_with("ftp://") {
        input.to_string()
    } else if input.starts_with("file:") {
        input.to_string()
    } else {
        // 视为本地文件路径
        let path = PathBuf::from(input);
        if !path.exists() {
            debug_log(&format!("submit_url: local file not found: {input}"));
            return Err(format!("文件不存在: {}", input));
        }
        format!("file:///{}", path.to_string_lossy().replace('\\', "/"))
    };

    debug_log(&format!("submit_url: sending url={}", url));

    let body = serde_json::json!({ "url": url });
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("build client: {e}"))?;

    let mut last_err = String::new();
    for attempt in 0..6 {
        if attempt > 0 {
            thread::sleep(Duration::from_secs(1));
        }
        match client
            .post(format!("{DAEMON_URL}/tasks"))
            .json(&body)
            .send()
        {
            Ok(resp) => {
                let status = resp.status();
                let body_text = resp.text().unwrap_or_default();
                if status.is_success() {
                    debug_log(&format!("submit_url: success on attempt {}", attempt + 1));
                    return Ok(());
                }
                last_err = format!("daemon returned {} body={}", status, body_text);
                debug_log(&format!("submit_url: attempt {} failed: {}", attempt + 1, last_err));
                // 非临时错误就别重试了
                if !status.is_server_error() {
                    return Err(last_err);
                }
            }
            Err(e) => {
                last_err = format!("connect error: {e}");
                debug_log(&format!("submit_url: attempt {} connect error: {}", attempt + 1, e));
                // 顺便确保 daemon 在跑
                if attempt == 0 {
                    ensure_running();
                }
            }
        }
    }
    Err(format!("submit_url 重试 6 次仍失败: {last_err}"))
}

/// 找到 Go daemon 可执行文件。
/// 搜索顺序：binaries/ 子目录 → 与自身同目录 → PATH
pub fn find_binary() -> Option<PathBuf> {
    let candidates: Vec<PathBuf> = {
        let mut v = vec![];

        if let Ok(exe) = env::current_exe() {
            if let Some(dir) = exe.parent() {
                for name in ["unfetch-daemon.exe", "unfetch-daemon"] {
                    v.push(dir.join("binaries").join(name));
                    v.push(dir.join(name));
                }
            }
        }
        v
    };

    for p in candidates {
        if p.exists() {
            return Some(p);
        }
    }

    // 尝试 PATH
    which_binary()
}

fn which_binary() -> Option<PathBuf> {
    for name in ["unfetch-daemon", "unfetch-daemon.exe"] {
        if let Ok(out) = Command::new("which").arg(name).output() {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
        // Windows where
        if let Ok(out) = Command::new("where").arg(name).output() {
            let path = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !path.is_empty() {
                return Some(PathBuf::from(path));
            }
        }
    }
    None
}

/// 关闭 daemon：先发优雅 shutdown 请求让其保存状态，然后强杀兜底。
pub fn shutdown_daemon() {
    debug_log("shutdown_daemon: requested");
    if let Ok(client) = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(800))
        .build()
    {
        let _ = client.post(format!("{DAEMON_URL}/shutdown")).send();
    }
    // 给 daemon 一点时间退出
    thread::sleep(Duration::from_millis(600));

    // 强杀兜底（防止 daemon 卡死）
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "unfetch-daemon.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("pkill")
            .args(["-9", "-f", "unfetch-daemon"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .output();
    }
    debug_log("shutdown_daemon: done");
}

/// 确保 daemon 正在运行。如果没运行则启动它。
pub fn ensure_running() {
    if is_running() {
        return;
    }

    let Some(bin) = find_binary() else {
        eprintln!("[unfetch] daemon binary not found — download engine unavailable");
        return;
    };

    // 确保日志目录存在
    let log_path = dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("unfetch")
        .join("daemon.log");
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let log_file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .ok();

    let mut cmd = Command::new(&bin);
    cmd.stdin(Stdio::null());

    // Windows: 隐藏 daemon 子进程的控制台窗口（双保险，daemon 本身已 -H windowsgui）
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if let Some(f) = log_file {
        let f2 = f.try_clone().unwrap_or_else(|_| {
            fs::OpenOptions::new()
                .write(true)
                .open(&log_path)
                .unwrap()
        });
        cmd.stdout(f).stderr(f2);
    } else {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }

    match cmd.spawn() {
        Ok(_) => {
            // 等待 daemon 就绪（最多 5 秒）
            for _ in 0..50 {
                thread::sleep(Duration::from_millis(100));
                if is_running() {
                    return;
                }
            }
            eprintln!("[unfetch] daemon started but not responding");
        }
        Err(e) => {
            eprintln!("[unfetch] failed to start daemon: {e}");
        }
    }
}
