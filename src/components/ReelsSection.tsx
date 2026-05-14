'use client'

import { useState, useEffect, useRef } from 'react'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'

// Categorías que aparecen siempre en los tabs de Reels (independiente de si
// hay contenido en este instante). Se ordenan: las que tienen reels primero.
const REELS_TAB_SLUGS = ['futbol', 'wwe', 'ufc']
import { useTilt } from '@/hooks/useTilt'
import { useScrollReveal } from '@/hooks/useScrollReveal'

// ── Tipo de entrada — compatible con Sanity y con Instagram API ─
interface SanityReel {
  _id?: string
  instagram_url?: string
  thumbnail?: { asset: { _ref: string } }
  sport?: string
  category?: string
  title?: string
  publishedAt?: string
  id?: string
  thumbnail_url?: string
  video_url?: string
  timestamp?: string
}

// ── Normalizado interno ─────────────────────────────────────────
interface Reel {
  key: string
  instagram_url: string
  thumbnailUrl: string | null
  videoUrl: string | null
  date: string
  sport: string
  title: string
}

function normalize(r: SanityReel, index: number): Reel {
  const sport = r.sport || r.category || ''
  const thumbnailUrl =
    r.thumbnail_url ||
    (r.thumbnail?.asset ? urlFor(r.thumbnail).width(360).height(600).url() : null)

  return {
    key:           r._id || r.id || `reel-${index}`,
    instagram_url: r.instagram_url || '',
    thumbnailUrl,
    videoUrl:      r.video_url || null,
    date:          r.publishedAt || r.timestamp || '',
    sport,
    title:         r.title || 'Reel',
  }
}

// ── Iconos ─────────────────────────────────────────────────────
function IGIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="white" strokeWidth="1.8" opacity="0.8" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" opacity="0.8" />
      <circle cx="17.5" cy="6.5" r="1" fill="white" opacity="0.8" />
    </svg>
  )
}

function PlayBtn() {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
      style={{
        background: 'rgba(255,255,255,0.22)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
        <path d="M1.5 1.5L8.5 6L1.5 10.5V1.5Z" fill="white" />
      </svg>
    </div>
  )
}

// ── Shimmer skeleton ────────────────────────────────────────────
function ReelSkeleton() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
      <div
        className="relative flex-shrink-0"
        style={{
          width: 180, height: 300, borderRadius: 16,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.6s infinite linear',
        }}
      />
    </>
  )
}

// ── Placeholders ────────────────────────────────────────────────
const REEL_PLACEHOLDERS = [
  { sport: 'futbol',     accent: '#22c55e', emoji: '⚽', label: 'Fútbol' },
  { sport: 'baloncesto', accent: '#f59e0b', emoji: '🏀', label: 'Baloncesto' },
  { sport: 'formula1',   accent: '#ef4444', emoji: '🏎️', label: 'F1' },
  { sport: 'tenis',      accent: '#d97706', emoji: '🎾', label: 'Tenis' },
  { sport: 'ufc',        accent: '#f97316', emoji: '🥊', label: 'UFC' },
  { sport: 'rugby',      accent: '#a78bfa', emoji: '🏉', label: 'Rugby' },
]

// Extrae el shortcode de una URL de reel/post de Instagram
function extractIGCode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

// ── Modal ───────────────────────────────────────────────────────
function ReelModal({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const { accent } = getSportStyle(reel.sport)
  const label = getSportLabel(reel.sport)
  const igCode = reel.instagram_url ? extractIGCode(reel.instagram_url) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(18px)' }}
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={reel.title}
        className="relative flex flex-col"
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: `0 32px 72px rgba(0,0,0,0.8), 0 0 0 1px ${accent}30`,
          animation: 'reelModalIn 280ms cubic-bezier(0.34,1.15,0.64,1) forwards',
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`
          @keyframes reelModalIn {
            from { opacity:0; transform:scale(0.93) translateY(14px); }
            to   { opacity:1; transform:scale(1) translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
          style={{ background: '#0D0D18', borderBottom: `1px solid ${accent}22` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <IGIcon size={13} />
            {label && (
              <span
                className="text-[9px] font-black uppercase tracking-widest flex-shrink-0"
                style={{ color: accent, fontFamily: 'var(--font-sport)' }}
              >
                {label}
              </span>
            )}
            <span className="text-[12px] font-semibold truncate" style={{ color: '#C8C8DC' }}>
              {reel.title}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {reel.instagram_url && (
              <a
                href={reel.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver en Instagram"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <IGIcon size={12} />
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#888' }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Player — video nativo con proxy si está disponible; si no, embed oficial IG */}
        {reel.videoUrl ? (
          <video
            src={reel.videoUrl}
            poster={reel.thumbnailUrl ?? undefined}
            controls
            autoPlay
            playsInline
            style={{
              width: '100%',
              aspectRatio: '9/16',
              background: '#000',
              display: 'block',
              maxHeight: '75vh',
              objectFit: 'contain',
            }}
          />
        ) : igCode ? (
          <iframe
            src={`https://www.instagram.com/p/${igCode}/embed/`}
            title={reel.title}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture; web-share; clipboard-write"
            allowFullScreen
            scrolling="no"
            style={{
              width: '100%',
              height: 'min(720px, 78vh)',
              border: 0,
              background: '#000',
              display: 'block',
            }}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center"
            style={{ background: 'linear-gradient(160deg,#1e1b4b,#09090F)', minHeight: 320 }}
          >
            <p className="font-black text-base" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
              {reel.title}
            </p>
            {reel.instagram_url && (
              <a
                href={reel.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
                style={{ color: accent }}
              >
                Ver en Instagram →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card ────────────────────────────────────────────────────────
function ReelCard({ reel, onClick }: { reel: Reel; onClick: () => void }) {
  const { accent } = getSportStyle(reel.sport)
  const label = getSportLabel(reel.sport)
  const { elRef } = useTilt({ max: 5, scale: 1.03, glare: false })

  return (
    <div ref={elRef}>
    <button
      onClick={onClick}
      aria-label={`Reproducir: ${reel.title}`}
      className="relative flex-shrink-0 overflow-hidden group text-left w-full h-full"
      style={{
        width: 180,
        height: 300,
        borderRadius: 16,
        background: reel.thumbnailUrl
          ? `url(${reel.thumbnailUrl}) center/cover no-repeat`
          : `linear-gradient(160deg, ${accent}18, #09090F)`,
        boxShadow: `0 12px 36px rgba(0,0,0,0.55), 0 0 0 1.5px ${accent}28`,
        border: `1.5px solid ${accent}22`,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.15) 45%,transparent 65%)' }} />
      {/* Gradiente superior más fuerte para tapar texto bakeado en thumbnails de Instagram */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.35) 30%,transparent 55%)' }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: `${accent}14` }} />

      {/* Overlay "Reproducir" — visible en hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(14px)',
              border: '1.5px solid rgba(255,255,255,0.4)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            <svg width="13" height="15" viewBox="0 0 10 12" fill="none">
              <path d="M1.5 1.5L8.5 6L1.5 10.5V1.5Z" fill="white" />
            </svg>
          </div>
          <span
            className="text-[10px] font-black uppercase tracking-widest text-white px-3 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
          >
            Reproducir
          </span>
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col justify-between p-3.5">
        <div className="flex items-start justify-end">
          <PlayBtn />
        </div>

        <div>
          {reel.date && (
            <p className="text-[9px] mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {timeAgo(reel.date)}
            </p>
          )}
          {label && (
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
              {label}
            </p>
          )}
          <p
            className="text-[13px] font-black leading-tight line-clamp-2"
            style={{ fontFamily: 'var(--font-display)', color: '#F8F8FF', textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}
          >
            {reel.title}
          </p>
          <div style={{ marginTop: 8, height: 2, borderRadius: 2, background: `linear-gradient(to right, ${accent}CC, ${accent}22)` }} />
        </div>
      </div>
    </button>
    </div>
  )
}

// ── Placeholder ─────────────────────────────────────────────────
function ReelPlaceholder({ accent, emoji, label }: { accent: string; emoji: string; label: string }) {
  return (
    <div
      className="relative flex-shrink-0 flex flex-col items-center justify-center gap-3"
      style={{
        width: 180, height: 300, borderRadius: 16,
        background: `linear-gradient(160deg, ${accent}22 0%, rgba(14,12,28,0.98) 65%)`,
        boxShadow: `0 0 0 1.5px ${accent}40, 0 8px 28px ${accent}20`,
        border: `1.5px solid ${accent}45`,
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: 16, background: `radial-gradient(ellipse at 50% 30%, ${accent}14 0%, transparent 65%)` }} />
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
        <IGIcon size={9} />
        <span className="text-[8px] font-black uppercase tracking-widest text-white opacity-60">Reels</span>
      </div>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl relative z-10" style={{ background: `${accent}20`, border: `1px solid ${accent}35` }}>
        {emoji}
      </div>
      <div className="text-center px-4 relative z-10">
        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>{label}</p>
        <p className="text-[8px] font-black uppercase tracking-widest mt-1" style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-sport)' }}>Próximamente</p>
      </div>
      <div className="absolute bottom-3 left-3.5 right-3.5" style={{ height: 2, borderRadius: 2, background: `linear-gradient(to right, ${accent}90, ${accent}15)` }} />
    </div>
  )
}

// ── CTA "Ver más" — siempre al final del carrusel; lleva al perfil de IG ─
function MoreReelsCard({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  // Si hay más reels a la derecha (el carrusel desborda), el botón scrollea
  // dentro del carrusel; si ya estamos al final, abre Instagram.
  const handleClick = () => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const atEnd = max <= 0 || el.scrollLeft >= max - 4
    if (atEnd) {
      window.open('https://www.instagram.com/taka.sports', '_blank', 'noopener,noreferrer')
    } else {
      el.scrollBy({ left: el.clientWidth * 0.85, behavior: 'smooth' })
    }
  }
  return (
    <button
      onClick={handleClick}
      aria-label="Ver más reels en Instagram"
      className="relative flex-shrink-0 flex flex-col items-center justify-center gap-3 group transition-transform hover:scale-[1.02]"
      style={{
        width: 180, height: 300, borderRadius: 16,
        background: 'linear-gradient(160deg, rgba(131,58,180,0.22) 0%, rgba(193,53,132,0.16) 50%, rgba(14,12,28,0.98) 100%)',
        boxShadow: '0 0 0 1.5px rgba(193,53,132,0.35), 0 8px 28px rgba(131,58,180,0.18)',
        border: '1.5px solid rgba(193,53,132,0.35)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: 16, background: 'radial-gradient(ellipse at 50% 30%, rgba(193,53,132,0.18) 0%, transparent 65%)' }} />
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}>
        <IGIcon size={9} />
        <span className="text-[8px] font-black uppercase tracking-widest text-white opacity-70">@taka.sports</span>
      </div>
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center relative z-10 transition-transform group-hover:translate-x-1"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(193,53,132,0.4)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M13 5l7 7-7 7" stroke="#D4A0C8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="text-center px-4 relative z-10">
        <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#D4A0C8', fontFamily: 'var(--font-sport)' }}>Ver más reels</p>
        <p className="text-[8px] font-black uppercase tracking-widest mt-1.5" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sport)' }}>Seguir scroll · Instagram</p>
      </div>
      <div className="absolute bottom-3 left-3.5 right-3.5" style={{ height: 2, borderRadius: 2, background: 'linear-gradient(to right, rgba(193,53,132,0.9), rgba(131,58,180,0.2))' }} />
    </button>
  )
}

// ── Filtro por deporte ──────────────────────────────────────────
function SportTabs({ sports, active, onChange }: { sports: string[]; active: string; onChange: (s: string) => void }) {
  const tabs = [{ slug: '', label: 'Todos' }, ...sports.map(s => ({ slug: s, label: getSportLabel(s) || s }))]
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4">
      {tabs.map(tab => {
        const isActive = active === tab.slug
        const accent = tab.slug ? getSportStyle(tab.slug).accent : '#7C3AED'
        return (
          <button
            key={tab.slug}
            onClick={() => onChange(tab.slug)}
            style={{
              padding: '4px 13px', borderRadius: 999, fontSize: 9,
              fontFamily: 'var(--font-sport)', fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase' as const, flexShrink: 0, whiteSpace: 'nowrap' as const,
              border: `1px solid ${isActive ? accent : 'rgba(255,255,255,0.07)'}`,
              background: isActive ? `${accent}18` : 'transparent',
              color: isActive ? accent : '#3A3A52',
              cursor: 'pointer', transition: 'all 160ms ease',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────
export default function ReelsSection({
  reels: rawReels,
  initialSport = '',
}: {
  reels: SanityReel[]
  initialSport?: string
}) {
  const [liveReels, setLiveReels] = useState<SanityReel[] | null>(null)
  const [loadingLive, setLoadingLive] = useState(true)
  const source = liveReels ?? rawReels
  const reels = source.map((r, i) => normalize(r, i))
  const [activeSport, setActiveSport] = useState(initialSport)
  const [activeReel, setActiveReel] = useState<Reel | null>(null)

  // Si los rawReels iniciales son seed (sin thumbnail), mostramos skeletons mientras carga live
  const isSeed = rawReels.every(r => !r.thumbnail_url)
  const showSkeleton = isSeed && loadingLive

  // Sync activeSport when parent changes initialSport (e.g. noticias category change)
  useEffect(() => {
    setActiveSport(initialSport)
  }, [initialSport])

  useEffect(() => {
    fetch('/api/instagram/reels')
      .then(r => r.json())
      .then((data: SanityReel[]) => {
        if (data?.length) {
          setLiveReels(data)
          // If the current sport filter yields 0 reels in live data, reset to show all
          setActiveSport(prev => {
            if (!prev) return prev
            const hasMatch = data.some((r, i) => normalize(r, i).sport === prev)
            return hasMatch ? prev : ''
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoadingLive(false))
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useScrollReveal()
  const [scrollRatio, setScrollRatio] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth
      setScrollRatio(max > 0 ? el.scrollLeft / max : 0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = 0
    setScrollRatio(0)
  }, [activeSport])

  const hasReels = reels.length > 0

  // Tabs fijos: Fútbol, WWE, UFC. Los que tienen reels actualmente van primero.
  const reelsBySport = new Set(reels.map(r => r.sport).filter(Boolean) as string[])
  const availableSports = [
    ...REELS_TAB_SLUGS.filter(s => reelsBySport.has(s)),
    ...REELS_TAB_SLUGS.filter(s => !reelsBySport.has(s)),
  ]
  const visible = activeSport ? reels.filter(r => r.sport === activeSport) : reels

  return (
    <section ref={containerRef as unknown as (el: HTMLElement | null) => void} className="pt-5 pb-0" id="reels" style={{ background: 'var(--bg-base)' }}>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: 'linear-gradient(135deg,rgba(131,58,180,0.2),rgba(193,53,132,0.15),rgba(253,29,29,0.1))',
              border: '1px solid rgba(193,53,132,0.25)',
            }}
          >
            <IGIcon size={11} />
            <h2 className="label-display text-[13px] uppercase" style={{ color: '#D4A0C8' }}>Reels</h2>
          </div>
          <span className="text-[10px]" style={{ color: '#3A3A4A' }}>·</span>
          <span className="text-[11px]" style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
            {hasReels ? `${visible.length} reels` : 'Próximamente'}
          </span>
        </div>
        <a
          href="https://www.instagram.com/taka.sports"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: '#9B6DB5', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
        >
          @taka.sports →
        </a>
      </div>

      {hasReels && availableSports.length > 1 && (
        <SportTabs sports={availableSports} active={activeSport} onChange={setActiveSport} />
      )}

      <div className="relative -mx-6 xl:-mx-10" style={{ background: 'var(--bg-base)' }}>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-strip pb-2 pt-1"
          style={{ paddingLeft: 'max(24px, calc((100vw - 1440px) / 2 + 40px))', background: 'var(--bg-base)' }}
        >
          {showSkeleton
            ? Array.from({ length: 6 }).map((_, i) => <ReelSkeleton key={i} />)
            : hasReels && visible.length > 0
              ? (
                <>
                  {visible.map(reel => <div key={reel.key}><ReelCard reel={reel} onClick={() => setActiveReel(reel)} /></div>)}
                  <MoreReelsCard scrollRef={scrollRef} />
                </>
              )
              : hasReels && visible.length === 0
                ? (
                  <>
                    <div
                      className="flex flex-col items-center justify-center gap-2 flex-shrink-0"
                      style={{ width: 360, minHeight: 200, color: '#3A3A52' }}
                    >
                      <span style={{ fontSize: 28 }}>📭</span>
                      <p className="text-[11px] font-black uppercase tracking-widest" style={{ fontFamily: 'var(--font-sport)' }}>
                        Sin reels en esta categoría
                      </p>
                    </div>
                    <MoreReelsCard scrollRef={scrollRef} />
                  </>
                )
                : REEL_PLACEHOLDERS.map((p, i) => <div key={p.sport} className="reel-enter" style={{ animationDelay: `${i * 60}ms` }}><ReelPlaceholder accent={p.accent} emoji={p.emoji} label={p.label} /></div>)
          }
          <div className="flex-shrink-0 w-6 xl:w-10" />
        </div>

        <div className="absolute left-0 top-0 bottom-2 w-6 xl:w-10 pointer-events-none z-10" style={{ background: 'linear-gradient(to right,var(--bg-base),transparent)' }} />
        <div className="absolute right-0 top-0 bottom-2 w-16 pointer-events-none z-10" style={{ background: 'linear-gradient(to right,transparent,var(--bg-base))' }} />
      </div>

      {/* Barra de progreso scroll — solo móvil, solo con reels reales */}
      {hasReels && !showSkeleton && (
        <div className="lg:hidden mt-2 px-6 flex items-center gap-2">
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(8, scrollRatio * 100)}%`,
                background: 'linear-gradient(to right, #7C3AED, #A78BFA)',
                borderRadius: 999,
                transition: 'width 80ms linear',
                marginLeft: `${scrollRatio * (100 - Math.max(8, scrollRatio * 100))}%`,
              }}
            />
          </div>
          <span className="text-[9px] font-black tabular-nums flex-shrink-0" style={{ color: '#38384A', fontFamily: 'var(--font-sport)' }}>
            {visible.length} reels
          </span>
        </div>
      )}

      {activeReel && <ReelModal reel={activeReel} onClose={() => setActiveReel(null)} />}
    </section>
  )
}
