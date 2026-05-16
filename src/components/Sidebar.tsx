import React from 'react'
import { useTranslation } from 'react-i18next'
import { useTaskStore } from '../stores/taskStore'
import type { FilterType } from '../types'

interface FilterItem {
  key: FilterType
  label: string
  icon: React.ReactNode
  pulse?: boolean
}

const filterItems: FilterItem[] = [
  {
    key: 'all',
    label: 'sidebar.all',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: 'downloading',
    label: 'sidebar.downloading',
    pulse: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="8 17 12 21 16 17" />
        <line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
      </svg>
    ),
  },
  {
    key: 'done',
    label: 'sidebar.done',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    key: 'error',
    label: 'sidebar.error',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    key: 'trash',
    label: 'sidebar.trash',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    ),
  },
]

const statusColors: Record<FilterType, string> = {
  all: 'var(--primary)',
  downloading: 'var(--success)',
  paused: 'var(--warning)',
  done: '#22c55e',
  error: 'var(--error)',
  queued: 'var(--text-secondary)',
  trash: 'var(--text-secondary)',
}

export const Sidebar: React.FC = () => {
  const { filter, setFilter, counts, tasks } = useTaskStore()
  const { t } = useTranslation()
  const taskCounts = counts()
  const activelyDownloading = tasks.some(
    (tk) => !tk.trashed && tk.status === 'downloading',
  )

  const getCount = (key: FilterType): number => {
    return taskCounts[key as keyof typeof taskCounts] ?? 0
  }

  return (
    <div
      style={{
        width: 180,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 8px',
        gap: 2,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '4px 8px 8px',
        }}
      >
        {t('sidebar.section')}
      </div>

      {filterItems.map((item) => {
        const active = filter === item.key
        const count = getCount(item.key)
        const color = statusColors[item.key]

        return (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: active
                ? `rgba(${colorToRgb(color)}, 0.12)`
                : 'transparent',
              color: active ? color : 'var(--text-secondary)',
              transition: 'all 0.15s',
              width: '100%',
              textAlign: 'left',
              position: 'relative',
              boxShadow: active ? `inset 0 0 0 1px rgba(${colorToRgb(color)}, 0.2)` : 'none',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                ;(e.currentTarget as HTMLButtonElement).style.background =
                  'rgba(99,102,241,0.07)'
                ;(e.currentTarget as HTMLButtonElement).style.color =
                  'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                ;(e.currentTarget as HTMLButtonElement).style.background =
                  'transparent'
                ;(e.currentTarget as HTMLButtonElement).style.color =
                  'var(--text-secondary)'
              }
            }}
          >
            {/* 图标 */}
            <span style={{ flexShrink: 0 }}>{item.icon}</span>

            {/* 标签 */}
            <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 400 }}>
              {t(item.label)}
            </span>

            {/* 脉冲动画：只在有任务真在下载时才跳 */}
            {item.pulse && activelyDownloading && (
              <PulseDot color={color} />
            )}

            {/* 数量徽章 */}
            {count > 0 && (
              <span
                style={{
                  background: active
                    ? `rgba(${colorToRgb(color)}, 0.2)`
                    : 'rgba(255,255,255,0.06)',
                  color: active ? color : 'var(--text-muted)',
                  borderRadius: 10,
                  padding: '1px 7px',
                  fontSize: 11,
                  fontWeight: 600,
                  minWidth: 20,
                  textAlign: 'center',
                }}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}

      {/* 底部版本信息 */}
      <div style={{ marginTop: 'auto', padding: '8px 10px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          unfetch v0.1
        </div>
      </div>
    </div>
  )
}

const PulseDot: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      position: 'relative',
      width: 8,
      height: 8,
      flexShrink: 0,
    }}
  >
    {/* 脉冲环 */}
    <span
      style={{
        position: 'absolute',
        inset: -2,
        borderRadius: '50%',
        background: color,
        opacity: 0.3,
        animation: 'pulse-ring 1.5s ease-out infinite',
      }}
    />
    {/* 实心点 */}
    <span
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: color,
        animation: 'pulse-dot 1.5s ease-in-out infinite',
      }}
    />
  </span>
)

/** 把 CSS 变量颜色转 rgb 数值 (简单映射) */
function colorToRgb(color: string): string {
  const map: Record<string, string> = {
    'var(--primary)': '99,102,241',
    'var(--success)': '34,197,94',
    'var(--warning)': '245,158,11',
    '#22c55e': '34,197,94',
    'var(--error)': '239,68,68',
  }
  return map[color] ?? '99,102,241'
}
