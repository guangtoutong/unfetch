import React, { useState } from 'react'
import { useTaskStore } from '../stores/taskStore'
import type { FilterType } from '../types'

interface ToolbarProps {
  onAdd: () => void
}

const filterLabels: Record<FilterType, string> = {
  all: '全部任务',
  downloading: '下载中（含已暂停 / 等待）',
  paused: '已暂停',
  done: '已完成',
  error: '失败任务',
  queued: '等待中',
  trash: '垃圾箱',
}

export const Toolbar: React.FC<ToolbarProps> = ({ onAdd }) => {
  const { filter, searchQuery, setSearchQuery, counts, tasks, emptyTrash, restoreAllTrashed, pauseAll, resumeAll } = useTaskStore()
  const [searchFocused, setSearchFocused] = useState(false)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const trashCount = counts().trash
  const inTrash = filter === 'trash'
  const showBulk = filter === 'downloading' || filter === 'all'

  // 可暂停/可继续的数量
  const pausableCount = tasks.filter((t) => !t.trashed && (t.status === 'downloading' || t.status === 'queued')).length
  const resumableCount = tasks.filter((t) => !t.trashed && (t.status === 'paused' || t.status === 'error')).length

  const handleEmpty = () => {
    if (confirmEmpty) {
      emptyTrash().catch(console.error)
      setConfirmEmpty(false)
    } else {
      setConfirmEmpty(true)
      setTimeout(() => setConfirmEmpty(false), 3000)
    }
  }

  return (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(7,7,16,0.6)',
        flexShrink: 0,
        gap: 12,
      }}
    >
      {/* 标题 */}
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          flexShrink: 0,
        }}
      >
        {filterLabels[filter]}
      </h2>

      {/* 搜索框 */}
      <div style={{ flex: 1, maxWidth: 280, position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: searchFocused ? 'var(--primary)' : 'var(--text-muted)',
            pointerEvents: 'none',
            transition: 'color 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="搜索任务..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: '100%',
            height: 34,
            background: searchFocused
              ? 'rgba(99,102,241,0.08)'
              : 'rgba(255,255,255,0.04)',
            border: `1px solid ${searchFocused ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 13,
            padding: '0 10px 0 32px',
            outline: 'none',
            transition: 'all 0.2s',
            boxShadow: searchFocused ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* 右侧按钮：垃圾箱视图显示批量操作，其他视图显示添加任务 */}
      {inTrash ? (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <BulkButton
            onClick={() => restoreAllTrashed().catch(console.error)}
            disabled={trashCount === 0}
            title="将所有垃圾桶任务恢复"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            全部恢复{trashCount > 0 ? ` (${trashCount})` : ''}
          </BulkButton>
          <BulkButton
            onClick={handleEmpty}
            disabled={trashCount === 0}
            danger
            title={confirmEmpty ? '再次点击彻底删除所有任务及文件' : '清空垃圾箱（彻底删除所有任务及文件）'}
          >
            {confirmEmpty ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                确认清空
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                清空垃圾箱
              </>
            )}
          </BulkButton>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {showBulk && (
            <>
              <BulkButton
                onClick={() => resumeAll().catch(console.error)}
                disabled={resumableCount === 0}
                title="继续所有暂停/失败的任务"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                全部开始{resumableCount > 0 ? ` (${resumableCount})` : ''}
              </BulkButton>
              <BulkButton
                onClick={() => pauseAll().catch(console.error)}
                disabled={pausableCount === 0}
                title="暂停所有正在下载/队列中的任务"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                全部暂停{pausableCount > 0 ? ` (${pausableCount})` : ''}
              </BulkButton>
              <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
            </>
          )}
          <AddButton onClick={onAdd} />
        </div>
      )}
    </div>
  )
}

const BulkButton: React.FC<{
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  title?: string
  children: React.ReactNode
}> = ({ onClick, disabled, danger, title, children }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 14px',
        height: 34,
        border: `1px solid ${
          disabled
            ? 'var(--border)'
            : danger && hovered
            ? 'rgba(239,68,68,0.4)'
            : hovered
            ? 'var(--border-strong)'
            : 'var(--border)'
        }`,
        borderRadius: 8,
        background: disabled
          ? 'rgba(255,255,255,0.02)'
          : danger && hovered
          ? 'rgba(239,68,68,0.12)'
          : hovered
          ? 'rgba(99,102,241,0.1)'
          : 'rgba(255,255,255,0.04)',
        color: disabled
          ? 'var(--text-muted)'
          : danger && hovered
          ? '#ef4444'
          : danger
          ? '#ef4444'
          : 'var(--text-primary)',
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

const AddButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 16px',
        height: 34,
        background: hovered
          ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
          : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        border: 'none',
        borderRadius: 8,
        color: 'white',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: hovered ? '0 0 20px rgba(99,102,241,0.5)' : '0 0 12px rgba(99,102,241,0.3)',
        flexShrink: 0,
        letterSpacing: '0.02em',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      添加任务
    </button>
  )
}
