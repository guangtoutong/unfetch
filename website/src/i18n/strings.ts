// 网站文案：与桌面端 i18n 独立，按需扩展。
// key 体系简单：每语言一个对象，访问时调 t(lang, key)

export type Lang =
  | 'zh' | 'en' | 'ja' | 'ko' | 'de' | 'fr' | 'es'
  | 'pt' | 'it' | 'pl' | 'nl' | 'tr' | 'sv' | 'uk'

export const LANGS: Array<{ code: Lang; native: string }> = [
  { code: 'en', native: 'English' },
  { code: 'zh', native: '中文' },
  { code: 'ja', native: '日本語' },
  { code: 'ko', native: '한국어' },
  { code: 'de', native: 'Deutsch' },
  { code: 'fr', native: 'Français' },
  { code: 'es', native: 'Español' },
  { code: 'pt', native: 'Português' },
  { code: 'it', native: 'Italiano' },
  { code: 'pl', native: 'Polski' },
  { code: 'nl', native: 'Nederlands' },
  { code: 'tr', native: 'Türkçe' },
  { code: 'sv', native: 'Svenska' },
  { code: 'uk', native: 'Українська' },
]

interface Strings {
  meta: { title: string; description: string }
  nav: { home: string; download: string; sponsor: string; mcp: string; github: string }
  hero: {
    tag: string
    title: string
    subtitle: string
    download: string
    downloadForMac: string
    downloadForWindows: string
    downloadForLinux: string
    allPlatforms: string
    mcp: string
    requirements: string
    chips: string[]
  }
  features: {
    title: string
    items: Array<{ title: string; desc: string }>
  }
  download: {
    heading: string
    lead: string
    platforms: {
      macos: { name: string; note: string; primary: string }
      windows: { name: string; note: string; primary: string }
      linux: { name: string; note: string; primary: string; secondary: string; tertiary: string }
    }
    notes: { macos: string; windows: string; linux: string }
    allReleases: string
    allReleasesLink: string
  }
  sponsor: {
    heading: string
    lead: string
    ghTitle: string
    ghDesc: string
    ghButton: string
    paypalTitle: string
    paypalDesc: string
    paypalButton: string
    alipayTitle: string
    alipayDesc: string
    wechatTitle: string
    wechatDesc: string
    scanQr: string
    note: string
  }
  cta: { title: string; desc: string; button: string }
  footer: { copy: string; license: string }
}

const en: Strings = {
  meta: {
    title: 'unfetch — A modern download manager for humans and AI',
    description: 'Multi-threaded HTTP with mirror fan-out, BT / magnet, 1000+ video sites, RSS, remote Web UI, 5 themes, AI-ready via MCP. Open source.',
  },
  nav: { home: 'Home', download: 'Download', sponsor: 'Sponsor', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Free · Open Source · No ads · No telemetry',
    title: 'Downloads built for humans and AI',
    subtitle: 'Fast multi-mirror HTTP, BT with selective file picker, 1000+ video sites, RSS auto-fetch, completion hooks, remote Web UI, 5 themes — driven by GUI, CLI or AI (MCP).',
    download: 'Download unfetch',
    downloadForMac: 'Download for macOS',
    downloadForWindows: 'Download for Windows',
    downloadForLinux: 'Download for Linux',
    allPlatforms: 'See all platforms ↓',
    mcp: 'Use with AI (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 MB',
    chips: ['⚡ Multi-mirror HTTP', '🧲 BT / Magnet', '🎬 1000+ sites', '🤖 MCP-native', '🌐 Remote Web UI', '🎨 5 themes'],
  },
  features: {
    title: 'Everything a download manager should be',
    items: [
      { title: 'Multi-mirror HTTP', desc: 'Up to 32 threads × multiple mirror URLs, automatic fallback, resume, SHA256/MD5 verification.' },
      { title: 'BT / Magnet, done right', desc: '35 public trackers, IPv6 + WebTorrent, file picker before download, peer & seeder stats, auto uTP fallback for throttled ISPs.' },
      { title: '1000+ video sites', desc: 'YouTube, Bilibili, TikTok, X and the rest — via yt-dlp.' },
      { title: 'AI-native (MCP)', desc: 'add_task, list_tasks, wait_for_task, progress notifications — from any MCP host. No vendor lock-in.' },
      { title: 'Remote Web UI', desc: 'Token-secured Web UI on 0.0.0.0 — manage downloads from your phone or remote box. QR-shareable.' },
      { title: 'RSS auto-fetch', desc: 'Subscribe with regex filters; new items get queued automatically. GUID deduped.' },
      { title: 'Completion hooks', desc: 'Webhook POST or shell exec on done — pipe into your automation (Home Assistant, n8n, anything).' },
      { title: 'Task templates & dependencies', desc: 'Per-site Cookie/UA presets, task dependency chains, scheduled start times.' },
      { title: '5 polished themes', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — switch live without restart.' },
      { title: 'Privacy first', desc: 'No ads. No telemetry. No login. No infohash uploads. Your downloads stay yours.' },
    ],
  },
  download: {
    heading: 'Download unfetch',
    lead: 'Free, open source, MIT-style license. No account, no telemetry, no ads.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Notarized', primary: 'Download .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · NSIS installer', primary: 'Download .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Download .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Drag unfetch.app to /Applications. Notarized by Apple — no Gatekeeper warning.',
      windows: 'First launch may show "Windows protected your PC" → click More info → Run anyway (one-time, until reputation builds).',
      linux: 'chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage for the AppImage.',
    },
    allReleases: 'Looking for older versions?',
    allReleasesLink: 'All releases →',
  },
  sponsor: {
    heading: 'Support unfetch',
    lead: 'unfetch is built and maintained by one developer in their spare time. If it saves you time, consider sponsoring — even a tiny tip keeps the project alive.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'For international sponsors. Monthly or one-time, processed by Stripe.',
    ghButton: 'Sponsor on GitHub →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Worldwide one-time tip. Choose any amount in your currency.',
    paypalButton: 'Tip via PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Open the Alipay app and scan the QR code below.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Open WeChat → Scan, point at the QR code below.',
    scanQr: 'Scan QR code',
    note: 'Sponsors get listed in the README and the in-app About dialog (with permission).',
  },
  cta: { title: 'Get unfetch v0.2.2', desc: 'No ads. No telemetry. No login.', button: 'Download installer' },
  footer: { copy: '© 2026 unfetch · MIT-style license · Open contributor to anacrolix/torrent', license: 'License' },
}

const zh: Strings = {
  meta: {
    title: 'unfetch — 为人和 AI 设计的下载管理器',
    description: '多线程 HTTP（多镜像并发）、BT 磁力、1000+ 视频网站、RSS、远程 Web UI、5 套皮肤、MCP AI 接入。开源免费。',
  },
  nav: { home: '首页', download: '下载', sponsor: '赞助', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · 免费 · 开源 · 无广告 · 无遥测',
    title: '为人和 AI 设计的下载工具',
    subtitle: '多镜像 HTTP、BT 文件选择、1000+ 视频网站、RSS 订阅、完成钩子、远程 Web UI、5 套主题 — GUI / CLI / AI（MCP）都能驱动。',
    download: '下载 unfetch',
    downloadForMac: '下载 macOS 版本',
    downloadForWindows: '下载 Windows 版本',
    downloadForLinux: '下载 Linux 版本',
    allPlatforms: '查看所有平台 ↓',
    mcp: '在 AI 里使用 (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · 约 8 MB',
    chips: ['⚡ 多镜像 HTTP', '🧲 BT / 磁力', '🎬 1000+ 视频网站', '🤖 MCP 原生', '🌐 远程 Web UI', '🎨 5 套主题'],
  },
  features: {
    title: '下载管理器该有的样子',
    items: [
      { title: '多镜像 HTTP', desc: '最多 32 线程 × 多镜像 URL 并发、失败自动 fallback、断点续传、SHA256 / MD5 校验。' },
      { title: 'BT / 磁力 全套', desc: '35 个公共 tracker、IPv6 + WebTorrent、下载前选文件、显示 peer 和做种数、ISP 屏蔽时自动切 uTP。' },
      { title: '1000+ 视频网站', desc: '通过 yt-dlp 支持 YouTube、B 站、抖音、X 等。' },
      { title: 'AI 原生 (MCP)', desc: 'add_task / list_tasks / wait_for_task / 进度通知 — 任意 MCP 宿主可调，无锁定。' },
      { title: '远程 Web UI', desc: '0.0.0.0 + token 鉴权 — 用手机或远程机器管理下载，可生成访问链接分享。' },
      { title: 'RSS 自动订阅', desc: '订阅源加正则过滤，新条目自动入队，GUID 去重持久化。' },
      { title: '完成钩子', desc: 'Webhook POST 或 Shell exec — 任务完成接入 Home Assistant / n8n 等自动化流程。' },
      { title: '任务模板 & 依赖链', desc: '按站点预设 Cookie / UA、任务依赖链等待前置完成、定时启动。' },
      { title: '5 套精心调色皮肤', desc: '深堡野 / 亮色纸 / 护眼绿 / 赛博朋克 / 极简灰白 — 一键切换无需重启。' },
      { title: '隐私至上', desc: '无广告、无遥测、无登录、不上传 infohash。你下了什么只有你知道。' },
    ],
  },
  download: {
    heading: '下载 unfetch',
    lead: '免费、开源，MIT 风格许可证。无需账号，无遥测，无广告。',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · 已 Apple 公证', primary: '下载 .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10 / 11 · NSIS 安装器', primary: '下载 .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: '下载 .AppImage', secondary: '.deb (Debian / Ubuntu)', tertiary: '.rpm (Fedora / RHEL)' },
    },
    notes: {
      macos: '把 unfetch.app 拖入 /Applications。已经 Apple 公证，不会有 Gatekeeper 拦截。',
      windows: '首次运行可能出现 "Windows 已保护你的电脑" → 更多信息 → 仍要运行（这是一次性的，等信誉积累上去就没了）。',
      linux: 'AppImage：chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage 即可。',
    },
    allReleases: '想找旧版本？',
    allReleasesLink: '查看所有版本 →',
  },
  sponsor: {
    heading: '赞助 unfetch',
    lead: 'unfetch 由一位开发者在业余时间开发维护。如果它帮你省了时间，欢迎赞助一杯咖啡，让项目继续走下去。',
    ghTitle: 'GitHub Sponsors',
    ghDesc: '面向国际开发者，通过 Stripe 处理，可月付或一次性。',
    ghButton: '前往 GitHub Sponsors →',
    paypalTitle: 'PayPal',
    paypalDesc: '面向海外用户的一次性打赏，金额自定，按当地币种支付。',
    paypalButton: '通过 PayPal 打赏 →',
    alipayTitle: '支付宝',
    alipayDesc: '打开支付宝 App，扫描下方二维码即可赞助。',
    wechatTitle: '微信支付',
    wechatDesc: '打开微信「扫一扫」，对准下方二维码即可。',
    scanQr: '扫码赞助',
    note: '赞助者将被列入 README 和 app 内的"关于"对话框（需同意）。',
  },
  cta: { title: '立即获取 unfetch v0.2.2', desc: '无广告 · 无遥测 · 无登录', button: '下载安装包' },
  footer: { copy: '© 2026 unfetch · MIT 风格许可 · 为 anacrolix/torrent 持续贡献', license: '许可证' },
}

// ========== 日本語 (ja) ==========
const ja: Strings = {
  meta: {
    title: 'unfetch — 人とAIのためのモダンなダウンロードマネージャー',
    description: 'マルチミラー HTTP、BT / マグネット、1000+ 動画サイト、RSS、リモート Web UI、5 種類のテーマ、MCP で AI 連携。オープンソース。',
  },
  nav: { home: 'ホーム', download: 'ダウンロード', sponsor: 'スポンサー', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · 無料 · オープンソース · 広告なし · テレメトリーなし',
    title: '人とAIのために設計されたダウンロード',
    subtitle: '高速マルチミラー HTTP、ファイル選択付き BT、1000+ 動画サイト、RSS 自動取得、完了フック、リモート Web UI、5 つのテーマ — GUI / CLI / AI (MCP) のいずれからも操作可能。',
    download: 'unfetch をダウンロード',
    downloadForMac: 'macOS 版をダウンロード',
    downloadForWindows: 'Windows 版をダウンロード',
    downloadForLinux: 'Linux 版をダウンロード',
    allPlatforms: 'すべてのプラットフォームを見る ↓',
    mcp: 'AI で使う (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · 約 8 MB',
    chips: ['⚡ マルチミラー HTTP', '🧲 BT / マグネット', '🎬 1000+ サイト', '🤖 MCP 対応', '🌐 リモート Web UI', '🎨 5 テーマ'],
  },
  features: {
    title: 'ダウンロードマネージャーに必要なすべて',
    items: [
      { title: 'マルチミラー HTTP', desc: '最大 32 スレッド × 複数のミラー URL、自動フォールバック、レジューム、SHA256/MD5 検証。' },
      { title: '本格的な BT / マグネット', desc: '35 の公開トラッカー、IPv6 + WebTorrent、ダウンロード前のファイル選択、ピア / シーダー統計、ISP 制限時の自動 uTP フォールバック。' },
      { title: '1000+ 動画サイト', desc: 'yt-dlp 経由で YouTube、ニコニコ、TikTok、X など対応。' },
      { title: 'AI ネイティブ (MCP)', desc: 'add_task、list_tasks、wait_for_task、進捗通知 — 任意の MCP ホストから利用可能、ベンダーロックインなし。' },
      { title: 'リモート Web UI', desc: 'トークン認証付き Web UI を 0.0.0.0 で公開 — スマホやリモートマシンから管理。QR で共有可能。' },
      { title: 'RSS 自動取得', desc: '正規表現フィルター付きの購読、新規アイテムを自動キューイング、GUID で重複排除。' },
      { title: '完了フック', desc: 'Webhook POST または Shell exec — Home Assistant / n8n などへ自動化パイプライン接続。' },
      { title: 'タスクテンプレートと依存関係', desc: 'サイトごとの Cookie / UA プリセット、タスク依存チェーン、スケジュール開始。' },
      { title: '5 つの洗練されたテーマ', desc: 'Deep Indigo / Light Paper / Forest Night / Cyberpunk / Mono Gray — 再起動不要でライブ切替。' },
      { title: 'プライバシー最優先', desc: '広告なし、テレメトリーなし、ログインなし、infohash アップロードなし。' },
    ],
  },
  download: {
    heading: 'unfetch をダウンロード',
    lead: '無料、オープンソース、MIT 風ライセンス。アカウント不要、テレメトリーなし、広告なし。',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · 公証済み', primary: '.dmg をダウンロード' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · NSIS インストーラー', primary: '.exe をダウンロード' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: '.AppImage をダウンロード', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'unfetch.app を /Applications にドラッグ。Apple 公証済みなので Gatekeeper の警告は出ません。',
      windows: '初回起動時に「Windows によって PC が保護されました」と表示される場合があります → 「詳細情報」→「実行」をクリック。',
      linux: 'AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage。',
    },
    allReleases: '旧バージョンをお探しですか？',
    allReleasesLink: 'すべてのリリース →',
  },
  sponsor: {
    heading: 'unfetch を応援する',
    lead: 'unfetch は開発者一人が空き時間で開発・メンテナンスしています。役立ったら、ちょっとした支援がプロジェクト存続の助けになります。',
    ghTitle: 'GitHub Sponsors',
    ghDesc: '国際的なスポンサー向け。Stripe 経由、月次または一回限り。',
    ghButton: 'GitHub でスポンサーになる →',
    paypalTitle: 'PayPal',
    paypalDesc: '世界中から一回限りのチップ。お好きな金額を現地通貨で。',
    paypalButton: 'PayPal でチップ →',
    alipayTitle: 'Alipay (支付宝)',
    alipayDesc: 'Alipay アプリを開き、下の QR コードをスキャン。',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'WeChat を開き、「スキャン」で下の QR コードを読み取り。',
    scanQr: 'QR コードをスキャン',
    note: 'スポンサーは README と app 内「About」ダイアログに掲載されます（同意の上）。',
  },
  cta: { title: 'unfetch v0.2.2 を入手', desc: '広告なし · テレメトリーなし · ログインなし', button: 'インストーラーをダウンロード' },
  footer: { copy: '© 2026 unfetch · MIT 風ライセンス · anacrolix/torrent の活発なコントリビューター', license: 'ライセンス' },
}

// ========== 한국어 (ko) ==========
const ko: Strings = {
  meta: {
    title: 'unfetch — 사람과 AI를 위한 현대적 다운로드 매니저',
    description: '멀티 미러 HTTP、BT / 마그넷、1000+ 동영상 사이트、RSS、원격 Web UI、5 가지 테마, MCP 로 AI 연동. 오픈 소스.',
  },
  nav: { home: '홈', download: '다운로드', sponsor: '후원', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · 무료 · 오픈소스 · 광고 없음 · 텔레메트리 없음',
    title: '사람과 AI를 위한 다운로드',
    subtitle: '빠른 멀티 미러 HTTP, 파일 선택 가능한 BT, 1000+ 동영상 사이트, RSS 자동 수집, 완료 훅, 원격 Web UI, 5 가지 테마 — GUI / CLI / AI(MCP) 모두 지원.',
    download: 'unfetch 다운로드',
    downloadForMac: 'macOS 다운로드',
    downloadForWindows: 'Windows 다운로드',
    downloadForLinux: 'Linux 다운로드',
    allPlatforms: '모든 플랫폼 보기 ↓',
    mcp: 'AI에서 사용 (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · 약 8 MB',
    chips: ['⚡ 멀티 미러 HTTP', '🧲 BT / 마그넷', '🎬 1000+ 사이트', '🤖 MCP 네이티브', '🌐 원격 Web UI', '🎨 5 가지 테마'],
  },
  features: {
    title: '다운로드 매니저의 완전체',
    items: [
      { title: '멀티 미러 HTTP', desc: '최대 32 스레드 × 다중 미러 URL, 자동 폴백, 이어받기, SHA256/MD5 검증.' },
      { title: '제대로 만든 BT / 마그넷', desc: '35 개 공용 트래커, IPv6 + WebTorrent, 다운로드 전 파일 선택, peer/seeder 통계, ISP 차단 시 자동 uTP 폴백.' },
      { title: '1000+ 동영상 사이트', desc: 'yt-dlp 로 YouTube, Bilibili, TikTok, X 등 지원.' },
      { title: 'AI 네이티브 (MCP)', desc: 'add_task / list_tasks / wait_for_task / 진행 알림 — 어떤 MCP 호스트에서도 사용 가능, 벤더 락인 없음.' },
      { title: '원격 Web UI', desc: '토큰 인증 Web UI 를 0.0.0.0 에서 — 휴대폰이나 원격 머신에서 관리, QR 코드로 공유.' },
      { title: 'RSS 자동 수집', desc: '정규식 필터로 구독, 새 항목 자동 큐잉, GUID 중복 제거.' },
      { title: '완료 훅', desc: 'Webhook POST 또는 Shell exec — Home Assistant / n8n 등 자동화에 연결.' },
      { title: '작업 템플릿과 의존성', desc: '사이트별 Cookie/UA 프리셋, 작업 의존 체인, 예약 시작.' },
      { title: '5 가지 세련된 테마', desc: 'Deep Indigo / Light Paper / Forest Night / Cyberpunk / Mono Gray — 재시작 없이 실시간 전환.' },
      { title: '프라이버시 최우선', desc: '광고 없음, 텔레메트리 없음, 로그인 없음, infohash 업로드 없음.' },
    ],
  },
  download: {
    heading: 'unfetch 다운로드',
    lead: '무료, 오픈소스, MIT 스타일 라이선스. 계정 불필요, 텔레메트리 없음, 광고 없음.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · 공증됨', primary: '.dmg 다운로드' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · NSIS 설치 프로그램', primary: '.exe 다운로드' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: '.AppImage 다운로드', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'unfetch.app 을 /Applications 로 드래그. Apple 공증되어 Gatekeeper 경고 없음.',
      windows: '첫 실행 시 "Windows의 PC 보호" 표시될 수 있음 → 추가 정보 → 실행 (한 번만).',
      linux: 'AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: '이전 버전을 찾으시나요?',
    allReleasesLink: '모든 릴리스 →',
  },
  sponsor: {
    heading: 'unfetch 후원하기',
    lead: 'unfetch 는 개발자 한 명이 여가 시간에 만들고 유지보수합니다. 시간을 절약해 준다면 작은 후원이 프로젝트를 살립니다.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: '국제 후원자용. Stripe 처리, 월정액 또는 일회성.',
    ghButton: 'GitHub Sponsors 로 가기 →',
    paypalTitle: 'PayPal',
    paypalDesc: '전 세계 일회성 팁. 원하는 금액을 현지 통화로.',
    paypalButton: 'PayPal 로 팁 보내기 →',
    alipayTitle: 'Alipay (支付宝)',
    alipayDesc: 'Alipay 앱을 열고 아래 QR 코드를 스캔하세요.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'WeChat 을 열고 "스캔"으로 아래 QR 코드를 읽으세요.',
    scanQr: 'QR 코드 스캔',
    note: '후원자는 README 와 앱 내 "정보" 대화상자에 등재됩니다 (동의 시).',
  },
  cta: { title: 'unfetch v0.2.2 받기', desc: '광고 없음 · 텔레메트리 없음 · 로그인 없음', button: '설치 프로그램 다운로드' },
  footer: { copy: '© 2026 unfetch · MIT 스타일 라이선스 · anacrolix/torrent 의 활발한 기여자', license: '라이선스' },
}

// ========== Deutsch (de) ==========
const de: Strings = {
  meta: {
    title: 'unfetch — Ein moderner Downloader für Menschen und KI',
    description: 'Multi-Mirror HTTP, BT / Magnet, 1000+ Videoseiten, RSS, Remote Web-UI, 5 Themes, KI-bereit via MCP. Open Source.',
  },
  nav: { home: 'Start', download: 'Download', sponsor: 'Sponsern', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Kostenlos · Open Source · Keine Werbung · Keine Telemetrie',
    title: 'Downloads für Menschen und KI',
    subtitle: 'Schnelles Multi-Mirror HTTP, BT mit Dateiauswahl, 1000+ Videoseiten, RSS-Abruf, Completion-Hooks, Remote Web-UI, 5 Themes — gesteuert per GUI, CLI oder KI (MCP).',
    download: 'unfetch herunterladen',
    downloadForMac: 'Für macOS herunterladen',
    downloadForWindows: 'Für Windows herunterladen',
    downloadForLinux: 'Für Linux herunterladen',
    allPlatforms: 'Alle Plattformen anzeigen ↓',
    mcp: 'Mit KI nutzen (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ca. 8 MB',
    chips: ['⚡ Multi-Mirror HTTP', '🧲 BT / Magnet', '🎬 1000+ Seiten', '🤖 MCP-nativ', '🌐 Remote Web-UI', '🎨 5 Themes'],
  },
  features: {
    title: 'Alles, was ein Download-Manager braucht',
    items: [
      { title: 'Multi-Mirror HTTP', desc: 'Bis zu 32 Threads × mehrere Mirror-URLs, automatischer Fallback, Resume, SHA256/MD5-Prüfung.' },
      { title: 'BT / Magnet, richtig gemacht', desc: '35 öffentliche Tracker, IPv6 + WebTorrent, Dateiauswahl vor Download, Peer- und Seeder-Statistiken, automatisches uTP-Fallback bei Drosselung.' },
      { title: '1000+ Videoseiten', desc: 'YouTube, Bilibili, TikTok, X u. v. m. via yt-dlp.' },
      { title: 'KI-nativ (MCP)', desc: 'add_task, list_tasks, wait_for_task, Fortschrittsbenachrichtigungen — von jedem MCP-Host aus, ohne Anbieterbindung.' },
      { title: 'Remote Web-UI', desc: 'Token-geschützte Web-UI auf 0.0.0.0 — Downloads vom Handy oder Remote-Rechner aus verwalten. Per QR-Code teilbar.' },
      { title: 'RSS-Abruf', desc: 'Abonnement mit Regex-Filtern; neue Einträge automatisch in die Warteschlange. GUID-dedupliziert.' },
      { title: 'Completion-Hooks', desc: 'Webhook POST oder Shell-Exec bei Abschluss — Anbindung an Home Assistant / n8n / beliebige Automatisierung.' },
      { title: 'Task-Templates & Abhängigkeiten', desc: 'Seitenbezogene Cookie/UA-Voreinstellungen, Abhängigkeitsketten, geplante Startzeiten.' },
      { title: '5 polierte Themes', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — Live-Wechsel ohne Neustart.' },
      { title: 'Privatsphäre zuerst', desc: 'Keine Werbung. Keine Telemetrie. Kein Login. Keine Infohash-Uploads.' },
    ],
  },
  download: {
    heading: 'unfetch herunterladen',
    lead: 'Kostenlos, Open Source, MIT-artige Lizenz. Kein Konto, keine Telemetrie, keine Werbung.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Notarisiert', primary: '.dmg herunterladen' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · NSIS-Installer', primary: '.exe herunterladen' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: '.AppImage herunterladen', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'unfetch.app nach /Applications ziehen. Von Apple notarisiert — keine Gatekeeper-Warnung.',
      windows: 'Beim ersten Start kann „Windows hat Ihren PC geschützt" erscheinen → Weitere Informationen → Trotzdem ausführen.',
      linux: 'Für AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: 'Auf der Suche nach älteren Versionen?',
    allReleasesLink: 'Alle Releases →',
  },
  sponsor: {
    heading: 'unfetch unterstützen',
    lead: 'unfetch wird von einem Entwickler in der Freizeit entwickelt und gepflegt. Wenn es Ihnen Zeit spart, hilft ein kleiner Beitrag dem Projekt am Leben.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'Für internationale Sponsoren. Monatlich oder einmalig, abgewickelt via Stripe.',
    ghButton: 'Auf GitHub sponsern →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Weltweite einmalige Spende. Beliebiger Betrag in Ihrer Währung.',
    paypalButton: 'Per PayPal spenden →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Alipay-App öffnen und den QR-Code unten scannen.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'WeChat öffnen → Scan, auf den QR-Code unten richten.',
    scanQr: 'QR-Code scannen',
    note: 'Sponsoren werden in der README und im In-App "Über"-Dialog gelistet (mit Einverständnis).',
  },
  cta: { title: 'unfetch v0.2.2 holen', desc: 'Keine Werbung · Keine Telemetrie · Kein Login', button: 'Installer herunterladen' },
  footer: { copy: '© 2026 unfetch · MIT-artige Lizenz · Aktiver Contributor zu anacrolix/torrent', license: 'Lizenz' },
}

// ========== Français (fr) ==========
const fr: Strings = {
  meta: {
    title: 'unfetch — Un gestionnaire de téléchargement moderne pour humains et IA',
    description: 'HTTP multi-miroir, BT / magnet, 1000+ sites vidéo, RSS, UI Web distante, 5 thèmes, prêt pour l\'IA via MCP. Open source.',
  },
  nav: { home: 'Accueil', download: 'Télécharger', sponsor: 'Soutenir', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Gratuit · Open source · Sans pub · Sans télémétrie',
    title: 'Des téléchargements pour humains et IA',
    subtitle: 'HTTP multi-miroir rapide, BT avec sélection de fichiers, 1000+ sites vidéo, RSS automatique, hooks de fin, UI Web distante, 5 thèmes — piloté par GUI, CLI ou IA (MCP).',
    download: 'Télécharger unfetch',
    downloadForMac: 'Télécharger pour macOS',
    downloadForWindows: 'Télécharger pour Windows',
    downloadForLinux: 'Télécharger pour Linux',
    allPlatforms: 'Voir toutes les plateformes ↓',
    mcp: 'Utiliser avec IA (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 Mo',
    chips: ['⚡ HTTP multi-miroir', '🧲 BT / Magnet', '🎬 1000+ sites', '🤖 MCP natif', '🌐 UI Web distante', '🎨 5 thèmes'],
  },
  features: {
    title: 'Tout ce qu\'un gestionnaire de téléchargement devrait être',
    items: [
      { title: 'HTTP multi-miroir', desc: 'Jusqu\'à 32 threads × plusieurs URL miroir, fallback automatique, reprise, vérification SHA256/MD5.' },
      { title: 'BT / Magnet bien fait', desc: '35 trackers publics, IPv6 + WebTorrent, sélection de fichiers avant téléchargement, statistiques peer/seeder, fallback uTP auto si FAI bridé.' },
      { title: '1000+ sites vidéo', desc: 'YouTube, Bilibili, TikTok, X et autres — via yt-dlp.' },
      { title: 'Natif IA (MCP)', desc: 'add_task, list_tasks, wait_for_task, notifications de progression — depuis tout hôte MCP. Sans verrouillage propriétaire.' },
      { title: 'UI Web distante', desc: 'UI Web protégée par token sur 0.0.0.0 — gérez les téléchargements depuis votre téléphone ou une machine distante. Partage par QR.' },
      { title: 'RSS automatique', desc: 'Abonnement avec filtres regex ; les nouveaux éléments sont mis en file automatiquement. Déduplication GUID.' },
      { title: 'Hooks de fin', desc: 'Webhook POST ou exécution shell à la fin — branchez vos automatismes (Home Assistant, n8n, etc.).' },
      { title: 'Modèles de tâches & dépendances', desc: 'Préréglages Cookie/UA par site, chaînes de dépendance, démarrages planifiés.' },
      { title: '5 thèmes soignés', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — changement à chaud sans redémarrage.' },
      { title: 'Vie privée d\'abord', desc: 'Sans pub. Sans télémétrie. Sans connexion. Sans envoi d\'infohash.' },
    ],
  },
  download: {
    heading: 'Télécharger unfetch',
    lead: 'Gratuit, open source, licence MIT. Sans compte, sans télémétrie, sans publicité.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Notarisé', primary: 'Télécharger .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · Installeur NSIS', primary: 'Télécharger .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Télécharger .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Glissez unfetch.app dans /Applications. Notarisé par Apple — pas d\'avertissement Gatekeeper.',
      windows: 'Au premier lancement « Windows a protégé votre PC » peut apparaître → Informations complémentaires → Exécuter quand même.',
      linux: 'Pour l\'AppImage : chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: 'À la recherche des anciennes versions ?',
    allReleasesLink: 'Toutes les versions →',
  },
  sponsor: {
    heading: 'Soutenir unfetch',
    lead: 'unfetch est développé et maintenu par un développeur sur son temps libre. Si ça vous fait gagner du temps, un petit pourboire aide le projet à survivre.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'Pour les sponsors internationaux. Mensuel ou ponctuel, via Stripe.',
    ghButton: 'Sponsoriser sur GitHub →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Pourboire ponctuel mondial. Montant libre dans votre devise.',
    paypalButton: 'Donner via PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Ouvrez l\'app Alipay et scannez le QR ci-dessous.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Ouvrez WeChat → Scan, visez le QR ci-dessous.',
    scanQr: 'Scanner le QR',
    note: 'Les sponsors sont listés dans le README et la boîte de dialogue « À propos » de l\'application (avec accord).',
  },
  cta: { title: 'Obtenir unfetch v0.2.2', desc: 'Sans pub · Sans télémétrie · Sans connexion', button: 'Télécharger l\'installeur' },
  footer: { copy: '© 2026 unfetch · Licence MIT · Contributeur actif à anacrolix/torrent', license: 'Licence' },
}

// ========== Español (es) ==========
const es: Strings = {
  meta: {
    title: 'unfetch — Un gestor de descargas moderno para humanos e IA',
    description: 'HTTP multi-espejo, BT / magnet, 1000+ sitios de vídeo, RSS, UI Web remota, 5 temas, listo para IA via MCP. Código abierto.',
  },
  nav: { home: 'Inicio', download: 'Descargar', sponsor: 'Patrocinar', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Gratis · Código abierto · Sin anuncios · Sin telemetría',
    title: 'Descargas pensadas para humanos e IA',
    subtitle: 'HTTP multi-espejo rápido, BT con selector de archivos, 1000+ sitios de vídeo, RSS automático, hooks al terminar, UI Web remota, 5 temas — controlado por GUI, CLI o IA (MCP).',
    download: 'Descargar unfetch',
    downloadForMac: 'Descargar para macOS',
    downloadForWindows: 'Descargar para Windows',
    downloadForLinux: 'Descargar para Linux',
    allPlatforms: 'Ver todas las plataformas ↓',
    mcp: 'Usar con IA (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 MB',
    chips: ['⚡ HTTP multi-espejo', '🧲 BT / Magnet', '🎬 1000+ sitios', '🤖 MCP nativo', '🌐 UI Web remota', '🎨 5 temas'],
  },
  features: {
    title: 'Todo lo que un gestor de descargas debería ser',
    items: [
      { title: 'HTTP multi-espejo', desc: 'Hasta 32 hilos × varias URL espejo, fallback automático, reanudación, verificación SHA256/MD5.' },
      { title: 'BT / Magnet bien hechos', desc: '35 trackers públicos, IPv6 + WebTorrent, selector de archivos antes de descargar, estadísticas peer/seeder, fallback uTP auto cuando el ISP estrangula.' },
      { title: '1000+ sitios de vídeo', desc: 'YouTube, Bilibili, TikTok, X y los demás — vía yt-dlp.' },
      { title: 'IA nativa (MCP)', desc: 'add_task, list_tasks, wait_for_task, notificaciones de progreso — desde cualquier host MCP. Sin lock-in.' },
      { title: 'UI Web remota', desc: 'UI Web protegida por token en 0.0.0.0 — gestiona descargas desde tu móvil o máquina remota. Compartible por QR.' },
      { title: 'RSS automático', desc: 'Suscripción con filtros regex; los nuevos elementos se encolan automáticamente. Deduplicación por GUID.' },
      { title: 'Hooks al terminar', desc: 'Webhook POST o exec de shell al finalizar — conecta con Home Assistant / n8n / lo que quieras.' },
      { title: 'Plantillas y dependencias', desc: 'Preajustes Cookie/UA por sitio, cadenas de dependencia, inicios programados.' },
      { title: '5 temas pulidos', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — cambio en caliente sin reiniciar.' },
      { title: 'Privacidad primero', desc: 'Sin anuncios. Sin telemetría. Sin login. Sin subida de infohash.' },
    ],
  },
  download: {
    heading: 'Descargar unfetch',
    lead: 'Gratis, código abierto, licencia tipo MIT. Sin cuenta, sin telemetría, sin anuncios.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Notarizado', primary: 'Descargar .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · Instalador NSIS', primary: 'Descargar .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Descargar .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Arrastra unfetch.app a /Applications. Notarizado por Apple — sin aviso de Gatekeeper.',
      windows: 'Al primer arranque puede aparecer "Windows protegió tu PC" → Más información → Ejecutar de todas formas.',
      linux: 'Para el AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: '¿Buscas versiones antiguas?',
    allReleasesLink: 'Todas las versiones →',
  },
  sponsor: {
    heading: 'Apoya a unfetch',
    lead: 'unfetch lo desarrolla y mantiene una persona en su tiempo libre. Si te ahorra tiempo, una pequeña aportación mantiene vivo el proyecto.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'Para patrocinadores internacionales. Mensual o único, procesado por Stripe.',
    ghButton: 'Patrocinar en GitHub →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Propina única mundial. Cualquier cantidad en tu moneda.',
    paypalButton: 'Apoyar por PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Abre la app Alipay y escanea el QR de abajo.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Abre WeChat → Escanear, apunta al QR de abajo.',
    scanQr: 'Escanear QR',
    note: 'Los patrocinadores aparecen en el README y en el diálogo "Acerca de" de la app (con permiso).',
  },
  cta: { title: 'Consigue unfetch v0.2.2', desc: 'Sin anuncios · Sin telemetría · Sin login', button: 'Descargar instalador' },
  footer: { copy: '© 2026 unfetch · Licencia tipo MIT · Contribuidor activo a anacrolix/torrent', license: 'Licencia' },
}

// ========== Português (pt) ==========
const pt: Strings = {
  meta: {
    title: 'unfetch — Um gerenciador de downloads moderno para humanos e IA',
    description: 'HTTP multi-mirror, BT / magnet, 1000+ sites de vídeo, RSS, UI Web remota, 5 temas, pronto para IA via MCP. Open source.',
  },
  nav: { home: 'Início', download: 'Baixar', sponsor: 'Apoiar', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Gratuito · Open source · Sem anúncios · Sem telemetria',
    title: 'Downloads pensados para humanos e IA',
    subtitle: 'HTTP multi-mirror rápido, BT com seletor de arquivos, 1000+ sites de vídeo, RSS automático, hooks ao concluir, UI Web remota, 5 temas — controlado por GUI, CLI ou IA (MCP).',
    download: 'Baixar unfetch',
    downloadForMac: 'Baixar para macOS',
    downloadForWindows: 'Baixar para Windows',
    downloadForLinux: 'Baixar para Linux',
    allPlatforms: 'Ver todas as plataformas ↓',
    mcp: 'Usar com IA (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 MB',
    chips: ['⚡ HTTP multi-mirror', '🧲 BT / Magnet', '🎬 1000+ sites', '🤖 MCP nativo', '🌐 UI Web remota', '🎨 5 temas'],
  },
  features: {
    title: 'Tudo o que um gerenciador de downloads deveria ser',
    items: [
      { title: 'HTTP multi-mirror', desc: 'Até 32 threads × várias URLs espelho, fallback automático, retomada, verificação SHA256/MD5.' },
      { title: 'BT / Magnet bem feitos', desc: '35 trackers públicos, IPv6 + WebTorrent, seletor de arquivos antes de baixar, estatísticas peer/seeder, fallback uTP automático quando ISP afunila.' },
      { title: '1000+ sites de vídeo', desc: 'YouTube, Bilibili, TikTok, X e outros — via yt-dlp.' },
      { title: 'IA nativa (MCP)', desc: 'add_task, list_tasks, wait_for_task, notificações de progresso — de qualquer host MCP. Sem lock-in.' },
      { title: 'UI Web remota', desc: 'UI Web protegida por token em 0.0.0.0 — gerencie downloads do celular ou máquina remota. Compartilhável por QR.' },
      { title: 'RSS automático', desc: 'Assine com filtros regex; novos itens entram na fila automaticamente. Deduplicação por GUID.' },
      { title: 'Hooks ao concluir', desc: 'Webhook POST ou shell exec ao terminar — conecte ao Home Assistant / n8n / qualquer automação.' },
      { title: 'Templates e dependências', desc: 'Preajustes Cookie/UA por site, cadeias de dependência, inícios agendados.' },
      { title: '5 temas caprichados', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — troca em tempo real sem reiniciar.' },
      { title: 'Privacidade em primeiro', desc: 'Sem anúncios. Sem telemetria. Sem login. Sem upload de infohash.' },
    ],
  },
  download: {
    heading: 'Baixar unfetch',
    lead: 'Gratuito, open source, licença estilo MIT. Sem conta, sem telemetria, sem anúncios.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Notarizado', primary: 'Baixar .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · Instalador NSIS', primary: 'Baixar .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Baixar .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Arraste unfetch.app para /Applications. Notarizado pela Apple — sem aviso do Gatekeeper.',
      windows: 'Na primeira execução pode aparecer "O Windows protegeu seu PC" → Mais informações → Executar mesmo assim.',
      linux: 'Para o AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: 'Procurando versões antigas?',
    allReleasesLink: 'Todos os releases →',
  },
  sponsor: {
    heading: 'Apoie o unfetch',
    lead: 'O unfetch é desenvolvido e mantido por uma pessoa nas horas vagas. Se ele te poupa tempo, uma pequena contribuição mantém o projeto vivo.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'Para apoiadores internacionais. Mensal ou único, processado pelo Stripe.',
    ghButton: 'Apoiar no GitHub →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Doação única mundial. Qualquer valor na sua moeda.',
    paypalButton: 'Doar via PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Abra o app Alipay e escaneie o QR abaixo.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Abra o WeChat → Escanear, aponte para o QR abaixo.',
    scanQr: 'Escanear QR',
    note: 'Apoiadores são listados no README e no diálogo "Sobre" do app (com permissão).',
  },
  cta: { title: 'Obtenha o unfetch v0.2.2', desc: 'Sem anúncios · Sem telemetria · Sem login', button: 'Baixar instalador' },
  footer: { copy: '© 2026 unfetch · Licença estilo MIT · Contribuidor ativo do anacrolix/torrent', license: 'Licença' },
}

// ========== Italiano (it) ==========
const it: Strings = {
  meta: {
    title: 'unfetch — Un download manager moderno per umani e IA',
    description: 'HTTP multi-mirror, BT / magnet, 1000+ siti video, RSS, UI Web remota, 5 temi, pronto per IA via MCP. Open source.',
  },
  nav: { home: 'Home', download: 'Download', sponsor: 'Sostieni', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Gratuito · Open source · Senza pubblicità · Senza telemetria',
    title: 'Download pensati per umani e IA',
    subtitle: 'HTTP multi-mirror veloce, BT con selettore file, 1000+ siti video, RSS automatico, hook al completamento, UI Web remota, 5 temi — guidato da GUI, CLI o IA (MCP).',
    download: 'Scarica unfetch',
    downloadForMac: 'Scarica per macOS',
    downloadForWindows: 'Scarica per Windows',
    downloadForLinux: 'Scarica per Linux',
    allPlatforms: 'Vedi tutte le piattaforme ↓',
    mcp: 'Usa con IA (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 MB',
    chips: ['⚡ HTTP multi-mirror', '🧲 BT / Magnet', '🎬 1000+ siti', '🤖 MCP nativo', '🌐 UI Web remota', '🎨 5 temi'],
  },
  features: {
    title: 'Tutto ciò che un download manager dovrebbe essere',
    items: [
      { title: 'HTTP multi-mirror', desc: 'Fino a 32 thread × più URL mirror, fallback automatico, ripresa, verifica SHA256/MD5.' },
      { title: 'BT / Magnet fatti bene', desc: '35 tracker pubblici, IPv6 + WebTorrent, selettore file prima del download, statistiche peer/seeder, fallback uTP automatico quando l\'ISP rallenta.' },
      { title: '1000+ siti video', desc: 'YouTube, Bilibili, TikTok, X e altri — via yt-dlp.' },
      { title: 'IA nativa (MCP)', desc: 'add_task, list_tasks, wait_for_task, notifiche di progresso — da qualsiasi host MCP. Niente lock-in.' },
      { title: 'UI Web remota', desc: 'UI Web protetta da token su 0.0.0.0 — gestisci i download da cellulare o macchina remota. Condivisibile via QR.' },
      { title: 'RSS automatico', desc: 'Abbonati con filtri regex; nuovi elementi accodati automaticamente. Deduplicazione per GUID.' },
      { title: 'Hook al completamento', desc: 'Webhook POST o shell exec al termine — collega Home Assistant / n8n / qualsiasi automazione.' },
      { title: 'Template di task e dipendenze', desc: 'Preset Cookie/UA per sito, catene di dipendenza, avvii pianificati.' },
      { title: '5 temi curati', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — switch live senza riavvio.' },
      { title: 'Privacy prima di tutto', desc: 'Niente pubblicità. Niente telemetria. Niente login. Niente upload di infohash.' },
    ],
  },
  download: {
    heading: 'Scarica unfetch',
    lead: 'Gratuito, open source, licenza in stile MIT. Niente account, niente telemetria, niente pubblicità.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Notarizzato', primary: 'Scarica .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · Installer NSIS', primary: 'Scarica .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Scarica .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Trascina unfetch.app in /Applications. Notarizzato da Apple — nessun avviso Gatekeeper.',
      windows: 'Al primo avvio può apparire "Windows ha protetto il PC" → Ulteriori informazioni → Esegui comunque.',
      linux: 'Per AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: 'Cerchi versioni precedenti?',
    allReleasesLink: 'Tutte le release →',
  },
  sponsor: {
    heading: 'Sostieni unfetch',
    lead: 'unfetch è sviluppato e mantenuto da uno sviluppatore nel tempo libero. Se ti fa risparmiare tempo, un piccolo contributo aiuta il progetto a sopravvivere.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'Per sostenitori internazionali. Mensile o una tantum, gestito da Stripe.',
    ghButton: 'Sostieni su GitHub →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Mancia una tantum nel mondo. Qualsiasi importo nella tua valuta.',
    paypalButton: 'Offri via PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Apri l\'app Alipay e scansiona il QR qui sotto.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Apri WeChat → Scansiona, punta al QR qui sotto.',
    scanQr: 'Scansiona QR',
    note: 'I sostenitori vengono elencati nel README e nella finestra "Informazioni" dell\'app (con consenso).',
  },
  cta: { title: 'Ottieni unfetch v0.2.2', desc: 'Senza pubblicità · Senza telemetria · Senza login', button: 'Scarica installer' },
  footer: { copy: '© 2026 unfetch · Licenza in stile MIT · Contributore attivo di anacrolix/torrent', license: 'Licenza' },
}

// ========== Polski (pl) ==========
const pl: Strings = {
  meta: {
    title: 'unfetch — Nowoczesny menedżer pobierania dla ludzi i AI',
    description: 'Wielo-mirror HTTP, BT / magnet, 1000+ stron wideo, RSS, zdalny Web UI, 5 motywów, gotowe na AI przez MCP. Open source.',
  },
  nav: { home: 'Główna', download: 'Pobierz', sponsor: 'Wesprzyj', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Darmowe · Open source · Bez reklam · Bez telemetrii',
    title: 'Pobierania zbudowane dla ludzi i AI',
    subtitle: 'Szybkie wielo-mirror HTTP, BT z selektorem plików, 1000+ stron wideo, automatyczne RSS, haki po zakończeniu, zdalny Web UI, 5 motywów — sterowane z GUI, CLI lub AI (MCP).',
    download: 'Pobierz unfetch',
    downloadForMac: 'Pobierz dla macOS',
    downloadForWindows: 'Pobierz dla Windows',
    downloadForLinux: 'Pobierz dla Linux',
    allPlatforms: 'Zobacz wszystkie platformy ↓',
    mcp: 'Użyj z AI (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 MB',
    chips: ['⚡ Wielo-mirror HTTP', '🧲 BT / Magnet', '🎬 1000+ stron', '🤖 MCP natywne', '🌐 Zdalny Web UI', '🎨 5 motywów'],
  },
  features: {
    title: 'Wszystko, czym powinien być menedżer pobierania',
    items: [
      { title: 'Wielo-mirror HTTP', desc: 'Do 32 wątków × wiele URL mirror, automatyczne fallback, wznawianie, weryfikacja SHA256/MD5.' },
      { title: 'BT / Magnet, jak należy', desc: '35 publicznych trackerów, IPv6 + WebTorrent, wybór plików przed pobraniem, statystyki peer/seeder, automatyczne uTP gdy ISP dławi.' },
      { title: '1000+ stron wideo', desc: 'YouTube, Bilibili, TikTok, X i inne — przez yt-dlp.' },
      { title: 'Natywne dla AI (MCP)', desc: 'add_task, list_tasks, wait_for_task, powiadomienia o postępie — z dowolnego hosta MCP. Bez vendor lock-in.' },
      { title: 'Zdalny Web UI', desc: 'Web UI zabezpieczone tokenem na 0.0.0.0 — zarządzaj pobieraniami z telefonu lub zdalnej maszyny. Udostępnianie przez QR.' },
      { title: 'Automatyczne RSS', desc: 'Subskrypcja z filtrami regex; nowe elementy automatycznie w kolejce. Deduplikacja po GUID.' },
      { title: 'Haki po zakończeniu', desc: 'Webhook POST lub shell exec — podłącz Home Assistant / n8n / dowolną automatyzację.' },
      { title: 'Szablony zadań i zależności', desc: 'Ustawienia Cookie/UA per strona, łańcuchy zależności, zaplanowane starty.' },
      { title: '5 dopracowanych motywów', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — zmiana na żywo bez restartu.' },
      { title: 'Prywatność przede wszystkim', desc: 'Bez reklam. Bez telemetrii. Bez logowania. Bez wysyłania infohash.' },
    ],
  },
  download: {
    heading: 'Pobierz unfetch',
    lead: 'Darmowe, open source, licencja w stylu MIT. Bez konta, bez telemetrii, bez reklam.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Notaryzowane', primary: 'Pobierz .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · Instalator NSIS', primary: 'Pobierz .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Pobierz .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Przeciągnij unfetch.app do /Applications. Notaryzowane przez Apple — bez ostrzeżenia Gatekeeper.',
      windows: 'Przy pierwszym uruchomieniu może pojawić się "System Windows ochronił komputer" → Więcej informacji → Uruchom mimo to.',
      linux: 'Dla AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: 'Szukasz starszych wersji?',
    allReleasesLink: 'Wszystkie wydania →',
  },
  sponsor: {
    heading: 'Wesprzyj unfetch',
    lead: 'unfetch jest tworzony i utrzymywany przez jednego programistę w wolnym czasie. Jeśli oszczędza Ci czas, drobne wsparcie pomaga projektowi przetrwać.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'Dla międzynarodowych sponsorów. Miesięcznie lub jednorazowo, obsługiwane przez Stripe.',
    ghButton: 'Wesprzyj na GitHubie →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Jednorazowy napiwek na cały świat. Dowolna kwota w Twojej walucie.',
    paypalButton: 'Wpłać przez PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Otwórz aplikację Alipay i zeskanuj QR poniżej.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Otwórz WeChat → Skanuj, wymierz w QR poniżej.',
    scanQr: 'Zeskanuj QR',
    note: 'Sponsorzy są wymieniani w README i oknie "O programie" (za zgodą).',
  },
  cta: { title: 'Pobierz unfetch v0.2.2', desc: 'Bez reklam · Bez telemetrii · Bez logowania', button: 'Pobierz instalator' },
  footer: { copy: '© 2026 unfetch · Licencja w stylu MIT · Aktywny współtwórca anacrolix/torrent', license: 'Licencja' },
}

// ========== Nederlands (nl) ==========
const nl: Strings = {
  meta: {
    title: 'unfetch — Een moderne downloadmanager voor mensen en AI',
    description: 'Multi-mirror HTTP, BT / magnet, 1000+ videosites, RSS, externe Web-UI, 5 thema\'s, klaar voor AI via MCP. Open source.',
  },
  nav: { home: 'Home', download: 'Downloaden', sponsor: 'Steun', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Gratis · Open source · Geen reclame · Geen telemetrie',
    title: 'Downloads gebouwd voor mensen en AI',
    subtitle: 'Snelle multi-mirror HTTP, BT met bestandsselectie, 1000+ videosites, automatische RSS, completion hooks, externe Web-UI, 5 thema\'s — bedienbaar via GUI, CLI of AI (MCP).',
    download: 'Download unfetch',
    downloadForMac: 'Download voor macOS',
    downloadForWindows: 'Download voor Windows',
    downloadForLinux: 'Download voor Linux',
    allPlatforms: 'Alle platformen bekijken ↓',
    mcp: 'Gebruik met AI (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 MB',
    chips: ['⚡ Multi-mirror HTTP', '🧲 BT / Magnet', '🎬 1000+ sites', '🤖 MCP-native', '🌐 Externe Web-UI', '🎨 5 thema\'s'],
  },
  features: {
    title: 'Alles wat een downloadmanager zou moeten zijn',
    items: [
      { title: 'Multi-mirror HTTP', desc: 'Tot 32 threads × meerdere mirror-URLs, automatische fallback, hervatten, SHA256/MD5-verificatie.' },
      { title: 'BT / Magnet, goed gedaan', desc: '35 publieke trackers, IPv6 + WebTorrent, bestandsselectie voor download, peer/seeder-statistieken, automatische uTP-fallback bij ISP-throttling.' },
      { title: '1000+ videosites', desc: 'YouTube, Bilibili, TikTok, X en de rest — via yt-dlp.' },
      { title: 'AI-native (MCP)', desc: 'add_task, list_tasks, wait_for_task, voortgangsmeldingen — vanuit elke MCP-host. Geen vendor lock-in.' },
      { title: 'Externe Web-UI', desc: 'Token-beveiligde Web-UI op 0.0.0.0 — beheer downloads vanaf je telefoon of externe machine. QR-deelbaar.' },
      { title: 'Automatische RSS', desc: 'Abonneren met regex-filters; nieuwe items komen automatisch in de wachtrij. GUID-gededupliceerd.' },
      { title: 'Completion hooks', desc: 'Webhook POST of shell-exec bij voltooiing — koppel met Home Assistant / n8n / wat dan ook.' },
      { title: 'Taaksjablonen & afhankelijkheden', desc: 'Cookie/UA-presets per site, afhankelijkheidsketens, geplande starts.' },
      { title: '5 gepolijste thema\'s', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — live wisselen zonder herstart.' },
      { title: 'Privacy eerst', desc: 'Geen reclame. Geen telemetrie. Geen login. Geen infohash-uploads.' },
    ],
  },
  download: {
    heading: 'Download unfetch',
    lead: 'Gratis, open source, MIT-stijl licentie. Geen account, geen telemetrie, geen reclame.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Genotariseerd', primary: 'Download .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · NSIS-installer', primary: 'Download .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Download .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Sleep unfetch.app naar /Applications. Genotariseerd door Apple — geen Gatekeeper-waarschuwing.',
      windows: 'Bij eerste start kan "Windows heeft uw pc beschermd" verschijnen → Meer info → Toch uitvoeren.',
      linux: 'Voor AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: 'Op zoek naar oudere versies?',
    allReleasesLink: 'Alle releases →',
  },
  sponsor: {
    heading: 'Steun unfetch',
    lead: 'unfetch wordt door één ontwikkelaar in zijn vrije tijd gemaakt en onderhouden. Als het je tijd bespaart, helpt een kleine bijdrage het project in leven.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'Voor internationale sponsors. Maandelijks of eenmalig, verwerkt door Stripe.',
    ghButton: 'Sponsor op GitHub →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Wereldwijde eenmalige fooi. Elk bedrag in jouw valuta.',
    paypalButton: 'Tip via PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Open de Alipay-app en scan de QR-code hieronder.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Open WeChat → Scannen, richt op de QR-code hieronder.',
    scanQr: 'QR-code scannen',
    note: 'Sponsors worden vermeld in de README en het "Over"-dialoogvenster van de app (met toestemming).',
  },
  cta: { title: 'Haal unfetch v0.2.2', desc: 'Geen reclame · Geen telemetrie · Geen login', button: 'Installer downloaden' },
  footer: { copy: '© 2026 unfetch · MIT-stijl licentie · Actieve contributor aan anacrolix/torrent', license: 'Licentie' },
}

// ========== Türkçe (tr) ==========
const tr: Strings = {
  meta: {
    title: 'unfetch — İnsanlar ve yapay zeka için modern indirme yöneticisi',
    description: 'Çoklu ayna HTTP, BT / magnet, 1000+ video sitesi, RSS, uzaktan Web arayüzü, 5 tema, MCP ile YZ hazır. Açık kaynak.',
  },
  nav: { home: 'Ana sayfa', download: 'İndir', sponsor: 'Destek ol', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Ücretsiz · Açık kaynak · Reklamsız · Telemetrisiz',
    title: 'İnsanlar ve YZ için tasarlanmış indirme',
    subtitle: 'Hızlı çoklu ayna HTTP, dosya seçimli BT, 1000+ video sitesi, otomatik RSS, tamamlanma kancaları, uzaktan Web arayüzü, 5 tema — GUI, CLI veya YZ (MCP) ile kontrol.',
    download: 'unfetch indir',
    downloadForMac: 'macOS için indir',
    downloadForWindows: 'Windows için indir',
    downloadForLinux: 'Linux için indir',
    allPlatforms: 'Tüm platformları gör ↓',
    mcp: 'YZ ile kullan (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 MB',
    chips: ['⚡ Çoklu ayna HTTP', '🧲 BT / Magnet', '🎬 1000+ site', '🤖 MCP yerel', '🌐 Uzaktan Web', '🎨 5 tema'],
  },
  features: {
    title: 'Bir indirme yöneticisinin sahip olması gereken her şey',
    items: [
      { title: 'Çoklu ayna HTTP', desc: '32 thread\'e kadar × birden fazla ayna URL, otomatik geri dönüş, devam ettirme, SHA256/MD5 doğrulama.' },
      { title: 'BT / Magnet, doğru şekilde', desc: '35 genel tracker, IPv6 + WebTorrent, indirmeden önce dosya seçici, peer/seeder istatistikleri, ISS kısıtlamasında otomatik uTP geri dönüşü.' },
      { title: '1000+ video sitesi', desc: 'YouTube, Bilibili, TikTok, X ve diğerleri — yt-dlp ile.' },
      { title: 'YZ yerel (MCP)', desc: 'add_task, list_tasks, wait_for_task, ilerleme bildirimleri — herhangi bir MCP host\'tan. Sağlayıcı kilitlenmesi yok.' },
      { title: 'Uzaktan Web arayüzü', desc: '0.0.0.0 üzerinde token korumalı Web UI — indirmeleri telefondan veya uzak makineden yönet. QR ile paylaşılabilir.' },
      { title: 'Otomatik RSS', desc: 'Regex filtreleri ile abone ol; yeni öğeler otomatik kuyruğa alınır. GUID ile tekrar engelleme.' },
      { title: 'Tamamlanma kancaları', desc: 'Bittiğinde Webhook POST veya shell exec — Home Assistant / n8n / herhangi bir otomasyona bağla.' },
      { title: 'Görev şablonları ve bağımlılıklar', desc: 'Site başına Cookie/UA önayarları, görev bağımlılık zincirleri, planlı başlangıçlar.' },
      { title: '5 cilalı tema', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — yeniden başlatma olmadan canlı geçiş.' },
      { title: 'Önce gizlilik', desc: 'Reklam yok. Telemetri yok. Giriş yok. Infohash yüklemesi yok.' },
    ],
  },
  download: {
    heading: 'unfetch indir',
    lead: 'Ücretsiz, açık kaynak, MIT tarzı lisans. Hesap yok, telemetri yok, reklam yok.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Onaylı', primary: '.dmg indir' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · NSIS yükleyicisi', primary: '.exe indir' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: '.AppImage indir', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'unfetch.app\'i /Applications\'a sürükleyin. Apple tarafından onaylı — Gatekeeper uyarısı yok.',
      windows: 'İlk başlatmada "Windows PC\'nizi korudu" görünebilir → Daha fazla bilgi → Yine de çalıştır.',
      linux: 'AppImage için: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: 'Eski sürümleri mi arıyorsunuz?',
    allReleasesLink: 'Tüm sürümler →',
  },
  sponsor: {
    heading: 'unfetch\'i destekle',
    lead: 'unfetch tek bir geliştirici tarafından boş zamanlarında geliştiriliyor ve sürdürülüyor. Size zaman kazandırıyorsa, küçük bir katkı projeyi yaşatır.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'Uluslararası sponsorlar için. Aylık veya tek seferlik, Stripe ile.',
    ghButton: 'GitHub\'da destek ol →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Dünya çapında tek seferlik bahşiş. Kendi para biriminizde istediğiniz miktar.',
    paypalButton: 'PayPal ile bahşiş →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Alipay uygulamasını açın ve aşağıdaki QR kodunu tarayın.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'WeChat\'i açın → Tara, aşağıdaki QR koduna doğrultun.',
    scanQr: 'QR kodu tara',
    note: 'Sponsorlar README\'de ve uygulama içi "Hakkında" iletişim kutusunda listelenir (izin ile).',
  },
  cta: { title: 'unfetch v0.2.2\'yi edinin', desc: 'Reklam yok · Telemetri yok · Giriş yok', button: 'Yükleyiciyi indir' },
  footer: { copy: '© 2026 unfetch · MIT tarzı lisans · anacrolix/torrent\'ın aktif katılımcısı', license: 'Lisans' },
}

// ========== Svenska (sv) ==========
const sv: Strings = {
  meta: {
    title: 'unfetch — En modern nedladdningshanterare för människor och AI',
    description: 'Multi-spegel HTTP, BT / magnet, 1000+ videosajter, RSS, fjärr-webb-UI, 5 teman, AI-redo via MCP. Öppen källkod.',
  },
  nav: { home: 'Hem', download: 'Ladda ner', sponsor: 'Stöd', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Gratis · Öppen källkod · Reklamfri · Ingen telemetri',
    title: 'Nedladdningar byggda för människor och AI',
    subtitle: 'Snabb multi-spegel HTTP, BT med filval, 1000+ videosajter, automatisk RSS, completion hooks, fjärr-webb-UI, 5 teman — styrt via GUI, CLI eller AI (MCP).',
    download: 'Ladda ner unfetch',
    downloadForMac: 'Ladda ner för macOS',
    downloadForWindows: 'Ladda ner för Windows',
    downloadForLinux: 'Ladda ner för Linux',
    allPlatforms: 'Se alla plattformar ↓',
    mcp: 'Använd med AI (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 MB',
    chips: ['⚡ Multi-spegel HTTP', '🧲 BT / Magnet', '🎬 1000+ sajter', '🤖 MCP-native', '🌐 Fjärr-webb-UI', '🎨 5 teman'],
  },
  features: {
    title: 'Allt en nedladdningshanterare borde vara',
    items: [
      { title: 'Multi-spegel HTTP', desc: 'Upp till 32 trådar × flera spegel-URL:er, automatisk fallback, återupptag, SHA256/MD5-verifiering.' },
      { title: 'BT / Magnet, ordentligt', desc: '35 publika trackers, IPv6 + WebTorrent, filväljare före nedladdning, peer/seeder-statistik, automatisk uTP-fallback vid ISP-strypning.' },
      { title: '1000+ videosajter', desc: 'YouTube, Bilibili, TikTok, X och resten — via yt-dlp.' },
      { title: 'AI-native (MCP)', desc: 'add_task, list_tasks, wait_for_task, förloppsnotifieringar — från valfri MCP-värd. Ingen vendor lock-in.' },
      { title: 'Fjärr-webb-UI', desc: 'Token-säkrat webb-UI på 0.0.0.0 — hantera nedladdningar från mobil eller fjärrmaskin. QR-delbart.' },
      { title: 'Automatisk RSS', desc: 'Prenumerera med regex-filter; nya poster köas automatiskt. GUID-dedupliceras.' },
      { title: 'Completion hooks', desc: 'Webhook POST eller shell exec vid klart — koppla till Home Assistant / n8n / valfri automation.' },
      { title: 'Uppgiftsmallar & beroenden', desc: 'Cookie/UA-förinställningar per sajt, beroendekedjor, schemalagda starter.' },
      { title: '5 polerade teman', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — live-byte utan omstart.' },
      { title: 'Integritet först', desc: 'Ingen reklam. Ingen telemetri. Ingen inloggning. Inga infohash-uppladdningar.' },
    ],
  },
  download: {
    heading: 'Ladda ner unfetch',
    lead: 'Gratis, öppen källkod, MIT-liknande licens. Inget konto, ingen telemetri, ingen reklam.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Notariserad', primary: 'Ladda ner .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · NSIS-installerare', primary: 'Ladda ner .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Ladda ner .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Dra unfetch.app till /Applications. Notariserad av Apple — ingen Gatekeeper-varning.',
      windows: 'Vid första start kan "Windows har skyddat din dator" visas → Mer info → Kör ändå.',
      linux: 'För AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: 'Letar du efter äldre versioner?',
    allReleasesLink: 'Alla releaser →',
  },
  sponsor: {
    heading: 'Stöd unfetch',
    lead: 'unfetch byggs och underhålls av en ensam utvecklare på fritiden. Om det sparar tid åt dig hjälper en liten gåva projektet att leva vidare.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'För internationella sponsorer. Månadsvis eller engångs, hanteras av Stripe.',
    ghButton: 'Sponsra på GitHub →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Engångsbidrag globalt. Valfritt belopp i din valuta.',
    paypalButton: 'Tippa via PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Öppna Alipay-appen och skanna QR-koden nedan.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Öppna WeChat → Skanna, sikta på QR-koden nedan.',
    scanQr: 'Skanna QR',
    note: 'Sponsorer listas i README och appens "Om"-dialog (med samtycke).',
  },
  cta: { title: 'Hämta unfetch v0.2.2', desc: 'Ingen reklam · Ingen telemetri · Ingen inloggning', button: 'Ladda ner installerare' },
  footer: { copy: '© 2026 unfetch · MIT-liknande licens · Aktiv bidragsgivare till anacrolix/torrent', license: 'Licens' },
}

// ========== Українська (uk) ==========
const uk: Strings = {
  meta: {
    title: 'unfetch — Сучасний менеджер завантажень для людей і ШІ',
    description: 'Багатодзеркальний HTTP, BT / magnet, 1000+ відеосайтів, RSS, віддалений Web UI, 5 тем, готовий для ШІ через MCP. З відкритим кодом.',
  },
  nav: { home: 'Головна', download: 'Завантажити', sponsor: 'Підтримати', mcp: 'MCP', github: 'GitHub' },
  hero: {
    tag: 'v0.2.2 · Безкоштовно · Open source · Без реклами · Без телеметрії',
    title: 'Завантаження, створені для людей і ШІ',
    subtitle: 'Швидкий багатодзеркальний HTTP, BT з вибором файлів, 1000+ відеосайтів, автоматичний RSS, хуки після завершення, віддалений Web UI, 5 тем — керується GUI, CLI або ШІ (MCP).',
    download: 'Завантажити unfetch',
    downloadForMac: 'Завантажити для macOS',
    downloadForWindows: 'Завантажити для Windows',
    downloadForLinux: 'Завантажити для Linux',
    allPlatforms: 'Усі платформи ↓',
    mcp: 'Використати зі ШІ (MCP)',
    requirements: 'Windows 10+ · macOS 11+ · Linux x64 · ~8 МБ',
    chips: ['⚡ Багатодзеркальний HTTP', '🧲 BT / Magnet', '🎬 1000+ сайтів', '🤖 MCP-нативно', '🌐 Віддалений Web UI', '🎨 5 тем'],
  },
  features: {
    title: 'Усе, чим має бути менеджер завантажень',
    items: [
      { title: 'Багатодзеркальний HTTP', desc: 'До 32 потоків × кілька URL-дзеркал, автоматичний fallback, продовження, перевірка SHA256/MD5.' },
      { title: 'BT / Magnet, як належить', desc: '35 публічних трекерів, IPv6 + WebTorrent, вибір файлів перед завантаженням, статистика peer/seeder, автоматичний uTP при обмеженнях провайдера.' },
      { title: '1000+ відеосайтів', desc: 'YouTube, Bilibili, TikTok, X та інші — через yt-dlp.' },
      { title: 'ШІ-нативно (MCP)', desc: 'add_task, list_tasks, wait_for_task, сповіщення про прогрес — з будь-якого MCP-хоста. Без vendor lock-in.' },
      { title: 'Віддалений Web UI', desc: 'Web UI з токен-захистом на 0.0.0.0 — керуйте завантаженнями зі смартфона чи віддаленої машини. Поділ через QR.' },
      { title: 'Автоматичний RSS', desc: 'Підписка з regex-фільтрами; нові елементи автоматично у черзі. Дедуплікація за GUID.' },
      { title: 'Хуки після завершення', desc: 'Webhook POST або shell exec при готовому — підключайте Home Assistant / n8n / будь-яку автоматизацію.' },
      { title: 'Шаблони завдань і залежності', desc: 'Пресети Cookie/UA per сайт, ланцюги залежностей, заплановані старти.' },
      { title: '5 відшліфованих тем', desc: 'Deep Indigo, Light Paper, Forest Night, Cyberpunk, Mono Gray — миттєве перемикання без перезапуску.' },
      { title: 'Приватність понад усе', desc: 'Без реклами. Без телеметрії. Без логіну. Без вивантаження infohash.' },
    ],
  },
  download: {
    heading: 'Завантажити unfetch',
    lead: 'Безкоштовно, open source, ліцензія в стилі MIT. Без облікового запису, без телеметрії, без реклами.',
    platforms: {
      macos: { name: 'macOS', note: 'Universal · Apple Silicon + Intel · Нотаризовано', primary: 'Завантажити .dmg' },
      windows: { name: 'Windows', note: 'x64 · Windows 10/11 · Інсталятор NSIS', primary: 'Завантажити .exe' },
      linux: { name: 'Linux', note: 'x64 · .AppImage / .deb / .rpm', primary: 'Завантажити .AppImage', secondary: '.deb (Debian/Ubuntu)', tertiary: '.rpm (Fedora/RHEL)' },
    },
    notes: {
      macos: 'Перетягніть unfetch.app у /Applications. Нотаризовано Apple — без попередження Gatekeeper.',
      windows: 'При першому запуску може з\'явитися "Захисник Windows захистив ваш ПК" → Докладніше → Все одно запустити.',
      linux: 'Для AppImage: chmod +x unfetch_*.AppImage && ./unfetch_*.AppImage.',
    },
    allReleases: 'Шукаєте старіші версії?',
    allReleasesLink: 'Усі релізи →',
  },
  sponsor: {
    heading: 'Підтримати unfetch',
    lead: 'unfetch створюється і підтримується одним розробником у вільний час. Якщо це економить ваш час, невелика підтримка тримає проєкт живим.',
    ghTitle: 'GitHub Sponsors',
    ghDesc: 'Для міжнародних спонсорів. Щомісяця або разово, через Stripe.',
    ghButton: 'Підтримати на GitHub →',
    paypalTitle: 'PayPal',
    paypalDesc: 'Разова донація з усього світу. Будь-яка сума у вашій валюті.',
    paypalButton: 'Чайові через PayPal →',
    alipayTitle: 'Alipay',
    alipayDesc: 'Відкрийте додаток Alipay і скануйте QR-код нижче.',
    wechatTitle: 'WeChat Pay',
    wechatDesc: 'Відкрийте WeChat → Сканувати, наведіть на QR-код нижче.',
    scanQr: 'Сканувати QR',
    note: 'Спонсорів вказано в README і вікні "Про програму" (за згодою).',
  },
  cta: { title: 'Отримати unfetch v0.2.2', desc: 'Без реклами · Без телеметрії · Без логіну', button: 'Завантажити інсталятор' },
  footer: { copy: '© 2026 unfetch · Ліцензія в стилі MIT · Активний контриб\'ютор anacrolix/torrent', license: 'Ліцензія' },
}

export const STRINGS: Record<Lang, Strings> = {
  en, zh, ja, ko, de, fr, es, pt, it, pl, nl, tr, sv, uk,
}

export function getStrings(lang: string | undefined): Strings {
  const code = (lang || 'en') as Lang
  return STRINGS[code] || STRINGS.en
}
