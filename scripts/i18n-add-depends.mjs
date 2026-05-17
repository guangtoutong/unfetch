import fs from 'node:fs'
import path from 'node:path'

const LOCALES_DIR = path.resolve(process.cwd(), 'src/i18n/locales')

const T = {
  'addTask.dependsOn': {
    en: 'Depends on (task IDs, comma separated)', zh: '依赖任务 ID（逗号分隔，可选）', ja: '依存タスク ID（カンマ区切り）', ko: '의존 작업 ID (쉼표 구분)',
    de: 'Abhängig von (Task-IDs, kommagetrennt)', fr: 'Dépend de (IDs de tâche, séparées par virgule)', es: 'Depende de (IDs de tarea, separados por coma)', pt: 'Depende de (IDs de tarefa, separados por vírgula)',
    it: 'Dipende da (ID task, separati da virgola)', pl: 'Zależy od (ID zadań, oddzielone przecinkami)', nl: 'Hangt af van (taak-IDs, kommagescheiden)', tr: 'Bağlı görevler (görev kimlikleri, virgülle ayrılmış)',
    sv: 'Beror på (uppgift-ID:n, kommaseparerade)', uk: 'Залежить від (ID завдань, через кому)',
  },
  'addTask.dependsOnHint': {
    en: 'This task waits until all listed tasks finish (status=done) before starting',
    zh: '此任务等列出的所有任务全部完成后才开始',
    ja: 'リストされたすべてのタスクが完了するまで待機します',
    ko: '나열된 모든 작업이 완료될 때까지 대기합니다',
    de: 'Diese Aufgabe wartet, bis alle aufgeführten Aufgaben abgeschlossen sind',
    fr: 'Cette tâche attend que toutes les tâches listées soient terminées',
    es: 'Esta tarea espera a que todas las tareas listadas terminen',
    pt: 'Esta tarefa aguarda até que todas as tarefas listadas terminem',
    it: 'Questa task attende il completamento di tutte le task elencate',
    pl: 'To zadanie czeka na ukończenie wszystkich wymienionych zadań',
    nl: 'Deze taak wacht tot alle vermelde taken klaar zijn',
    tr: 'Bu görev, listelenen tüm görevler tamamlanana kadar bekler',
    sv: 'Denna uppgift väntar tills alla listade uppgifter är klara',
    uk: 'Це завдання чекає, поки всі перелічені завдання завершаться',
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

const langs = Object.keys(T['addTask.dependsOn'])
for (const lang of langs) {
  const file = path.join(LOCALES_DIR, `${lang}.json`)
  const obj = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const [key, perLang] of Object.entries(T)) {
    setNested(obj, key, perLang[lang] ?? perLang.en)
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}
console.log('Done')
