// unfetch 浏览器扩展 service worker (v0.3.0)
// 1. 监听 chrome.downloads.onCreated，自动附带站点 Cookie / Referer 转发到桌面客户端
// 2. 监听 chrome.webRequest 自动嗅探当前标签页的 HLS (.m3u8) / DASH (.mpd) / 直链音视频流

const DAEMON_BASE = 'http://127.0.0.1:19543'

const DEFAULTS = {
  enabled: true,
  sendCookies: true,   // 自动附带目标站点的 Cookie 与 Referer
  sniffMedia: true,    // 自动嗅探页面中的 .m3u8 / 视频流
  minSize: 0,          // 字节，0 = 不限制
  ignoreExt: ['html', 'htm', 'txt', 'css', 'js', 'json'],
  ignoreDomains: [],   // 域名白名单（这些域名走浏览器原生下载）
  promptOnConflict: false,
}

// 每个 tabId 嗅探到的媒体列表：Map<number, Array<{url, type, ext, size, time, referrer, title}>>
const tabMediaMap = new Map()
const MAX_MEDIA_PER_TAB = 30

const MEDIA_EXT_RE = /\.(m3u8|mpd|mp4|mkv|webm|flv|mov|m4v|mp3|flac|wav|m4a)(?:[?#]|$)/i
const SEGMENT_SKIP_RE = /\.(ts|m4s|aac|vtt|srt)(?:[?#]|$)/i
const MEDIA_MIME_PREFIXES = [
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'audio/mpegurl',
  'application/dash+xml',
  'video/mp4',
  'video/webm',
  'video/x-matroska',
  'video/x-flv',
]

/** 取设置（带默认值） */
async function getSettings() {
  const data = await chrome.storage.local.get(DEFAULTS)
  return { ...DEFAULTS, ...data }
}

/** 启动时检查 daemon 是否在线，更新徽章 */
async function pingDaemon() {
  try {
    const r = await fetch(`${DAEMON_BASE}/health`, { cache: 'no-store' })
    if (r.ok) {
      await updateActiveTabBadge()
      return true
    }
  } catch {}
  chrome.action.setBadgeText({ text: '!' })
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
  return false
}

async function updateActiveTabBadge() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.id) {
      chrome.action.setBadgeText({ text: '' })
      return
    }
    const list = tabMediaMap.get(tab.id) || []
    if (list.length > 0) {
      chrome.action.setBadgeText({ text: String(list.length), tabId: tab.id })
      chrome.action.setBadgeBackgroundColor({ color: '#7c3aed', tabId: tab.id })
    } else {
      chrome.action.setBadgeText({ text: '', tabId: tab.id })
    }
  } catch {}
}

/** 后缀提取 */
function getExt(name) {
  const m = /\.([^.\/?#]+)(?:[?#]|$)/.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}

function getHost(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/** 获取指定 URL 对应的 Cookie 字符串 */
async function getCookieHeaderForUrl(targetUrl) {
  try {
    if (!chrome.cookies) return ''
    const list = await chrome.cookies.getAll({ url: targetUrl })
    if (!list || !list.length) return ''
    return list.map((c) => `${c.name}=${c.value}`).join('; ')
  } catch {
    return ''
  }
}

/** 把任务 POST 给 daemon（完整支持 cookies、user_agent 与 Referer header） */
async function postTask({ url, filename, referrer, cookies, userAgent }) {
  const settings = await getSettings()
  const body = {
    url,
    filename: filename || undefined,
    user_agent: userAgent || navigator.userAgent || undefined,
  }

  if (settings.sendCookies) {
    const cookieStr = cookies || (await getCookieHeaderForUrl(url))
    if (cookieStr) {
      body.cookies = cookieStr
    }
    if (referrer) {
      body.headers = { Referer: referrer }
    }
  }

  const r = await fetch(`${DAEMON_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`daemon ${r.status}: ${text}`)
  }
  return r.json()
}

/** 记录嗅探到的流媒体 / 视频链接 */
function recordMediaItem(tabId, item) {
  if (tabId === undefined || tabId < 0) return
  if (!item.url || item.url.startsWith('blob:') || item.url.startsWith('data:')) return
  if ( item.url.startsWith(DAEMON_BASE)) return
  // 忽略细碎的 .ts / .m4s 分片，只保留主播放列表 (.m3u8/.mpd) 或完整视频文件
  if (SEGMENT_SKIP_RE.test(item.url) && !item.url.includes('.m3u8')) return

  const list = tabMediaMap.get(tabId) || []
  if (list.some((x) => x.url === item.url)) return

  list.unshift({
    url: item.url,
    ext: item.ext || getExt(item.url) || 'media',
    size: item.size || 0,
    referrer: item.referrer || '',
    time: Date.now(),
  })
  if (list.length > MAX_MEDIA_PER_TAB) {
    list.length = MAX_MEDIA_PER_TAB
  }
  tabMediaMap.set(tabId, list)
  chrome.action.setBadgeText({ text: String(list.length), tabId })
  chrome.action.setBadgeBackgroundColor({ color: '#7c3aed', tabId })
}

/** 监听网络响应头嗅探 HLS (.m3u8) / DASH (.mpd) / 视频流 */
if (chrome.webRequest) {
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (details.tabId < 0) return
      const url = details.url || ''
      if (SEGMENT_SKIP_RE.test(url) && !url.includes('.m3u8')) return

      let contentType = ''
      let contentLength = 0
      for (const h of details.responseHeaders || []) {
        const name = (h.name || '').toLowerCase()
        if (name === 'content-type') contentType = (h.value || '').toLowerCase()
        else if (name === 'content-length') contentLength = parseInt(h.value || '0', 10) || 0
      }

      const extMatch = MEDIA_EXT_RE.exec(url)
      const mimeMatch = MEDIA_MIME_PREFIXES.some((m) => contentType.includes(m))
      if (!extMatch && !mimeMatch) return

      // 过滤小于 256KB 的非 m3u8/mpd 杂项视频广告切片
      const ext = extMatch ? extMatch[1].toLowerCase() : contentType.includes('mpegurl') ? 'm3u8' : 'mp4'
      if (ext !== 'm3u8' && ext !== 'mpd' && contentLength > 0 && contentLength < 256 * 1024) {
        return
      }

      recordMediaItem(details.tabId, {
        url,
        ext,
        size: contentLength,
        referrer: details.initiator || '',
      })
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
  )
}

chrome.tabs?.onRemoved.addListener((tabId) => {
  tabMediaMap.delete(tabId)
})

chrome.tabs?.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabMediaMap.delete(tabId)
    chrome.action.setBadgeText({ text: '', tabId })
  }
})

/** 拦截浏览器下载 */
chrome.downloads.onCreated.addListener(async (item) => {
  try {
    const settings = await getSettings()
    if (!settings.enabled) return

    const url = item.finalUrl || item.url
    if (!url) return

    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('chrome-extension:')) return

    const host = getHost(url)
    if (settings.ignoreDomains.includes(host)) return

    const name = item.filename || ''
    const ext = getExt(name) || getExt(url)
    if (ext && settings.ignoreExt.includes(ext)) return

    if (settings.minSize > 0 && item.fileSize > 0 && item.fileSize < settings.minSize) return

    // 1) 立即取消浏览器下载
    await chrome.downloads.cancel(item.id).catch(() => {})
    await chrome.downloads.erase({ id: item.id }).catch(() => {})

    // 2) 转发到 unfetch daemon（自动携带 referrer 与 cookies）
    const filename = name ? name.split(/[\\/]/).pop() : undefined
    await postTask({
      url,
      filename,
      referrer: item.referrer || undefined,
    })

    // 3) 通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'unfetch 已接管下载',
      message: filename || url,
      priority: 0,
    })
  } catch (e) {
    console.error('[unfetch] intercept failed:', e)
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'unfetch 转发失败',
      message: String(e?.message || e),
      priority: 1,
    })
  }
})

/** 右键菜单：把当前页面 / 链接发送到 unfetch */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'unfetch-send-link',
    title: '用 unfetch 下载链接',
    contexts: ['link'],
  })
  chrome.contextMenus.create({
    id: 'unfetch-send-page',
    title: '用 unfetch 下载此页面（视频）',
    contexts: ['page'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const target = info.menuItemId === 'unfetch-send-link' ? info.linkUrl : info.pageUrl
    if (!target) return
    await postTask({
      url: target,
      referrer: info.pageUrl || tab?.url || undefined,
    })
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: '已发送到 unfetch',
      message: target.slice(0, 120),
    })
  } catch (e) {
    console.error('[unfetch] context menu failed:', e)
  }
})

/** Popup 消息通信：获取嗅探列表 & 发送下载 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'get-sniffed-media') {
    const list = tabMediaMap.get(msg.tabId) || []
    sendResponse({ items: list })
    return true
  }
  if (msg?.type === 'download-media') {
    postTask({
      url: msg.url,
      filename: msg.filename,
      referrer: msg.referrer,
    })
      .then((task) => sendResponse({ ok: true, task }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }))
    return true
  }
  return false
})

// 启动 & 周期 ping daemon
pingDaemon()
chrome.alarms?.create('ping', { periodInMinutes: 1 })
chrome.alarms?.onAlarm.addListener((a) => {
  if (a.name === 'ping') pingDaemon()
})
