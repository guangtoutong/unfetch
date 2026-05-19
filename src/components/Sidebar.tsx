import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTaskStore } from '../stores/taskStore'
import type { FilterType } from '../types'
import { loadAds, openExternal, type AdItem } from '../lib/ads'

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

      {/* 中间撑开 */}
      <div style={{ flex: 1 }} />

      {/* 紧凑广告条(原底部 AdBanner 移到这里,小一点不抢屏)
          MAS 构建跳过这一节,避免 Apple 政策摩擦 — 仅留下方官网链接 */}
      {!__APP_STORE_BUILD__ && <SidebarAds />}

      {/* 底部版本信息 + 官网链接(两个构建版本都显示,作为"About"入口) */}
      <div style={{ padding: '10px 10px 4px', textAlign: 'center' }}>
        <a
          href="https://unfetch.org"
          target="_blank"
          rel="noopener"
          onClick={(e) => {
            e.preventDefault()
            openExternal('https://unfetch.org').catch(console.error)
          }}
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--primary)',
            textDecoration: 'none',
            padding: '2px 6px',
            borderRadius: 4,
            marginBottom: 6,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-hover)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
          }}
        >
          → unfetch.org
        </a>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          unfetch v{__APP_VERSION__}
          <br />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7 }}>MIT License</span>
        </div>
      </div>
    </div>
  )
}

// 侧栏底部的紧凑广告组件 — 替代之前抢屏的底部 AdBanner。
// 单次会话可点 ✕ 隐藏(localStorage 不持久,关闭再开还会显示)。
const SidebarAds: React.FC = () => {
  const [ads, setAds] = useState<AdItem[]>([])
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('unfetch.ads.hide') === '1')

  useEffect(() => {
    if (dismissed) return
    loadAds().then(setAds).catch(() => {})
  }, [dismissed])

  if (dismissed || ads.length === 0) return null

  const dismiss = () => {
    sessionStorage.setItem('unfetch.ads.hide', '1')
    setDismissed(true)
  }

  return (
    <div style={{ padding: '8px 6px 0', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
      <button
        onClick={dismiss}
        title="隐藏(本次会话)"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 18,
          height: 18,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          opacity: 0.6,
          transition: 'opacity 0.15s, background 0.15s',
          zIndex: 1,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '1'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }}
      >
        ✕
      </button>
      {ads.map((ad) => (
        <CompactAdCard key={ad.url} ad={ad} />
      ))}
    </div>
  )
}

const CompactAdCard: React.FC<{ ad: AdItem }> = ({ ad }) => {
  const [hovered, setHovered] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = !!ad.logoUrl && !imgFailed
  return (
    <button
      onClick={() => openExternal(ad.url).catch(console.error)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${ad.name} — ${ad.description}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 8px',
        background: hovered ? 'var(--surface-hover)' : 'transparent',
        border: `1px solid ${hovered ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: showImg ? 'transparent' : (ad.logoColor || 'var(--primary)'),
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 11,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {showImg ? (
          <img src={ad.logoUrl} alt={ad.name} onError={() => setImgFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          ad.logoLetter || ad.name[0]
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ad.name}
        </div>
      </div>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.6 }}>
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </button>
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
