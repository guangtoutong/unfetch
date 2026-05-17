import fs from 'node:fs'
import path from 'node:path'

const LOCALES_DIR = path.resolve(process.cwd(), 'src/i18n/locales')

const T = {
  'settings.proxyDetected': {
    en: 'Detected: {{proxy}}', zh: '检测到：{{proxy}}', ja: '検出：{{proxy}}', ko: '감지됨: {{proxy}}',
    de: 'Erkannt: {{proxy}}', fr: 'Détecté : {{proxy}}', es: 'Detectado: {{proxy}}', pt: 'Detectado: {{proxy}}',
    it: 'Rilevato: {{proxy}}', pl: 'Wykryto: {{proxy}}', nl: 'Gedetecteerd: {{proxy}}', tr: 'Algılandı: {{proxy}}',
    sv: 'Upptäckt: {{proxy}}', uk: 'Виявлено: {{proxy}}',
  },
  'settings.proxyNotDetected': {
    en: 'No system proxy detected', zh: '未检测到系统代理设置', ja: 'システムプロキシは検出されません', ko: '시스템 프록시 감지 안 됨',
    de: 'Kein System-Proxy erkannt', fr: 'Aucun proxy système détecté', es: 'No se detectó proxy del sistema', pt: 'Nenhum proxy do sistema detectado',
    it: 'Nessun proxy di sistema rilevato', pl: 'Nie wykryto proxy systemowego', nl: 'Geen systeem-proxy gedetecteerd', tr: 'Sistem proxy\'si algılanmadı',
    sv: 'Ingen system-proxy upptäckt', uk: 'Системний проксі не виявлено',
  },
}

function setNested(obj, dotKey, value) {
  const parts = dotKey.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
}

const langs = Object.keys(T['settings.proxyDetected'])
for (const lang of langs) {
  const file = path.join(LOCALES_DIR, `${lang}.json`)
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const [key, perLang] of Object.entries(T)) {
    setNested(obj, key, perLang[lang] ?? perLang.en)
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}
console.log('Done')
