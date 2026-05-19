import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../stores/settingsStore'
import { LanguageSwitcher } from './LanguageSwitcher'

// Tauri 2 窗口控制（如果不在 Tauri 环境中，则忽略）
async function tauriClose() {
  try {
    // 直接调 Rust 命令，绕开 Tauri 的 CloseRequested 事件系统（自定义无边框窗口下不可靠）
    const { invoke } = await import('@tauri-apps/api/core')
    // 如果设置了"最小化到托盘"，由 Rust 端决定不退；否则关 daemon + 退 app
    const flags = await invoke<{ minimize_to_tray: boolean }>('get_runtime_flags').catch(() => null)
    if (flags?.minimize_to_tray) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().hide()
      return
    }
    await invoke('close_app').catch(() => {})
  } catch {}
}
async function tauriMinimize() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().minimize()
  } catch {}
}
async function tauriToggleMaximize() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().toggleMaximize()
  } catch {}
}
async function showMiniMode() {
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const mini = await WebviewWindow.getByLabel('mini')
    if (mini) {
      await mini.show()
      await mini.setFocus()
    }
    const main = await WebviewWindow.getByLabel('main')
    if (main) await main.hide()
  } catch {}
}

export const TitleBar: React.FC = () => {
  const { setOpen } = useSettingsStore()
  const { t } = useTranslation()

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 40,
        // 跟随主题:深色主题用 sidebar(比 base 略浅或略深,看主题定义),浅色用纯白侧栏 token
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 0 16px',
        flexShrink: 0,
        userSelect: 'none',
        WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'],
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'],
        }}
      >
        {/* U + fetch logo */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="u-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="arr-grad" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          {/* U 形（双层壁） */}
          <path
            d="M3 3 L3 13.5 Q3 19 12 19 Q21 19 21 13.5 L21 3 L17 3 L17 13.2 Q17 15.5 12 15.5 Q7 15.5 7 13.2 L7 3 Z"
            fill="url(#u-grad)"
          />
          {/* 实心粗箭头 */}
          <path d="M10 4 L14 4 L14 10.5 L17 10.5 L12 16 L7 10.5 L10 10.5 Z" fill="url(#arr-grad)" />
        </svg>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.3px',
          }}
        >
          unfetch
        </span>
      </div>

      {/* 右侧按钮 — 显式标记非拖拽区，否则 Tauri 2 会把点击当成拖动 */}
      <div
        data-tauri-drag-region="false"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
        }}
      >
        {/* 语言切换 */}
        <LanguageSwitcher />

        {/* 设置 */}
        <TitleBarBtn
          onClick={() => setOpen(true)}
          title={t('titlebar.settings')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </TitleBarBtn>

        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

        {/* 迷你模式 */}
        <TitleBarBtn onClick={showMiniMode} title={t('titlebar.miniMode')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <rect x="14" y="14" width="6" height="6" rx="1" fill="currentColor" />
          </svg>
        </TitleBarBtn>

        {/* 最小化 */}
        <TitleBarBtn onClick={tauriMinimize} title={t('titlebar.minimize')} hoverColor="var(--surface-hover)">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="5.5" width="10" height="1" fill="currentColor" rx="0.5" />
          </svg>
        </TitleBarBtn>

        {/* 最大化 */}
        <TitleBarBtn onClick={tauriToggleMaximize} title={t('titlebar.maximize')} hoverColor="var(--surface-hover)">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1.2" rx="1" />
          </svg>
        </TitleBarBtn>

        {/* 关闭 */}
        <TitleBarBtn onClick={tauriClose} title={t('titlebar.close')} hoverColor="rgba(239,68,68,0.85)" hoverTextColor="white">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </TitleBarBtn>
      </div>
    </div>
  )
}

interface TitleBarBtnProps {
  onClick: () => void
  title: string
  children: React.ReactNode
  hoverColor?: string
  hoverTextColor?: string
}

const TitleBarBtn: React.FC<TitleBarBtnProps> = ({
  onClick,
  title,
  children,
  hoverColor = 'var(--surface-hover)',
  hoverTextColor,
}) => {
  const [hovered, setHovered] = React.useState(false)

  return (
    <button
      data-tauri-drag-region="false"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? hoverColor : 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: hovered && hoverTextColor ? hoverTextColor : 'var(--text-secondary)',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  )
}
