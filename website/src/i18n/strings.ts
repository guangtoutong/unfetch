// 网站文案：与桌面端 i18n 独立，按需扩展。
// key 体系简单：每语言一个对象，访问时调 t(lang, key)

export type Lang =
  | 'zh' | 'en' | 'ja' | 'ko' | 'de' | 'fr' | 'es'
  | 'pt' | 'it' | 'pl' | 'nl' | 'tr' | 'sv' | 'uk'

export const LANGS: Array<{ code: Lang; native: string }> = [
  { code: 'en', native: 'English' },
  { code: 'zh', native: '中文' },
  { code: 'ja', native: '日本語' },
  { code: 'ko', native: '한국어' },
  { code: 'de', native: 'Deutsch' },
  { code: 'fr', native: 'Français' },
  { code: 'es', native: 'Español' },
  { code: 'pt', native: 'Português' },
  { code: 'it', native: 'Italiano' },
  { code: 'pl', native: 'Polski' },
  { code: 'nl', native: 'Nederlands' },
  { code: 'tr', native: 'Türkçe' },
  { code: 'sv', native: 'Svenska' },
  { code: 'uk', native: 'Українська' },
]

interface Strings {
  meta: { title: string; description: string }
  nav: { home: string; mcp: string; github: string }
  hero: {
    tag: string
    title: string
    subtitle: string
    download: string
    mcp: string
    requirements: string
  }
  features: {
    title: string
    items: Array<{ title: string; desc: string }>
  }
  cta: { title: string; desc: string; button: string }
  footer: { copy: string; license: string }
}

const en: Strings = {
  meta: {
    title: 'unfetch — A modern download manager for humans and AI',
    description: 'Multi-threaded HTTP, BT / magnet, 1000+ video sites, AI-ready via MCP. Open source.',
  },
  nav: { home: 'Home', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'Free · Open Source · No ads',
    title: 'Downloads built for humans and AI',
    subtitle: 'Fast HTTP downloads, BT, 1000+ video sites — all in one app. Drive it by hand, by CLI, or by AI through MCP.',
    download: 'Download for Windows',
    mcp: 'Use with AI (MCP)',
    requirements: 'Windows 10 / 11 · 64-bit · 8 MB installer',
  },
  features: {
    title: 'Everything a download manager should be',
    items: [
      { title: 'Multi-thread HTTP', desc: 'Up to 32 threads, resume support, hash verification.' },
      { title: 'BT / Magnet', desc: 'Built on anacrolix/torrent. Public trackers pre-populated.' },
      { title: '1000+ video sites', desc: 'YouTube, Bilibili, TikTok, X and the rest — via yt-dlp.' },
      { title: 'Browser extension', desc: 'Intercept browser downloads and hand them to unfetch.' },
      { title: 'AI-native (MCP)', desc: 'add_task, list_tasks, pause_task — usable from any MCP host.' },
      { title: 'Scheduled & smart', desc: 'Hourly speed schedule, retry with backoff, action-when-done.' },
    ],
  },
  cta: { title: 'Get unfetch now', desc: 'No ads. No telemetry. No login.', button: 'Download installer' },
  footer: { copy: '© 2026 unfetch · MIT-style license', license: 'License' },
}

const zh: Strings = {
  meta: {
    title: 'unfetch — 为人和 AI 设计的下载管理器',
    description: '多线程 HTTP、BT 磁力、1000+ 视频网站、MCP AI 接入。开源免费。',
  },
  nav: { home: '首页', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: '免费 · 开源 · 无广告',
    title: '为人和 AI 设计的下载工具',
    subtitle: '多线程 HTTP、BT 磁力、1000+ 视频网站，一个 app 全搞定。GUI、CLI、AI 都能驱动它。',
    download: '下载 Windows 版',
    mcp: '在 AI 里使用 (MCP)',
    requirements: 'Windows 10 / 11 · 64 位 · 8 MB 安装包',
  },
  features: {
    title: '下载管理器该有的样子',
    items: [
      { title: '多线程 HTTP', desc: '最多 32 线程，断点续传，哈希校验。' },
      { title: 'BT / 磁力', desc: '基于 anacrolix/torrent，预置公共 tracker。' },
      { title: '1000+ 视频网站', desc: '通过 yt-dlp 支持 YouTube、B 站、抖音、X 等。' },
      { title: '浏览器扩展', desc: '拦截浏览器下载并转给 unfetch。' },
      { title: 'AI 原生 (MCP)', desc: 'add_task / list_tasks / pause_task — 任意 MCP 宿主可调。' },
      { title: '定时 & 智能', desc: '分时段限速、退避重试、完成后动作。' },
    ],
  },
  cta: { title: '立即获取 unfetch', desc: '无广告 · 无遥测 · 无登录', button: '下载安装包' },
  footer: { copy: '© 2026 unfetch · MIT 风格许可', license: '许可证' },
}

// 其他 12 语言先复用英文，等用户提供翻译再替换
const fallback = en
const ja = fallback, ko = fallback, de = fallback, fr = fallback, es = fallback
const pt = fallback, it = fallback, pl = fallback, nl = fallback, tr = fallback
const sv = fallback, uk = fallback

export const STRINGS: Record<Lang, Strings> = {
  en, zh, ja, ko, de, fr, es, pt, it, pl, nl, tr, sv, uk,
}

export function getStrings(lang: string | undefined): Strings {
  const code = (lang || 'en') as Lang
  return STRINGS[code] || STRINGS.en
}
