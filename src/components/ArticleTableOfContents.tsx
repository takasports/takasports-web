'use client'

import { useEffect, useRef, useState } from 'react'
import type { TocHeading } from '@/lib/article-toc'

interface Props {
  headings: TocHeading[]
  variant?: 'sidebar' | 'mobile'
}

// Offset del header sticky (56px) + un poco de respiro.
const SCROLL_OFFSET = 80

export default function ArticleTableOfContents({ headings, variant = 'sidebar' }: Props) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null)
  const tickingRef = useRef(false)

  useEffect(() => {
    if (headings.length === 0) return

    // Estrategia: scroll-spy basado en getBoundingClientRect en lugar de
    // IntersectionObserver para que el "activo" sea el último heading cuyo
    // top ya pasó el offset. Más fiable cuando hay headings cortos seguidos.
    const compute = () => {
      tickingRef.current = false
      let current: string | null = headings[0]?.id ?? null
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (!el) continue
        const top = el.getBoundingClientRect().top
        if (top - SCROLL_OFFSET - 1 <= 0) {
          current = h.id
        } else {
          break
        }
      }
      setActiveId(current)
    }

    const onScroll = () => {
      if (tickingRef.current) return
      tickingRef.current = true
      requestAnimationFrame(compute)
    }

    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [headings])

  if (headings.length < 2) return null

  const handleClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    const top = window.scrollY + el.getBoundingClientRect().top - SCROLL_OFFSET
    window.scrollTo({ top, behavior: 'smooth' })
    if (typeof history?.replaceState === 'function') {
      history.replaceState(null, '', `#${id}`)
    }
    setActiveId(id)
  }

  const list = (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {headings.map(h => {
        const active = h.id === activeId
        return (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={e => handleClick(e, h.id)}
              aria-current={active ? 'location' : undefined}
              style={{
                display: 'block',
                padding: h.level === 3 ? '6px 8px 6px 18px' : '7px 8px',
                fontFamily: 'var(--font-sport)',
                fontSize: h.level === 3 ? 12 : 13,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderLeft: active ? '2px solid var(--purple)' : '2px solid transparent',
                marginLeft: h.level === 3 ? 8 : 0,
                textDecoration: 'none',
                lineHeight: 1.35,
                borderRadius: 'var(--radius-sm)',
                transition: 'color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
              }}
            >
              {h.text}
            </a>
          </li>
        )
      })}
    </ul>
  )

  if (variant === 'mobile') {
    return (
      <details
        className="lg:hidden mb-6 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            listStyle: 'none',
            padding: 'var(--space-sm) var(--space-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontFamily: 'var(--font-sport)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}
        >
          <span>En este artículo · {headings.length}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0, transition: 'transform var(--duration-base) var(--ease-standard)' }}
            className="toc-chev"
          >
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <nav aria-label="Índice del artículo" style={{ padding: 'var(--space-xs) var(--space-sm) var(--space-sm)' }}>
          {list}
        </nav>
      </details>
    )
  }

  return (
    <nav
      aria-label="Índice del artículo"
      className="hidden lg:block"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-md)',
      }}
    >
      <p
        className="section-label"
        style={{ marginBottom: 10 }}
      >
        En este artículo
      </p>
      {list}
    </nav>
  )
}
