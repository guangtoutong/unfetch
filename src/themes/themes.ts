// 主题 token 系统
// 每个主题定义一组 CSS 变量值；运行时通过 setProperty 应用到 :root
// 新增主题：在 THEMES 里加一项即可。
//
// 对比度准则（v0.2.x 重新校准）：
//   text-primary  vs bg-base ≥ 12:1 (AAA)
//   text-secondary vs bg-base ≥ 7:1  (AAA)
//   text-muted    vs bg-base ≥ 4.5:1 (AA normal text)
// 之前几套深色主题的 text-muted 全部不到 3:1，读不清。这版统一提到 AA+。

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

// 0. 乳白 Cream — 跟官网 unfetch.org 同款（v0.2.x 新增，浅色高对比）
const creamLight: ThemeDef = {
  id: 'cream-light',
  name: '乳白',
  desc: '官网同款浅色 — 乳白底 + 深紫强调，WCAG AAA',
  light: true,
  preview: ['#fafafa', '#7c3aed'],
  tokens: {
    '--bg-base': '#fafafa',
    '--bg-sidebar': '#f3f3f5',
    '--bg-card': '#ffffff',
    '--bg-card-hover': '#f8f8fa',
    '--bg-elevated': '#ffffff',
    '--border': 'rgba(0, 0, 0, 0.10)',
    '--border-strong': 'rgba(0, 0, 0, 0.18)',
    '--primary': '#7c3aed',
    '--primary-glow': 'rgba(124, 58, 237, 0.22)',
    '--primary-rgb': '124, 58, 237',
    '--success': '#16a34a',
    '--warning': '#d97706',
    '--error': '#dc2626',
    '--speed-color': '#0891b2',
    '--text-primary': '#0a0a0a',
    '--text-secondary': '#404040',
    '--text-muted': '#525252', // 7.8:1 on #fafafa = AAA
    '--surface-input': 'rgba(124, 58, 237, 0.06)',
    '--surface-hover': 'rgba(124, 58, 237, 0.10)',
    '--scrollbar-thumb': 'rgba(124, 58, 237, 0.30)',
    '--scrollbar-thumb-hover': 'rgba(124, 58, 237, 0.55)',
  },
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
    '--bg-card': '#15152e',
    '--bg-card-hover': '#1c1c3a',
    '--bg-elevated': '#222244',
    '--border': 'rgba(148, 163, 184, 0.22)', // 从 indigo-tinted 0.15 提到中性 0.22,边框可辨
    '--border-strong': 'rgba(148, 163, 184, 0.40)',
    '--primary': '#818cf8', // 从 #6366f1 调亮一档,在深底上更醒目
    '--primary-glow': 'rgba(129, 140, 248, 0.4)',
    '--primary-rgb': '129, 140, 248',
    '--success': '#22c55e',
    '--warning': '#f59e0b',
    '--error': '#ef4444',
    '--speed-color': '#10b981',
    '--text-primary': '#f1f5f9', // 11:1 vs #070710
    '--text-secondary': '#cbd5e1', // 8.8:1 - 之前 #64748b 才 3.7:1
    '--text-muted': '#94a3b8', // 5.9:1 - 之前 #374151 才 2:1
    '--surface-input': 'rgba(129, 140, 248, 0.08)',
    '--surface-hover': 'rgba(129, 140, 248, 0.14)',
    '--scrollbar-thumb': 'rgba(129, 140, 248, 0.30)',
    '--scrollbar-thumb-hover': 'rgba(129, 140, 248, 0.50)',
  },
}

// 2. 亮色纸（蓝调浅色,跟 Cream Light 区分开 — 这套偏冷蓝）
const lightPaper: ThemeDef = {
  id: 'light-paper',
  name: '亮色纸',
  desc: '冷蓝调浅色 — 白纸 + 靛蓝',
  light: true,
  preview: ['#fafafa', '#2563eb'],
  tokens: {
    '--bg-base': '#fafafa',
    '--bg-sidebar': '#eff4f9',
    '--bg-card': '#ffffff',
    '--bg-card-hover': '#f5f8fc',
    '--bg-elevated': '#ffffff',
    '--border': 'rgba(15, 23, 42, 0.12)',
    '--border-strong': 'rgba(15, 23, 42, 0.24)',
    '--primary': '#2563eb',
    '--primary-glow': 'rgba(37, 99, 235, 0.22)',
    '--primary-rgb': '37, 99, 235',
    '--success': '#16a34a',
    '--warning': '#d97706',
    '--error': '#dc2626',
    '--speed-color': '#0891b2',
    '--text-primary': '#0f172a',
    '--text-secondary': '#334155', // 9.7:1 - 之前 #475569 才 7.5:1, 略提
    '--text-muted': '#64748b', // 4.7:1 - 之前 #94a3b8 才 3.5:1
    '--surface-input': 'rgba(15, 23, 42, 0.05)',
    '--surface-hover': 'rgba(37, 99, 235, 0.08)',
    '--scrollbar-thumb': 'rgba(37, 99, 235, 0.32)',
    '--scrollbar-thumb-hover': 'rgba(37, 99, 235, 0.58)',
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
    '--bg-sidebar': '#10201b',
    '--bg-card': '#172823',
    '--bg-card-hover': '#1e342c',
    '--bg-elevated': '#243d34',
    '--border': 'rgba(110, 231, 183, 0.22)',
    '--border-strong': 'rgba(110, 231, 183, 0.42)',
    '--primary': '#34d399', // 从 #10b981 略提亮,在深底上更鲜
    '--primary-glow': 'rgba(52, 211, 153, 0.4)',
    '--primary-rgb': '52, 211, 153',
    '--success': '#86efac',
    '--warning': '#fbbf24',
    '--error': '#f87171',
    '--speed-color': '#22d3ee',
    '--text-primary': '#ecfdf5', // 14:1
    '--text-secondary': '#a7f3d0', // 9.5:1
    '--text-muted': '#86efac', // 8.2:1 — 之前 #3f6259 才 2.4:1
    '--surface-input': 'rgba(52, 211, 153, 0.08)',
    '--surface-hover': 'rgba(52, 211, 153, 0.14)',
    '--scrollbar-thumb': 'rgba(52, 211, 153, 0.32)',
    '--scrollbar-thumb-hover': 'rgba(52, 211, 153, 0.55)',
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
    '--bg-sidebar': '#150a22',
    '--bg-card': '#211030',
    '--bg-card-hover': '#2c143f',
    '--bg-elevated': '#36194c',
    '--border': 'rgba(244, 114, 182, 0.28)',
    '--border-strong': 'rgba(244, 114, 182, 0.50)',
    '--primary': '#f472b6', // 从 #ec4899 提亮
    '--primary-glow': 'rgba(244, 114, 182, 0.5)',
    '--primary-rgb': '244, 114, 182',
    '--success': '#06ffa5',
    '--warning': '#fbbf24',
    '--error': '#ff3860',
    '--speed-color': '#22d3ee',
    '--text-primary': '#fdf2f8', // 14:1
    '--text-secondary': '#e9d5ff', // 11:1
    '--text-muted': '#d8b4fe', // 8.2:1 — 之前 #5b2860 才 2.5:1
    '--surface-input': 'rgba(244, 114, 182, 0.10)',
    '--surface-hover': 'rgba(244, 114, 182, 0.18)',
    '--scrollbar-thumb': 'rgba(244, 114, 182, 0.34)',
    '--scrollbar-thumb-hover': 'rgba(244, 114, 182, 0.58)',
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
    '--bg-sidebar': '#141414',
    '--bg-card': '#1c1c1c',
    '--bg-card-hover': '#252525',
    '--bg-elevated': '#2d2d2d',
    '--border': 'rgba(250, 250, 250, 0.18)',
    '--border-strong': 'rgba(250, 250, 250, 0.32)',
    '--primary': '#fafafa',
    '--primary-glow': 'rgba(250, 250, 250, 0.22)',
    '--primary-rgb': '250, 250, 250',
    '--success': '#a3e635',
    '--warning': '#fbbf24',
    '--error': '#f87171',
    '--speed-color': '#e5e5e5',
    '--text-primary': '#fafafa', // 19:1
    '--text-secondary': '#d4d4d4', // 13:1
    '--text-muted': '#a1a1aa', // 7.5:1 — 之前 #52525b 才 4.2:1 (勉强 AA)
    '--surface-input': 'rgba(250, 250, 250, 0.06)',
    '--surface-hover': 'rgba(250, 250, 250, 0.12)',
    '--scrollbar-thumb': 'rgba(250, 250, 250, 0.22)',
    '--scrollbar-thumb-hover': 'rgba(250, 250, 250, 0.40)',
  },
}

// Cream Light 排在前列让浅色用户更容易找到。Deep Indigo 保留默认（保留品牌色)。
export const THEMES: ThemeDef[] = [deepIndigo, creamLight, lightPaper, forestNight, cyberpunk, monoGray]

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
