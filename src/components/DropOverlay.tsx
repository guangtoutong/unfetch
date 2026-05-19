import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useTaskStore } from '../stores/taskStore'

type DragState = 'idle' | 'over'

export const DropOverlay: React.FC = () => {
  const [state, setState] = useState<DragState>('idle')
  const [count, setCount] = useState(0)
  const { addTask } = useTaskStore()
  const { t } = useTranslation()

  useEffect(() => {
    let unlistenPromise: any
    ;(async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        unlistenPromise = win.onDragDropEvent(async (event: any) => {
          const t = event.payload?.type
          if (t === 'over' || t === 'enter') {
            const paths: string[] = event.payload?.paths || []
            setCount(paths.length)
            setState('over')
          } else if (t === 'leave' || t === 'cancel') {
            setState('idle')
          } else if (t === 'drop') {
            const paths: string[] = event.payload?.paths || []
            setState('idle')
            for (const p of paths) {
              const lower = p.toLowerCase()
              let url: string | null = null
              if (lower.endsWith('.torrent')) {
                url = 'file:///' + p.replace(/\\/g, '/')
              } else if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('magnet:')) {
                url = p
              }
              if (url) {
                try { await addTask({ url }) } catch (e) { console.error('drop add task failed', e) }
              }
            }
          }
        })
      } catch (e) {
        // 非 Tauri 环境忽略
      }
    })()
    return () => {
      if (unlistenPromise) unlistenPromise.then((fn: any) => typeof fn === 'function' && fn()).catch(() => {})
    }
  }, [])

  return (
    <AnimatePresence>
      {state === 'over' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(99,102,241,0.18)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 400,
            pointerEvents: 'none',
            border: '3px dashed rgba(139,92,246,0.6)',
            borderRadius: 12,
          }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            style={{
              background: 'color-mix(in srgb, var(--bg-base) 88%, transparent)',
              border: '1px solid rgba(139,92,246,0.5)',
              borderRadius: 16,
              padding: '24px 36px',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#dropg)" strokeWidth="2" style={{ marginBottom: 10 }}>
              <defs>
                <linearGradient id="dropg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <polyline points="8 17 12 21 16 17" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
            </svg>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 4 }}>
              {t('drop.release')}
            </div>
            <div style={{ fontSize: 12, color: '#a3a3b8' }}>
              {count > 0 ? `${count}` : t('drop.supports')}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
