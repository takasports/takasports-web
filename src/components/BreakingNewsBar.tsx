'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { getSportEmoji, getSportLabel } from '@/lib/sports'

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
  // Sin fallback hardcodeado: si no hay breaking real, NO se muestra la barra (no inventar noticias).
  const resolved: TickerItem[] =
    items && items.length > 0
      ? items
      : titles && titles.length > 0
        ? titles.map(t => ({ title: t }))
        : []

  if (resolved.length === 0) return null

  // Duplicate items so the ticker scrolls seamlessly
  const doubled = [...resolved, ...resolved]

  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  // Reset animation on mount so SSR/hydration don't misalign
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    el.style.animation = 'none'
    requestAnimationFrame(() => { el.style.animation = '' })
  }, [])

  return (
    <div
      className="w-full overflow-hidden flex items-center"
      style={{
        height: 36,
        background: 'rgba(9,9,15,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 w-full flex items-center gap-3 overflow-hidden">
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
        >
          <div
            ref={trackRef}
            className="flex items-center gap-0 whitespace-nowrap animate-ticker"
            style={{ animationPlayState: paused ? 'paused' : 'running' }}
          >
            {doubled.map((item, i) => {
              const label = item.sport ? getSportLabel(item.sport) : null
              const emoji = label ? getSportEmoji(label) : null
              const href = item.slug ? `/noticias/${item.slug}` : null
              const content = (
                <span
                  className="inline-flex items-center gap-1.5 text-xs transition-colors hover:text-white"
                  style={{ color: '#B4B4C8' }}
                >
                  {emoji && <span>{emoji}</span>}
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
