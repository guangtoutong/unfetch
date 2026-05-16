import { create } from 'zustand'
import { api } from '../lib/api'
import type { Config } from '../types'

interface SettingsStore {
  config: Config
  isOpen: boolean
  isLoading: boolean

  setOpen: (open: boolean) => void
  loadConfig: () => Promise<void>
  updateConfig: (patch: Partial<Config>) => Promise<void>
}

const defaultConfig: Config = {
  download_dir: '',
  max_concurrent: 5,
  http_threads: 16,
  proxy: '',
  use_system_proxy: false,
  speed_limit: 0,
  auto_play_unflick: false,
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  config: defaultConfig,
  isOpen: false,
  isLoading: false,

  setOpen: (isOpen) => set({ isOpen }),

  loadConfig: async () => {
    set({ isLoading: true })
    try {
      const config = await api.getConfig()
      set({ config })
    } catch {
      // 保持默认配置
    } finally {
      set({ isLoading: false })
    }
  },

  updateConfig: async (patch) => {
    const { config } = get()
    const next = { ...config, ...patch }
    set({ config: next })
    try {
      const updated = await api.updateConfig(patch)
      set({ config: updated })
    } catch {
      // 回滚
      set({ config })
    }
  },
}))
