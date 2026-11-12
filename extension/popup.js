const DEFAULTS = {
  enabled: true,
  sendCookies: true,
  minSize: 0,
  ignoreExt: ['html', 'htm', 'txt', 'css', 'js', 'json'],
  ignoreDomains: [],
}

const $ = (id) => document.getElementById(id)

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return ''
  if (bytes >= 1024 * 1024) return ` · ${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return ` · ${(bytes / 1024).toFixed(0)} KB`
  return ` · ${bytes} B`
}

async function loadSniffedMedia() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.id) return

    $('downloadPageBtn').onclick = async () => {
      if (!tab.url || tab.url.startsWith('chrome:')) return
      $('downloadPageBtn').disabled = true
      $('downloadPageBtn').textContent = '已发送'
      await chrome.runtime.sendMessage({
        type: 'download-media',
        url: tab.url,
        referrer: tab.url,
      })
    }

    const res = await chrome.runtime.sendMessage({
      type: 'get-sniffed-media',
      tabId: tab.id,
    })
    const items = res?.items || []
    $('mediaCount').textContent = String(items.length)
    const container = $('mediaList')
    if (!items.length) {
      container.innerHTML = '<div class="media-empty">暂未嗅探到 .m3u8 / 视频流</div>'
      return
    }

    container.innerHTML = ''
    for (const item of items) {
      const row = document.createElement('div')
      row.className = 'media-item'

      const badge = document.createElement('span')
      badge.className = 'media-badge'
      badge.textContent = item.ext || 'stream'

      const urlSpan = document.createElement('span')
      urlSpan.className = 'media-url'
      const cleanName = (item.url.split('?')[0].split('/').pop() || item.url) + formatSize(item.size)
      urlSpan.textContent = cleanName
      urlSpan.title = item.url

      const btn = document.createElement('button')
      btn.className = 'btn-dl'
      btn.textContent = '下载'
      btn.onclick = async () => {
        btn.disabled = true
        btn.textContent = '发送中…'
        const safeTitle = (tab.title || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
        const filename = safeTitle ? `${safeTitle}.${item.ext === 'm3u8' ? 'mp4' : item.ext}` : undefined
        const r = await chrome.runtime.sendMessage({
          type: 'download-media',
          url: item.url,
          filename,
          referrer: tab.url || item.referrer,
        })
        btn.textContent = r?.ok ? '✓ 已添加' : '失败'
      }

      row.appendChild(badge)
      row.appendChild(urlSpan)
      row.appendChild(btn)
      container.appendChild(row)
    }
  } catch (e) {
    console.warn('loadSniffedMedia failed:', e)
  }
}

async function load() {
  const s = await chrome.storage.local.get(DEFAULTS)
  const cfg = { ...DEFAULTS, ...s }

  $('enabledSwitch').classList.toggle('on', !!cfg.enabled)
  $('cookieSwitch').classList.toggle('on', cfg.sendCookies !== false)
  $('minSize').value = cfg.minSize ?? 0
  $('ignoreExt').value = (cfg.ignoreExt || []).join(', ')
  $('ignoreDomains').value = (cfg.ignoreDomains || []).join(', ')

  // ping daemon
  try {
    const r = await fetch('http://127.0.0.1:19543/health', { cache: 'no-store' })
    if (r.ok) {
      $('dot').classList.add('ok')
      $('statusText').textContent = '已连接'
    } else {
      $('dot').classList.add('bad')
      $('statusText').textContent = '响应异常'
    }
  } catch {
    $('dot').classList.add('bad')
    $('statusText').textContent = '未连接（请启动 unfetch）'
  }

  await loadSniffedMedia()
}

function save(patch) {
  return chrome.storage.local.set(patch)
}

function parseList(s) {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

$('enabledSwitch').addEventListener('click', async () => {
  const next = !$('enabledSwitch').classList.contains('on')
  $('enabledSwitch').classList.toggle('on', next)
  await save({ enabled: next })
})

$('cookieSwitch').addEventListener('click', async () => {
  const next = !$('cookieSwitch').classList.contains('on')
  $('cookieSwitch').classList.toggle('on', next)
  await save({ sendCookies: next })
})

$('minSize').addEventListener('change', (e) => {
  save({ minSize: Math.max(0, Number(e.target.value) || 0) })
})

$('ignoreExt').addEventListener('change', (e) => {
  save({ ignoreExt: parseList(e.target.value).map((x) => x.toLowerCase()) })
})

$('ignoreDomains').addEventListener('change', (e) => {
  save({ ignoreDomains: parseList(e.target.value) })
})

load()
