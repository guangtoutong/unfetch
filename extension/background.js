// unfetch 浏览器扩展 service worker
// 监听 chrome.downloads.onCreated，根据用户设置决定是否拦截转发到桌面客户端

const DAEMON_BASE = 'http://127.0.0.1:19543'

const DEFAULTS = {
  enabled: true,
  minSize: 0,          // 字节，0 = 不限制
  ignoreExt: ['html', 'htm', 'txt', 'css', 'js', 'json'],
  ignoreDomains: [],    // 域名白名单（这些域名走浏览器原生下载）
  promptOnConflict: false,
}

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
      chrome.action.setBadgeText({ text: '' })
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' })
      return true
    }
  } catch {}
  chrome.action.setBadgeText({ text: '!' })
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
  return false
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

/** 把任务 POST 给 daemon */
async function postTask({ url, filename, referrer, cookies }) {
  const body = {
    url,
    filename: filename || undefined,
  }
  // 浏览器 cookies 转发：把 Cookie 字段拼成 yt-dlp / curl 格式
  if (cookies && cookies.length) {
    // 暂时不传 cookies（daemon 端需要支持 cookies 字段，可后续完善）
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

/** 拦截浏览器下载 */
chrome.downloads.onCreated.addListener(async (item) => {
  try {
    const settings = await getSettings()
    if (!settings.enabled) return

    // 没有 finalUrl 时跳过（极少见）
    const url = item.finalUrl || item.url
    if (!url) return

    // 跳过 data: / blob: / chrome-extension:
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('chrome-extension:')) return

    // 跳过白名单域名
    const host = getHost(url)
    if (settings.ignoreDomains.includes(host)) return

    // 跳过白名单后缀
    const name = item.filename || ''
    const ext = getExt(name) || getExt(url)
    if (ext && settings.ignoreExt.includes(ext)) return

    // 跳过过小文件
    if (settings.minSize > 0 && item.fileSize > 0 && item.fileSize < settings.minSize) return

    // 1) 立即取消浏览器下载
    await chrome.downloads.cancel(item.id).catch(() => {})
    await chrome.downloads.erase({ id: item.id }).catch(() => {})

    // 2) 转发到 unfetch daemon
    const filename = name ? name.split(/[\\/]/).pop() : undefined
    await postTask({ url, filename })

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

chrome.contextMenus.onClicked.addListener(async (info) => {
  try {
    const target = info.menuItemId === 'unfetch-send-link' ? info.linkUrl : info.pageUrl
    if (!target) return
    await postTask({ url: target })
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

// 启动 & 周期 ping daemon
pingDaemon()
chrome.alarms?.create('ping', { periodInMinutes: 1 })
chrome.alarms?.onAlarm.addListener((a) => {
  if (a.name === 'ping') pingDaemon()
})
