use std::process::Command;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// 用 Unflick 播放已下载的文件。
#[tauri::command]
pub fn play_in_unflick(path: String) -> Result<(), String> {
    let result = if cfg!(target_os = "windows") {
        Command::new("unflick.exe").arg("play").arg(&path).spawn()
    } else {
        Command::new("unflick").arg("play").arg(&path).spawn()
    };

    result
        .map(|_| ())
        .map_err(|e| format!("无法启动 Unflick：{e}"))
}

/// 在文件管理器中打开目录。
#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    let result = if cfg!(target_os = "windows") {
        Command::new("explorer").arg(&path).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(&path).spawn()
    } else {
        Command::new("xdg-open").arg(&path).spawn()
    };

    result.map(|_| ()).map_err(|e| format!("打开目录失败：{e}"))
}

/// 在文件管理器中定位并选中文件。
#[tauri::command]
pub fn reveal_file(path: String) -> Result<(), String> {
    let result = if cfg!(target_os = "windows") {
        Command::new("explorer").arg("/select,").arg(&path).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg("-R").arg(&path).spawn()
    } else {
        // Linux：尝试 nautilus，回退到打开目录
        let p = std::path::Path::new(&path);
        let dir = p.parent().unwrap_or(p);
        Command::new("xdg-open").arg(dir).spawn()
    };

    result.map(|_| ()).map_err(|e| format!("定位文件失败：{e}"))
}

/// 让 Tauri 窗口可见（启动时先隐藏，加载完再显示，避免白屏）。
#[tauri::command]
pub fn show_window(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// 弹出目录选择对话框，返回用户选中的路径。
#[tauri::command]
pub async fn select_directory(app: AppHandle) -> Option<String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path.map(|p| p.to_string()));
    });
    rx.await.ok().flatten()
}
