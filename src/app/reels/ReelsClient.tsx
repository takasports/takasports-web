'use client'

// Experiencia /reels vertical full-screen estilo TikTok/Reels.
// - scroll-snap-y: cada reel ocupa una pantalla, el scroll engancha.
// - El iframe embed de Instagram solo se monta para el reel activo ±1
//   (lazy): montar 40 iframes a la vez sería inviable.
// - Reel inactivo lejano = thumbnail estático con botón play.

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import type { PublicReel } from '@/lib/instagram-public'

function toEmbedUrl(url: string): string {
  const clean = url.replace(/\/+$/, '')
  return `${clean}/embed`
}

export default function ReelsClient({ reels }: { reels: PublicReel[] }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<Array<HTMLElement | null>>([])
  const tickingRef = useRef(false)

  // Scroll-spy: el reel activo es el que ocupa más viewport.
  const computeActive = useCallback(() => {
    tickingRef.current = false
    const container = containerRef.current
    if (!container) return
    const mid = container.scrollTop + container.clientHeight / 2
    let best = 0
    let bestDist = Infinity
    slideRefs.current.forEach((el, i) => {
      if (!el) return
      const center = el.offsetTop + el.offsetHeight / 2
      const dist = Math.abs(center - mid)
      if (dist < bestDist) { bestDist = dist; best = i }
    })
    setActiveIdx(best)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onScroll = () => {
      if (tickingRef.current) return
      tickingRef.current = true
      requestAnimationFrame(computeActive)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [computeActive])

  if (reels.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center px-6"
        style={{ height: 'calc(100dvh - 56px)' }}
      >
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>
          Reels en camino
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 8 }}>
          Estamos preparando los vídeos. Vuelve en un rato.
        </p>
        <Link
          href="/"
          className="mt-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
          style={{
            padding: '10px 18px',
            background: 'var(--purple)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-sport)',
            fontWeight: 700,
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            textDecoration: 'none',
          }}
        >
          Ir al inicio
        </Link>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="reels-scroll"
      style={{
        height: 'calc(100dvh - 56px)',
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        background: '#000',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {reels.map((reel, i) => {
        const near = Math.abs(i - activeIdx) <= 1
        const { accent } = getSportStyle(reel.sport)
        const thumb = reel.thumbnail_url ?? null
        return (
          <section
            key={reel.id}
            ref={el => { slideRefs.current[i] = el }}
            aria-label={reel.title || `Reel ${i + 1}`}
            style={{
              height: '100%',
              scrollSnapAlign: 'start',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Embed o thumbnail */}
            <div
              style={{
                width: 'min(100%, 420px)',
                height: '100%',
                maxHeight: 'calc(100dvh - 56px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {near ? (
                <iframe
                  src={toEmbedUrl(reel.instagram_url)}
                  title={reel.title || `Reel ${i + 1}`}
                  loading="lazy"
                  allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
                  allowFullScreen
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: '#000',
                  }}
                />
              ) : (
                thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={reel.title || 'Reel'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }}
                  />
                )
              )}
            </div>

            {/* Overlay inferior — deporte + título */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '20px 16px calc(20px + env(safe-area-inset-bottom, 0px) + 64px)',
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                pointerEvents: 'none',
              }}
            >
              <div style={{ maxWidth: 420, margin: '0 auto', pointerEvents: 'auto' }}>
                {reel.sport && (
                  <span
                    style={{
                      display: 'inline-block',
                      fontFamily: 'var(--font-sport)',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: accent,
                      marginBottom: 6,
                    }}
                  >
                    {getSportLabel(reel.sport)}
                  </span>
                )}
                {reel.title && (
                  <p
                    style={{
                      color: '#fff',
                      fontFamily: 'var(--font-sport)',
                      fontSize: 14,
                      fontWeight: 600,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {reel.title}
                  </p>
                )}
                <a
                  href={reel.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 8,
                    fontFamily: 'var(--font-sport)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'rgba(255,255,255,0.7)',
                    textDecoration: 'none',
                  }}
                >
                  Ver en Instagram ↗
                </a>
              </div>
            </div>

            {/* Contador de progreso */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 12,
                right: 14,
                fontFamily: 'var(--font-display)',
                fontSize: 12,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.6)',
                background: 'rgba(0,0,0,0.4)',
                padding: '3px 9px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {i + 1} / {reels.length}
            </div>
          </section>
        )
      })}
    </div>
  )
}
