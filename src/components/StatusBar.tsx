import React, { useEffect, useRef, useState } from 'react'
import { useTaskStore } from '../stores/taskStore'
import { formatSpeed } from '../lib/format'

const HISTORY_LEN = 60 // 最近 60 个采样点

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const w = 80
  const h = 18
  const max = Math.max(1, ...data)
  const step = w / (HISTORY_LEN - 1)
  const points = data
    .map((v, i) => {
      const x = (i + (HISTORY_LEN - data.length)) * step
      const y = h - (v / max) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

export const StatusBar: React.FC = () => {
  const { tasks, isConnected } = useTaskStore()

  const downloading = tasks.filter((t) => t.status === 'downloading')
  const done = tasks.filter((t) => t.status === 'done')
  const totalSpeed = downloading.reduce((acc, t) => acc + t.speed, 0)

  const [history, setHistory] = useState<number[]>([])
  const speedRef = useRef(totalSpeed)
  speedRef.current = totalSpeed
  useEffect(() => {
    const id = window.setInterval(() => {
      setHistory((prev) => {
        const next = [...prev, speedRef.current]
        if (next.length > HISTORY_LEN) next.shift()
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      style={{
        height: 32,
        // 跟主题走,同 TitleBar
        background: 'var(--bg-sidebar)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        fontSize: 11,
        color: 'var(--text-muted)',
      }}
    >
      {/* 左：连接状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isConnected ? 'var(--success)' : 'var(--error)',
            animation: isConnected ? 'none' : 'blink 1.2s infinite',
            flexShrink: 0,
          }}
        />
        <span style={{ color: isConnected ? 'var(--text-muted)' : '#ef4444' }}>
          {isConnected ? 'Daemon 已连接' : 'Daemon 未连接'}
        </span>
        <span style={{ color: 'var(--border-strong)', margin: '0 4px' }}>·</span>
        <span>127.0.0.1:19543</span>
      </div>

      {/* 中：下载速度 + sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {totalSpeed > 0 ? (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--speed-color)" strokeWidth="2.5">
              <polyline points="8 17 12 21 16 17" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
            </svg>
            <span style={{ color: 'var(--speed-color)', fontWeight: 700 }}>
              {formatSpeed(totalSpeed)}
            </span>
          </>
        ) : (
          <span>空闲</span>
        )}
        <Sparkline data={history} color="var(--speed-color)" />
      </div>

      {/* 右：任务统计 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {downloading.length > 0 && (
          <span style={{ color: 'var(--success)' }}>
            ↓ {downloading.length} 个下载中
          </span>
        )}
        {done.length > 0 && (
          <span>
            <span style={{ color: 'var(--primary)' }}>✓</span> {done.length} 个已完成
          </span>
        )}
        {tasks.length === 0 && <span>无任务</span>}
      </div>
    </div>
  )
}
