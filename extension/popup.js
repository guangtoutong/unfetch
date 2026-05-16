const DEFAULTS = {
  enabled: true,
  minSize: 0,
  ignoreExt: ['html', 'htm', 'txt', 'css', 'js', 'json'],
  ignoreDomains: [],
}

const $ = (id) => document.getElementById(id)

async function load() {
  const s = await chrome.storage.local.get(DEFAULTS)
  const cfg = { ...DEFAULTS, ...s }

  $('enabledSwitch').classList.toggle('on', !!cfg.enabled)
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
