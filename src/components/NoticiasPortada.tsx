'use client'

import { useState, useEffect, useRef } from 'react'
import Image from '@/components/DynamicImage'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'

const ROTATION_MS = 5000
const SWIPE_THRESHOLD = 50

const OVERLAY = 'linear-gradient(to top, rgba(3,3,10,0.97) 0%, rgba(3,3,10,0.55) 38%, rgba(3,3,10,0.08) 72%, transparent 100%)'
const CARD_BG = '#06060F'

interface Article {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  takaStatus?: string | null
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

function Badge({ sport, category }: { sport?: string; category?: string }) {
  const { accent } = getSportStyle(sport, category)
  const label = getSportLabel(sport, category)
  if (!label) return null
  return (
    <span
      className="inline-block text-[9px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded mb-1.5"
      style={{ background: `${accent}26`, color: accent, border: `1px solid ${accent}48`, fontFamily: 'var(--font-sport)' }}
    >
      {label}
    </span>
  )
}

// ── Card grande (top 2) ────────────────────────────────────────
function BigCard({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(800).height(520).url() : null)

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl"
      style={{ height: 340, textDecoration: 'none', background: CARD_BG }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 1024px) 100vw, 48vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          priority
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}35, #06060F)` }} />
      )}

      <div className="absolute inset-0" style={{ background: OVERLAY }} />

      {article.takaStatus === 'breaking' && (
        <div className="absolute top-3 left-3 z-10">
          <span
            className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded animate-pulse"
            style={{ background: 'rgba(6,6,14,0.9)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)', backdropFilter: 'blur(8px)', fontFamily: 'var(--font-sport)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Breaking
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
        <Badge sport={article.sport} category={article.category} />
        <h2
          className="font-black leading-[1.1] mb-2 transition-colors group-hover:text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.1rem, 1.6vw, 1.45rem)', color: '#EEEEF8', letterSpacing: '-0.018em' }}
        >
          {article.title}
        </h2>
        {article.short_summary && (
          <p className="line-clamp-2 mb-2.5" style={{ fontSize: '0.82rem', color: '#8888AA', lineHeight: 1.5 }}>
            {article.short_summary}
          </p>
        )}
        <div className="flex items-center gap-2">
          {article.publishedAt && (
            <span className="text-[10px]" style={{ color: '#40405A', fontFamily: 'var(--font-sport)' }}>
              {timeAgo(article.publishedAt)}
            </span>
          )}
          <span
            className="text-[10px] font-bold flex items-center gap-1 group-hover:gap-2 transition-all"
            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
          >
            Leer <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Card de tira ───────────────────────────────────────────────
function StripCard({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(400).height(280).url() : null)

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-xl"
      style={{ height: 200, textDecoration: 'none', background: CARD_BG }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}30, #06060F)` }} />
      )}

      <div className="absolute inset-0" style={{ background: OVERLAY }} />

      {article.takaStatus === 'breaking' && (
        <div className="absolute top-2 left-2 z-10">
          <span
            className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded animate-pulse"
            style={{ background: 'rgba(6,6,14,0.9)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', fontFamily: 'var(--font-sport)' }}
          >
            <span className="w-1 h-1 rounded-full bg-red-500" />
            Breaking
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        <Badge sport={article.sport} category={article.category} />
        <h3
          className="font-bold leading-snug line-clamp-3 sm:line-clamp-2 transition-colors group-hover:text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.88rem, 1.5vw, 0.9rem)', color: '#DCDCF0', letterSpacing: '-0.01em' }}
        >
          {article.title}
        </h3>
        {article.publishedAt && (
          <span className="text-[9px] mt-1 block" style={{ color: '#32324A', fontFamily: 'var(--font-sport)' }}>
            {timeAgo(article.publishedAt)}
          </span>
        )}
      </div>
    </Link>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function NoticiasPortada({ articles }: { articles: Article[] }) {
  const safe = articles.filter(Boolean)
  const [pairIdx, setPairIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const pausedRef = useRef(false)
  const touchStartX = useRef<number | null>(null)

  const MAX_PAIRS = 5
  const totalPairs = Math.min(MAX_PAIRS, Math.max(1, Math.floor(safe.length / 2)))

  useEffect(() => {
    if (safe.length <= 2) return
    const timer = setInterval(() => {
      if (pausedRef.current) return
      setVisible(false)
      setTimeout(() => {
        setPairIdx(i => (i + 1) % totalPairs)
        setVisible(true)
      }, 400)
    }, ROTATION_MS)
    return () => clearInterval(timer)
  }, [safe.length, totalPairs])

  const goTo = (i: number) => {
    setVisible(false)
    setTimeout(() => { setPairIdx(i); setVisible(true) }, 400)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    pausedRef.current = true
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0) {
        goTo((pairIdx + 1) % totalPairs)
      } else {
        goTo((pairIdx - 1 + totalPairs) % totalPairs)
      }
    }
    touchStartX.current = null
    pausedRef.current = false
  }

  const base = (pairIdx * 2) % safe.length
  const big  = [safe[base], safe[(base + 1) % safe.length]].filter(Boolean)
  const strip = safe.slice(2, 7)

  if (safe.length === 0) return null

  return (
    <>
      {/* keyframe para la barra de progreso */}
      <style>{`@keyframes progressFill { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>

      <div className="mb-6">

        {/* ── 2 GRANDES ROTANTES (pausa en hover, swipe en táctil) ── */}
        <div
          onMouseEnter={() => { pausedRef.current = true }}
          onMouseLeave={() => { pausedRef.current = false }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-0"
            style={{ opacity: visible ? 1 : 0, transition: 'opacity 400ms ease' }}
          >
            {big.map(a => <BigCard key={a._id} article={a} />)}
          </div>

          {/* Barra de progreso + contador + dots */}
          {totalPairs > 1 && (
            <div className="flex items-center gap-3 mt-2.5 mb-3 px-1">
              {/* Barra */}
              <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  key={`bar-${pairIdx}`}
                  style={{
                    height: '100%',
                    borderRadius: 9999,
                    background: 'linear-gradient(to right, #7C3AED, #A78BFA)',
                    transformOrigin: 'left center',
                    animation: `progressFill ${ROTATION_MS}ms linear forwards`,
                    animationPlayState: pausedRef.current ? 'paused' : 'running',
                  }}
                />
              </div>

              {/* Contador */}
              <span className="flex-shrink-0 text-[10px] tabular-nums" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)' }}>
                {pairIdx + 1} / {totalPairs}
              </span>

              {/* Dots */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {Array.from({ length: totalPairs }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    style={{
                      width: i === pairIdx ? 16 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === pairIdx ? '#7C3AED' : 'rgba(255,255,255,0.15)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 300ms ease',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── TIRA (2 cols mobile → 5 cols desktop) ── */}
        {strip.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {strip.map(a => <StripCard key={a._id} article={a} />)}
          </div>
        )}

      </div>
    </>
  )
}
