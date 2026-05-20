'use client'

// Iconos SVG inline — sin dependencia de librería externa
const ICONS = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.05a8.16 8.16 0 004.77 1.52V7.12a4.85 4.85 0 01-1-.43z"/>
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  twitch: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  ),
}

const PLATFORM_STYLES: Record<string, { color: string; bg: string; label: string; urlFn: (h: string) => string }> = {
  instagram: {
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.12)',
    label: 'Instagram',
    urlFn: h => `https://instagram.com/${h.replace(/^@/, '')}`,
  },
  tiktok: {
    color: '#69C9D0',
    bg: 'rgba(105,201,208,0.12)',
    label: 'TikTok',
    urlFn: h => `https://tiktok.com/@${h.replace(/^@/, '')}`,
  },
  youtube: {
    color: '#FF0000',
    bg: 'rgba(255,0,0,0.10)',
    label: 'YouTube',
    urlFn: h => h.startsWith('http') ? h : `https://youtube.com/@${h.replace(/^@/, '')}`,
  },
  twitter: {
    color: '#E7E9EA',
    bg: 'rgba(231,233,234,0.08)',
    label: 'X / Twitter',
    urlFn: h => `https://x.com/${h.replace(/^@/, '')}`,
  },
  twitch: {
    color: '#9147FF',
    bg: 'rgba(145,71,255,0.12)',
    label: 'Twitch',
    urlFn: h => `https://twitch.tv/${h.replace(/^@/, '')}`,
  },
}

type Handles = {
  instagram?: string
  tiktok?: string
  youtube?: string
  twitter?: string
  twitch?: string
}

export default function SocialHandles({ handles }: { handles: Handles }) {
  const platforms = (['instagram', 'tiktok', 'youtube', 'twitter', 'twitch'] as const).filter(
    p => handles[p]
  )
  if (platforms.length === 0) return null

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      {platforms.map(p => {
        const s = PLATFORM_STYLES[p]
        const handle = handles[p]!
        return (
          <a
            key={p}
            href={s.urlFn(handle)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${s.label}: ${handle}`}
            className="flex items-center justify-center rounded transition-all hover:brightness-125"
            style={{
              width: 22,
              height: 22,
              color: s.color,
              background: s.bg,
              border: `1px solid ${s.color}20`,
              flexShrink: 0,
            }}
          >
            {ICONS[p]}
          </a>
        )
      })}
    </div>
  )
}
