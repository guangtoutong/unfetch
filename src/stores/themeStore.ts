import { create } from 'zustand'
import { applyTheme, DEFAULT_THEME_ID, getTheme, THEMES } from '../themes/themes'

const STORAGE_KEY = 'unfetch.theme'

interface ThemeStore {
  themeId: string
  setTheme: (id: string) => void
  init: () => void
}

function loadStored(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && THEMES.some((t) => t.id === v)) return v
  } catch {}
  return DEFAULT_THEME_ID
}

export const useThemeStore = create<ThemeStore>((set) => ({
  themeId: DEFAULT_THEME_ID,
  setTheme: (id) => {
    const t = getTheme(id)
    applyTheme(t)
    try {
      localStorage.setItem(STORAGE_KEY, t.id)
    } catch {}
    set({ themeId: t.id })
  },
  init: () => {
    const id = loadStored()
    const t = getTheme(id)
    applyTheme(t)
    set({ themeId: t.id })
  },
}))
