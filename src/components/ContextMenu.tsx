import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  divider?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y, ready: false })

  // 调整位置，避免溢出屏幕
  useLayoutEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const ww = window.innerWidth
    const wh = window.innerHeight
    let nx = x
    let ny = y
    if (x + rect.width > ww) nx = Math.max(4, ww - rect.width - 4)
    if (y + rect.height > wh) ny = Math.max(4, wh - rect.height - 4)
    setPos({ x: nx, y: ny, ready: true })
  }, [x, y])

  // 点击外部 / Esc 关闭
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // 延迟一帧避免捕获到打开菜单时的鼠标事件
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleDown)
      document.addEventListener('contextmenu', handleDown)
    }, 0)
    document.addEventListener('keydown', handleEsc)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('contextmenu', handleDown)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.08)',
        padding: 4,
        minWidth: 180,
        zIndex: 9999,
        visibility: pos.ready ? 'visible' : 'hidden',
        backdropFilter: 'blur(12px)',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return (
            <div
              key={`d-${i}`}
              style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }}
            />
          )
        }
        return (
          <MenuButton
            key={i}
            item={item}
            onAfterClick={onClose}
          />
        )
      })}
    </div>
  )
}

const MenuButton: React.FC<{ item: MenuItem; onAfterClick: () => void }> = ({ item, onAfterClick }) => {
  const [hovered, setHovered] = useState(false)
  const danger = !!item.danger
  const disabled = !!item.disabled

  return (
    <button
      onClick={() => {
        if (disabled) return
        item.onClick?.()
        onAfterClick()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '7px 10px',
        background: hovered && !disabled
          ? danger
            ? 'rgba(239,68,68,0.1)'
            : 'rgba(99,102,241,0.1)'
          : 'transparent',
        border: 'none',
        color: disabled
          ? 'var(--text-muted)'
          : danger
          ? '#ef4444'
          : 'var(--text-primary)',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 5,
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.85 }}>
        {item.icon}
      </span>
      {item.label}
    </button>
  )
}
