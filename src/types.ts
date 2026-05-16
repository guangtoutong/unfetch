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
}

export interface SpeedScheduleEntry {
  start_hour: number
  end_hour: number
  limit: number
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
