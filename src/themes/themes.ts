// 主题 token 系统
// 每个主题定义一组 CSS 变量值；运行时通过 setProperty 应用到 :root
// 新增主题：在 THEMES 里加一项即可。

export interface ThemeTokens {
  // 背景层（从外到内）
  '--bg-base': string
  '--bg-sidebar': string
  '--bg-card': string
  '--bg-card-hover': string
  '--bg-elevated': string
  // 边框
  '--border': string
  '--border-strong': string
  // 主色系
  '--primary': string
  '--primary-glow': string
  '--primary-rgb': string // 例如 "99, 102, 241"，供 rgba() 使用
  // 状态色
  '--success': string
  '--warning': string
  '--error': string
  '--speed-color': string
  // 文本
  '--text-primary': string
  '--text-secondary': string
  '--text-muted': string
  // 输入/滚动条柄背景（半透明，可独立于主色）
  '--surface-input': string
  '--surface-hover': string
  '--scrollbar-thumb': string
  '--scrollbar-thumb-hover': string
}

export interface ThemeDef {
  id: string
  name: string // 显示名
  desc: string
  /** 是否为浅色主题（影响图标对比、阴影强度） */
  light?: boolean
  /** 卡片预览的两个代表色（用于设置面板小方块） */
  preview: [string, string]
  tokens: ThemeTokens
}

// 1. 深堡野（默认 —— 当前应用配色）
const deepIndigo: ThemeDef = {
  id: 'deep-indigo',
  name: '深堡野',
  desc: '默认配色 — indigo 主调，深空背景',
  preview: ['#070710', '#6366f1'],
  tokens: {
    '--bg-base': '#070710',
    '--bg-sidebar': '#0c0c1a',
    '--bg-card': '#111128',
    '--bg-card-hover': '#161634',
    '--bg-elevated': '#1a1a3a',
    '--border': 'rgba(99, 102, 241, 0.15)',
    '--border-strong': 'rgba(99, 102, 241, 0.3)',
    '--primary': '#6366f1',
    '--primary-glow': 'rgba(99, 102, 241, 0.4)',
    '--primary-rgb': '99, 102, 241',
    '--success': '#22c55e',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
    '--speed-color': '#10b981',
    '--text-primary': '#e2e8f0',
    '--text-secondary': '#64748b',
    '--text-muted': '#374151',
    '--surface-input': 'rgba(99, 102, 241, 0.06)',
    '--surface-hover': 'rgba(99, 102, 241, 0.10)',
    '--scrollbar-thumb': 'rgba(99, 102, 241, 0.25)',
    '--scrollbar-thumb-hover': 'rgba(99, 102, 241, 0.45)',
  },
}

// 2. 亮色纸（高对比度浅色）
const lightPaper: ThemeDef = {
  id: 'light-paper',
  name: '亮色纸',
  desc: '高对比度浅色 — 白纸 + 靛蓝',
  light: true,
  preview: ['#fafafa', '#2563eb'],
  tokens: {
    '--bg-base': '#fafafa',
    '--bg-sidebar': '#f1f5f9',
    '--bg-card': '#ffffff',
    '--bg-card-hover': '#f8fafc',
    '--bg-elevated': '#ffffff',
    '--border': 'rgba(15, 23, 42, 0.08)',
    '--border-strong': 'rgba(15, 23, 42, 0.18)',
    '--primary': '#2563eb',
    '--primary-glow': 'rgba(37, 99, 235, 0.18)',
    '--primary-rgb': '37, 99, 235',
    '--success': '#16a34a',
    '--warning': '#d97706',
    '--error': '#dc2626',
    '--speed-color': '#0891b2',
    '--text-primary': '#0f172a',
    '--text-secondary': '#475569',
    '--text-muted': '#94a3b8',
    '--surface-input': 'rgba(15, 23, 42, 0.04)',
    '--surface-hover': 'rgba(37, 99, 235, 0.06)',
    '--scrollbar-thumb': 'rgba(37, 99, 235, 0.30)',
    '--scrollbar-thumb-hover': 'rgba(37, 99, 235, 0.55)',
  },
}

// 3. 护眼绿（长时间下载守夜的人）
const forestNight: ThemeDef = {
  id: 'forest-night',
  name: '护眼绿',
  desc: '深墨绿 + emerald 主调，护眼夜战',
  preview: ['#0b1411', '#10b981'],
  tokens: {
    '--bg-base': '#0b1411',
    '--bg-sidebar': '#0f1c17',
    '--bg-card': '#142420',
    '--bg-card-hover': '#1a2e28',
    '--bg-elevated': '#1d342d',
    '--border': 'rgba(16, 185, 129, 0.14)',
    '--border-strong': 'rgba(16, 185, 129, 0.32)',
    '--primary': '#10b981',
    '--primary-glow': 'rgba(16, 185, 129, 0.4)',
    '--primary-rgb': '16, 185, 129',
    '--success': '#34d399',
    '--warning': '#fbbf24',
    '--error': '#f87171',
    '--speed-color': '#22d3ee',
    '--text-primary': '#d1fae5',
    '--text-secondary': '#6ee7b7',
    '--text-muted': '#3f6259',
    '--surface-input': 'rgba(16, 185, 129, 0.06)',
    '--surface-hover': 'rgba(16, 185, 129, 0.12)',
    '--scrollbar-thumb': 'rgba(16, 185, 129, 0.28)',
    '--scrollbar-thumb-hover': 'rgba(16, 185, 129, 0.50)',
  },
}

// 4. 赛博朋克（粉紫霓虹 + 青蓝点缀）
const cyberpunk: ThemeDef = {
  id: 'cyberpunk',
  name: '赛博朋克',
  desc: '霓虹粉紫 + 青蓝，黑夜城市的电流',
  preview: ['#0a0612', '#ec4899'],
  tokens: {
    '--bg-base': '#0a0612',
    '--bg-sidebar': '#13081e',
    '--bg-card': '#1c0c2b',
    '--bg-card-hover': '#250f3a',
    '--bg-elevated': '#2c1144',
    '--border': 'rgba(236, 72, 153, 0.20)',
    '--border-strong': 'rgba(236, 72, 153, 0.42)',
    '--primary': '#ec4899',
    '--primary-glow': 'rgba(236, 72, 153, 0.5)',
    '--primary-rgb': '236, 72, 153',
    '--success': '#06ffa5',
    '--warning': '#fbbf24',
    '--error': '#ff3860',
    '--speed-color': '#06b6d4',
    '--text-primary': '#fce7f3',
    '--text-secondary': '#c084fc',
    '--text-muted': '#5b2860',
    '--surface-input': 'rgba(236, 72, 153, 0.07)',
    '--surface-hover': 'rgba(236, 72, 153, 0.15)',
    '--scrollbar-thumb': 'rgba(236, 72, 153, 0.30)',
    '--scrollbar-thumb-hover': 'rgba(236, 72, 153, 0.55)',
  },
}

// 5. 极简灰白（高对比 mono）
const monoGray: ThemeDef = {
  id: 'mono-gray',
  name: '极简灰白',
  desc: '高对比黑白灰，专注模式',
  preview: ['#0a0a0a', '#fafafa'],
  tokens: {
    '--bg-base': '#0a0a0a',
    '--bg-sidebar': '#101010',
    '--bg-card': '#161616',
    '--bg-card-hover': '#1d1d1d',
    '--bg-elevated': '#242424',
    '--border': 'rgba(250, 250, 250, 0.10)',
    '--border-strong': 'rgba(250, 250, 250, 0.22)',
    '--primary': '#fafafa',
    '--primary-glow': 'rgba(250, 250, 250, 0.18)',
    '--primary-rgb': '250, 250, 250',
    '--success': '#a3e635',
    '--warning': '#fbbf24',
    '--error': '#f87171',
    '--speed-color': '#e5e5e5',
    '--text-primary': '#fafafa',
    '--text-secondary': '#a1a1aa',
    '--text-muted': '#52525b',
    '--surface-input': 'rgba(250, 250, 250, 0.04)',
    '--surface-hover': 'rgba(250, 250, 250, 0.08)',
    '--scrollbar-thumb': 'rgba(250, 250, 250, 0.18)',
    '--scrollbar-thumb-hover': 'rgba(250, 250, 250, 0.35)',
  },
}

export const THEMES: ThemeDef[] = [deepIndigo, lightPaper, forestNight, cyberpunk, monoGray]

export const DEFAULT_THEME_ID = 'deep-indigo'

export function getTheme(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

export function applyTheme(theme: ThemeDef) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.tokens)) {
    root.style.setProperty(k, v)
  }
  root.dataset.theme = theme.id
  if (theme.light) root.dataset.themeLight = 'true'
  else delete root.dataset.themeLight
}
