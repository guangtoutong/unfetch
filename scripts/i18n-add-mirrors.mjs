import fs from 'node:fs'
import path from 'node:path'

const LOCALES_DIR = path.resolve(process.cwd(), 'src/i18n/locales')

const T = {
  'addTask.customTrackers': {
    en: 'Custom trackers (one per line)', zh: '自定义 Tracker（每行一个，可选）', ja: 'カスタムトラッカー（1 行 1 つ）', ko: '커스텀 트래커 (한 줄에 하나)',
    de: 'Eigene Tracker (einer pro Zeile)', fr: 'Trackers personnalisés (un par ligne)', es: 'Trackers personalizados (uno por línea)', pt: 'Trackers personalizados (um por linha)',
    it: 'Tracker personalizzati (uno per riga)', pl: 'Własne trackery (jeden na linię)', nl: 'Aangepaste trackers (één per regel)', tr: 'Özel izleyiciler (her satır bir tane)',
    sv: 'Anpassade trackers (en per rad)', uk: 'Власні трекери (по одному в рядку)',
  },
  'addTask.customTrackersHint': {
    en: 'Merged with built-in public trackers to expand the peer pool', zh: '会和内置公共 tracker 合并使用，扩大 peer 池', ja: '内蔵の公開トラッカーと統合され peer プールを拡大', ko: '내장 공개 트래커와 병합하여 피어 풀 확장',
    de: 'Wird mit eingebauten öffentlichen Trackern kombiniert', fr: 'Combiné aux trackers publics intégrés', es: 'Combinado con trackers públicos integrados', pt: 'Combinado com trackers públicos integrados',
    it: 'Combinato con i tracker pubblici integrati', pl: 'Łączone z wbudowanymi publicznymi trackerami', nl: 'Gecombineerd met ingebouwde publieke trackers', tr: 'Yerleşik halka açık izleyicilerle birleştirilir',
    sv: 'Kombineras med inbyggda publika trackers', uk: 'Об\'єднуються з вбудованими публічними трекерами',
  },
  'addTask.mirrors': {
    en: 'Mirror URLs (one per line)', zh: '镜像 URL（每行一个，可选）', ja: 'ミラー URL（1 行 1 つ）', ko: '미러 URL (한 줄에 하나)',
    de: 'Mirror-URLs (eine pro Zeile)', fr: 'URLs miroir (une par ligne)', es: 'URLs espejo (una por línea)', pt: 'URLs espelho (uma por linha)',
    it: 'URL mirror (uno per riga)', pl: 'URL kopii lustrzanych (jeden na linię)', nl: 'Mirror-URLs (één per regel)', tr: 'Yansı URL\'ler (her satır bir tane)',
    sv: 'Spegel-URLer (en per rad)', uk: 'URL дзеркал (по одному в рядку)',
  },
  'addTask.mirrorsHint': {
    en: 'Same file from multiple sources — chunks distributed across mirrors, failed chunks retry on next mirror', zh: '同一文件多源并发：chunk 在镜像间分发；失败 chunk 自动切到下个镜像', ja: '同じファイルを複数ソースから並行ダウンロード。失敗時は次のミラーで再試行。', ko: '동일 파일을 여러 소스에서 병렬 다운로드. 실패 시 다음 미러로 재시도.',
    de: 'Gleiche Datei aus mehreren Quellen — Chunks verteilt, fehlgeschlagene Chunks wechseln zum nächsten Mirror', fr: 'Même fichier de plusieurs sources — chunks répartis, échec bascule au miroir suivant', es: 'Mismo archivo desde varias fuentes — chunks distribuidos, fallos cambian al siguiente espejo', pt: 'Mesmo arquivo de várias fontes — chunks distribuídos, falhas trocam para o próximo espelho',
    it: 'Stesso file da più fonti — chunk distribuiti, fallimenti cambiano al prossimo mirror', pl: 'Ten sam plik z wielu źródeł — chunki rozproszone, niepowodzenia przełączają na kolejne źródło', nl: 'Zelfde bestand uit meerdere bronnen — chunks verdeeld, mislukte chunks naar volgende mirror', tr: 'Aynı dosya birden fazla kaynaktan — parçalar dağıtılır, başarısız olanlar sonraki yansıya geçer',
    sv: 'Samma fil från flera källor — chunks fördelas, misslyckade byter till nästa spegel', uk: 'Один файл з кількох джерел — частини розподіляються, помилки переходять на наступне дзеркало',
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

const langs = Object.keys(T['addTask.mirrors'])
for (const lang of langs) {
  const file = path.join(LOCALES_DIR, `${lang}.json`)
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const [key, perLang] of Object.entries(T)) {
    setNested(obj, key, perLang[lang] ?? perLang.en)
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}
console.log('Done')
