// Tauri 系统集成的薄封装层（开机自启、运行时开关、剪贴板事件订阅）

export async function getAutostart(): Promise<boolean> {
  try {
    const { isEnabled } = await import('@tauri-apps/plugin-autostart')
    return await isEnabled()
  } catch {
    return false
  }
}

export async function setAutostart(enabled: boolean): Promise<void> {
  const { enable, disable } = await import('@tauri-apps/plugin-autostart')
  if (enabled) await enable()
  else await disable()
}

export interface RuntimeFlags {
  clipboard_sniff_enabled: boolean
  minimize_to_tray: boolean
}

export async function getRuntimeFlags(): Promise<RuntimeFlags> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<RuntimeFlags>('get_runtime_flags')
}

export async function setClipboardSniff(enabled: boolean): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_clipboard_sniff_enabled', { enabled })
}

export async function setMinimizeToTray(enabled: boolean): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('set_minimize_to_tray', { enabled })
}

export async function listenClipboardUrls(handler: (url: string) => void): Promise<() => void> {
  try {
    const { listen } = await import('@tauri-apps/api/event')
    const unlisten = await listen<string>('clipboard-url-detected', (e) => handler(e.payload))
    return unlisten
  } catch {
    return () => {}
  }
}
