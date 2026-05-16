import React, { useEffect, useState } from 'react'
import { loadAds, openExternal, type AdItem } from '../lib/ads'

export const AdBanner: React.FC = () => {
  const [ads, setAds] = useState<AdItem[]>([])

  useEffect(() => {
    loadAds().then(setAds).catch(() => {})
  }, [])

  if (ads.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 16px',
        borderTop: '1px solid var(--border)',
        background: 'rgba(7,7,16,0.6)',
        flexShrink: 0,
      }}
    >
      {ads.map((ad) => (
        <AdCard key={ad.url} ad={ad} />
      ))}
    </div>
  )
}

const AdCard: React.FC<{ ad: AdItem }> = ({ ad }) => {
  const [hovered, setHovered] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = !!ad.logoUrl && !imgFailed

  return (
    <button
      onClick={() => openExternal(ad.url).catch(console.error)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={ad.url}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: hovered ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'left',
        color: 'inherit',
        font: 'inherit',
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          background: showImg ? 'rgba(255,255,255,0.05)' : (ad.logoColor || '#6366f1'),
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 14,
          flexShrink: 0,
          overflow: 'hidden',
          border: showImg ? '1px solid var(--border)' : 'none',
        }}
      >
        {showImg ? (
          <img
            src={ad.logoUrl}
            alt={ad.name}
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          ad.logoLetter || ad.name[0]
        )}
      </div>

      {/* 文案 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            {ad.name}
          </span>
          {ad.badge && (
            <span
              style={{
                fontSize: 9,
                padding: '1.5px 6px',
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(16,185,129,0.18))',
                color: '#22c55e',
                fontWeight: 700,
                letterSpacing: '0.04em',
                border: '1px solid rgba(34,197,94,0.3)',
              }}
            >
              {ad.badge}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 1,
          }}
          title={ad.description}
        >
          {ad.description}
        </div>
      </div>

      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={hovered ? 'var(--primary)' : 'var(--text-muted)'} strokeWidth="2.2" style={{ flexShrink: 0, transition: 'stroke 0.15s' }}>
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
        <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
      </svg>
    </button>
  )
}
