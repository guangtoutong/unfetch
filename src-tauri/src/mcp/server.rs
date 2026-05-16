use std::io::{self, BufRead, Write};
use serde_json::{json, Value};
use crate::daemon;

pub fn run() -> i32 {
    // 确保 daemon 在线
    daemon::ensure_running();

    let stdin  = io::stdin();
    let stdout = io::stdout();
    let mut out = stdout.lock();

    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let line = line.trim().to_string();
        if line.is_empty() { continue; }

        let request: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let id     = request.get("id").cloned().unwrap_or(Value::Null);
        let method = request["method"].as_str().unwrap_or("");

        let response = match method {
            "initialize" => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": { "tools": {} },
                    "serverInfo": { "name": "unfetch", "version": env!("CARGO_PKG_VERSION") }
                }
            }),

            "tools/list" => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": { "tools": tool_definitions() }
            }),

            "tools/call" => {
                let name = request["params"]["name"].as_str().unwrap_or("");
                let args = request["params"].get("arguments").cloned().unwrap_or(json!({}));
                let result = handle_tool(name, &args);
                json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&result).unwrap_or_default() }]
                    }
                })
            }

            _ => json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": { "code": -32601, "message": "method not found" }
            }),
        };

        let _ = writeln!(out, "{}", response);
        let _ = out.flush();
    }

    0
}

fn handle_tool(name: &str, args: &Value) -> Value {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
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
            });
            client.post(format!("{base}/tasks")).json(&body).send()
                .and_then(|r| r.json::<Value>())
                .unwrap_or_else(|e| json!({"error": e.to_string()}))
        }

        "list_tasks" => {
            let status = args.get("status").and_then(|v| v.as_str()).unwrap_or("all");
            let url = if status == "all" {
                format!("{base}/tasks")
            } else {
                format!("{base}/tasks?status={status}")
            };
            client.get(&url).send()
                .and_then(|r| r.json::<Value>())
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
            let url = if del {
                format!("{base}/tasks/{id}?delete_file=true")
            } else {
                format!("{base}/tasks/{id}")
            };
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
                Ok(_)  => json!({"ok": true}),
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
                    "save_dir":  { "type": "string", "description": "保存目录（可选，默认用配置中的下载目录）" },
                    "filename":  { "type": "string", "description": "文件名（可选）" },
                    "threads":   { "type": "integer", "description": "HTTP 分片线程数（默认 8）" },
                    "quality":   { "type": "string", "enum": ["best","1080p","720p","480p","audio"], "description": "视频质量（仅 yt-dlp 任务有效）" },
                    "proxy":     { "type": "string", "description": "代理地址" },
                    "play_after":{ "type": "boolean", "description": "下载完成后用 Unflick 播放" }
                },
                "required": ["url"]
            }
        },
        {
            "name": "list_tasks",
            "description": "列出下载任务",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "status": { "type": "string", "enum": ["all","downloading","paused","done","error","queued"], "description": "按状态过滤" }
                }
            }
        },
        {
            "name": "get_task",
            "description": "获取单个任务的详细信息和实时进度",
            "inputSchema": {
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }
        },
        {
            "name": "pause_task",
            "description": "暂停下载任务",
            "inputSchema": {
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }
        },
        {
            "name": "resume_task",
            "description": "恢复暂停的下载任务",
            "inputSchema": {
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }
        },
        {
            "name": "remove_task",
            "description": "删除下载任务",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id":          { "type": "string" },
                    "delete_file": { "type": "boolean", "description": "同时删除已下载的文件" }
                },
                "required": ["id"]
            }
        },
        {
            "name": "trash_task",
            "description": "将任务移入垃圾箱（可恢复，不删除文件）",
            "inputSchema": {
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }
        },
        {
            "name": "restore_task",
            "description": "从垃圾箱恢复任务",
            "inputSchema": {
                "type": "object",
                "properties": { "id": { "type": "string" } },
                "required": ["id"]
            }
        },
        {
            "name": "empty_trash",
            "description": "清空垃圾箱（彻底删除所有垃圾桶任务及对应文件）",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "restore_all_trashed",
            "description": "恢复所有垃圾桶中的任务",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "get_config",
            "description": "获取当前配置（下载目录、并发数、线程数等）",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "set_config",
            "description": "修改配置",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "download_dir":     { "type": "string" },
                    "max_concurrent":   { "type": "integer" },
                    "http_threads":     { "type": "integer" },
                    "proxy":            { "type": "string" },
                    "speed_limit":      { "type": "integer", "description": "限速（字节/秒），0 = 不限" },
                    "auto_play_unflick":{ "type": "boolean" }
                }
            }
        },
        {
            "name": "play_in_unflick",
            "description": "用 Unflick 播放本地文件",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string", "description": "本地文件路径" } },
                "required": ["path"]
            }
        }
    ])
}
