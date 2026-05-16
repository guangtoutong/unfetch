import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n'

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage)
    || SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language?.split('-')[0])
    || SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    setTimeout(() => document.addEventListener('mousedown', close), 0)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const switchTo = (code: string) => {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }} data-tauri-drag-region="false">
      <button
        data-tauri-drag-region="false"
        onClick={() => setOpen(!open)}
        title="Language / 语言"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 28,
          padding: '0 8px',
          background: open ? 'rgba(99,102,241,0.15)' : 'transparent',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span style={{ fontSize: 11 }}>{current.nativeName}</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          data-tauri-drag-region="false"
          style={{
            position: 'absolute',
            top: 32,
            right: 0,
            minWidth: 160,
            maxHeight: 320,
            overflowY: 'auto',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            padding: 4,
            zIndex: 9999,
          }}
        >
          {SUPPORTED_LANGUAGES.map((l) => {
            const active = l.code === current.code
            return (
              <button
                key={l.code}
                data-tauri-drag-region="false"
                onClick={() => switchTo(l.code)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 5,
                  cursor: 'pointer',
                  fontSize: 12,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ fontWeight: active ? 600 : 400 }}>{l.nativeName}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.code}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
