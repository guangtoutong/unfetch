import React from 'react'
import type { SpeedScheduleEntry } from '../types'

interface Props {
  value: SpeedScheduleEntry[]
  onChange: (next: SpeedScheduleEntry[]) => void
}

const MB = 1024 * 1024

function formatLimit(bytes: number): string {
  if (bytes <= 0) return '不限'
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB/s`
  return `${(bytes / 1024).toFixed(0)} KB/s`
}

function parseLimit(text: string): number {
  const t = text.trim().toLowerCase()
  if (!t || t === '0' || t === '不限') return 0
  const m = /^([\d.]+)\s*(k|kb|kb\/s|m|mb|mb\/s|g|gb)?/i.exec(t)
  if (!m) return 0
  const n = parseFloat(m[1])
  const unit = (m[2] || '').toLowerCase()
  if (unit.startsWith('m')) return Math.floor(n * MB)
  if (unit.startsWith('g')) return Math.floor(n * MB * 1024)
  if (unit.startsWith('k')) return Math.floor(n * 1024)
  return Math.floor(n)
}

export const SpeedScheduleEditor: React.FC<Props> = ({ value, onChange }) => {
  const entries = value || []

  const addEntry = () => {
    onChange([...entries, { start_hour: 0, end_hour: 8, limit: 0 }])
  }

  const updateEntry = (i: number, patch: Partial<SpeedScheduleEntry>) => {
    const next = entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e))
    onChange(next)
  }

  const removeEntry = (i: number) => {
    onChange(entries.filter((_, idx) => idx !== i))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {entries.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 0' }}>
          暂无时段。点下方"添加"为不同时段设置限速。例如夜晚 22:00–08:00 不限速，白天限 1MB/s。
        </div>
      )}

      {entries.map((e, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            padding: '6px 8px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <HourSelect value={e.start_hour} onChange={(v) => updateEntry(i, { start_hour: v })} />
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
          <HourSelect value={e.end_hour} onChange={(v) => updateEntry(i, { end_hour: v })} />

          <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />

          <input
            type="text"
            value={formatLimit(e.limit)}
            onChange={(ev) => updateEntry(i, { limit: parseLimit(ev.target.value) })}
            placeholder="不限 / 1 MB/s"
            style={{
              flex: 1,
              minWidth: 0,
              height: 26,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-primary)',
              fontSize: 11,
              padding: '0 7px',
              fontFamily: 'monospace',
            }}
          />

          <button
            onClick={() => removeEntry(i)}
            title="删除"
            style={{
              width: 24,
              height: 24,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.04)',
              color: '#ef4444',
              borderRadius: 5,
              cursor: 'pointer',
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={addEntry}
        style={{
          height: 28,
          border: '1px dashed var(--border-strong)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        + 添加时段
      </button>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        优先级高于"全局限速"。当前小时不命中任何时段时，使用全局限速。<br />
        跨夜：将 起始时 设大于 结束时（如 22:00 — 8:00）。
      </div>
    </div>
  )
}

const HourSelect: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    style={{
      height: 26,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 5,
      color: 'var(--text-primary)',
      fontSize: 11,
      padding: '0 4px',
      fontFamily: 'monospace',
    }}
  >
    {Array.from({ length: 25 }, (_, h) => (
      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
    ))}
  </select>
)
