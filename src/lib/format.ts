/** 格式化字节数 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  if (i === 0) return `${val} B`
  return `${val.toFixed(val >= 100 ? 1 : 2)} ${units[i]}`
}

/** 格式化速度 */
export function formatSpeed(bps: number): string {
  if (bps <= 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bps) / Math.log(1024))
  const val = bps / Math.pow(1024, i)
  return `${val.toFixed(val >= 100 ? 1 : 2)} ${units[i]}`
}

/** 格式化剩余时间 */
export function formatETA(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) return '--'
  if (seconds === 0) return '即将完成'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

/** 格式化进度百分比 */
export function formatPercent(done: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.min(100, Math.floor((done / total) * 100))}%`
}

/** 格式化日期 */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 检测 URL 类型 */
export function detectUrlType(url: string): 'http' | 'bt' | 'ytdlp' {
  if (!url) return 'http'
  const lower = url.toLowerCase()
  if (lower.startsWith('magnet:') || lower.endsWith('.torrent')) return 'bt'
  const ytdlpSites = [
    'youtube.com', 'youtu.be', 'bilibili.com', 'b23.tv',
    'tiktok.com', 'twitter.com', 'x.com', 'instagram.com',
    'facebook.com', 'vimeo.com', 'dailymotion.com', 'twitch.tv',
    'nicovideo.jp', 'weibo.com', 'iqiyi.com', 'youku.com',
    'v.qq.com', 'mgtv.com', 'acfun.cn',
  ]
  if (ytdlpSites.some((s) => lower.includes(s))) return 'ytdlp'
  return 'http'
}

/** 获取网站名称 */
export function getSiteName(url: string, type: string): string {
  if (type === 'bt') return 'BT'
  const lower = url.toLowerCase()
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube'
  if (lower.includes('bilibili.com') || lower.includes('b23.tv')) return 'Bilibili'
  if (lower.includes('tiktok.com')) return 'TikTok'
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'Twitter'
  if (lower.includes('instagram.com')) return 'Instagram'
  if (lower.includes('vimeo.com')) return 'Vimeo'
  if (lower.includes('twitch.tv')) return 'Twitch'
  if (lower.includes('iqiyi.com')) return '爱奇艺'
  if (lower.includes('youku.com')) return '优酷'
  if (lower.includes('v.qq.com')) return '腾讯视频'
  if (lower.includes('mgtv.com')) return '芒果TV'
  if (lower.includes('acfun.cn')) return 'AcFun'
  if (lower.includes('nicovideo.jp')) return 'NicoNico'
  return 'HTTP'
}
