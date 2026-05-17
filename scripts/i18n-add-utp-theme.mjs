// 一次性脚本：把皮肤/uTP 相关新 key 写入 14 个 locale JSON
// 不依赖任何 npm 包，直接读写
import fs from 'node:fs'
import path from 'node:path'

const LOCALES_DIR = path.resolve(process.cwd(), 'src/i18n/locales')

// 14 语言的翻译表（key -> {lang: text}）
const T = {
  'settings.theme': {
    en: 'Theme', zh: '主题皮肤', ja: 'テーマ', ko: '테마',
    de: 'Design', fr: 'Thème', es: 'Tema', pt: 'Tema',
    it: 'Tema', pl: 'Motyw', nl: 'Thema', tr: 'Tema',
    sv: 'Tema', uk: 'Тема',
  },
  'settings.btOptim': {
    en: 'BT optimization', zh: 'BT 优化', ja: 'BT 最適化', ko: 'BT 최적화',
    de: 'BT-Optimierung', fr: 'Optimisation BT', es: 'Optimización BT', pt: 'Otimização BT',
    it: 'Ottimizzazione BT', pl: 'Optymalizacja BT', nl: 'BT-optimalisatie', tr: 'BT optimizasyonu',
    sv: 'BT-optimering', uk: 'Оптимізація BT',
  },
  'settings.forceUTP': {
    en: 'Force uTP (disable TCP)', zh: '强制 uTP 模式（关闭 TCP）', ja: 'uTP を強制（TCP 無効）', ko: 'uTP 강제 (TCP 비활성화)',
    de: 'uTP erzwingen (TCP aus)', fr: 'Forcer uTP (TCP désactivé)', es: 'Forzar uTP (TCP desactivado)', pt: 'Forçar uTP (TCP desativado)',
    it: 'Forza uTP (TCP disattivato)', pl: 'Wymuś uTP (wyłącz TCP)', nl: 'uTP forceren (TCP uit)', tr: 'uTP zorla (TCP kapalı)',
    sv: 'Tvinga uTP (TCP av)', uk: 'Примусово uTP (вимкнути TCP)',
  },
  'settings.forceUTPHint': {
    en: 'Some ISPs block BT TCP ports; switching to uTP (UDP) may restore connections but limits some peer sources.',
    zh: '部分 ISP 屏蔽 BT 的 TCP 端口；切换到 uTP (UDP) 后可能恢复连接，但同时会限制部分 peer 来源。',
    ja: '一部の ISP は BT の TCP ポートをブロックします。uTP (UDP) への切替で接続が回復することがありますが、ピアの一部は使えなくなります。',
    ko: '일부 ISP는 BT TCP 포트를 차단합니다. uTP (UDP)로 전환하면 연결이 복구될 수 있지만 일부 피어 소스가 제한됩니다.',
    de: 'Einige ISPs blockieren BT-TCP-Ports; ein Wechsel zu uTP (UDP) kann Verbindungen wiederherstellen, schränkt aber manche Peer-Quellen ein.',
    fr: 'Certains FAI bloquent les ports TCP BT ; basculer en uTP (UDP) peut rétablir la connexion mais limite certaines sources de pairs.',
    es: 'Algunos ISP bloquean los puertos TCP de BT; cambiar a uTP (UDP) puede restaurar las conexiones pero limita algunas fuentes de peers.',
    pt: 'Alguns ISPs bloqueiam portas TCP de BT; mudar para uTP (UDP) pode restaurar conexões mas limita algumas fontes de peers.',
    it: 'Alcuni ISP bloccano le porte TCP del BT; passare a uTP (UDP) può ripristinare la connessione ma limita alcune fonti di peer.',
    pl: 'Niektórzy ISP blokują porty TCP BT; przejście na uTP (UDP) może przywrócić połączenia, ale ogranicza część źródeł peerów.',
    nl: 'Sommige ISP\'s blokkeren BT-TCP-poorten; overschakelen naar uTP (UDP) kan verbindingen herstellen maar beperkt sommige peerbronnen.',
    tr: 'Bazı ISS\'ler BT TCP portlarını engeller; uTP (UDP)\'ye geçmek bağlantıları geri getirebilir ancak bazı peer kaynaklarını kısıtlar.',
    sv: 'Vissa ISP:er blockerar BT-TCP-portar; byte till uTP (UDP) kan återställa anslutningar men begränsar vissa peer-källor.',
    uk: 'Деякі провайдери блокують TCP-порти BT; перемикання на uTP (UDP) може відновити з\'єднання, але обмежить частину джерел.',
  },
  'settings.autoUtpFallback': {
    en: 'Auto uTP fallback', zh: '自动 uTP fallback', ja: 'uTP 自動フォールバック', ko: 'uTP 자동 전환',
    de: 'Automatischer uTP-Fallback', fr: 'Bascule uTP automatique', es: 'Cambio automático a uTP', pt: 'Fallback automático para uTP',
    it: 'Fallback uTP automatico', pl: 'Automatyczny fallback uTP', nl: 'Automatische uTP-fallback', tr: 'Otomatik uTP geçişi',
    sv: 'Automatisk uTP-växling', uk: 'Авто-перехід на uTP',
  },
  'settings.autoUtpFallbackHint': {
    en: 'Switch to uTP-only after 30s if speed stays below 100 KB/s. No user action required — best for ISPs that throttle BT.',
    zh: 'BT 任务启动 30 秒内速度低于 100 KB/s 时，自动切到 uTP-only 重连一次。无需用户介入，适合国内 ISP 屏蔽场景。',
    ja: 'BT タスクの起動から 30 秒以内に速度が 100 KB/s 未満の場合、自動で uTP のみに切り替えて再接続します。ISP の BT ブロック対策に最適。',
    ko: 'BT 작업 시작 30초 안에 속도가 100 KB/s 미만이면 자동으로 uTP 전용으로 재연결합니다. ISP가 BT를 차단하는 환경에 적합.',
    de: 'Wechselt nach 30 s automatisch zu uTP-only, wenn die Geschwindigkeit unter 100 KB/s bleibt. Ideal bei ISP-Drosselung.',
    fr: 'Passe en uTP-only après 30 s si la vitesse reste sous 100 Ko/s. Idéal contre les FAI qui bridens le BT.',
    es: 'Cambia a solo uTP tras 30 s si la velocidad se mantiene bajo 100 KB/s. Ideal cuando el ISP limita BT.',
    pt: 'Muda para somente uTP após 30 s se a velocidade ficar abaixo de 100 KB/s. Ideal quando o ISP limita BT.',
    it: 'Passa a solo uTP dopo 30 s se la velocità resta sotto 100 KB/s. Utile quando l\'ISP limita il BT.',
    pl: 'Przełącza na tylko uTP po 30 s, jeśli prędkość spada poniżej 100 KB/s. Idealne gdy ISP dławi BT.',
    nl: 'Schakelt na 30 s om naar uTP-only als de snelheid onder 100 KB/s blijft. Ideaal bij ISP-throttling.',
    tr: 'Hız 30 s boyunca 100 KB/s altında kalırsa otomatik uTP-only\'ye geçer. ISP BT kısıtlamasına ideal.',
    sv: 'Växlar till endast uTP efter 30 s om hastigheten stannar under 100 KB/s. Bra mot ISP-strypning av BT.',
    uk: 'Перемикає на лише uTP через 30 с, якщо швидкість нижча за 100 КБ/с. Підходить для провайдерів, що блокують BT.',
  },
  'task.utp.triggeredBadge': {
    en: 'uTP active', zh: '已切 uTP', ja: 'uTP 切替済', ko: 'uTP 전환됨',
    de: 'uTP aktiv', fr: 'uTP actif', es: 'uTP activo', pt: 'uTP ativo',
    it: 'uTP attivo', pl: 'uTP aktywne', nl: 'uTP actief', tr: 'uTP etkin',
    sv: 'uTP aktivt', uk: 'uTP активний',
  },
  'task.utp.triggeredTitle': {
    en: 'Switched to uTP-only after slow start.',
    zh: '速度偏慢，已自动切到 uTP-only 模式重连。',
    ja: '速度が遅いため uTP-only に自動切替して再接続しました。',
    ko: '속도가 느려 uTP-only로 자동 전환하여 재연결했습니다.',
    de: 'Nach langsamem Start auf uTP-only umgeschaltet.',
    fr: 'Basculé en uTP-only après un démarrage lent.',
    es: 'Cambiado a solo uTP tras inicio lento.',
    pt: 'Alterado para somente uTP após início lento.',
    it: 'Passato a solo uTP dopo un avvio lento.',
    pl: 'Przełączono na tylko uTP po wolnym starcie.',
    nl: 'Overgeschakeld naar uTP-only na trage start.',
    tr: 'Yavaş başlangıçtan sonra uTP-only\'ye geçildi.',
    sv: 'Bytte till endast uTP efter långsam start.',
    uk: 'Перемкнено на лише uTP після повільного старту.',
  },
  'task.utp.suggestBtn': {
    en: 'Try uTP', zh: '试试 uTP', ja: 'uTP を試す', ko: 'uTP 시도',
    de: 'uTP testen', fr: 'Essayer uTP', es: 'Probar uTP', pt: 'Tentar uTP',
    it: 'Prova uTP', pl: 'Spróbuj uTP', nl: 'Probeer uTP', tr: 'uTP dene',
    sv: 'Prova uTP', uk: 'Спробувати uTP',
  },
  'task.utp.switching': {
    en: 'Switching...', zh: '切换中…', ja: '切替中…', ko: '전환 중…',
    de: 'Wechselt…', fr: 'Bascule…', es: 'Cambiando…', pt: 'Mudando…',
    it: 'Cambio…', pl: 'Przełączam…', nl: 'Wisselen…', tr: 'Geçiliyor…',
    sv: 'Växlar…', uk: 'Перемикання…',
  },
  'task.utp.suggestTitle': {
    en: 'Speed is slow — ISP may be throttling BT TCP. Click to enable auto uTP fallback and restart this task.',
    zh: '速度偏慢可能是 ISP 屏蔽了 BT 端口；点击开启自动 uTP fallback 并重启本任务。',
    ja: '速度が遅い場合 ISP が BT TCP を制限している可能性。クリックで自動 uTP フォールバックを有効化しタスクを再起動します。',
    ko: '속도가 느린 경우 ISP가 BT TCP를 차단하고 있을 수 있습니다. 클릭하면 자동 uTP 전환을 켜고 작업을 재시작합니다.',
    de: 'Geschwindigkeit gering — evtl. ISP-Drosselung. Klicken: Auto-uTP-Fallback aktivieren und Aufgabe neu starten.',
    fr: 'Vitesse faible — FAI bride peut-être le BT TCP. Cliquez pour activer la bascule uTP et redémarrer la tâche.',
    es: 'Velocidad baja — el ISP puede estar limitando BT TCP. Haz clic para activar el cambio automático a uTP y reiniciar.',
    pt: 'Velocidade baixa — o ISP pode estar limitando BT TCP. Clique para ativar fallback uTP e reiniciar.',
    it: 'Velocità bassa — l\'ISP potrebbe limitare BT TCP. Clicca per attivare fallback uTP e riavviare.',
    pl: 'Wolna prędkość — ISP może dławić BT TCP. Kliknij aby włączyć fallback uTP i zrestartować zadanie.',
    nl: 'Snelheid laag — ISP throttelt mogelijk BT TCP. Klik om auto-uTP-fallback aan te zetten en taak te herstarten.',
    tr: 'Hız düşük — ISS BT TCP\'yi kısıtlıyor olabilir. Otomatik uTP geçişini aç ve görevi yeniden başlat.',
    sv: 'Låg hastighet — ISP kan strypa BT TCP. Klicka för att slå på auto-uTP och starta om uppgiften.',
    uk: 'Низька швидкість — провайдер може блокувати BT TCP. Натисніть, щоб увімкнути авто-uTP і перезапустити.',
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

const langs = Object.keys(T['settings.theme'])
for (const lang of langs) {
  const file = path.join(LOCALES_DIR, `${lang}.json`)
  const raw = fs.readFileSync(file, 'utf8')
  const obj = JSON.parse(raw)
  for (const [key, perLang] of Object.entries(T)) {
    const value = perLang[lang] ?? perLang.en
    setNested(obj, key, value)
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8')
  console.log('wrote', lang)
}
console.log('Done')
