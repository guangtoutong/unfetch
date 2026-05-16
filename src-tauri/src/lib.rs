pub mod cli;
pub mod daemon;
pub mod gui;
pub mod mcp;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use gui::commands;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_clipboard_manager::ClipboardExt;

/// 全局：剪贴板嗅探是否启用
static CLIPBOARD_SNIFF_ENABLED: AtomicBool = AtomicBool::new(true);
/// 全局：关闭窗口时是否最小化到托盘（默认 false：X 直接退出 app）
static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(
            |app, args, _cwd| {
                daemon::debug_log(&format!("single_instance callback fired with {} args: {:?}", args.len(), args));
                forward_args(app, &args);
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.unminimize();
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            },
        ))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 首次启动：处理 argv
            let args: Vec<String> = std::env::args().collect();
            daemon::debug_log(&format!("setup() argv: {:?}", args));
            forward_args(app.handle(), &args);

            // 建系统托盘
            setup_tray(app.handle())?;

            // 启动剪贴板嗅探线程
            let handle = app.handle().clone();
            std::thread::spawn(move || clipboard_sniff_loop(handle));

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                daemon::debug_log(&format!(
                    "CloseRequested fired on window '{}', minimize_to_tray={}",
                    window.label(),
                    MINIMIZE_TO_TRAY.load(Ordering::Relaxed)
                ));
                if window.label() == "main" {
                    if MINIMIZE_TO_TRAY.load(Ordering::Relaxed) {
                        daemon::debug_log("close: hiding window (minimize to tray)");
                        let _ = window.hide();
                        api.prevent_close();
                    } else {
                        daemon::debug_log("close: shutdown daemon + exit");
                        api.prevent_close();
                        // 把窗口先隐藏，让用户感知到 X 生效
                        let _ = window.hide();
                        // 异步关 daemon，避免在事件循环上阻塞
                        std::thread::spawn(|| {
                            daemon::shutdown_daemon();
                            daemon::debug_log("close: calling std::process::exit(0)");
                            std::process::exit(0);
                        });
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::play_in_unflick,
            commands::open_folder,
            commands::reveal_file,
            commands::show_window,
            commands::select_directory,
            set_clipboard_sniff_enabled,
            set_minimize_to_tray,
            get_runtime_flags,
            close_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running unfetch");
}

#[tauri::command]
fn set_clipboard_sniff_enabled(enabled: bool) {
    CLIPBOARD_SNIFF_ENABLED.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn set_minimize_to_tray(enabled: bool) {
    MINIMIZE_TO_TRAY.store(enabled, Ordering::Relaxed);
}

/// X 关闭按钮直接调用：关 daemon → 退 app
#[tauri::command]
fn close_app() {
    daemon::debug_log("close_app: invoked");
    if MINIMIZE_TO_TRAY.load(Ordering::Relaxed) {
        // 最小化到托盘：不退，前端会另行处理隐藏窗口
        return;
    }
    std::thread::spawn(|| {
        daemon::shutdown_daemon();
        daemon::debug_log("close_app: std::process::exit(0)");
        std::process::exit(0);
    });
}

#[derive(serde::Serialize)]
struct RuntimeFlags {
    clipboard_sniff_enabled: bool,
    minimize_to_tray: bool,
}

#[tauri::command]
fn get_runtime_flags() -> RuntimeFlags {
    RuntimeFlags {
        clipboard_sniff_enabled: CLIPBOARD_SNIFF_ENABLED.load(Ordering::Relaxed),
        minimize_to_tray: MINIMIZE_TO_TRAY.load(Ordering::Relaxed),
    }
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let mini_item = MenuItem::with_id(app, "toggle_mini", "切换迷你悬浮窗", true, None::<&str>)?;
    let pause_all = MenuItem::with_id(app, "pause_all", "暂停全部", true, None::<&str>)?;
    let resume_all = MenuItem::with_id(app, "resume_all", "继续全部", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show_item, &mini_item, &pause_all, &resume_all, &separator, &quit_item],
    )?;

    let _ = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().unwrap())
        .tooltip("unfetch")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.unminimize();
                    let _ = win.set_focus();
                }
                if let Some(mini) = app.get_webview_window("mini") {
                    let _ = mini.hide();
                }
            }
            "toggle_mini" => {
                let main = app.get_webview_window("main");
                let mini = app.get_webview_window("mini");
                if let Some(mini) = mini {
                    let visible = mini.is_visible().unwrap_or(false);
                    if visible {
                        let _ = mini.hide();
                        if let Some(main) = main {
                            let _ = main.show();
                            let _ = main.set_focus();
                        }
                    } else {
                        let _ = mini.show();
                        let _ = mini.set_focus();
                        if let Some(main) = main {
                            let _ = main.hide();
                        }
                    }
                }
            }
            "pause_all" => {
                // 通过 daemon REST API 批量暂停所有 downloading 任务
                let _ = daemon_bulk("downloading", "pause");
            }
            "resume_all" => {
                let _ = daemon_bulk("paused", "resume");
            }
            "quit" => {
                MINIMIZE_TO_TRAY.store(false, Ordering::Relaxed);
                daemon::shutdown_daemon();
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.unminimize();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}

/// 通过 daemon 批量执行 pause/resume：先列举该状态的任务，然后逐个调用
fn daemon_bulk(status: &str, action: &str) -> Result<(), String> {
    let client = reqwest::blocking::Client::new();
    let list_url = format!("{}/tasks?status={status}", daemon::DAEMON_URL);
    let tasks: Vec<serde_json::Value> = client
        .get(&list_url)
        .send()
        .map_err(|e| e.to_string())?
        .json()
        .map_err(|e| e.to_string())?;
    for t in tasks {
        if let Some(id) = t["id"].as_str() {
            let _ = client
                .patch(format!("{}/tasks/{id}/{action}", daemon::DAEMON_URL))
                .send();
        }
    }
    Ok(())
}

/// 剪贴板嗅探：1 秒轮询，发现新 URL/magnet 时 emit 给前端
fn clipboard_sniff_loop(handle: AppHandle) {
    let mut last_seen = String::new();
    loop {
        std::thread::sleep(std::time::Duration::from_millis(1200));
        if !CLIPBOARD_SNIFF_ENABLED.load(Ordering::Relaxed) {
            continue;
        }
        let Ok(text) = handle.clipboard().read_text() else {
            continue;
        };
        let trimmed = text.trim().to_string();
        if trimmed.is_empty() || trimmed == last_seen {
            continue;
        }
        if !is_downloadable_url(&trimmed) {
            continue;
        }
        last_seen = trimmed.clone();
        let _ = handle.emit("clipboard-url-detected", trimmed);
    }
}

fn is_downloadable_url(s: &str) -> bool {
    let lower = s.to_lowercase();
    if lower.starts_with("magnet:?") {
        return true;
    }
    if lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("ftp://") {
        // 必须包含点（域名）
        return s.contains('.') && !s.contains(' ');
    }
    false
}

fn forward_args(_app: &AppHandle, args: &[String]) {
    for arg in args.iter().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        let lower = arg.to_lowercase();
        if lower.starts_with("magnet:")
            || lower.starts_with("http://")
            || lower.starts_with("https://")
            || lower.starts_with("ftp://")
        {
            daemon::debug_log(&format!("forward_args: URL arg matched, submitting: {arg}"));
            if let Err(e) = daemon::submit_url(arg) {
                daemon::debug_log(&format!("forward_args: submit_url failed: {e}"));
            }
            continue;
        }
        if lower.ends_with(".torrent") {
            let path = std::path::Path::new(arg);
            if !path.exists() {
                daemon::debug_log(&format!("forward_args: .torrent file not found: {arg}"));
                continue;
            }
            let abs = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
            let s = abs.to_string_lossy().replace('\\', "/");
            let url = if let Some(stripped) = s.strip_prefix("//?/") {
                format!("file:///{stripped}")
            } else if s.starts_with('/') {
                format!("file://{s}")
            } else {
                format!("file:///{s}")
            };
            daemon::debug_log(&format!("forward_args: .torrent matched, submitting: {url}"));
            if let Err(e) = daemon::submit_url(&url) {
                daemon::debug_log(&format!("forward_args: submit_url failed: {e}"));
            }
        } else {
            daemon::debug_log(&format!("forward_args: arg not matched, skipping: {arg}"));
        }
    }
}

// 抑制 unused 警告（Arc 当前未用到，但保留接口）
#[allow(dead_code)]
fn _suppress_unused() {
    let _ = Arc::new(AtomicBool::new(true));
}
