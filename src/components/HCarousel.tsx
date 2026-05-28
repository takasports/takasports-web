'use client'

import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react'

// Carrusel horizontal con scroll-snap. Auto-avanza una tarjeta hacia la
// izquierda cada `tickMs`; al llegar al final vuelve al inicio. Se pausa al
// pasar el ratón por encima (por si alguien está leyendo) y deja flechas
// para retroceder/avanzar manualmente.
export default function HCarousel<T>({
  items,
  renderItem,
  getKey,
  basisClass,
  tickMs = 4000,
  visible = 5,
}: {
  items: T[]
  renderItem: (item: T, i: number) => ReactNode
  getKey: (item: T, i: number) => string
  basisClass: string
  tickMs?: number
  visible?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const step = useCallback(() => {
    const el = ref.current
    if (!el) return 0
    const card = el.querySelector('[data-carousel-card]') as HTMLElement | null
    const gap = 12 // gap-3
    return card ? card.offsetWidth + gap : el.clientWidth
  }, [])

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCanPrev(el.scrollLeft > 8)
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }, [])

  useEffect(() => { update() }, [items, update])

  const nudge = useCallback((dir: number) => {
    ref.current?.scrollBy({ left: dir * step(), behavior: 'smooth' })
  }, [step])

  // Auto-avance hacia la izquierda, tarjeta a tarjeta.
  useEffect(() => {
    if (items.length <= visible) return
    const t = setInterval(() => {
      if (paused) return
      const el = ref.current
      if (!el) return
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 8) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: step(), behavior: 'smooth' })
      }
    }, tickMs)
    return () => clearInterval(t)
  }, [items.length, visible, paused, step, tickMs])

  if (items.length === 0) return null

  return (
    <div
      className="relative group/carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`.hcarousel::-webkit-scrollbar{display:none}.hcarousel{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      <div
        ref={ref}
        onScroll={update}
        className="hcarousel flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth"
      >
        {items.map((item, i) => (
          <div
            key={getKey(item, i)}
            data-carousel-card
            className={`snap-start shrink-0 ${basisClass}`}
          >
            {renderItem(item, i)}
          </div>
        ))}
      </div>

      {/* Flecha volver — aparece cuando hay tarjetas escondidas a la izquierda */}
      {canPrev && (
        <button
          onClick={() => nudge(-1)}
          aria-label="Noticias anteriores"
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all opacity-70 hover:opacity-100 hover:scale-105"
          style={{
            background: 'rgba(9,9,15,0.82)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path d="M6.5 2L3 5l3.5 3" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Flecha avanzar */}
      {canNext && (
        <button
          onClick={() => nudge(1)}
          aria-label="Más noticias"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center transition-all opacity-70 hover:opacity-100 hover:scale-105"
          style={{
            background: 'rgba(9,9,15,0.82)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path d="M3.5 2L7 5l-3.5 3" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
