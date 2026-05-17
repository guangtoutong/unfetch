export type TaskType = 'http' | 'bt' | 'ytdlp'
export type TaskStatus = 'queued' | 'downloading' | 'paused' | 'done' | 'error'
export type FilterType = TaskStatus | 'all' | 'trash'
export type OnAllDoneAction = '' | 'notify' | 'open_dir' | 'shutdown' | 'sleep'

export interface TaskMeta {
  title?: string
  thumbnail?: string
  site?: string
  duration?: number
}

export interface Task {
  id: string
  url: string
  filename: string
  save_path: string
  type: TaskType
  status: TaskStatus
  total_bytes: number
  done_bytes: number
  speed: number
  eta: number
  threads: number
  proxy?: string
  quality?: string
  created_at: string
  finished_at?: string
  error?: string
  metadata?: TaskMeta
  play_after?: boolean
  trashed?: boolean
  retry_count?: number
  start_at?: string
  tags?: string[]
  expected_sha256?: string
  expected_md5?: string
  actual_sha256?: string
  selected_files?: number[]
  custom_trackers?: string[]
  peers_connected?: number
  peers_total?: number
  seeders?: number
  auto_utp_triggered?: boolean
}

export interface SpeedScheduleEntry {
  start_hour: number
  end_hour: number
  limit: number
}

export interface RSSFeed {
  name: string
  url: string
  filter_regex?: string
  interval_min: number
  enabled: boolean
  save_dir?: string
  tags?: string[]
}

export interface TaskTemplate {
  name: string
  cookies?: string
  user_agent?: string
  headers?: Record<string, string>
}

export interface Config {
  download_dir: string
  max_concurrent: number
  http_threads: number
  proxy?: string
  use_system_proxy: boolean
  speed_limit: number
  speed_schedule?: SpeedScheduleEntry[]
  auto_play_unflick: boolean
  auto_retry?: boolean
  max_retries?: number
  on_all_done?: OnAllDoneAction
  bt_force_utp?: boolean
  bt_auto_utp_fallback?: boolean
  // v0.1.1+ 远程 Web UI
  remote_enabled?: boolean
  remote_token?: string
  // RSS 订阅
  rss_feeds?: RSSFeed[]
  // 完成钩子
  on_complete_webhook?: string
  on_complete_exec?: string
  // 任务模板
  task_templates?: TaskTemplate[]
}

export interface AddTaskRequest {
  url: string
  save_dir?: string
  filename?: string
  threads?: number
  proxy?: string
  quality?: string
  cookies?: string
  play_after?: boolean
  start_at?: string
  tags?: string[]
  expected_sha256?: string
  expected_md5?: string
  selected_files?: number[]
  custom_trackers?: string[]
  template?: string
}

export interface TorrentFile {
  index: number
  path: string
  length: number
  selected: boolean
}

export interface TorrentPreview {
  name: string
  info_hash: string
  total_bytes: number
  files: TorrentFile[]
}

export interface TaskCounts {
  all: number
  downloading: number
  paused: number
  done: number
  error: number
  trash: number
}
