'use client'

import { useState, useRef, useEffect } from 'react'
import { HOME_SPORT_CATEGORIES, MORE_SPORT_CATEGORIES, getSportStyle } from '@/lib/sports'
import { FootballIcon, BasketballIcon, F1Icon, TennisIcon, UFCIcon, RugbyIcon, WWEIcon } from '@/components/icons/GameIcons'

const SPORT_META: Record<string, { accent: string; Icon: React.ComponentType<{ size?: number }> | null }> = {
  'Todo':    { accent: '#7C3AED', Icon: null },
  'Fútbol':  { accent: '#22c55e', Icon: FootballIcon },
  'WWE':     { accent: '#facc15', Icon: WWEIcon },
  'F1':      { accent: '#ef4444', Icon: F1Icon },
  'Baloncesto': { accent: '#f59e0b', Icon: BasketballIcon },
  'Tenis':   { accent: '#d97706', Icon: TennisIcon },
  'UFC':     { accent: '#f97316', Icon: UFCIcon },
  'Rugby':   { accent: '#a78bfa', Icon: RugbyIcon },
}

function getMeta(label: string) {
  return SPORT_META[label] ?? { accent: '#7C3AED', Icon: null }
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
        className="pointer-events-none absolute right-0 top-0 bottom-8 w-12 sm:w-16 z-10"
        style={{ background: 'linear-gradient(to left, var(--bg-base, #09090f) 40%, transparent)' }}
      />

      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide snap-strip pb-0.5 pr-6 sm:pr-8">

        {categories.map((sport) => {
          const isActive = sport === active
          const { accent, Icon } = getMeta(sport)

          return (
            <button
              key={sport}
              onClick={() => { onSelect(sport); setMoreOpen(false) }}
              className="group flex-shrink-0 flex items-center gap-1.5 transition-all duration-200 hover:-translate-y-px"
              style={{
                padding: '7px 14px 7px 12px',
                borderRadius: 999,
                background: isActive
                  ? accent
                  : `${accent}1A`, // ~10% alpha tint del color del deporte
                border: isActive
                  ? `1px solid ${accent}`
                  : `1px solid ${accent}55`,
                boxShadow: isActive
                  ? `0 4px 16px ${accent}66`
                  : 'none',
                cursor: 'pointer',
              }}
            >
              <span
                className="leading-none flex-shrink-0 inline-flex items-center justify-center"
                style={{
                  color: isActive ? '#fff' : accent,
                  transition: 'color 200ms',
                }}
              >
                {Icon ? <Icon size={14} /> : (
                  <span className="block rounded-full" style={{ width: 6, height: 6, background: 'currentColor' }} />
                )}
              </span>
              <span
                className="text-[11.5px] font-black leading-none whitespace-nowrap"
                style={{
                  fontFamily: 'var(--font-sport)',
                  color: isActive ? '#fff' : accent,
                  letterSpacing: '0.04em',
                  transition: 'color 200ms',
                  textShadow: isActive ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
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
              className="flex items-center gap-1.5 transition-all duration-200 hover:-translate-y-px"
              style={{
                padding: '7px 12px',
                borderRadius: 999,
                background: activeIsMore
                  ? getMeta(active).accent
                  : moreOpen
                  ? 'rgba(124,58,237,0.22)'
                  : 'rgba(124,58,237,0.10)',
                border: activeIsMore
                  ? `1px solid ${getMeta(active).accent}`
                  : moreOpen
                  ? '1px solid rgba(124,58,237,0.6)'
                  : '1px solid rgba(124,58,237,0.35)',
                boxShadow: activeIsMore
                  ? `0 4px 16px ${getMeta(active).accent}66`
                  : 'none',
                cursor: 'pointer',
              }}
            >
              <span
                className="text-[11.5px] font-black leading-none"
                style={{
                  fontFamily: 'var(--font-sport)',
                  color: activeIsMore ? '#fff' : '#C4B5FD',
                  letterSpacing: '0.04em',
                  textShadow: activeIsMore ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {activeIsMore ? active : 'Más'}
              </span>
              <svg
                width="8" height="8" viewBox="0 0 8 8" fill="none"
                style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease', flexShrink: 0 }}
              >
                <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: activeIsMore ? '#fff' : '#C4B5FD' }}
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
                  const { accent, Icon } = getMeta(cat)
                  const isSel = active === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => { onSelect(cat); setMoreOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-white/[0.04]"
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="leading-none inline-flex items-center" style={{ color: isSel ? accent : '#8E8E9E' }}>
                        {Icon ? <Icon size={14} /> : <span className="block rounded-full" style={{ width: 6, height: 6, background: 'currentColor' }} />}
                      </span>
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
