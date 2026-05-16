import React, { useState, useMemo } from 'react'
import type { TorrentPreview } from '../types'
import { formatBytes } from '../lib/format'

interface Props {
  preview: TorrentPreview
  onConfirm: (selectedIndices: number[]) => void
  onCancel: () => void
  submitting?: boolean
}

export const TorrentFilePicker: React.FC<Props> = ({ preview, onConfirm, onCancel, submitting }) => {
  // 默认全选
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(preview.files.map((f) => f.index)),
  )
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return preview.files
    return preview.files.filter((f) => f.path.toLowerCase().includes(q))
  }, [preview.files, filter])

  const totalSelectedSize = useMemo(() => {
    return preview.files.reduce((sum, f) => (selected.has(f.index) ? sum + f.length : sum), 0)
  }, [preview.files, selected])

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(preview.files.map((f) => f.index)))
  const selectNone = () => setSelected(new Set())
  const selectVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((f) => next.add(f.index))
      return next
    })
  }
  const deselectVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      filtered.forEach((f) => next.delete(f.index))
      return next
    })
  }

  // 按文件扩展名分组统计
  const extStats = useMemo(() => {
    const m: Record<string, number> = {}
    for (const f of preview.files) {
      const ext = (f.path.split('.').pop() || '').toLowerCase()
      m[ext] = (m[ext] || 0) + 1
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [preview.files])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 头部信息 */}
      <div style={{ padding: '10px 12px', background: 'rgba(99,102,241,0.06)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, wordBreak: 'break-all' }}>
          {preview.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {preview.files.length} 文件 · 共 {formatBytes(preview.total_bytes)} · {selected.size} 已选 ({formatBytes(totalSelectedSize)})
        </div>
      </div>

      {/* 搜索 + 批量操作 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="搜索文件..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input-base"
          style={{ flex: 1, height: 30, fontSize: 12 }}
        />
        <button onClick={selectAll} className="btn btn-ghost" style={{ height: 30, fontSize: 11 }}>全选</button>
        <button onClick={selectNone} className="btn btn-ghost" style={{ height: 30, fontSize: 11 }}>清空</button>
        {filter && (
          <>
            <button onClick={selectVisible} className="btn btn-ghost" style={{ height: 30, fontSize: 11 }}>勾选匹配</button>
            <button onClick={deselectVisible} className="btn btn-ghost" style={{ height: 30, fontSize: 11 }}>取消匹配</button>
          </>
        )}
      </div>

      {/* 常见扩展名快速选择 */}
      {extStats.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', fontSize: 10 }}>
          <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>仅选：</span>
          {extStats.map(([ext, n]) => (
            <button
              key={ext}
              onClick={() => {
                setSelected(new Set(preview.files.filter((f) => f.path.toLowerCase().endsWith('.' + ext)).map((f) => f.index)))
              }}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-secondary)',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              .{ext || '(无)'} × {n}
            </button>
          ))}
        </div>
      )}

      {/* 文件列表 */}
      <div
        style={{
          maxHeight: 320,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.15)',
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: 24, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>无匹配</div>
        ) : (
          filtered.map((f) => {
            const isSel = selected.has(f.index)
            return (
              <label
                key={f.index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  background: isSel ? 'rgba(99,102,241,0.06)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isSel ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? 'rgba(99,102,241,0.06)' : 'transparent' }}
              >
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(f.index)}
                  style={{ flexShrink: 0, accentColor: 'var(--primary)' }}
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                  title={f.path}
                >
                  {f.path}
                </span>
                <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatBytes(f.length)}
                </span>
              </label>
            )
          })
        )}
      </div>

      {/* 底部按钮 */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
        <button className="btn btn-ghost" onClick={onCancel} disabled={submitting}>取消</button>
        <button
          className="btn btn-primary"
          onClick={() => onConfirm(Array.from(selected))}
          disabled={submitting || selected.size === 0}
          style={{ minWidth: 140, boxShadow: '0 0 16px rgba(99,102,241,0.35)' }}
        >
          {submitting ? '添加中...' : `开始下载 ${selected.size} 个文件`}
        </button>
      </div>
    </div>
  )
}
