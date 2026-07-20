'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { accentForSport, getSportLabel } from '@/lib/sports'
import { SportIcon } from '@/components/icons/GameIcons'

interface TickerItem {
  title: string
  sport?: string
  slug?: string
}

export default function BreakingNewsBar({
  items,
  titles,
}: {
  items?: TickerItem[]
  titles?: string[]
}) {
  // TODOS los hooks ARRIBA, antes de cualquier return condicional: el modo
  // autofetch hace que los datos pasen de vacío a llenos (async), y con el
  // return temprano antes de los hooks React rompería el orden de hooks.
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [fetched, setFetched] = useState<TickerItem[]>([])
  // Ocultar "Último momento" al bajar (móvil), manteniendo "En directo" fijo.
  const [hidden, setHidden] = useState(false)
  const hiddenRef = useRef(false)
  const lastYRef = useRef(0)

  // Autofetch (modo consola site-wide): si NO llegan items/titles por props,
  // pide los titulares recientes a /api/articles y prioriza los "breaking".
  // Si no hay nada, `resolved` queda vacío y la barra no se pinta (no inventar).
  const autofetch = !(items && items.length > 0) && !(titles && titles.length > 0)
  useEffect(() => {
    if (!autofetch) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/articles?pageSize=20', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const arts: Array<{ title: string; slug?: string; sport?: string; category?: string; takaStatus?: string | null }> =
          data?.articles ?? []
        const ordered = [
          ...arts.filter((a) => a.takaStatus === 'breaking'),
          ...arts.filter((a) => a.takaStatus !== 'breaking'),
        ]
          .slice(0, 8)
          .map((a) => ({ title: a.title, slug: a.slug, sport: a.sport || a.category }))
        if (!cancelled) setFetched(ordered)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [autofetch])

  // Sin fallback hardcodeado: si no hay breaking real, NO se muestra la barra.
  const resolved: TickerItem[] =
    items && items.length > 0
      ? items
      : titles && titles.length > 0
        ? titles.map((t) => ({ title: t }))
        : fetched

  // Reset de la animación al montar / al llegar datos para que SSR/hidratación
  // y el autofetch no descuadren el ticker.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    el.style.animation = 'none'
    requestAnimationFrame(() => { el.style.animation = '' })
  }, [resolved.length])

  // Ocultar en scroll-down, mostrar en scroll-up (solo móvil). Mismo patrón
  // anti-tiritones que usaba LiveStrip: throttle con rAF (1 evaluación/frame),
  // zona muerta de 8px y un candado de ~320ms tras cada cambio (duración de la
  // transición) para que el reflow del colapso no dispare el rebote.
  useEffect(() => {
    let raf = 0
    let locked = false
    let unlock: ReturnType<typeof setTimeout> | null = null

    const setHiddenSafe = (next: boolean) => {
      if (next === hiddenRef.current) return
      hiddenRef.current = next
      setHidden(next)
      locked = true
      if (unlock) clearTimeout(unlock)
      unlock = setTimeout(() => { locked = false; lastYRef.current = window.scrollY }, 320)
    }

    const evaluate = () => {
      raf = 0
      if (window.innerWidth >= 1024) { setHiddenSafe(false); return }
      const y = window.scrollY
      if (y < 48) { setHiddenSafe(false); lastYRef.current = y; return }
      if (locked) { lastYRef.current = y; return }
      const delta = y - lastYRef.current
      if (Math.abs(delta) < 8) return
      lastYRef.current = y
      setHiddenSafe(delta > 0) // baja → oculta · sube → muestra
    }

    const onScroll = () => { if (!raf) raf = requestAnimationFrame(evaluate) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
      if (unlock) clearTimeout(unlock)
    }
  }, [])

  if (resolved.length === 0) return null

  // Duplicate items so the ticker scrolls seamlessly
  const doubled = [...resolved, ...resolved]

  return (
    <div
      className="w-full overflow-hidden flex items-center transition-all duration-300"
      style={{
        maxHeight: hidden ? 0 : 36,
        opacity: hidden ? 0 : 1,
        background: 'rgba(9,9,15,0.95)',
        borderBottom: hidden ? 'none' : '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 w-full flex items-center gap-3 overflow-hidden" style={{ height: 36 }}>
        {/* Badge */}
        <div
          className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap" style={{ color: '#ef4444' }}>
            Último momento
          </span>
        </div>

        {/* Ticker — items individuales y clicables */}
        <div
          className="flex-1 overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div
            ref={trackRef}
            className="flex items-center gap-0 whitespace-nowrap animate-ticker"
            style={{ animationPlayState: paused ? 'paused' : 'running' }}
          >
            {doubled.map((item, i) => {
              const label = item.sport ? getSportLabel(item.sport) : null
              const href = item.slug ? `/noticias/${item.slug}` : null
              const content = (
                <span
                  className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-white"
                  style={{ color: '#B4B4C8' }}
                >
                  {/* Tanda v3: SportIcon teñido del acento en vez de emoji (variaba por SO) */}
                  {label && (
                    <span className="flex-shrink-0 inline-flex" style={{ color: accentForSport(label) }}>
                      <SportIcon sport={label} size={12} />
                    </span>
                  )}
                  {item.title}
                </span>
              )
              return (
                <span key={i} className="inline-flex items-center">
                  {href
                    ? <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link>
                    : content
                  }
                  <span className="inline-block mx-4 opacity-25" style={{ color: '#B4B4C8' }}>·</span>
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
