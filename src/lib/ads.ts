// 广告位数据。先用本地硬编码兜底，远程 URL 可后续替换。

export interface AdItem {
  name: string
  url: string
  description: string
  /** 站点 favicon / 官方 logo 图片 URL */
  logoUrl?: string
  /** 没有 logoUrl 时的字母占位 */
  logoLetter?: string
  logoColor?: string
  /** 显眼角标，如"免费无广告" */
  badge?: string
}

const REMOTE_ADS_URL = 'https://unfetch.org/ads.json'

/** Google favicon 服务，所有公开域名都能拿到一个尺寸合适的图标 */
function favicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
}

export const LOCAL_ADS: AdItem[] = [
  {
    name: 'DO AI PM',
    url: 'https://doaipm.com',
    description: '成为 AI 时代的产品经理 · 用 AI 从想法到上线做出真实产品',
    logoUrl: 'https://doaipm.com/favicon.svg',
    logoLetter: 'D',
    logoColor: '#8b5cf6',
    badge: 'AI 产品方法论',
  },
  {
    name: 'Solomd',
    url: 'https://solomd.app',
    description: '本地 Markdown 笔记 · 隐私安全的 Solo 写作工具',
    logoUrl: favicon('solomd.app'),
    logoLetter: 'S',
    logoColor: '#10b981',
    badge: '免费 · 无广告',
  },
]

/** 加载广告：远程优先，超时/失败回落到本地 */
export async function loadAds(): Promise<AdItem[]> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    const r = await fetch(REMOTE_ADS_URL, {
      cache: 'no-store',
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (r.ok) {
      const data = (await r.json()) as AdItem[]
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch {
    // 远程失败回落本地
  }
  return LOCAL_ADS
}

export async function openExternal(url: string): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } catch {
    window.open(url, '_blank')
  }
}
