import type { Task } from '../types'

// 触发原生系统通知（Windows 通知中心 / macOS Notification Center）
// 用户首次使用时会询问权限
let permissionGranted: boolean | null = null

async function ensurePermission(): Promise<boolean> {
  if (permissionGranted !== null) return permissionGranted
  try {
    const mod = await import('@tauri-apps/plugin-notification')
    let granted = await mod.isPermissionGranted()
    if (!granted) {
      const result = await mod.requestPermission()
      granted = result === 'granted'
    }
    permissionGranted = granted
    return granted
  } catch {
    permissionGranted = false
    return false
  }
}

export async function notify(title: string, body: string) {
  try {
    if (!(await ensurePermission())) return
    const { sendNotification } = await import('@tauri-apps/plugin-notification')
    sendNotification({ title, body })
  } catch {
    // 浏览器（非 Tauri）环境忽略
  }
}

// 任务状态变化时触发对应通知
export function notifyTaskTransition(prev: Task, next: Task) {
  // 跳过非用户感兴趣的过渡
  if (prev.trashed || next.trashed) return

  const name = next.metadata?.title || next.filename || next.url

  if (prev.status !== 'done' && next.status === 'done') {
    notify('下载完成', name)
  } else if (prev.status !== 'error' && next.status === 'error') {
    const msg = next.error ? `${name}\n${next.error.substring(0, 80)}` : name
    notify('下载失败', msg)
  }
}
