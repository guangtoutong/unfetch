import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useTaskStore } from '../stores/taskStore'
import { TaskItem } from './TaskItem'

// 空状态图
const EmptyIllustration: React.FC = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="50" fill="rgba(99,102,241,0.06)" stroke="rgba(99,102,241,0.15)" strokeWidth="1.5" />
    {/* 云 */}
    <path
      d="M42 68a12 12 0 0 1 0-24c1.2 0 2.4.18 3.5.5A16 16 0 0 1 76 54a10 10 0 0 1 0 20H42z"
      fill="rgba(99,102,241,0.1)"
      stroke="rgba(99,102,241,0.3)"
      strokeWidth="1.5"
    />
    {/* 下载箭头 */}
    <line x1="60" y1="52" x2="60" y2="76" stroke="rgba(99,102,241,0.5)" strokeWidth="2" strokeLinecap="round" />
    <polyline points="52,68 60,76 68,68" stroke="rgba(99,102,241,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {/* 小点装饰 */}
    <circle cx="36" cy="44" r="2.5" fill="rgba(99,102,241,0.2)" />
    <circle cx="84" cy="40" r="3.5" fill="rgba(139,92,246,0.15)" />
    <circle cx="88" cy="78" r="2" fill="rgba(99,102,241,0.15)" />
  </svg>
)

export const TaskList: React.FC = () => {
  const filteredTasks = useTaskStore((s) => s.filteredTasks())
  const { isLoading, searchQuery, filter } = useTaskStore()
  const { t } = useTranslation()

  if (isLoading && filteredTasks.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: 'var(--text-muted)',
        }}
      >
        <LoadingSpinner />
        <span style={{ fontSize: 13 }}>...</span>
      </div>
    )
  }

  if (filteredTasks.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 40,
        }}
      >
        <EmptyIllustration />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {searchQuery ? t('empty.noMatch') : filter === 'trash' ? t('empty.trashEmpty') : t('empty.noTasks')}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {searchQuery
              ? t('empty.noMatchHint')
              : filter === 'trash'
              ? t('empty.trashEmptyHint')
              : t('empty.noTasksHint')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {filteredTasks.map((task) => (
          <TaskItem key={task.id} task={task} filter={filter} />
        ))}
      </AnimatePresence>

      {/* 底部留白 */}
      <motion.div style={{ height: 8, flexShrink: 0 }} />
    </div>
  )
}

const LoadingSpinner: React.FC = () => (
  <div
    style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: '2.5px solid rgba(99,102,241,0.15)',
      borderTopColor: 'var(--primary)',
      animation: 'spin 0.8s linear infinite',
    }}
  />
)

// 在 index.css 之外补一个 spin keyframe（内联注入，避免改 css 文件结构）
const injectSpinKeyframe = () => {
  if (typeof document === 'undefined') return
  const id = '__unfetch_spin'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }'
    document.head.appendChild(style)
  }
}
injectSpinKeyframe()
