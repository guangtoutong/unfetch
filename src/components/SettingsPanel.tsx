import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '../stores/settingsStore'
import {
  getAutostart,
  setAutostart,
  getRuntimeFlags,
  setClipboardSniff,
  setMinimizeToTray,
} from '../lib/systemIntegration'
import { SpeedScheduleEditor } from './SpeedScheduleEditor'

export const SettingsPanel: React.FC = () => {
  const { isOpen, setOpen, config, updateConfig } = useSettingsStore()
  const [detectedProxy, setDetectedProxy] = useState<string>('')
  const [autostart, setAuto] = useState<boolean>(false)
  const [clipSniff, setClipSniff] = useState<boolean>(true)
  const [minToTray, setMinToTray] = useState<boolean>(true)

  useEffect(() => {
    if (!isOpen) return
    fetch('http://127.0.0.1:19543/system-proxy')
      .then(r => r.json())
      .then(d => setDetectedProxy(d.proxy || ''))
      .catch(() => setDetectedProxy(''))
    getAutostart().then(setAuto).catch(() => {})
    getRuntimeFlags().then((f) => {
      setClipSniff(f.clipboard_sniff_enabled)
      setMinToTray(f.minimize_to_tray)
    }).catch(() => {})
  }, [isOpen])

  const onToggleAutostart = async (v: boolean) => {
    setAuto(v)
    try { await setAutostart(v) } catch { setAuto(!v) }
  }
  const onToggleClipSniff = async (v: boolean) => {
    setClipSniff(v)
    try { await setClipboardSniff(v) } catch { setClipSniff(!v) }
  }
  const onToggleMinTray = async (v: boolean) => {
    setMinToTray(v)
    try { await setMinimizeToTray(v) } catch { setMinToTray(!v) }
  }

  const handleSelectDir = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const dir = await invoke<string>('select_directory')
      if (dir) await updateConfig({ download_dir: dir })
    } catch {
      // 非 Tauri 环境
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 200,
            }}
          />

          {/* 抽屉 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 360,
              height: '100vh',
              background: 'var(--bg-elevated)',
              borderLeft: '1px solid var(--border-strong)',
              zIndex: 201,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* 顶部渐变条 */}
            <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />

            {/* 头部 */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>偏好设置</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* 设置内容 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* 下载目录 */}
              <Section title="下载目录" icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              }>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={config.download_dir}
                    onChange={(e) => updateConfig({ download_dir: e.target.value })}
                    placeholder="/Users/username/Downloads"
                    className="input-base"
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-ghost" onClick={handleSelectDir} style={{ flexShrink: 0, height: 38 }}>
                    浏览
                  </button>
                </div>
              </Section>

              <Divider />

              {/* 并发与线程 */}
              <Section title="下载并发" icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>最大并发任务数</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{config.max_concurrent}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={config.max_concurrent}
                      onChange={(e) => updateConfig({ max_concurrent: Number(e.target.value) })}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      <span>1 个</span>
                      <span>20 个</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>HTTP 下载线程数</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{config.http_threads}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={32}
                      value={config.http_threads}
                      onChange={(e) => updateConfig({ http_threads: Number(e.target.value) })}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      <span>1</span>
                      <span>32</span>
                    </div>
                  </div>
                </div>
              </Section>

              <Divider />

              {/* 速度限制 */}
              <Section title="速度限制" icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      全局速度限制
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: config.speed_limit > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {config.speed_limit > 0 ? `${(config.speed_limit / 1024).toFixed(0)} KB/s` : '不限速'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10485760}
                    step={131072}
                    value={config.speed_limit}
                    onChange={(e) => updateConfig({ speed_limit: Number(e.target.value) })}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    <span>不限速</span>
                    <span>10 MB/s</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    分时段限速
                  </div>
                  <SpeedScheduleEditor
                    value={config.speed_schedule || []}
                    onChange={(next) => updateConfig({ speed_schedule: next })}
                  />
                </div>
              </Section>

              <Divider />

              {/* 代理 */}
              <Section title="网络代理" icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              }>
                {/* 系统代理开关 */}
                <ToggleRow
                  label="使用系统代理"
                  description={
                    detectedProxy
                      ? `检测到：${detectedProxy}`
                      : '未检测到系统代理设置'
                  }
                  checked={config.use_system_proxy}
                  onChange={(v) => updateConfig({ use_system_proxy: v })}
                />

                {/* 检测到系统代理时显示状态徽章 */}
                {detectedProxy && config.use_system_proxy && (
                  <div style={{
                    marginTop: 8,
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'monospace' }}>
                      {detectedProxy}
                    </span>
                  </div>
                )}

                {/* 手动代理（优先级更高） */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    手动指定（覆盖系统代理）
                  </div>
                  <input
                    type="text"
                    value={config.proxy || ''}
                    onChange={(e) => updateConfig({ proxy: e.target.value })}
                    placeholder="http://127.0.0.1:7890"
                    className="input-base"
                  />
                </div>
              </Section>

              <Divider />

              {/* 自动播放 */}
              <Section title="播放器集成" icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              }>
                <ToggleRow
                  label="下载完成后自动用 Unflick 播放"
                  description="仅对视频/音频类任务生效"
                  checked={config.auto_play_unflick}
                  onChange={(v) => updateConfig({ auto_play_unflick: v })}
                />
              </Section>

              <Divider />

              {/* 重试 & 完成动作 */}
              <Section title="自动重试 & 完成后" icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              }>
                <ToggleRow
                  label="任务失败自动重试"
                  description="按 1m / 3m / 10m 间隔重试，最多 3 次"
                  checked={!!config.auto_retry}
                  onChange={(v) => updateConfig({ auto_retry: v })}
                />
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>所有任务完成后动作</div>
                  <select
                    value={config.on_all_done || ''}
                    onChange={(e) => updateConfig({ on_all_done: e.target.value as any })}
                    style={{
                      width: '100%',
                      height: 30,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      padding: '0 8px',
                    }}
                  >
                    <option value="">不做任何事</option>
                    <option value="notify">弹通知</option>
                    <option value="open_dir">打开下载目录</option>
                    <option value="sleep">休眠</option>
                    <option value="shutdown">关机（30 秒后执行）</option>
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    执行一次后自动重置为"不做任何事"
                  </div>
                </div>
              </Section>

              <Divider />

              {/* 系统集成 */}
              <Section title="启动 & 系统集成" icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <circle cx="12" cy="16" r="1" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }>
                <ToggleRow
                  label="开机自动启动"
                  description="登录系统后在后台静默启动"
                  checked={autostart}
                  onChange={onToggleAutostart}
                />
                <ToggleRow
                  label="关闭窗口时最小化到托盘"
                  description="关闭主窗口后任务继续在后台下载"
                  checked={minToTray}
                  onChange={onToggleMinTray}
                />
                <ToggleRow
                  label="剪贴板嗅探"
                  description="复制 URL/magnet 链接后弹出快速下载提示"
                  checked={clipSniff}
                  onChange={onToggleClipSniff}
                />
              </Section>

              <Divider />

              <Section title="BT 优化" icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              }>
                <ToggleRow
                  label="强制 uTP 模式（关闭 TCP）"
                  description="部分 ISP 屏蔽 BT 的 TCP 端口；切换到 uTP (UDP) 后可能恢复连接，但同时会限制部分 peer 来源"
                  checked={!!config.bt_force_utp}
                  onChange={(v) => updateConfig({ bt_force_utp: v })}
                />
                <ToggleRow
                  label="自动 uTP fallback"
                  description="BT 任务启动 30 秒内速度低于 100 KB/s 时，自动切到 uTP-only 重连一次。无需用户介入，适合国内 ISP 屏蔽场景"
                  checked={!!config.bt_auto_utp_fallback}
                  onChange={(v) => updateConfig({ bt_auto_utp_fallback: v })}
                />
              </Section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// 辅助组件

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
      <span style={{ color: 'var(--primary)' }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {title}
      </span>
    </div>
    {children}
  </div>
)

const Divider: React.FC = () => (
  <div style={{ height: 1, background: 'var(--border)' }} />
)

const ToggleRow: React.FC<{
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}> = ({ label, description, checked, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</div>
      {description && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
      )}
    </div>
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: checked ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
        border: '1px solid var(--border)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 19 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  </div>
)
