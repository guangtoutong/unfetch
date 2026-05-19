import React, { useEffect } from 'react'
import { useTaskStore } from './stores/taskStore'
import { formatSpeed } from './lib/format'

// 迷你悬浮窗：320×64 永远置顶
export const MiniApp: React.FC = () => {
  const { tasks, startPolling, stopPolling } = useTaskStore()

  useEffect(() => {
    startPolling()
    return () => { stopPolling() }
  }, [])

  const active = tasks.filter((t) => !t.trashed && t.status === 'downloading')
  const totalSpeed = active.reduce((sum, t) => sum + (t.speed || 0), 0)
  const totalDone = tasks.filter((t) => !t.trashed && t.status === 'done').length
  const totalAll = tasks.filter((t) => !t.trashed).length
  const overallPct = totalAll === 0 ? 0 : Math.round((totalDone / totalAll) * 100)

  const onShowMain = async () => {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const main = await WebviewWindow.getByLabel('main')
      if (main) {
        await main.show()
        await main.unminimize()
        await main.setFocus()
      }
      const mini = await WebviewWindow.getByLabel('mini')
      if (mini) await mini.hide()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={onShowMain}
      style={{
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-elevated)',
        backdropFilter: 'blur(20px)',
        borderRadius: 12,
        border: '1px solid var(--border-strong)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: 12,
        cursor: 'grab',
        userSelect: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(139,92,246,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="mini-u" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="mini-a" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <path
            d="M3 3 L3 13.5 Q3 19 12 19 Q21 19 21 13.5 L21 3 L17 3 L17 13.2 Q17 15.5 12 15.5 Q7 15.5 7 13.2 L7 3 Z"
            fill="url(#mini-u)"
          />
          <path d="M10 4 L14 4 L14 10.5 L17 10.5 L12 16 L7 10.5 L10 10.5 Z" fill="url(#mini-a)" />
        </svg>
      </div>

      {/* 速度 + 任务计数 */}
      <div style={{ flex: 1, minWidth: 0 }} onDoubleClick={onShowMain}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: active.length > 0 ? '#10b981' : '#94a3b8',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {active.length > 0 ? formatSpeed(totalSpeed) : '空闲'}
          </span>
          {active.length > 0 && <span style={{ fontSize: 10, color: '#94a3b8' }}>·  {active.length} 个下载中</span>}
        </div>
        <div
          style={{
            height: 4,
            background: 'rgba(99,102,241,0.15)',
            borderRadius: 2,
            overflow: 'hidden',
            marginTop: 6,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${overallPct}%`,
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>

      {/* 展开按钮 */}
      <button
        onClick={onShowMain}
        title="返回主窗口"
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)',
          color: '#94a3b8',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94a3b8' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>
    </div>
  )
}
