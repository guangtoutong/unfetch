// 在 Windows release 构建中隐藏控制台窗口（GUI 模式）
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use clap::Parser;
use unfetch_lib::{cli, daemon, mcp};

fn main() {
    // 协议处理器（magnet://）会带上 URL 当作位置参数。
    // 用 try_parse 容错；解析失败时回退到 GUI 模式，由 forward_args 接管 URL。
    let cli_args = cli::Cli::try_parse().unwrap_or_else(|_| cli::Cli {
        command: None,
        mcp: false,
    });

    // ── MCP 服务器模式 ─────────────────────────────────────
    if cli_args.mcp {
        attach_console();
        std::process::exit(mcp::run());
    }

    // ── CLI 模式（有子命令）────────────────────────────────
    if cli_args.command.is_some() {
        attach_console();
        std::process::exit(cli::run(cli_args));
    }

    // ── GUI 模式 ───────────────────────────────────────────
    // 确保 daemon 在后台运行，然后启动 Tauri 窗口
    daemon::ensure_running();
    unfetch_lib::run();
}

/// 在 Windows 上把进程重新连接到父进程的控制台，
/// 使 CLI 输出能正常显示在终端。
#[cfg(target_os = "windows")]
fn attach_console() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    unsafe { AttachConsole(ATTACH_PARENT_PROCESS); }
}

#[cfg(not(target_os = "windows"))]
fn attach_console() {}
