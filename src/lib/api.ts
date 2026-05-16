import type { Task, Config, AddTaskRequest, TorrentPreview } from '../types'

const API_BASE = 'http://127.0.0.1:19543'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: (): Promise<{ status: string }> =>
    request('/health'),

  getTasks: (): Promise<Task[]> =>
    request('/tasks'),

  getTask: (id: string): Promise<Task> =>
    request(`/tasks/${id}`),

  addTask: (req: AddTaskRequest): Promise<Task> =>
    request('/tasks', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  pauseTask: (id: string): Promise<Task> =>
    request(`/tasks/${id}/pause`, { method: 'PATCH' }),

  resumeTask: (id: string): Promise<Task> =>
    request(`/tasks/${id}/resume`, { method: 'PATCH' }),

  trashTask: (id: string): Promise<Task> =>
    request(`/tasks/${id}/trash`, { method: 'PATCH' }),

  restoreTask: (id: string): Promise<Task> =>
    request(`/tasks/${id}/restore`, { method: 'PATCH' }),

  previewTorrent: (url: string): Promise<TorrentPreview> =>
    request('/torrent/preview', { method: 'POST', body: JSON.stringify({ url }) }),

  emptyTrash: (): Promise<{ deleted: number }> =>
    request(`/tasks/trash`, { method: 'DELETE' }),

  restoreAllTrashed: (): Promise<{ restored: number }> =>
    request(`/tasks/trash/restore-all`, { method: 'PATCH' }),

  removeTask: (id: string, deleteFile = false): Promise<void> =>
    request(`/tasks/${id}?delete_file=${deleteFile}`, { method: 'DELETE' }),

  getConfig: (): Promise<Config> =>
    request('/config'),

  updateConfig: (config: Partial<Config>): Promise<Config> =>
    request('/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),
}

/** 订阅 SSE 任务事件，返回取消订阅函数 */
export function subscribeToTaskEvents(
  onUpdate: (task: Task) => void,
  onError?: (err: Event) => void,
): () => void {
  let es: EventSource | null = null
  let closed = false

  function connect() {
    if (closed) return
    es = new EventSource(`${API_BASE}/tasks/events`)

    es.onmessage = (e) => {
      try {
        const task = JSON.parse(e.data) as Task
        onUpdate(task)
      } catch {
        // 忽略解析错误
      }
    }

    es.onerror = (e) => {
      onError?.(e)
      es?.close()
      es = null
      // 3 秒后重连
      if (!closed) setTimeout(connect, 3000)
    }
  }

  connect()

  return () => {
    closed = true
    es?.close()
    es = null
  }
}
