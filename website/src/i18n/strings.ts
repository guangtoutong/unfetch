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
  nav: { home: string; download: string; sponsor: string; mcp: string; github: string }
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
  download: {
    heading: string
    lead: string
    platforms: {
      macos: { name: string; note: string; primary: string }
      windows: { name: string; note: string; primary: string; secondary: string }
      linux: { name: string; note: string; primary: string; secondary: string; tertiary: string }
    }
    notes: { macos: string; windows: string; linux: string }
    allReleases: string
    allReleasesLink: string
  }
  sponsor: {
    heading: string
    lead: string
    ghTitle: string
    ghDesc: string
    ghButton: string
    paypalTitle: string
    paypalDesc: string
    paypalButton: string
    alipayTitle: string
    alipayDesc: string
    wechatTitle: string
    wechatDesc: string
    scanQr: string
    note: string
  }
  cta: { title: string; desc: string; button: string }
  footer: { copy: string; license: string }
}

const en: Strings = {
  meta: {
    title: 'unfetch — A modern download manager for humans and AI',
    description: 'Multi-threaded HTTP with mirror fan-out, BT / magnet, 1000+ video sites, RSS, remote Web UI, 5 themes, AI-ready via MCP. Open source.',
  },
  nav: { home: 'Home', download: 'Download', sponsor: 'Sponsor', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.0 · Free · Open Source · No ads · No telemetry',
    title: 'Downloads built for humans and AI',
    subtitle: 'Fast multi-mirror HTTP, BT with selective file picker, 1000+ video sites, RSS auto-fetch, completion hooks, remote Web UI, 5 themes — driven by GUI, CLI or AI (MCP).',
    download: 'Download',
    mcp: 'Use with AI (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 MB',
  },
  features: {
    title: 'Everything a download manager should be',
    items: [
      { title: 'Multi-mirror HTTP', desc: 'Up to 32 threads × multiple mirror URLs, automatic fallback, resume, SHA256/MD5 verification.' },
      { title: 'BT / Magnet, done right', desc: '35 public trackers, IPv6 + WebTorrent, file picker before download, peer & seeder stats, auto uTP fallback for throttled ISPs.' },
      { title: '1000+ video sites', desc: 'YouTube, Bilibili, TikTok, X and the rest — via yt-dlp.' },
      { title: 'AI-native (MCP)', desc: 'add_task, list_tasks, wait_for_task, progress notifications — from any MCP host. No vendor lock-in.' },
      { title: 'Remote Web UI', desc: 'Token-secured Web UI on 0.0.0.0 — manage downloads from your phone or remote box. QR-shareable.' },
      { title: 'RSS auto-fetch', desc: 'Subscribe with regex filters; new items get queued automatically. GUID deduped.' },
      { title: 'Completion hooks', desc: 'Webhook POST or shell exec on done — pipe into your automation (Home Assistant, n8n, anything).' },
      { title: 'Task templates & dependencies', desc: 'Per-site Cookie/UA presets, task dependency chains, scheduled start times.' },
      { title: '5 polished themes', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — switch live without restart.' },
      { title: 'Privacy first', desc: 'No ads. No telemetry. No login. No infohash uploads. Your downloads stay yours.' },
    ],
  },
  download: {
    heading: 'Download unfetch',
    lead: 'Free, open source, MIT-style license. No account, no telemetry, no ads.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Notarized', primary: 'Download .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11', primary: 'Download .msi', secondary: '.exe installer' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Download .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Drag unfetch.app to /Applications. Notarized by Apple — no Gatekeeper warning.',
      windows: 'First launch may show "Windows protected your PC" → click More info → Run anyway (one-time, until reputation builds).',
      linux: 'chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage for the AppImage.',
    },
    allReleases: 'Looking for older versions?',
    allReleasesLink: 'All releases →',
  },
  sponsor: {
    heading: 'Support unfetch',
    lead: 'unfetch is built and maintained by one developer in their spare time. If it saves you time, consider sponsoring — even a tiny tip keeps the project alive.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'For international sponsors. Monthly or one-time, processed by Stripe.',
    ghButton: 'Sponsor on GitHub →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Worldwide one-time tip. Choose any amount in your currency.',
    paypalButton: 'Tip via PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Open the Alipay app and scan the QR code below.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Open WeChat → Scan, point at the QR code below.',
    scanQr: 'Scan QR code',
    note: 'Sponsors get listed in the README and the in-app About dialog (with permission).',
  },
  cta: { title: 'Get unfetch v0.2.0', desc: 'No ads. No telemetry. No login.', button: 'Download installer' },
  footer: { copy: '© 2026 unfetch · MIT-style license · Open contributor to anacrolix/torrent', license: 'License' },
}

const zh: Strings = {
  meta: {
    title: 'unfetch — 为人和 AI 设计的下载管理器',
    description: '多线程 HTTP（多镜像并发）、BT 磁力、1000+ 视频网站、RSS、远程 Web UI、5 套皮肤、MCP AI 接入。开源免费。',
  },
  nav: { home: '首页', download: '下载', sponsor: '赞助', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.0 · 免费 · 开源 · 无广告 · 无遥测',
    title: '为人和 AI 设计的下载工具',
    subtitle: '多镜像 HTTP、BT 文件选择、1000+ 视频网站、RSS 订阅、完成钩子、远程 Web UI、5 套主题 — GUI / CLI / AI（MCP）都能驱动。',
    download: '立即下载',
    mcp: '在 AI 里使用 (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · 约 8 MB',
  },
  features: {
    title: '下载管理器该有的样子',
    items: [
      { title: '多镜像 HTTP', desc: '最多 32 线程 × 多镜像 URL 并发、失败自动 fallback、断点续传、SHA256 / MD5 校验。' },
      { title: 'BT / 磁力 全套', desc: '35 个公共 tracker、IPv6 + WebTorrent、下载前选文件、显示 peer 和做种数、ISP 屏蔽时自动切 uTP。' },
      { title: '1000+ 视频网站', desc: '通过 yt-dlp 支持 YouTube、B 站、抖音、X 等。' },
      { title: 'AI 原生 (MCP)', desc: 'add_task / list_tasks / wait_for_task / 进度通知 — 任意 MCP 宿主可调，无锁定。' },
      { title: '远程 Web UI', desc: '0.0.0.0 + token 鉴权 — 用手机或远程机器管理下载，可生成访问链接分享。' },
      { title: 'RSS 自动订阅', desc: '订阅源加正则过滤，新条目自动入队，GUID 去重持久化。' },
      { title: '完成钩子', desc: 'Webhook POST 或 Shell exec — 任务完成接入 Home Assistant / n8n 等自动化流程。' },
      { title: '任务模板 & 依赖链', desc: '按站点预设 Cookie / UA、任务依赖链等待前置完成、定时启动。' },
      { title: '5 套精心调色皮肤', desc: '深堡野 / 亮色纸 / 护眼绿 / 赛博朋克 / 极简灰白 — 一键切换无需重启。' },
      { title: '隐私至上', desc: '无广告、无遥测、无登录、不上传 infohash。你下了什么只有你知道。' },
    ],
  },
  download: {
    heading: '下载 unfetch',
    lead: '免费、开源，MIT 风格许可证。无需账号，无遥测，无广告。',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · 已 Apple 公证', primary: '下载 .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10 / 11', primary: '下载 .msi', secondary: '.exe 安装器' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: '下载 .AppImage', secondary: '.deb (Debian / Ubuntu)', tertiary: '.rpm (Fedora / RHEL)' },
    },
    notes: {
      macos: '把 unfetch.app 拖入 /Applications。已经 Apple 公证，不会有 Gatekeeper 拦截。',
      windows: '首次运行可能出现 "Windows 已保护你的电脑" → 更多信息 → 仍要运行（这是一次性的，等信誉积累上去就没了）。',
      linux: 'AppImage：chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage 即可。',
    },
    allReleases: '想找旧版本？',
    allReleasesLink: '查看所有版本 →',
  },
  sponsor: {
    heading: '赞助 unfetch',
    lead: 'unfetch 由一位开发者在业余时间开发维护。如果它帮你省了时间，欢迎赞助一杯咖啡，让项目继续走下去。',
    ghTitle: 'GitHub Sponsors',
    ghDesc: '面向国际开发者，通过 Stripe 处理，可月付或一次性。',
    ghButton: '前往 GitHub Sponsors →',
    paypalTitle: 'PayPal',
    paypalDesc: '面向海外用户的一次性打赏，金额自定，按当地币种支付。',
    paypalButton: '通过 PayPal 打赏 →',
    alipayTitle: '支付宝',
    alipayDesc: '打开支付宝 App，扫描下方二维码即可赞助。',
    wechatTitle: '微信支付',
    wechatDesc: '打开微信「扫一扫」，对准下方二维码即可。',
    scanQr: '扫码赞助',
    note: '赞助者将被列入 README 和 app 内的"关于"对话框（需同意）。',
  },
  cta: { title: '立即获取 unfetch v0.2.0', desc: '无广告 · 无遥测 · 无登录', button: '下载安装包' },
  footer: { copy: '© 2026 unfetch · MIT 风格许可 · 为 anacrolix/torrent 持续贡献', license: '许可证' },
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
