pub mod cli;
pub mod daemon;
pub mod gui;
pub mod mcp;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use gui::commands;
use tauri::{
    menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent, Wry,
};
use tauri_plugin_clipboard_manager::ClipboardExt;

struct TrayMenuItems {
    show: MenuItem<Wry>,
    mini: MenuItem<Wry>,
    pause_all: MenuItem<Wry>,
    resume_all: MenuItem<Wry>,
    quit: MenuItem<Wry>,
}

static TRAY_ITEMS: Mutex<Option<TrayMenuItems>> = Mutex::new(None);

/// 全局：剪贴板嗅探是否启用（MAS 版默认关闭，避免后台轮询触发 macOS 剪贴板隐私告警及拒审）
static CLIPBOARD_SNIFF_ENABLED: AtomicBool = AtomicBool::new(cfg!(not(feature = "mas")));
/// 全局：关闭窗口时是否最小化到托盘（默认 false：X 直接退出 app）
static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
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
        ));

    #[cfg(not(feature = "mas"))]
    let builder = builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ));

    let app = builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 首次启动：处理 argv
            let args: Vec<String> = std::env::args().collect();
            daemon::debug_log(&format!("setup() argv: {:?}", args));
            forward_args(app.handle(), &args);

            // 建系统托盘与应用菜单
            let init_zh = std::env::var("LANG")
                .or_else(|_| std::env::var("LC_ALL"))
                .map(|v| v.to_lowercase().starts_with("zh"))
                .unwrap_or(false);
            #[cfg(target_os = "macos")]
            let _ = setup_app_menu(app.handle(), init_zh);
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
            set_tray_labels,
        ])
        .build(tauri::generate_context!())
        .expect("error while building unfetch");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } = event
        {
            if !has_visible_windows {
                if let Some(win) = app_handle.get_webview_window("main") {
                    let _ = win.unminimize();
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        }
        let _ = (app_handle, event);
    });
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

#[tauri::command]
fn set_tray_labels(
    app: AppHandle,
    show: String,
    toggle_mini: String,
    pause_all: String,
    resume_all: String,
    quit: String,
) {
    #[cfg(target_os = "macos")]
    {
        let is_zh = show.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c));
        let _ = setup_app_menu(&app, is_zh);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = &app;
    if let Ok(guard) = TRAY_ITEMS.lock() {
        if let Some(items) = guard.as_ref() {
            let _ = items.show.set_text(show);
            let _ = items.mini.set_text(toggle_mini);
            let _ = items.pause_all.set_text(pause_all);
            let _ = items.resume_all.set_text(resume_all);
            let _ = items.quit.set_text(quit);
        }
    }
}

#[cfg(target_os = "macos")]
fn setup_app_menu(app: &AppHandle, is_zh: bool) -> tauri::Result<()> {
    let pkg_info = app.package_info();
    let app_name = &pkg_info.name;
    let about_meta = AboutMetadata {
        name: Some(app_name.clone()),
        version: Some(pkg_info.version.to_string()),
        ..Default::default()
    };

    let about_label = if is_zh {
        format!("关于 {app_name}")
    } else {
        format!("About {app_name}")
    };
    let hide_label = if is_zh {
        format!("隐藏 {app_name}")
    } else {
        format!("Hide {app_name}")
    };
    let quit_label = if is_zh {
        format!("退出 {app_name}")
    } else {
        format!("Quit {app_name}")
    };

    let app_submenu = Submenu::with_items(
        app,
        app_name,
        true,
        &[
            &PredefinedMenuItem::about(app, Some(&about_label), Some(about_meta))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, Some(if is_zh { "服务" } else { "Services" }))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some(&hide_label))?,
            &PredefinedMenuItem::hide_others(
                app,
                Some(if is_zh { "隐藏其他" } else { "Hide Others" }),
            )?,
            &PredefinedMenuItem::show_all(
                app,
                Some(if is_zh { "全部显示" } else { "Show All" }),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some(&quit_label))?,
        ],
    )?;

    let edit_submenu = Submenu::with_items(
        app,
        if is_zh { "编辑" } else { "Edit" },
        true,
        &[
            &PredefinedMenuItem::undo(app, Some(if is_zh { "撤销" } else { "Undo" }))?,
            &PredefinedMenuItem::redo(app, Some(if is_zh { "重做" } else { "Redo" }))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some(if is_zh { "剪切" } else { "Cut" }))?,
            &PredefinedMenuItem::copy(app, Some(if is_zh { "拷贝" } else { "Copy" }))?,
            &PredefinedMenuItem::paste(app, Some(if is_zh { "粘贴" } else { "Paste" }))?,
            &PredefinedMenuItem::select_all(app, Some(if is_zh { "全选" } else { "Select All" }))?,
        ],
    )?;

    let view_submenu = Submenu::with_items(
        app,
        if is_zh { "显示" } else { "View" },
        true,
        &[&PredefinedMenuItem::fullscreen(
            app,
            Some(if is_zh { "进入全屏幕" } else { "Enter Full Screen" }),
        )?],
    )?;

    let window_submenu = Submenu::with_items(
        app,
        if is_zh { "窗口" } else { "Window" },
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some(if is_zh { "最小化" } else { "Minimize" }))?,
            &PredefinedMenuItem::maximize(app, Some(if is_zh { "缩放" } else { "Zoom" }))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(
                app,
                Some(if is_zh { "关闭窗口" } else { "Close Window" }),
            )?,
        ],
    )?;

    let menu = Menu::with_items(
        app,
        &[&app_submenu, &edit_submenu, &view_submenu, &window_submenu],
    )?;
    let _ = app.set_menu(menu);
    Ok(())
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let is_zh = std::env::var("LANG")
        .or_else(|_| std::env::var("LC_ALL"))
        .map(|v| v.to_lowercase().starts_with("zh"))
        .unwrap_or(false);
    let show_item = MenuItem::with_id(
        app,
        "show",
        if is_zh { "显示主窗口" } else { "Show main window" },
        true,
        None::<&str>,
    )?;
    let mini_item = MenuItem::with_id(
        app,
        "toggle_mini",
        if is_zh { "切换迷你悬浮窗" } else { "Toggle mini overlay" },
        true,
        None::<&str>,
    )?;
    let pause_all = MenuItem::with_id(
        app,
        "pause_all",
        if is_zh { "暂停全部" } else { "Pause all" },
        true,
        None::<&str>,
    )?;
    let resume_all = MenuItem::with_id(
        app,
        "resume_all",
        if is_zh { "继续全部" } else { "Resume all" },
        true,
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(
        app,
        "quit",
        if is_zh { "退出" } else { "Quit" },
        true,
        None::<&str>,
    )?;

    let menu = Menu::with_items(
        app,
        &[&show_item, &mini_item, &pause_all, &resume_all, &separator, &quit_item],
    )?;

    if let Ok(mut guard) = TRAY_ITEMS.lock() {
        *guard = Some(TrayMenuItems {
            show: show_item,
            mini: mini_item,
            pause_all,
            resume_all,
            quit: quit_item,
        });
    }

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
    #[cfg(not(feature = "mas"))]
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
        let is_scheme = lower.starts_with("http://")
            || lower.starts_with("https://")
            || lower.starts_with("ftp://")
            || {
                #[cfg(not(feature = "mas"))]
                {
                    lower.starts_with("magnet:")
                }
                #[cfg(feature = "mas")]
                {
                    false
                }
            };
        if is_scheme {
            daemon::debug_log(&format!("forward_args: URL arg matched, submitting: {arg}"));
            if let Err(e) = daemon::submit_url(arg) {
                daemon::debug_log(&format!("forward_args: submit_url failed: {e}"));
            }
            continue;
        }
        #[cfg(not(feature = "mas"))]
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
            continue;
        }
        daemon::debug_log(&format!("forward_args: arg not matched, skipping: {arg}"));
    }
}

// 抑制 unused 警告（Arc 当前未用到，但保留接口）
#[allow(dead_code)]
fn _suppress_unused() {
    let _ = Arc::new(AtomicBool::new(true));
}
