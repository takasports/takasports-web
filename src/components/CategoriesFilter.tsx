'use client'

import { useState, useRef, useEffect } from 'react'
import { HOME_SPORT_CATEGORIES, MORE_SPORT_CATEGORIES, getSportStyle } from '@/lib/sports'

// Emoji + accent por categoría
const SPORT_META: Record<string, { emoji: string; accent: string }> = {
  'Todo':    { emoji: '✦',  accent: '#7C3AED' },
  'Fútbol':  { emoji: '⚽', accent: '#22c55e' },
  'WWE':     { emoji: '🎤', accent: '#facc15' },
  'F1':      { emoji: '🏎️', accent: '#ef4444' },
  'Baloncesto': { emoji: '🏀', accent: '#f59e0b' },
  'Tenis':   { emoji: '🎾', accent: '#d97706' },
  'UFC':     { emoji: '🥊', accent: '#f97316' },
  'Rugby':   { emoji: '🏉', accent: '#a78bfa' },
}

function getMeta(label: string) {
  return SPORT_META[label] ?? { emoji: '·', accent: '#7C3AED' }
}

interface Props {
  active: string
  onSelect: (cat: string) => void
  categories?: string[]
  moreCategories?: string[]
}

export default function CategoriesFilter({
  active,
  onSelect,
  categories = HOME_SPORT_CATEGORIES,
  moreCategories = MORE_SPORT_CATEGORIES,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moreOpen])

  const activeIsMore = moreCategories.includes(active)
  const { accent: activeAccent } = getMeta(active)

  return (
    <div className="relative" style={{ isolation: 'isolate' }}>
      {/* Fade izquierdo */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-8 w-4 z-10"
        style={{ background: 'linear-gradient(to right, var(--bg-base, #09090f) 20%, transparent)' }}
      />
      {/* Fade derecho */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-8 w-16 z-10"
        style={{ background: 'linear-gradient(to left, var(--bg-base, #09090f) 40%, transparent)' }}
      />

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 pr-8">

        {categories.map((sport) => {
          const isActive = sport === active
          const { emoji, accent } = getMeta(sport)

          return (
            <button
              key={sport}
              onClick={() => { onSelect(sport); setMoreOpen(false) }}
              className="group flex-shrink-0 flex items-center gap-1.5 transition-all duration-200"
              style={{
                padding: '5px 12px 5px 10px',
                borderRadius: 999,
                background: isActive
                  ? `linear-gradient(135deg, ${accent}22, ${accent}10)`
                  : 'transparent',
                border: isActive
                  ? `1px solid ${accent}45`
                  : '1px solid rgba(255,255,255,0.07)',
                boxShadow: isActive ? `0 0 0 1px ${accent}20, 0 2px 12px ${accent}18` : 'none',
                cursor: 'pointer',
              }}
            >
              <span
                className="text-sm leading-none flex-shrink-0"
                style={{ opacity: isActive ? 1 : 0.45, transition: 'opacity 200ms', fontSize: sport === 'Todo' ? 8 : 13 }}
              >
                {emoji}
              </span>
              <span
                className="text-[11px] font-bold leading-none whitespace-nowrap"
                style={{
                  fontFamily: 'var(--font-sport)',
                  color: isActive ? accent : '#7A7A8E',
                  letterSpacing: '0.03em',
                  transition: 'color 200ms',
                }}
              >
                {sport}
              </span>
            </button>
          )
        })}

        {/* Botón Más */}
        {moreCategories.length > 0 && (
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="flex items-center gap-1.5 transition-all duration-200"
              style={{
                padding: '5px 10px 5px 10px',
                borderRadius: 999,
                background: activeIsMore
                  ? `linear-gradient(135deg, ${getMeta(active).accent}22, ${getMeta(active).accent}10)`
                  : moreOpen
                  ? 'rgba(124,58,237,0.1)'
                  : 'transparent',
                border: activeIsMore
                  ? `1px solid ${getMeta(active).accent}45`
                  : moreOpen
                  ? '1px solid rgba(124,58,237,0.3)'
                  : '1px solid rgba(255,255,255,0.07)',
                cursor: 'pointer',
              }}
            >
              <span
                className="text-[11px] font-bold leading-none"
                style={{
                  fontFamily: 'var(--font-sport)',
                  color: activeIsMore ? getMeta(active).accent : moreOpen ? '#C4B5FD' : '#7A7A8E',
                  letterSpacing: '0.03em',
                }}
              >
                {activeIsMore ? active : 'Más'}
              </span>
              <svg
                width="8" height="8" viewBox="0 0 8 8" fill="none"
                style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease', flexShrink: 0 }}
              >
                <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: activeIsMore ? getMeta(active).accent : moreOpen ? '#C4B5FD' : '#7A7A8E' }}
                />
              </svg>
            </button>

            {moreOpen && (
              <div
                className="absolute top-full left-0 mt-2 py-1 rounded-2xl z-50"
                style={{
                  background: '#111118',
                  border: '1px solid rgba(255,255,255,0.09)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
                  minWidth: 130,
                  animation: 'dropIn 140ms cubic-bezier(0.34,1.2,0.64,1) forwards',
                }}
              >
                <style>{`
                  @keyframes dropIn {
                    from { opacity:0; transform:translateY(-6px) scale(0.97); }
                    to   { opacity:1; transform:translateY(0) scale(1); }
                  }
                `}</style>
                {moreCategories.map((cat) => {
                  const { emoji, accent } = getMeta(cat)
                  const isSel = active === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => { onSelect(cat); setMoreOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-white/[0.04]"
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="text-sm leading-none">{emoji}</span>
                      <span
                        className="text-[11px] font-bold"
                        style={{ fontFamily: 'var(--font-sport)', color: isSel ? accent : '#8E8E9E', letterSpacing: '0.03em' }}
                      >
                        {cat}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Underline accent indicator — muy sutil, no cuadrado */}
      <div
        className="mt-2 h-px"
        style={{
          background: `linear-gradient(to right, transparent 5%, ${activeAccent}28 30%, ${activeAccent}40 50%, ${activeAccent}28 70%, transparent 95%)`,
          transition: 'background 400ms ease',
          opacity: 0.8,
        }}
      />
    </div>
  )
}
