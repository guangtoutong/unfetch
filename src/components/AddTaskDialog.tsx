import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTaskStore } from '../stores/taskStore'
import { useSettingsStore } from '../stores/settingsStore'
import { detectUrlType } from '../lib/format'
import type { AddTaskRequest } from '../types'

const qualityOptions = [
  { value: 'best', label: '最佳画质' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: 'audio', label: '仅音频' },
]

const UrlTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  if (type === 'bt') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    )
  }
  if (type === 'ytdlp') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M9 15V9l7 3-7 3z" fill="#ef4444" stroke="none" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

interface AddTaskDialogProps {
  open: boolean
  onClose: () => void
}

function parseUrls(input: string): string[] {
  return input
    .split(/[\r\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export const AddTaskDialog: React.FC<AddTaskDialogProps> = ({ open, onClose }) => {
  const { addTask } = useTaskStore()
  const { config } = useSettingsStore()

  const [url, setUrl] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [urlType, setUrlType] = useState<'http' | 'bt' | 'ytdlp'>('http')
  const [quality, setQuality] = useState('best')
  const [saveDir, setSaveDir] = useState('')
  const [threads, setThreads] = useState(8)
  const [proxy, setProxy] = useState('')
  const [cookies, setCookies] = useState('')
  const [playAfter, setPlayAfter] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 新增字段
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [startAt, setStartAt] = useState('') // datetime-local
  const [sha256, setSha256] = useState('')
  const [md5, setMd5] = useState('')

  const urlInputRef = useRef<HTMLInputElement>(null)
  const batchRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setSaveDir(config.download_dir || '')
    setThreads(config.http_threads || 8)
    setProxy(config.proxy || '')
    setPlayAfter(config.auto_play_unflick || false)
  }, [config])

  useEffect(() => {
    if (!batchMode) {
      setUrlType(detectUrlType(url))
    }
  }, [url, batchMode])

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (batchMode) batchRef.current?.focus()
        else urlInputRef.current?.focus()
      }, 100)
    } else {
      setUrl('')
      setError('')
      setShowAdvanced(false)
      setBatchMode(false)
      setTags([])
      setTagInput('')
      setStartAt('')
      setSha256('')
      setMd5('')
    }
  }, [open, batchMode])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const addTagFromInput = () => {
    const t = tagInput.trim().replace(/^#/, '')
    if (!t) return
    if (!tags.includes(t)) {
      setTags([...tags, t])
    }
    setTagInput('')
  }
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))

  const handleSubmit = async () => {
    const urls = batchMode ? parseUrls(url) : (url.trim() ? [url.trim()] : [])
    if (urls.length === 0) {
      setError(batchMode ? '请粘贴至少一个 URL（每行一个）' : '请输入下载地址')
      return
    }

    setError('')
    setSubmitting(true)

    // start_at: datetime-local → ISO string；空就是立即开始
    let startAtISO: string | undefined
    if (startAt) {
      const d = new Date(startAt)
      if (!isNaN(d.getTime())) startAtISO = d.toISOString()
    }

    try {
      let succeeded = 0
      for (const u of urls) {
        const detectedType = detectUrlType(u)
        const req: AddTaskRequest = {
          url: u,
          save_dir: saveDir || undefined,
          threads: detectedType === 'http' ? threads : undefined,
          proxy: proxy || undefined,
          cookies: cookies || undefined,
          quality: detectedType === 'ytdlp' ? quality : undefined,
          play_after: playAfter,
          tags: tags.length > 0 ? tags : undefined,
          start_at: startAtISO,
          expected_sha256: sha256 || undefined,
          expected_md5: md5 || undefined,
        }
        try {
          await addTask(req)
          succeeded++
        } catch (e) {
          console.error('add task failed', u, e)
        }
      }
      if (succeeded === 0) {
        setError('添加失败，请检查地址')
      } else {
        onClose()
      }
    } catch (err) {
      setError((err as Error).message || '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSelectDir = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const dir = await invoke<string>('select_directory')
      if (dir) setSaveDir(dir)
    } catch {}
  }

  const urlTypeLabels: Record<string, string> = {
    http: 'HTTP 下载',
    bt: 'BT / 磁力链接',
    ytdlp: '视频网站',
  }

  // 批量解析预览
  const parsedBatch = batchMode ? parseUrls(url) : []

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 100,
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 560,
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 32px)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 16,
              boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
              zIndex: 101,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ height: 2, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)', flexShrink: 0 }} />

            <div style={{ padding: '20px 24px 24px', overflow: 'auto', flex: 1 }}>
              {/* 标题 + 模式切换 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>添加下载任务</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>支持 HTTP、BT/磁力、1000+ 视频网站</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* 批量开关 */}
                  <button
                    onClick={() => { setBatchMode(!batchMode); setUrl('') }}
                    title={batchMode ? '切换到单 URL 模式' : '切换到批量模式（每行一个 URL）'}
                    style={{
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: `1px solid ${batchMode ? 'var(--primary)' : 'var(--border)'}`,
                      background: batchMode ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',
                      color: batchMode ? 'var(--primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    批量
                  </button>

                  <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* URL 输入 */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  下载地址{batchMode && '（每行一个）'}
                </label>
                {batchMode ? (
                  <textarea
                    ref={batchRef}
                    placeholder="https://example.com/file1.zip&#10;https://example.com/file2.zip&#10;magnet:?xt=urn:btih:..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="input-base"
                    style={{ minHeight: 100, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                  />
                ) : (
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', zIndex: 1 }}>
                      <UrlTypeIcon type={urlType} />
                    </span>
                    <input
                      ref={urlInputRef}
                      type="text"
                      placeholder="粘贴 URL、磁力链接或视频网页地址..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      className="input-base"
                      style={{ paddingLeft: 36 }}
                    />
                  </div>
                )}
                {url && !batchMode && (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                    检测到类型：<span style={{ color: 'var(--primary)', fontWeight: 600 }}>{urlTypeLabels[urlType]}</span>
                  </div>
                )}
                {batchMode && parsedBatch.length > 0 && (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                    将创建 <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{parsedBatch.length}</span> 个任务
                  </div>
                )}
              </div>

              {/* 质量（仅 ytdlp 单 URL 模式显示） */}
              {urlType === 'ytdlp' && !batchMode && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    画质选择
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {qualityOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setQuality(opt.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 7,
                          border: `1px solid ${quality === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                          background: quality === opt.value ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                          color: quality === opt.value ? 'var(--primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: quality === opt.value ? 600 : 400,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* HTTP 线程数 */}
              {urlType === 'http' && !batchMode && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    下载线程数：<span style={{ color: 'var(--primary)' }}>{threads}</span>
                  </label>
                  <input type="range" min={1} max={32} value={threads} onChange={(e) => setThreads(Number(e.target.value))} />
                </div>
              )}

              {/* 保存目录 */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  保存目录
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <input type="text" placeholder={config.download_dir || '使用默认目录'} value={saveDir} onChange={(e) => setSaveDir(e.target.value)} className="input-base" style={{ paddingLeft: 30 }} />
                  </div>
                  <button onClick={handleSelectDir} className="btn btn-ghost" style={{ flexShrink: 0, height: 38 }}>浏览</button>
                </div>
              </div>

              {/* 标签 */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  标签
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {tags.map((t) => (
                    <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(168,85,247,0.12)', color: '#a855f7', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
                      #{t}
                      <button onClick={() => removeTag(t)} style={{ width: 12, height: 12, border: 'none', background: 'none', color: 'currentColor', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="输入标签后回车（如 影视 / 软件 / 工作）"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addTagFromInput()
                    }
                  }}
                  className="input-base"
                />
              </div>

              {/* 高级选项 */}
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: 0 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  高级选项
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* 代理 */}
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>代理地址</label>
                          <input type="text" placeholder="http://127.0.0.1:7890" value={proxy} onChange={(e) => setProxy(e.target.value)} className="input-base" />
                        </div>

                        {/* 定时下载 */}
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                            ⏰ 定时下载（留空 = 立即开始）
                          </label>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="input-base" style={{ flex: 1 }} />
                            {startAt && (
                              <button onClick={() => setStartAt('')} style={{ height: 38, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>清除</button>
                            )}
                          </div>
                        </div>

                        {/* 哈希校验 */}
                        <div>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                            校验码（下载完成后比对）
                          </label>
                          <input type="text" placeholder="SHA-256（64 位十六进制）" value={sha256} onChange={(e) => setSha256(e.target.value)} className="input-base" style={{ marginBottom: 6, fontFamily: 'monospace', fontSize: 11 }} />
                          <input type="text" placeholder="MD5（32 位十六进制）" value={md5} onChange={(e) => setMd5(e.target.value)} className="input-base" style={{ fontFamily: 'monospace', fontSize: 11 }} />
                        </div>

                        {/* Cookie */}
                        {urlType === 'ytdlp' && (
                          <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>Cookie（Netscape 格式）</label>
                            <textarea placeholder="粘贴 Cookie 内容..." value={cookies} onChange={(e) => setCookies(e.target.value)} className="input-base" style={{ height: 72, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }} />
                          </div>
                        )}

                        {/* 下载完成后播放 */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                          <div onClick={() => setPlayAfter(!playAfter)} style={{ width: 36, height: 20, borderRadius: 10, background: playAfter ? 'var(--primary)' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', border: '1px solid var(--border)' }}>
                            <div style={{ position: 'absolute', top: 2, left: playAfter ? 17 : 2, width: 14, height: 14, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>下载完成后自动用 Unflick 播放</span>
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {error && (
                <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#ef4444', fontSize: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={onClose}>取消</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting || !url.trim()}
                  style={{ minWidth: 100, position: 'relative', boxShadow: '0 0 16px rgba(99,102,241,0.35)' }}
                >
                  {submitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                      添加中...
                    </span>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="8 17 12 21 16 17" />
                        <line x1="12" y1="12" x2="12" y2="21" />
                        <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
                      </svg>
                      {batchMode && parsedBatch.length > 1 ? `开始下载 (${parsedBatch.length})` : '开始下载'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
