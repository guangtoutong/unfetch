import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listenClipboardUrls } from '../lib/systemIntegration'
import { useTaskStore } from '../stores/taskStore'

interface Pending {
  url: string
  ts: number
}

export const ClipboardPrompt: React.FC = () => {
  const [pending, setPending] = useState<Pending | null>(null)
  const { addTask } = useTaskStore()

  useEffect(() => {
    let unlisten: (() => void) | null = null
    listenClipboardUrls((url) => {
      setPending({ url, ts: Date.now() })
    }).then((u) => { unlisten = u })

    return () => { unlisten?.() }
  }, [])

  // 8 秒自动消失
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setPending(null), 8000)
    return () => clearTimeout(t)
  }, [pending])

  const onAccept = async () => {
    if (!pending) return
    try {
      await addTask({ url: pending.url })
    } catch (e) {
      console.error('剪贴板任务失败', e)
    }
    setPending(null)
  }

  const onDismiss = () => setPending(null)

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 56,
            zIndex: 300,
            width: 340,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.08)',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
              <rect x="9" y="2" width="6" height="4" rx="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              检测到下载链接
            </span>
          </div>

          <div
            title={pending.url}
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '6px 8px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontFamily: 'monospace',
            }}
          >
            {pending.url}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={onAccept}
              style={{
                flex: 1,
                height: 30,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              立即下载
            </button>
            <button
              onClick={onDismiss}
              style={{
                width: 80,
                height: 30,
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              忽略
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
