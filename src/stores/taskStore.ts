import { create } from 'zustand'
import { api, subscribeToTaskEvents } from '../lib/api'
import { notify, notifyTaskTransition } from '../lib/notify'
import type { Task, FilterType, TaskCounts } from '../types'

let allDoneFired = false
async function triggerAllDoneAction() {
  if (allDoneFired) return
  try {
    const cfg = await api.getConfig()
    const action = cfg.on_all_done as string | undefined
    if (!action || action === '' || action === 'shutdown' || action === 'sleep') {
      // shutdown / sleep 由 daemon 端执行；notify / open_dir 在前端
      return
    }
    allDoneFired = true
    if (action === 'notify') {
      await notify('全部下载完成', '所有任务已完成')
    } else if (action === 'open_dir') {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_folder', { path: cfg.download_dir })
    }
    // 重置（守备：daemon 也会清，但 race 时取最快）
    setTimeout(() => { allDoneFired = false }, 5000)
  } catch (e) {
    console.error('all-done action failed', e)
  }
}

interface TaskStore {
  tasks: Task[]
  filter: FilterType
  searchQuery: string
  isConnected: boolean
  isLoading: boolean

  // 计算属性
  filteredTasks: () => Task[]
  counts: () => TaskCounts

  // 操作
  setFilter: (filter: FilterType) => void
  setSearchQuery: (q: string) => void
  loadTasks: () => Promise<void>
  addTask: (req: Parameters<typeof api.addTask>[0]) => Promise<Task>
  pauseTask: (id: string) => Promise<void>
  resumeTask: (id: string) => Promise<void>
  trashTask: (id: string) => Promise<void>
  restoreTask: (id: string) => Promise<void>
  emptyTrash: () => Promise<number>
  restoreAllTrashed: () => Promise<number>
  pauseAll: () => Promise<number>
  resumeAll: () => Promise<number>
  removeTask: (id: string, deleteFile?: boolean) => Promise<void>
  updateTask: (task: Task) => void

  // 轮询 & SSE
  _pollingTimer: ReturnType<typeof setInterval> | null
  _sseUnsub: (() => void) | null
  startPolling: () => void
  stopPolling: () => void
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  filter: 'downloading',
  searchQuery: '',
  isConnected: false,
  isLoading: false,
  _pollingTimer: null,
  _sseUnsub: null,

  filteredTasks: () => {
    const { tasks, filter, searchQuery } = get()
    let list = tasks
    if (filter === 'trash') {
      list = list.filter((t) => t.trashed)
    } else {
      list = list.filter((t) => !t.trashed)
      if (filter === 'downloading') {
        // "下载中" 等于"未完成"：queued + downloading + paused
        list = list.filter((t) => t.status === 'queued' || t.status === 'downloading' || t.status === 'paused')
      } else if (filter !== 'all') {
        list = list.filter((t) => t.status === filter)
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (t) =>
          t.filename.toLowerCase().includes(q) ||
          t.url.toLowerCase().includes(q) ||
          t.metadata?.title?.toLowerCase().includes(q),
      )
    }
    return list
  },

  counts: () => {
    const { tasks } = get()
    const active = tasks.filter((t) => !t.trashed)
    const unfinished = active.filter((t) => t.status === 'queued' || t.status === 'downloading' || t.status === 'paused')
    return {
      all: active.length,
      downloading: unfinished.length, // "下载中" = 未完成
      paused: active.filter((t) => t.status === 'paused').length,
      done: active.filter((t) => t.status === 'done').length,
      error: active.filter((t) => t.status === 'error').length,
      trash: tasks.filter((t) => t.trashed).length,
    }
  },

  setFilter: (filter) => set({ filter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  loadTasks: async () => {
    try {
      const tasks = await api.getTasks()
      // 按 created_at 倒序
      tasks.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      set({ tasks, isConnected: true })
    } catch {
      set({ isConnected: false })
    }
  },

  addTask: async (req) => {
    const task = await api.addTask(req)
    set((state) => ({
      tasks: [task, ...state.tasks],
    }))
    return task
  },

  pauseTask: async (id) => {
    const task = await api.pauseTask(id)
    get().updateTask(task)
  },

  resumeTask: async (id) => {
    const task = await api.resumeTask(id)
    get().updateTask(task)
  },

  trashTask: async (id) => {
    const task = await api.trashTask(id)
    get().updateTask(task)
  },

  restoreTask: async (id) => {
    const task = await api.restoreTask(id)
    get().updateTask(task)
  },

  emptyTrash: async () => {
    const { deleted } = await api.emptyTrash()
    // 本地立即移除所有 trashed 任务
    set((state) => ({
      tasks: state.tasks.filter((t) => !t.trashed),
    }))
    return deleted
  },

  restoreAllTrashed: async () => {
    const { restored } = await api.restoreAllTrashed()
    // 本地立即把所有 trashed 改为非 trashed
    set((state) => ({
      tasks: state.tasks.map((t) => (t.trashed ? { ...t, trashed: false } : t)),
    }))
    return restored
  },

  pauseAll: async () => {
    const { tasks } = get()
    const targets = tasks.filter((t) => !t.trashed && (t.status === 'downloading' || t.status === 'queued'))
    let n = 0
    await Promise.all(
      targets.map(async (t) => {
        try {
          const updated = await api.pauseTask(t.id)
          get().updateTask(updated)
          n++
        } catch {}
      }),
    )
    return n
  },

  resumeAll: async () => {
    const { tasks } = get()
    const targets = tasks.filter((t) => !t.trashed && (t.status === 'paused' || t.status === 'error'))
    let n = 0
    await Promise.all(
      targets.map(async (t) => {
        try {
          const updated = await api.resumeTask(t.id)
          get().updateTask(updated)
          n++
        } catch {}
      }),
    )
    return n
  },

  removeTask: async (id, deleteFile = false) => {
    await api.removeTask(id, deleteFile)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }))
  },

  updateTask: (task) => {
    set((state) => {
      const idx = state.tasks.findIndex((t) => t.id === task.id)
      if (idx === -1) {
        return { tasks: [task, ...state.tasks] }
      }
      const prev = state.tasks[idx]
      const tasks = [...state.tasks]
      tasks[idx] = task

      // 状态变化触发原生通知（done / error）
      if (prev.status !== task.status) {
        notifyTaskTransition(prev, task)
        // 任务变为 done 且所有任务都 done 时触发 on_all_done
        if (task.status === 'done') {
          const allDone = tasks
            .filter((t) => !t.trashed)
            .every((t) => t.status === 'done')
          if (allDone) {
            // 异步检查 config 并执行 notify / open_dir
            void triggerAllDoneAction()
          }
        }
      }
      return { tasks }
    })
  },

  startPolling: () => {
    const store = get()

    // 先加载一次
    store.loadTasks()

    // 尝试 SSE
    const unsub = subscribeToTaskEvents(
      (task) => {
        get().updateTask(task)
        set({ isConnected: true })
      },
      () => {
        set({ isConnected: false })
      },
    )
    set({ _sseUnsub: unsub })

    // 同时保留 500ms 轮询作为兜底（SSE 断线时确保数据刷新）
    const timer = setInterval(async () => {
      try {
        const tasks = await api.getTasks()
        tasks.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )
        set({ tasks, isConnected: true })
      } catch {
        set({ isConnected: false })
      }
    }, 2000)

    set({ _pollingTimer: timer })
  },

  stopPolling: () => {
    const { _pollingTimer, _sseUnsub } = get()
    if (_pollingTimer) clearInterval(_pollingTimer)
    if (_sseUnsub) _sseUnsub()
    set({ _pollingTimer: null, _sseUnsub: null })
  },
}))
