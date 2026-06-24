'use client'

import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import Image from '@/components/DynamicImage'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel, getSportEmoji } from '@/lib/sports'
import { useTilt } from '@/hooks/useTilt'
import HCarousel from '@/components/HCarousel'

const STRIP_COLS = 5

// ── Tira compacta inferior — 5 artículos ───────────────────────
function CompactStripItem({ art }: { art: Article }) {
  const href = `/noticias/${art.slug ?? art._id}`
  const { accent } = getSportStyle(art.sport, art.category)
  const label = getSportLabel(art.sport, art.category)
  const rawImgUrl = art.imageUrl ?? (art.image?.asset ? urlFor(art.image).width(480).height(270).url() : null)
  const [imgFailed, setImgFailed] = useState(false)
  const imgUrl = imgFailed ? null : rawImgUrl
  const fresh = isNew(art.publishedAt)

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl overflow-hidden transition-all hover:brightness-110 hover:-translate-y-0.5"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset',
      }}
    >
      <div className="relative w-full" style={{ aspectRatio: '16 / 9', background: '#06060F' }}>
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={art.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 18vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}06)` }}
          >
            <div style={{ fontSize: '2.6rem', opacity: 0.35 }}>{getSportEmoji(label)}</div>
          </div>
        )}
        {/* sutil oscurecido inferior para que el borde pegue con la card */}
        <div
          className="absolute inset-x-0 bottom-0 h-8 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(9,9,15,0.55))' }}
        />
        {/* badge deporte sobre la imagen */}
        {label && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            {fresh && (
              <span
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#10B981',
                  boxShadow: '0 0 6px rgba(16,185,129,0.7)',
                  display: 'inline-block',
                }}
              />
            )}
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{
                background: `${accent}26`,
                color: accent,
                border: `1px solid ${accent}45`,
                backdropFilter: 'blur(6px)',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {label}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col p-3">
        <h3
          className="font-bold leading-snug line-clamp-3 transition-colors group-hover:text-white"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            color: '#D8D8F0',
            letterSpacing: '-0.005em',
          }}
        >
          {art.title}
        </h3>
        {art.publishedAt && (
          <p className="text-[10px] mt-2" style={{ color: '#52527A', fontFamily: 'var(--font-sport)' }}>
            {timeAgo(art.publishedAt)}
          </p>
        )}
      </div>
    </Link>
  )
}

// Carrusel: la tira se desplaza una tarjeta a la izquierda cada pocos
// segundos, trayendo noticias que no caben en pantalla (la 9, 10, 11…).
// Flechas para retroceder/avanzar a mano.
function CompactStrip({ pool }: { pool: Article[] }) {
  return (
    <div className="mt-4">
      <HCarousel
        items={pool}
        getKey={(art, i) => art._id ?? String(i)}
        visible={STRIP_COLS}
        tickMs={4000}
        basisClass="basis-[calc((100%-12px)/2)] sm:basis-[calc((100%-24px)/3)] lg:basis-[calc((100%-48px)/5)]"
        renderItem={(art) => <CompactStripItem art={art} />}
      />
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
  still = false,
  onError,
}: {
  src: string
  alt: string
  animKey: number
  priority?: boolean
  /** Sin Ken Burns: la imagen del LCP debe estar quieta para asentar la métrica
   *  durante la carga (un transform continuo deja el LCP sin atribuir). */
  still?: boolean
  onError?: () => void
}) {
  return (
    <div
      key={animKey}
      className="absolute inset-0 hero-kenburns"
      style={{
        animation: still ? 'none' : `kenBurns ${INTERVAL + 1200}ms ease-in-out forwards`,
        transformOrigin: 'center center',
        willChange: still ? 'auto' : 'transform',
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 62vw"
        className="object-cover"
        priority={priority}
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
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
  still = false,
}: {
  article: Article
  visible: boolean
  animKey: number
  still?: boolean
}) {
  const href = `/noticias/${article.slug ?? article._id}`
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
      className="hero-big-col group relative flex flex-col justify-end overflow-hidden rounded-2xl h-full"
      style={{
        textDecoration: 'none',
        background: '#06060F',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.984) translateY(8px)',
        transition: `opacity ${visible ? FADE_IN : FADE_OUT}ms ease, transform ${visible ? FADE_IN : FADE_OUT}ms ease`,
      }}
    >
      {/* Imagen con Ken Burns */}
      {imgUrl ? (
        <KenBurnsImage key={animKey} src={imgUrl} alt={article.title} animKey={animKey} priority still={still} onError={() => setImgFailed(true)} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: getSportStyle(article.sport, article.category).bg }}>
          <div style={{ fontSize: '10rem', lineHeight: 1, opacity: 0.1, userSelect: 'none', filter: 'blur(2px)' }}>
            {getSportEmoji(getSportLabel(article.sport, article.category))}
          </div>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${getSportStyle(article.sport, article.category).accent}15 0%, transparent 70%)` }} />
        </div>
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
          className="font-black leading-[0.98] mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.7rem, 3.4vw, 4rem)',
            fontWeight: 900,
            color: '#F8F8FF',
            letterSpacing: '-0.022em',
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
  const href = `/noticias/${article.slug ?? article._id}`
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
        background: '#06060F',
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
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: getSportStyle(article.sport, article.category).bg }}>
          <div style={{ fontSize: '5rem', lineHeight: 1, opacity: 0.12, userSelect: 'none', filter: 'blur(1px)' }}>
            {getSportEmoji(getSportLabel(article.sport, article.category))}
          </div>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${accent}18 0%, transparent 70%)` }} />
        </div>
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

        {article.short_summary && (
          <p className="text-[10px] leading-snug line-clamp-1 mt-1" style={{ color: '#686884' }}>
            {article.short_summary}
          </p>
        )}

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

// ── Secundaria compacta (tira deslizable en móvil) ──────────────
// Mini-tarjeta horizontal (miniatura + titular). En escritorio las
// secundarias van apiladas con imagen (SmallCard); en móvil estaban ocultas,
// ahora se deslizan aquí.
function SecondaryMini({ art }: { art: Article }) {
  const href = `/noticias/${art.slug ?? art._id}`
  const label = getSportLabel(art.sport, art.category)
  const { accent } = getSportStyle(art.sport, art.category)
  const rawImgUrl = art.imageUrl ?? (art.image?.asset ? urlFor(art.image).width(160).height(160).url() : null)
  const [imgFailed, setImgFailed] = useState(false)
  const imgUrl = imgFailed ? null : rawImgUrl
  return (
    <Link
      href={href}
      data-carousel-card
      className="snap-start shrink-0 flex gap-2.5 rounded-xl p-2.5 transition-all active:brightness-110"
      style={{ width: '78%', background: 'var(--bg-card)', border: `1px solid ${accent}30`, textDecoration: 'none' }}
    >
      <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 54, height: 54, background: '#06060F' }}>
        {imgUrl ? (
          <Image src={imgUrl} alt={art.title} fill sizes="54px" className="object-cover" onError={() => setImgFailed(true)} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: getSportStyle(art.sport, art.category).bg }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1, opacity: 0.2 }}>{getSportEmoji(label)}</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex flex-col gap-1">
        {label && (
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
            {label}
          </span>
        )}
        <h3 className="font-bold leading-snug line-clamp-2" style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: '#D8D8F0' }}>
          {art.title}
        </h3>
      </div>
    </Link>
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
        className="hero-progress"
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
export default function HeroBlock({ articles, stripPool }: { articles: Article[]; stripPool?: Article[] }) {
  // Los primeros 3 rotan en el hero. La tira inferior usa `stripPool` (que puede
  // incluir noticias más allá del bloque destacado) o, en su defecto, el resto.
  const heroArticles  = articles.slice(0, 3)
  const stripArticles = stripPool ?? articles.slice(3)
  const len = heroArticles.length
  const [offset, setOffset] = useState(0)
  const [visible, setVisible] = useState(true)
  const [paused, setPaused] = useState(false)
  // El autoplay NO arranca hasta que la página termina de cargar (window.load),
  // con un tope de seguridad de 10 s. Así, durante la ventana de carga el héroe
  // se queda en la 1ª imagen QUIETA (sin rotar ni Ken Burns) y el LCP se asienta
  // en ella; antes, el carrusel rotando + el zoom continuo dejaban el "elemento
  // más grande" sin asentar y disparaban el LCP a decenas de segundos en móvil.
  const [autoplay, setAutoplay] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef<number | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const [heroInView, setHeroInView] = useState(true)

  const advance = useCallback(
    (dir: number = 1) => {
      if (len < 2) return
      startTransition(() => { setVisible(false) })
      setTimeout(() => {
        startTransition(() => {
          setOffset((o) => (o + dir + len) % len)
          setVisible(true)
        })
      }, FADE_OUT + 40)
    },
    [len]
  )

  const goTo = useCallback((i: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    startTransition(() => { setVisible(false) })
    setTimeout(() => {
      startTransition(() => {
        setOffset(i)
        setVisible(true)
      })
    }, FADE_OUT + 40)
  }, [])

  // Habilita el autoplay al completar la carga (window.load), con fallback 10 s
  // por si algún recurso cuelga. Ata el arranque del carrusel a que el LCP ya
  // haya tenido tiempo de asentarse en la 1ª imagen.
  useEffect(() => {
    let done = false
    const go = () => { if (!done) { done = true; setAutoplay(true) } }
    if (document.readyState === 'complete') { go(); return }
    window.addEventListener('load', go, { once: true })
    const fb = setTimeout(go, 10000)
    return () => { window.removeEventListener('load', go); clearTimeout(fb) }
  }, [])

  // Autoplay — pausado si el usuario pide reducir movimiento o aún no cargó.
  useEffect(() => {
    if (!autoplay || paused || len < 2) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    timerRef.current = setInterval(() => advance(1), INTERVAL)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [advance, paused, len, autoplay])

  // El hero solo "escucha" las flechas cuando está a la vista (no roba teclas
  // mientras el usuario está más abajo en la página).
  useEffect(() => {
    const el = heroRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(([e]) => setHeroInView(e.isIntersecting), { threshold: 0.25 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Teclado — flechas izq/der. Solo si el hero está visible y el foco NO está
  // en un campo de texto (no interferir al escribir en el buscador/modales).
  useEffect(() => {
    if (!heroInView) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft')  advance(-1)
      if (e.key === 'ArrowRight') advance(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, heroInView])

  if (len === 0) return null

  const big = heroArticles[offset % len]
  const s1  = heroArticles[(offset + 1) % len]
  const s2  = heroArticles[(offset + 2) % len]

  return (
    <>
      <div
        ref={heroRef}
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
        <div className="flex items-center justify-end mb-2.5">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-black tabular-nums"
              style={{ color: '#6B6B8A', fontFamily: 'var(--font-sport)' }}
            >
              {String((offset % len) + 1).padStart(2, '0')} / {String(len).padStart(2, '0')}
            </span>
            {len > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => advance(-1)}
                  aria-label="Artículo anterior"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all opacity-60 hover:opacity-100 hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                    <path d="M6.5 2L3 5l3.5 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => advance(1)}
                  aria-label="Artículo siguiente"
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all opacity-60 hover:opacity-100 hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                    <path d="M3.5 2L7 5l-3.5 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Grid hero ─────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-3 hero-h">
          {/* Artículo grande — izquierda */}
          <div style={{ flex: '0 0 62%' }}>
            <BigCard article={big} visible={visible} animKey={offset % len} still={offset === 0 && !autoplay} />
          </div>

          {/* Artículos pequeños — derecha apilados (ocultos en mobile) */}
          <div className="hidden sm:flex lg:flex-col gap-3 flex-1">
            {len > 1 && <SmallCard article={s1} visible={visible} delay={60} />}
            {len > 2 && <SmallCard article={s2} visible={visible} delay={120} />}
          </div>
        </div>

        {/* ── Secundarias deslizables (solo móvil; en escritorio van apiladas) ─ */}
        {len > 1 && (
          <div
            className="sm:hidden mt-3"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#9090B0', fontFamily: 'var(--font-sport)' }}>
                Más noticias
              </span>
              <span className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: '#6B6B8A', fontFamily: 'var(--font-sport)' }}>
                desliza
                <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                  <path d="M3.5 2L7 5l-3.5 3" stroke="#6B6B8A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1">
              {[len > 1 ? s1 : null, len > 2 ? s2 : null]
                .filter((a): a is Article => Boolean(a))
                .map((a) => (
                  <SecondaryMini key={a._id} art={a} />
                ))}
            </div>
          </div>
        )}

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
                  width: i === offset % len ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: i === offset % len ? '#7C3AED' : 'rgba(255,255,255,0.2)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'width 250ms ease, background 250ms ease',
                  boxShadow: i === offset % len ? '0 0 8px rgba(124,58,237,0.5)' : 'none',
                }}
              />
            ))}
          </div>
        )}

        {/* ── Tira compacta: carrusel que desliza a la izquierda ─── */}
        <CompactStrip pool={stripArticles} />
      </div>
    </>
  )
}
