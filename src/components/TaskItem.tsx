import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useTaskStore } from '../stores/taskStore'
import { useSettingsStore } from '../stores/settingsStore'
import { ContextMenu, type MenuItem } from './ContextMenu'
import {
  formatBytes,
  formatSpeed,
  formatETA,
  formatPercent,
  getSiteName,
} from '../lib/format'
import type { Task, TaskStatus, FilterType } from '../types'

interface TaskItemProps {
  task: Task
  filter?: FilterType
}

// 文件类型图标
const FileIcon: React.FC<{ filename: string; type: string }> = ({ filename, type }) => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm4v', 'ts']
  const audioExts = ['mp3', 'aac', 'flac', 'wav', 'm4a', 'ogg', 'opus']

  if (type === 'bt') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    )
  }

  if (videoExts.includes(ext)) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M9 15V9l7 3-7 3z" fill="#6366f1" stroke="none" />
      </svg>
    )
  }

  if (audioExts.includes(ext)) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="1.8">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    )
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

// 慢速 BT 任务提示：连续 60s < 100KB/s 时显示"试试 uTP"按钮
// 点击后开启全局 bt_auto_utp_fallback + pause/resume 当前任务以触发 fallback
const SlowUTPHint: React.FC<{ task: Task }> = ({ task }) => {
  const config = useSettingsStore((s) => s.config)
  const updateConfig = useSettingsStore((s) => s.updateConfig)
  const { pauseTask, resumeTask } = useTaskStore()
  const slowSinceRef = useRef<number | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    // 不显示的前置条件：已切过、用户已强制 uTP、已开启自动 fallback
    if (task.auto_utp_triggered || config.bt_force_utp || config.bt_auto_utp_fallback) {
      setShowHint(false)
      slowSinceRef.current = null
      return
    }
    const SLOW = 100 * 1024
    const WINDOW = 60_000
    if (task.speed < SLOW) {
      if (slowSinceRef.current === null) slowSinceRef.current = Date.now()
      if (Date.now() - slowSinceRef.current >= WINDOW) setShowHint(true)
    } else {
      slowSinceRef.current = null
      setShowHint(false)
    }
  }, [task.speed, task.auto_utp_triggered, config.bt_force_utp, config.bt_auto_utp_fallback])

  if (!showHint) return null

  const onClick = async () => {
    if (acting) return
    setActing(true)
    try {
      await updateConfig({ bt_auto_utp_fallback: true })
      await pauseTask(task.id)
      // 间隔 400ms 再 resume，避免 daemon 还没释放 client
      setTimeout(() => {
        resumeTask(task.id).catch(() => {})
        setActing(false)
      }, 400)
    } catch {
      setActing(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={acting}
      style={{
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 4,
        background: 'rgba(245,158,11,0.18)',
        color: '#f59e0b',
        border: '1px solid rgba(245,158,11,0.4)',
        fontWeight: 600,
        cursor: acting ? 'wait' : 'pointer',
        letterSpacing: 0.3,
      }}
      title="速度偏慢可能是 ISP 屏蔽了 BT 端口；点击开启自动 uTP fallback 并重启本任务"
    >
      {acting ? '切换中…' : '试试 uTP'}
    </button>
  )
}

// 来源徽章
const SourceBadge: React.FC<{ url: string; type: string }> = ({ url, type }) => {
  const name = getSiteName(url, type)
  const colorMap: Record<string, { bg: string; text: string }> = {
    YouTube: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
    Bilibili: { bg: 'rgba(236,72,153,0.15)', text: '#ec4899' },
    BT: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
    TikTok: { bg: 'rgba(0,0,0,0.3)', text: '#e2e8f0' },
    Twitter: { bg: 'rgba(29,161,242,0.15)', text: '#1da1f2' },
    Instagram: { bg: 'rgba(225,48,108,0.15)', text: '#e1306c' },
    Vimeo: { bg: 'rgba(26,183,234,0.15)', text: '#1ab7ea' },
    Twitch: { bg: 'rgba(145,71,255,0.15)', text: '#9147ff' },
    爱奇艺: { bg: 'rgba(0,255,0,0.1)', text: '#00b140' },
    优酷: { bg: 'rgba(0,120,255,0.15)', text: '#0078ff' },
    腾讯视频: { bg: 'rgba(255,164,0,0.15)', text: '#ffa400' },
    HTTP: { bg: 'rgba(100,116,139,0.15)', text: '#64748b' },
  }
  const style = colorMap[name] ?? colorMap.HTTP

  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        borderRadius: 4,
        padding: '2px 7px',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {name}
    </span>
  )
}

// 状态徽章
const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const { t } = useTranslation()
  const map: Record<TaskStatus, { label: string; bg: string; color: string; pulse: boolean }> = {
    queued: { label: t('status.queued'), bg: 'rgba(100,116,139,0.15)', color: '#64748b', pulse: false },
    downloading: { label: t('status.downloading'), bg: 'rgba(34,197,94,0.12)', color: '#22c55e', pulse: true },
    paused: { label: t('status.paused'), bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', pulse: false },
    done: { label: t('status.done'), bg: 'rgba(99,102,241,0.12)', color: '#6366f1', pulse: false },
    error: { label: t('status.error'), bg: 'rgba(239,68,68,0.12)', color: '#ef4444', pulse: false },
  }
  const s = map[status]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: s.bg,
        color: s.color,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {s.pulse ? (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: s.color,
            animation: 'pulse-dot 1.2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
      ) : (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: s.color,
            opacity: 0.8,
            flexShrink: 0,
          }}
        />
      )}
      {s.label}
    </span>
  )
}

// 进度条
const ProgressBar: React.FC<{ done: number; total: number; status: TaskStatus }> = ({
  done,
  total,
  status,
}) => {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0
  const isActive = status === 'downloading'

  return (
    <div
      style={{
        height: 5,
        background: 'rgba(99,102,241,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        className={isActive ? 'progress-shimmer' : ''}
        style={{
          height: '100%',
          width: `${pct}%`,
          background:
            status === 'done'
              ? 'linear-gradient(90deg, #22c55e, #10b981)'
              : status === 'error'
              ? '#ef4444'
              : status === 'paused'
              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
              : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  )
}

// 操作按钮
const ActionButton: React.FC<{
  onClick: () => void
  title: string
  danger?: boolean
  children: React.ReactNode
}> = ({ onClick, title, danger, children }) => {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        borderRadius: 6,
        border: `1px solid ${
          danger && hovered ? 'rgba(239,68,68,0.4)' : 'var(--border)'
        }`,
        background:
          danger && hovered
            ? 'rgba(239,68,68,0.1)'
            : hovered
            ? 'rgba(99,102,241,0.12)'
            : 'rgba(255,255,255,0.04)',
        color: danger && hovered ? '#ef4444' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

async function openInExplorer(path: string) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('open_in_explorer', { path })
  } catch {
    console.log('非 Tauri 环境，无法打开目录')
  }
}

async function playInUnflick(path: string) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('play_in_unflick', { path })
  } catch {
    console.log('非 Tauri 环境，无法播放')
  }
}

export const TaskItem = forwardRef<HTMLDivElement, TaskItemProps>(function TaskItem({ task, filter }, ref) {
  const { pauseTask, resumeTask, trashTask, restoreTask, removeTask } = useTaskStore()
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const [confirmHardDelete, setConfirmHardDelete] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const percent = formatPercent(task.done_bytes, task.total_bytes)
  const displayName = task.metadata?.title || task.filename
  const inTrash = filter === 'trash'

  const handleHardDelete = () => {
    if (confirmHardDelete) {
      removeTask(task.id, true).catch(console.error)
    } else {
      setConfirmHardDelete(true)
      setTimeout(() => setConfirmHardDelete(false), 3000)
    }
  }

  const filePath = task.save_path && task.filename ? `${task.save_path}/${task.filename}` : ''

  const menuItems = useMemo<MenuItem[]>(() => {
    const copyURL = () => {
      navigator.clipboard?.writeText(task.url).catch(() => {})
    }
    if (inTrash) {
      return [
        {
          label: t('task.restore'),
          icon: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          ),
          onClick: () => restoreTask(task.id).catch(console.error),
        },
        { divider: true, label: '' },
        {
          label: t('task.copyUrl'),
          icon: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          ),
          onClick: copyURL,
        },
        { divider: true, label: '' },
        {
          label: t('task.hardDelete'),
          danger: true,
          icon: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          ),
          onClick: () => removeTask(task.id, true).catch(console.error),
        },
      ]
    }

    const items: MenuItem[] = []
    if (task.status === 'downloading' || task.status === 'queued') {
      items.push({
        label: t('task.pause'),
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ),
        onClick: () => pauseTask(task.id).catch(console.error),
      })
    } else if (task.status === 'paused') {
      items.push({
        label: t('task.resume'),
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        ),
        onClick: () => resumeTask(task.id).catch(console.error),
      })
    } else if (task.status === 'error') {
      items.push({
        label: t('task.retry'),
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        ),
        onClick: () => resumeTask(task.id).catch(console.error),
      })
    }

    if (task.status === 'done') {
      items.push({
        label: t('task.openFolder'),
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        ),
        onClick: () => openInExplorer(task.save_path),
      })
      if (filePath) {
        items.push({
          label: t('task.playInUnflick'),
          icon: (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          ),
          onClick: () => playInUnflick(filePath),
        })
      }
    }

    if (items.length > 0) items.push({ divider: true, label: '' })

    items.push({
      label: t('task.copyUrl'),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      ),
      onClick: copyURL,
    })

    items.push({ divider: true, label: '' })

    items.push({
      label: t('task.trash'),
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      ),
      onClick: () => trashTask(task.id).catch(console.error),
    })

    items.push({
      label: t('task.hardDelete'),
      danger: true,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      ),
      onClick: () => removeTask(task.id, true).catch(console.error),
    })

    return items
  }, [task, inTrash, filePath, pauseTask, resumeTask, trashTask, restoreTask, removeTask])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmHardDelete(false) }}
      onContextMenu={handleContextMenu}
      style={{
        background: hovered || menuPos ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        border: `1px solid ${hovered || menuPos ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '12px 14px',
        transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered || menuPos ? '0 2px 20px rgba(99,102,241,0.08)' : 'none',
      }}
    >
      {/* 主信息行 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        {/* 文件图标 */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'rgba(99,102,241,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid var(--border)',
          }}
        >
          <FileIcon filename={task.filename} type={task.type} />
        </div>

        {/* 文件信息 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <span
              title={displayName}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 360,
              }}
            >
              {displayName}
            </span>
            <SourceBadge url={task.url} type={task.type} />
            <StatusBadge status={task.status} />
            {(task.retry_count ?? 0) > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.12)',
                borderRadius: 4, padding: '2px 6px',
              }}>
                {t('task.retryBadge', { count: task.retry_count })}
              </span>
            )}
            {task.start_at && new Date(task.start_at).getTime() > Date.now() && (
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: '#06b6d4',
                background: 'rgba(6,182,212,0.12)',
                borderRadius: 4, padding: '2px 6px',
              }}>
                ⏰ {new Date(task.start_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {(task.tags ?? []).map((tag) => (
              <span key={tag} style={{
                fontSize: 10, fontWeight: 600,
                color: '#a855f7',
                background: 'rgba(168,85,247,0.12)',
                borderRadius: 4, padding: '2px 6px',
              }}>
                #{tag}
              </span>
            ))}
          </div>
          <div
            title={task.url}
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {task.url}
          </div>
        </div>
      </div>

      {/* 进度条 */}
      {task.status !== 'queued' && (
        <div style={{ marginBottom: 6 }}>
          <ProgressBar done={task.done_bytes} total={task.total_bytes} status={task.status} />
        </div>
      )}

      {/* 进度信息行 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* 左：进度数据 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {task.status !== 'queued' && task.total_bytes > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{percent}</span>
              {'  '}
              <span style={{ color: 'var(--text-muted)' }}>
                {formatBytes(task.done_bytes)} / {formatBytes(task.total_bytes)}
              </span>
            </span>
          )}

          {task.status === 'downloading' && task.speed > 0 && (
            <>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--speed-color)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="8 17 12 21 16 17" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
                </svg>
                {formatSpeed(task.speed)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t('task.remaining', { time: formatETA(task.eta) })}
              </span>
            </>
          )}

          {/* BT 已自动切 uTP 徽章 */}
          {task.type === 'bt' && task.auto_utp_triggered && (
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(168,85,247,0.18)',
                color: '#a855f7',
                fontWeight: 600,
                letterSpacing: 0.3,
              }}
              title="速度偏慢，已自动切到 uTP-only 模式重连"
            >
              已切 uTP
            </span>
          )}

          {/* 慢速提示按钮 */}
          {task.type === 'bt' && task.status === 'downloading' && <SlowUTPHint task={task} />}

          {/* BT 类型：peer / seeder 统计 */}
          {task.type === 'bt' && task.status === 'downloading' && (task.peers_connected || task.peers_total || task.seeders) !== undefined && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontVariantNumeric: 'tabular-nums',
              }}
              title={`已连接 peer / 总发现 peer，其中 ${task.seeders ?? 0} 个种子`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{task.peers_connected ?? 0}</span>
              <span>/ {task.peers_total ?? 0}</span>
              {(task.seeders ?? 0) > 0 && (
                <span style={{ color: '#22c55e', marginLeft: 4, fontWeight: 600 }} title="种子数（拥有完整文件的 peer）">
                  ★ {task.seeders}
                </span>
              )}
            </span>
          )}

          {task.status === 'error' && task.error && (
            <span style={{ fontSize: 12, color: 'var(--error)' }} title={task.error}>
              {t('task.errorPrefix')}{task.error.substring(0, 60)}{task.error.length > 60 ? '...' : ''}
            </span>
          )}

          {task.status === 'queued' && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('task.waitingToStart')}</span>
          )}
        </div>

        {/* 右：操作按钮（hover 时显示） */}
        <motion.div
          initial={false}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}
        >
          {task.status === 'downloading' && (
            <ActionButton onClick={() => pauseTask(task.id)} title={t('task.pause')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              {t('task.pause')}
            </ActionButton>
          )}

          {task.status === 'paused' && (
            <ActionButton onClick={() => resumeTask(task.id)} title={t('task.resume')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {t('task.resume')}
            </ActionButton>
          )}

          {task.status === 'done' && !inTrash && (
            <>
              <ActionButton
                onClick={() => openInExplorer(task.save_path)}
                title={t('task.openFolder')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {t('task.openFolder')}
              </ActionButton>
              <ActionButton
                onClick={() => playInUnflick(`${task.save_path}/${task.filename}`)}
                title={t('task.playInUnflick')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('task.playInUnflick')}
              </ActionButton>
            </>
          )}

          {inTrash ? (
            <>
              <ActionButton
                onClick={() => restoreTask(task.id).catch(console.error)}
                title={t('task.restore')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                {t('task.restore')}
              </ActionButton>
              <ActionButton
                onClick={handleHardDelete}
                title={confirmHardDelete ? t('task.confirmDelete') : t('task.hardDelete')}
                danger
              >
                {confirmHardDelete ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {t('task.confirmDelete')}
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    {t('task.hardDelete')}
                  </>
                )}
              </ActionButton>
            </>
          ) : (
            <ActionButton
              onClick={() => trashTask(task.id).catch(console.error)}
              title={t('task.trash')}
              danger
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              {t('task.delete')}
            </ActionButton>
          )}
        </motion.div>
      </div>

      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          items={menuItems}
          onClose={() => setMenuPos(null)}
        />
      )}
    </motion.div>
  )
})
