'use client'

import { useState } from 'react'
import Image from '@/components/DynamicImage'
import { urlFor } from '@/lib/sanity'
import { getSportStyle } from '@/lib/sports'
import ReelsSection from './ReelsSection'

interface Reel {
  _id: string
  instagram_url?: string
  thumbnail?: { asset: { _ref: string } }
  category?: string
  title?: string
  publishedAt?: string
}

function IGIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="currentColor" strokeWidth="1.8" opacity="0.7" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" opacity="0.7" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

// Convierte URL de instagram reel a embed URL
function toEmbedUrl(url?: string): string | null {
  if (!url) return null
  const m = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)
  return m ? `https://www.instagram.com/p/${m[1]}/embed/` : null
}

const REEL_SPORTS = [
  { sport: 'Fútbol',     accent: '#22c55e', emoji: '⚽' },
  { sport: 'Baloncesto', accent: '#f59e0b', emoji: '🏀' },
  { sport: 'F1',         accent: '#ef4444', emoji: '🏎️' },
  { sport: 'Tenis',      accent: '#d97706', emoji: '🎾' },
]

function MiniReelCard({
  reel,
  accent,
  label,
  emoji,
  onClick,
}: {
  reel?: Reel
  accent: string
  label: string
  emoji?: string
  onClick: () => void
}) {
  const imgUrl = reel?.thumbnail?.asset
    ? urlFor(reel.thumbnail).width(140).height(200).url()
    : null

  return (
    <button
      onClick={onClick}
      className="relative flex-shrink-0 overflow-hidden group"
      style={{
        width: 80,
        height: 120,
        borderRadius: 10,
        background: imgUrl
          ? 'transparent'
          : `linear-gradient(160deg, ${accent}14 0%, #09090F 100%)`,
        border: `1px solid ${accent}25`,
        boxShadow: `0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px ${accent}18`,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {imgUrl && (
        <Image
          src={imgUrl}
          alt={label}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }}
      />
      {/* Hover overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: 'rgba(124,58,237,0.15)' }}
      />
      {/* Play icon */}
      <div
        className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity"
      >
        {!imgUrl && <span className="text-xl">{emoji}</span>}
        {imgUrl && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(6px)' }}
          >
            <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
              <path d="M1.5 1.5L6.5 5L1.5 8.5V1.5Z" fill="white" />
            </svg>
          </div>
        )}
      </div>
      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 p-1.5">
        <p
          className="text-[8px] font-black uppercase tracking-widest truncate text-center"
          style={{ color: imgUrl ? 'rgba(255,255,255,0.9)' : accent, fontFamily: 'var(--font-sport)' }}
        >
          {label}
        </p>
      </div>
      {/* Accent bar */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 2, background: `linear-gradient(to right, ${accent}BB, ${accent}20)` }}
      />
    </button>
  )
}

export default function ReelsCompact({ reels }: { reels: Reel[] }) {
  const [modalReel, setModalReel] = useState<Reel | null>(null)

  // Para el modal reutilizamos ReelsSection pasando solo el reel activo
  // pero lo manejamos inline con iframe
  const embedUrl = modalReel ? toEmbedUrl(modalReel.instagram_url) : null
  const { accent: modalAccent } = getSportStyle(modalReel?.category)

  const displayReels = reels.length > 0 ? reels.slice(0, 4) : null

  return (
    <>
      <div className="flex items-center gap-4">
        {/* Label */}
        <div
          className="flex items-center gap-1.5 flex-shrink-0"
          style={{ color: '#7A6090' }}
        >
          <IGIcon />
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-sport)', color: '#6A507A' }}
          >
            En vídeo
          </span>
        </div>

        {/* Cards */}
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {displayReels
            ? displayReels.map((reel) => {
                const { accent } = getSportStyle(reel.category)
                return (
                  <MiniReelCard
                    key={reel._id}
                    reel={reel}
                    accent={accent}
                    label={reel.title ?? reel.category ?? 'Reel'}
                    onClick={() => setModalReel(reel)}
                  />
                )
              })
            : REEL_SPORTS.map((s) => (
                <MiniReelCard
                  key={s.sport}
                  accent={s.accent}
                  label={s.sport}
                  emoji={s.emoji}
                  onClick={() => {}}
                />
              ))
          }
        </div>
      </div>

      {/* Modal inline */}
      {modalReel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}
          onClick={() => setModalReel(null)}
        >
          <div
            className="relative w-full max-w-sm flex flex-col"
            style={{
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: `0 32px 72px rgba(0,0,0,0.65), 0 0 0 1px ${modalAccent}28`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
              style={{ background: '#0D0D18', borderBottom: `1px solid ${modalAccent}22` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <IGIcon />
                {modalReel.title && (
                  <span className="text-[12px] font-semibold truncate" style={{ color: '#C8C8DC' }}>
                    {modalReel.title}
                  </span>
                )}
              </div>
              <button
                onClick={() => setModalReel(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-70"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#888', cursor: 'pointer' }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {embedUrl ? (
              <iframe
                src={embedUrl}
                style={{ width: '100%', height: 'min(580px, 72vh)', border: 'none', display: 'block', background: '#000' }}
                allowFullScreen
                scrolling="no"
                title={modalReel.title ?? 'Reel'}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-3 py-14"
                style={{ background: '#09090F', minHeight: 260 }}
              >
                <p className="text-sm font-semibold" style={{ color: '#4A4A5A' }}>Contenido próximamente</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
