use std::collections::HashSet;
use std::io::{self, BufRead, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use crate::daemon;

type Out = Arc<Mutex<Box<dyn Write + Send>>>;

#[derive(Default)]
struct State {
    subscribed: Mutex<HashSet<String>>, // 已订阅的 resource URIs（task://id）
}

const POLL_INTERVAL: Duration = Duration::from_millis(800);
const DEFAULT_WAIT_TIMEOUT_SECS: u64 = 30 * 60; // 30 分钟

pub fn run() -> i32 {
    daemon::ensure_running();

    let out: Out = Arc::new(Mutex::new(Box::new(io::stdout())));
    let state = Arc::new(State::default());

    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let line = line.trim().to_string();
        if line.is_empty() {
            continue;
        }

        let request: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        handle_request(request, out.clone(), state.clone());
    }
    0
}

fn handle_request(req: Value, out: Out, state: Arc<State>) {
    let id = req.get("id").cloned().unwrap_or(Value::Null);
    let method = req["method"].as_str().unwrap_or("").to_string();

    match method.as_str() {
        "initialize" => send_result(&out, id, json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {},
                "resources": { "subscribe": true, "listChanged": true },
                "logging": {}
            },
            "serverInfo": { "name": "unfetch", "version": env!("CARGO_PKG_VERSION") }
        })),

        "ping" => send_result(&out, id, json!({})),

        "tools/list" => send_result(&out, id, json!({ "tools": tool_definitions() })),

        "tools/call" => {
            let name = req["params"]["name"].as_str().unwrap_or("").to_string();
            let args = req["params"].get("arguments").cloned().unwrap_or(json!({}));
            let progress_token = req["params"]["_meta"].get("progressToken").cloned();

            // 长阻塞工具走线程
            if matches!(name.as_str(), "wait_for_task" | "wait_for_all") {
                let out2 = out.clone();
                thread::spawn(move || {
                    let result = handle_long_tool(&name, &args, progress_token, &out2);
                    send_tool_response(&out2, id, result);
                });
            } else {
                let result = handle_tool(&name, &args);
                send_tool_response(&out, id, result);
            }
        }

        "resources/list" => send_result(&out, id, json!({ "resources": list_resources() })),

        "resources/read" => {
            let uri = req["params"]["uri"].as_str().unwrap_or("").to_string();
            send_result(&out, id, json!({ "contents": read_resource(&uri) }));
        }

        "resources/subscribe" => {
            let uri = req["params"]["uri"].as_str().unwrap_or("").to_string();
            let was_new = state.subscribed.lock().unwrap().insert(uri.clone());
            if was_new {
                let out2 = out.clone();
                let state2 = state.clone();
                let uri2 = uri.clone();
                thread::spawn(move || subscription_loop(uri2, state2, out2));
            }
            send_result(&out, id, json!({}));
        }

        "resources/unsubscribe" => {
            let uri = req["params"]["uri"].as_str().unwrap_or("");
            state.subscribed.lock().unwrap().remove(uri);
            send_result(&out, id, json!({}));
        }

        "notifications/cancelled" | "notifications/initialized" => {
            // 通知类无需响应
        }

        _ => {
            if !id.is_null() {
                send_error(&out, id, -32601, "method not found");
            }
        }
    }
}

// ──────────────────────────────────────────────────────────────────────
// I/O helpers
// ──────────────────────────────────────────────────────────────────────

fn write_json(out: &Out, value: Value) {
    let s = value.to_string();
    let mut guard = out.lock().unwrap();
    let _ = writeln!(guard, "{s}");
    let _ = guard.flush();
}

fn send_result(out: &Out, id: Value, result: Value) {
    write_json(out, json!({ "jsonrpc": "2.0", "id": id, "result": result }));
}

fn send_error(out: &Out, id: Value, code: i32, msg: &str) {
    write_json(out, json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": msg } }));
}

fn send_tool_response(out: &Out, id: Value, value: Value) {
    let body = json!({
        "content": [{
            "type": "text",
            "text": serde_json::to_string_pretty(&value).unwrap_or_default()
        }]
    });
    send_result(out, id, body);
}

fn send_progress(out: &Out, token: &Value, progress: f64, total: Option<f64>, message: Option<&str>) {
    let mut params = serde_json::Map::new();
    params.insert("progressToken".into(), token.clone());
    params.insert("progress".into(), json!(progress));
    if let Some(t) = total {
        params.insert("total".into(), json!(t));
    }
    if let Some(m) = message {
        params.insert("message".into(), json!(m));
    }
    write_json(out, json!({
        "jsonrpc": "2.0",
        "method": "notifications/progress",
        "params": Value::Object(params)
    }));
}

fn send_resource_updated(out: &Out, uri: &str) {
    write_json(out, json!({
        "jsonrpc": "2.0",
        "method": "notifications/resources/updated",
        "params": { "uri": uri }
    }));
}

// ──────────────────────────────────────────────────────────────────────
// 长阻塞工具：wait_for_task / wait_for_all
// ──────────────────────────────────────────────────────────────────────

fn handle_long_tool(name: &str, args: &Value, progress_token: Option<Value>, out: &Out) -> Value {
    match name {
        "wait_for_task" => {
            let id = args["id"].as_str().unwrap_or("").to_string();
            let timeout = args.get("timeout_seconds").and_then(|v| v.as_u64()).unwrap_or(DEFAULT_WAIT_TIMEOUT_SECS);
            wait_for_task_impl(&id, timeout, progress_token, out)
        }
        "wait_for_all" => {
            let timeout = args.get("timeout_seconds").and_then(|v| v.as_u64()).unwrap_or(60 * 60);
            wait_for_all_impl(timeout, progress_token, out)
        }
        _ => json!({ "error": format!("unknown long tool: {name}") }),
    }
}

fn fetch_task(id: &str) -> Result<Value, String> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/tasks/{}", daemon::DAEMON_URL, id);
    client.get(&url).send()
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .map_err(|e| e.to_string())
}

fn fetch_all_tasks() -> Result<Vec<Value>, String> {
    let client = reqwest::blocking::Client::new();
    let url = format!("{}/tasks", daemon::DAEMON_URL);
    client.get(&url).send()
        .map_err(|e| e.to_string())?
        .json::<Vec<Value>>()
        .map_err(|e| e.to_string())
}

fn wait_for_task_impl(id: &str, timeout_secs: u64, progress_token: Option<Value>, out: &Out) -> Value {
    let start = Instant::now();
    let deadline = start + Duration::from_secs(timeout_secs);
    let mut last_progress = -1.0_f64;

    loop {
        let task = match fetch_task(id) {
            Ok(t) => t,
            Err(e) => return json!({ "error": format!("fetch task: {e}") }),
        };

        if task.get("error").is_some() {
            return task; // daemon returned error JSON
        }

        let status = task["status"].as_str().unwrap_or("");
        let total = task["total_bytes"].as_i64().unwrap_or(0);
        let done = task["done_bytes"].as_i64().unwrap_or(0);
        let speed = task["speed"].as_i64().unwrap_or(0);

        // 发 progress 通知（避免重复发相同进度）
        if let Some(tok) = &progress_token {
            let progress = if total > 0 { (done as f64) / (total as f64) * 100.0 } else { 0.0 };
            if (progress - last_progress).abs() >= 0.5 || status != "downloading" {
                let msg = if total > 0 {
                    format!("{:.1}% · {}/s", progress, format_bytes(speed))
                } else {
                    format!("{} · {}/s", status, format_bytes(speed))
                };
                send_progress(out, tok, done as f64, if total > 0 { Some(total as f64) } else { None }, Some(&msg));
                last_progress = progress;
            }
        }

        match status {
            "done" | "error" => return task,
            _ => {}
        }

        if Instant::now() >= deadline {
            let mut t = task;
            t["_wait_timeout"] = json!(true);
            return t;
        }

        thread::sleep(POLL_INTERVAL);
    }
}

fn wait_for_all_impl(timeout_secs: u64, progress_token: Option<Value>, out: &Out) -> Value {
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);

    loop {
        let tasks = match fetch_all_tasks() {
            Ok(t) => t,
            Err(e) => return json!({ "error": format!("fetch tasks: {e}") }),
        };

        let active: Vec<&Value> = tasks.iter().filter(|t| {
            !t["trashed"].as_bool().unwrap_or(false) &&
            matches!(t["status"].as_str().unwrap_or(""), "queued" | "downloading" | "paused")
        }).collect();

        if let Some(tok) = &progress_token {
            let total_n = tasks.len();
            let active_n = active.len();
            let done_n = total_n.saturating_sub(active_n);
            let msg = format!("{}/{} 已完成", done_n, total_n);
            send_progress(out, tok, done_n as f64, Some(total_n as f64), Some(&msg));
        }

        if active.is_empty() {
            return json!({ "tasks": tasks.len(), "finished": true });
        }

        if Instant::now() >= deadline {
            return json!({ "tasks": tasks.len(), "finished": false, "active": active.len(), "timeout": true });
        }

        thread::sleep(Duration::from_secs(1));
    }
}

fn format_bytes(bytes: i64) -> String {
    let b = bytes.max(0) as f64;
    if b >= 1024.0 * 1024.0 * 1024.0 {
        format!("{:.2} GB", b / 1024.0 / 1024.0 / 1024.0)
    } else if b >= 1024.0 * 1024.0 {
        format!("{:.2} MB", b / 1024.0 / 1024.0)
    } else if b >= 1024.0 {
        format!("{:.1} KB", b / 1024.0)
    } else {
        format!("{} B", b as i64)
    }
}

// ──────────────────────────────────────────────────────────────────────
// 资源 (resources) — 把任务暴露为 task://{id}
// ──────────────────────────────────────────────────────────────────────

fn list_resources() -> Vec<Value> {
    let Ok(tasks) = fetch_all_tasks() else { return vec![] };
    tasks.iter().map(|t| {
        let id = t["id"].as_str().unwrap_or("");
        let url = t["url"].as_str().unwrap_or("");
        let name = t.get("metadata").and_then(|m| m["title"].as_str())
            .or_else(|| t["filename"].as_str())
            .unwrap_or(url);
        json!({
            "uri": format!("task://{id}"),
            "name": name,
            "mimeType": "application/json",
            "description": format!("Download task — {}", t["status"].as_str().unwrap_or(""))
        })
    }).collect()
}

fn read_resource(uri: &str) -> Vec<Value> {
    let Some(id) = uri.strip_prefix("task://") else {
        return vec![json!({ "uri": uri, "mimeType": "text/plain", "text": "unknown resource" })];
    };
    let task = match fetch_task(id) {
        Ok(t) => t,
        Err(e) => return vec![json!({ "uri": uri, "mimeType": "text/plain", "text": format!("error: {e}") })],
    };
    vec![json!({
        "uri": uri,
        "mimeType": "application/json",
        "text": serde_json::to_string_pretty(&task).unwrap_or_default()
    })]
}

fn subscription_loop(uri: String, state: Arc<State>, out: Out) {
    let Some(id) = uri.strip_prefix("task://").map(str::to_string) else { return };
    let mut last_signature = String::new();

    loop {
        // 退订即停止
        if !state.subscribed.lock().unwrap().contains(&uri) {
            return;
        }
        if let Ok(task) = fetch_task(&id) {
            let sig = format!(
                "{}|{}|{}|{}|{}",
                task["status"].as_str().unwrap_or(""),
                task["done_bytes"].as_i64().unwrap_or(0),
                task["total_bytes"].as_i64().unwrap_or(0),
                task["error"].as_str().unwrap_or(""),
                task["trashed"].as_bool().unwrap_or(false),
            );
            if sig != last_signature {
                last_signature = sig;
                send_resource_updated(&out, &uri);
            }
        }
        thread::sleep(Duration::from_secs(2));
    }
}

// ──────────────────────────────────────────────────────────────────────
// 快速工具（同步，无 progress）
// ──────────────────────────────────────────────────────────────────────

fn handle_tool(name: &str, args: &Value) -> Value {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .unwrap();
    let base = daemon::DAEMON_URL;

    match name {
        "add_task" => {
            let body = json!({
                "url":       args["url"],
                "save_dir":  args.get("save_dir"),
                "filename":  args.get("filename"),
                "threads":   args.get("threads"),
                "quality":   args.get("quality"),
                "proxy":     args.get("proxy"),
                "cookies":   args.get("cookies"),
                "play_after": args.get("play_after").and_then(|v| v.as_bool()).unwrap_or(false),
                "tags":      args.get("tags"),
                "start_at":  args.get("start_at"),
                "expected_sha256": args.get("expected_sha256"),
                "expected_md5":    args.get("expected_md5"),
            });
            client.post(format!("{base}/tasks")).json(&body).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "list_tasks" => {
            let status = args.get("status").and_then(|v| v.as_str()).unwrap_or("all");
            let url = if status == "all" { format!("{base}/tasks") } else { format!("{base}/tasks?status={status}") };
            client.get(&url).send().and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "get_task" => {
            let id = args["id"].as_str().unwrap_or("");
            client.get(format!("{base}/tasks/{id}")).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "pause_task" => {
            let id = args["id"].as_str().unwrap_or("");
            client.patch(format!("{base}/tasks/{id}/pause")).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "resume_task" => {
            let id = args["id"].as_str().unwrap_or("");
            client.patch(format!("{base}/tasks/{id}/resume")).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "remove_task" => {
            let id = args["id"].as_str().unwrap_or("");
            let del = args.get("delete_file").and_then(|v| v.as_bool()).unwrap_or(false);
            let url = if del { format!("{base}/tasks/{id}?delete_file=true") } else { format!("{base}/tasks/{id}") };
            client.delete(&url).send()
                .map(|_| json!({"ok": true}))
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "trash_task" => {
            let id = args["id"].as_str().unwrap_or("");
            client.patch(format!("{base}/tasks/{id}/trash")).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "restore_task" => {
            let id = args["id"].as_str().unwrap_or("");
            client.patch(format!("{base}/tasks/{id}/restore")).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "empty_trash" => {
            client.delete(format!("{base}/tasks/trash")).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "restore_all_trashed" => {
            client.patch(format!("{base}/tasks/trash/restore-all")).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "get_config" => {
            client.get(format!("{base}/config")).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "set_config" => {
            let body = args.clone();
            client.patch(format!("{base}/config")).json(&body).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }
        "play_in_unflick" => {
            let path = args["path"].as_str().unwrap_or("");
            let result = if cfg!(target_os = "windows") {
                std::process::Command::new("unflick.exe").arg("play").arg(path).spawn()
            } else {
                std::process::Command::new("unflick").arg("play").arg(path).spawn()
            };
            match result {
                Ok(_) => json!({"ok": true}),
                Err(e) => json!({"error": e.to_string()}),
            }
        }
        _ => json!({"error": format!("unknown tool: {name}")}),
    }
}

fn tool_definitions() -> Value {
    json!([
        {
            "name": "add_task",
            "description": "添加下载任务（支持 HTTP/HTTPS、BT 磁力链接、YouTube 等 1000+ 视频网站）",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "url":       { "type": "string", "description": "下载链接（HTTP URL、magnet:// 或视频网站 URL）" },
                    "save_dir":  { "type": "string", "description": "保存目录" },
                    "filename":  { "type": "string", "description": "文件名" },
                    "threads":   { "type": "integer", "description": "HTTP 分片线程数" },
                    "quality":   { "type": "string", "enum": ["best","1080p","720p","480p","audio"] },
                    "proxy":     { "type": "string" },
                    "play_after":{ "type": "boolean" },
                    "tags":      { "type": "array", "items": { "type": "string" }, "description": "任务标签" },
                    "start_at":  { "type": "string", "description": "RFC3339 时间，定时下载" },
                    "expected_sha256": { "type": "string" },
                    "expected_md5":    { "type": "string" }
                },
                "required": ["url"]
            }
        },
        {
            "name": "wait_for_task",
            "description": "阻塞等待一个任务完成或失败；返回最终任务对象。期间会持续推送 progress 通知。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "任务 ID" },
                    "timeout_seconds": { "type": "integer", "description": "最长等待秒数，默认 1800（30 分钟）" }
                },
                "required": ["id"]
            }
        },
        {
            "name": "wait_for_all",
            "description": "等所有当前未完成任务（queued / downloading / paused）跑完或超时。",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "timeout_seconds": { "type": "integer", "description": "最长等待秒数，默认 3600（1 小时）" }
                }
            }
        },
        {
            "name": "list_tasks",
            "description": "列出下载任务",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "status": { "type": "string", "enum": ["all","downloading","paused","done","error","queued"] }
                }
            }
        },
        { "name": "get_task", "description": "获取单个任务的详细信息和实时进度",
          "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] } },
        { "name": "pause_task", "description": "暂停下载任务",
          "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] } },
        { "name": "resume_task", "description": "恢复暂停的下载任务",
          "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] } },
        { "name": "remove_task", "description": "彻底删除下载任务",
          "inputSchema": { "type": "object", "properties": {
              "id": { "type": "string" },
              "delete_file": { "type": "boolean" }
          }, "required": ["id"] } },
        { "name": "trash_task", "description": "将任务移入垃圾箱（可恢复，不删除文件）",
          "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] } },
        { "name": "restore_task", "description": "从垃圾箱恢复任务",
          "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] } },
        { "name": "empty_trash", "description": "清空垃圾箱（彻底删除所有垃圾桶任务及对应文件）",
          "inputSchema": { "type": "object", "properties": {} } },
        { "name": "restore_all_trashed", "description": "恢复所有垃圾桶中的任务",
          "inputSchema": { "type": "object", "properties": {} } },
        { "name": "get_config", "description": "获取当前配置",
          "inputSchema": { "type": "object", "properties": {} } },
        { "name": "set_config", "description": "修改配置",
          "inputSchema": { "type": "object", "properties": {
              "download_dir":     { "type": "string" },
              "max_concurrent":   { "type": "integer" },
              "http_threads":     { "type": "integer" },
              "proxy":            { "type": "string" },
              "speed_limit":      { "type": "integer" },
              "auto_play_unflick":{ "type": "boolean" },
              "auto_retry":       { "type": "boolean" },
              "on_all_done":      { "type": "string", "enum": ["", "notify", "open_dir", "shutdown", "sleep"] }
          } } },
        { "name": "play_in_unflick", "description": "用 Unflick 播放本地文件",
          "inputSchema": { "type": "object", "properties": { "path": { "type": "string" } }, "required": ["path"] } }
    ])
}
