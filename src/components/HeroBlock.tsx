'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from '@/components/DynamicImage'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { useTilt } from '@/hooks/useTilt'

// ── Tira compacta inferior — 5 artículos ───────────────────────
function CompactStripItem({ art }: { art: Article }) {
  const href = `/article/${art.slug ?? art._id}`
  const { accent } = getSportStyle(art.sport, art.category)
  const label = getSportLabel(art.sport, art.category)
  const rawImgUrl = art.imageUrl ?? (art.image?.asset ? urlFor(art.image).width(160).height(100).url() : null)
  const [imgFailed, setImgFailed] = useState(false)
  const imgUrl = imgFailed ? null : rawImgUrl
  const fresh = isNew(art.publishedAt)

  return (
    <Link
      href={href}
      className="group flex items-start gap-2.5 rounded-xl transition-all hover:brightness-110 hover:-translate-y-px"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        padding: '10px',
        textDecoration: 'none',
        borderLeft: `3px solid ${accent}70`,
      }}
    >
      {imgUrl ? (
        <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 7, flexShrink: 0, overflow: 'hidden' }}>
          <Image src={imgUrl} alt={art.title} fill className="object-cover" onError={() => setImgFailed(true)} />
        </div>
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 7, flexShrink: 0, background: `linear-gradient(135deg, ${accent}18, #09090F)` }} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 mb-0.5">
          {fresh && (
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10B981', display: 'inline-block', flexShrink: 0 }} />
          )}
          {label && (
            <span className="text-[8px] font-black uppercase tracking-widest truncate" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
              {label}
            </span>
          )}
        </div>
        <p className="text-[11px] font-bold leading-snug line-clamp-2 transition-colors group-hover:text-white" style={{ color: '#A0A0BE', fontFamily: 'var(--font-display)' }}>
          {art.title}
        </p>
        {art.publishedAt && (
          <p className="text-[9px] mt-1" style={{ color: '#30304A' }}>{timeAgo(art.publishedAt)}</p>
        )}
      </div>
    </Link>
  )
}

function CompactStrip({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-3">
      {articles.map((art) => <CompactStripItem key={art._id} art={art} />)}
    </div>
  )
}

interface Article {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

const INTERVAL = 6500
const FADE_OUT = 320
const FADE_IN  = 420
const NEW_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 horas

function isNew(publishedAt?: string): boolean {
  if (!publishedAt) return false
  return Date.now() - new Date(publishedAt).getTime() < NEW_THRESHOLD_MS
}

// ── Ken Burns wrapper — la clave fuerza restart de la animación ─
function KenBurnsImage({
  src,
  alt,
  animKey,
  priority = false,
  onError,
}: {
  src: string
  alt: string
  animKey: number
  priority?: boolean
  onError?: () => void
}) {
  return (
    <div
      key={animKey}
      className="absolute inset-0"
      style={{
        animation: `kenBurns ${INTERVAL + 1200}ms ease-in-out forwards`,
        transformOrigin: 'center center',
        willChange: 'transform',
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 62vw"
        className="object-cover"
        priority={priority}
        onError={onError}
      />
    </div>
  )
}

// ── Tarjeta grande (62%) ────────────────────────────────────────
function BigCard({
  article,
  visible,
  animKey,
}: {
  article: Article
  visible: boolean
  animKey: number
}) {
  const href = `/article/${article.slug ?? article._id}`
  const label = getSportLabel(article.sport, article.category)
  const { accent } = getSportStyle(article.sport, article.category)
  const rawImgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(1200).height(680).url() : null)
  const [imgFailed, setImgFailed] = useState(false)
  const imgUrl = imgFailed ? null : rawImgUrl
  const fresh = isNew(article.publishedAt)
  const { elRef } = useTilt({ max: 4, scale: 1.01, speed: 0.1 })

  return (
    <div ref={elRef} className="h-full">
    <Link
      href={href}
      className="group relative flex flex-col justify-end overflow-hidden rounded-2xl h-full"
      style={{
        textDecoration: 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.984) translateY(8px)',
        transition: `opacity ${visible ? FADE_IN : FADE_OUT}ms ease, transform ${visible ? FADE_IN : FADE_OUT}ms ease`,
      }}
    >
      {/* Imagen con Ken Burns */}
      {imgUrl ? (
        <KenBurnsImage key={animKey} src={imgUrl} alt={article.title} animKey={animKey} priority onError={() => setImgFailed(true)} />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg,#1e1040 0%,#0f0825 45%,#090912 100%)' }}
        />
      )}

      {/* Overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top,rgba(9,9,15,0.97) 0%,rgba(9,9,15,0.52) 38%,rgba(9,9,15,0.06) 68%,transparent 100%)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to right,rgba(9,9,15,0.52) 0%,transparent 58%)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-96 h-72 blur-3xl opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 30% 80%, ${accent}CC, transparent)` }}
      />

      {/* Contenido editorial */}
      <div className="relative z-10 p-6 lg:p-8">
        {/* Badges */}
        <div className="flex items-center gap-2 mb-3">
          {fresh && (
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(16,185,129,0.12)',
                color: '#10B981',
                border: '1px solid rgba(16,185,129,0.28)',
                fontFamily: 'var(--font-sport)',
              }}
            >
              Nuevo
            </span>
          )}
          {label && (
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{
                background: `${accent}22`,
                color: accent,
                border: `1px solid ${accent}40`,
                backdropFilter: 'blur(8px)',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {label}
            </span>
          )}
        </div>

        <h2
          className="font-black leading-tight mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 2.9vw, 3rem)',
            color: '#F8F8FF',
            letterSpacing: '-0.018em',
            textShadow: '0 2px 32px rgba(0,0,0,0.7)',
          }}
        >
          {article.title}
        </h2>

        {article.short_summary && (
          <p
            className="hidden sm:block leading-relaxed line-clamp-2 mb-3"
            style={{ fontSize: '0.875rem', color: '#8A8AA8' }}
          >
            {article.short_summary}
          </p>
        )}

        <div className="flex items-center gap-3">
          {article.publishedAt && (
            <span className="text-xs" style={{ color: '#525266' }}>
              {timeAgo(article.publishedAt)}
            </span>
          )}
          <span
            className="text-xs font-semibold flex items-center gap-1 transition-all group-hover:gap-2"
            style={{ color: '#8B5CF6' }}
          >
            Leer artículo
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
    </div>
  )
}

// ── Tarjeta pequeña (columna derecha) ─────────────────────────
function SmallCard({
  article,
  visible,
  delay,
}: {
  article: Article
  visible: boolean
  delay: number
}) {
  const href = `/article/${article.slug ?? article._id}`
  const label = getSportLabel(article.sport, article.category)
  const { accent } = getSportStyle(article.sport, article.category)
  const rawImgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(500).height(300).url() : null)
  const [imgFailed, setImgFailed] = useState(false)
  const imgUrl = imgFailed ? null : rawImgUrl
  const fresh = isNew(article.publishedAt)
  const fadeMs = visible ? FADE_IN : FADE_OUT
  const { elRef } = useTilt({ max: 3, scale: 1.015, speed: 0.1 })

  return (
    <div ref={elRef} style={{ flex: 1 }}>
    <Link
      href={href}
      className="group relative h-full flex flex-col justify-end overflow-hidden rounded-xl"
      style={{
        textDecoration: 'none',
        borderLeft: `3px solid ${accent}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-5px)',
        transition: `opacity ${fadeMs}ms ease ${visible ? delay : 0}ms, transform ${fadeMs}ms ease ${visible ? delay : 0}ms`,
      }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 1024px) 100vw, 38vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${accent}18, #09090F)` }}
        />
      )}

      {/* Overlay — más imagen visible en la parte alta */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top,rgba(9,9,15,0.97) 0%,rgba(9,9,15,0.72) 45%,rgba(9,9,15,0.12) 100%)' }}
      />

      <div className="relative z-10 p-4">
        <div className="flex items-center gap-1.5 mb-1">
          {fresh && (
            <span
              style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#10B981',
                boxShadow: '0 0 6px rgba(16,185,129,0.6)',
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
          )}
          {label && (
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: accent, fontFamily: 'var(--font-sport)' }}
            >
              {label}
            </span>
          )}
        </div>

        <h3
          className="font-bold leading-snug line-clamp-2 transition-colors group-hover:text-white"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(0.82rem, 1.1vw, 0.96rem)',
            color: '#D8D8F0',
          }}
        >
          {article.title}
        </h3>

        {article.publishedAt && (
          <p className="text-[10px] mt-1" style={{ color: '#3D3D58' }}>
            {timeAgo(article.publishedAt)}
          </p>
        )}
      </div>
    </Link>
    </div>
  )
}

// ── Barra de progreso animada ───────────────────────────────────
function ProgressBar({ offset, paused }: { offset: number; paused: boolean }) {
  return (
    <div
      style={{
        marginTop: 10,
        height: 2,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        key={offset}
        style={{
          height: '100%',
          background: 'linear-gradient(to right, #7C3AED, #A78BFA)',
          animation: `heroProgress ${INTERVAL}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────
export default function HeroBlock({ articles }: { articles: Article[] }) {
  // Los primeros 3 rotan en el hero. Los restantes van en la tira inferior.
  const heroArticles = articles.slice(0, 3)
  const stripArticles = articles.slice(3)
  const len = heroArticles.length
  const [offset, setOffset] = useState(0)
  const [visible, setVisible] = useState(true)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef<number | null>(null)

  const advance = useCallback(
    (dir: number = 1) => {
      if (len < 2) return
      setVisible(false)
      setTimeout(() => {
        setOffset((o) => (o + dir + len) % len)
        setVisible(true)
      }, FADE_OUT + 40)
    },
    [len]
  )

  const goTo = useCallback((i: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setVisible(false)
    setTimeout(() => {
      setOffset(i)
      setVisible(true)
    }, FADE_OUT + 40)
  }, [])

  // Autoplay
  useEffect(() => {
    if (paused || len < 2) return
    timerRef.current = setInterval(() => advance(1), INTERVAL)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [advance, paused, len])

  // Teclado — flechas izq/der
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  advance(-1)
      if (e.key === 'ArrowRight') advance(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  if (len === 0) return null

  const big = heroArticles[offset % len]
  const s1  = heroArticles[(offset + 1) % len]
  const s2  = heroArticles[(offset + 2) % len]

  return (
    <>
      {/* Keyframes inyectados una sola vez */}
      <style>{`
        @keyframes kenBurns {
          from { transform: scale(1.0) translate(0, 0); }
          to   { transform: scale(1.065) translate(-0.8%, -0.4%); }
        }
        @keyframes heroProgress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>

      <div
        className="hero-enter"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return
          const delta = touchStartX.current - e.changedTouches[0].clientX
          if (Math.abs(delta) > 48) advance(delta > 0 ? 1 : -1)
          touchStartX.current = null
        }}
      >
        {/* ── Cabecera: contador + flechas ─────────────────── */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="section-accent" />
            <span
              className="text-[10px] font-black tracking-widest"
              style={{ color: '#52527A', fontFamily: 'var(--font-sport)' }}
            >
              Portada
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-black tabular-nums"
              style={{ color: '#38384A', fontFamily: 'var(--font-sport)' }}
            >
              {String((offset % len) + 1).padStart(2, '0')} / {String(len).padStart(2, '0')}
            </span>
            {len > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => advance(-1)}
                  aria-label="Artículo anterior"
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity opacity-35 hover:opacity-75"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M6.5 2L3 5l3.5 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => advance(1)}
                  aria-label="Artículo siguiente"
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity opacity-35 hover:opacity-75"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3.5 2L7 5l-3.5 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Grid hero ─────────────────────────────────────── */}
        <div
          className="flex flex-col lg:flex-row gap-3"
          style={{ height: 'clamp(400px, 52vw, 620px)' }}
        >
          {/* Artículo grande — izquierda */}
          <div style={{ flex: '0 0 62%' }}>
            <BigCard article={big} visible={visible} animKey={offset % len} />
          </div>

          {/* Artículos pequeños — derecha apilados */}
          <div className="flex lg:flex-col gap-3 flex-1">
            {len > 1 && <SmallCard article={s1} visible={visible} delay={60} />}
            {len > 2 && <SmallCard article={s2} visible={visible} delay={120} />}
          </div>
        </div>

        {/* ── Barra de progreso ─────────────────────────────── */}
        <ProgressBar offset={offset % len} paused={paused} />

        {/* ── Dots de posición ──────────────────────────────── */}
        {len >= 3 && (
          <div className="flex items-center gap-1.5 mt-3 justify-center lg:justify-start">
            {Array.from({ length: len }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Ir al artículo ${i + 1}`}
                style={{
                  width: i === offset % len ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === offset % len ? '#7C3AED' : 'rgba(255,255,255,0.12)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'width 250ms ease, background 250ms ease',
                }}
              />
            ))}
          </div>
        )}

        {/* ── Tira compacta: 5 artículos adicionales ────────── */}
        <CompactStrip articles={stripArticles} />
      </div>
    </>
  )
}
