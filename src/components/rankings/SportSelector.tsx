'use client'

import { getSportStyle } from '@/lib/sports'

const SPORT_OPTIONS = [
  { slug: '',           label: 'Todos',     emoji: '🏅' },
  { slug: 'futbol',     label: 'Fútbol',    emoji: '⚽' },
  { slug: 'baloncesto', label: 'NBA',       emoji: '🏀' },
  { slug: 'formula1',   label: 'F1',        emoji: '🏎️' },
  { slug: 'tenis',      label: 'Tenis',     emoji: '🎾' },
  { slug: 'ufc',        label: 'UFC',       emoji: '🥊' },
  { slug: 'wwe',        label: 'WWE',       emoji: '🤼' },
  { slug: 'contenido',  label: 'Contenido', emoji: '✍️' },
]

export default function SportSelector({ active, onChange }: { active: string; onChange: (s: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
      {SPORT_OPTIONS.map((s) => {
        const isActive = active === s.slug
        const accent = s.slug ? getSportStyle(s.slug).accent : '#7C3AED'
        return (
          <button key={s.slug} onClick={() => onChange(s.slug)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap"
            style={{
              background: isActive ? `${accent}20` : 'rgba(255,255,255,0.04)',
              color: isActive ? accent : '#6A6A7A',
              border: isActive ? `1px solid ${accent}45` : '1px solid rgba(255,255,255,0.06)',
              boxShadow: isActive ? `0 2px 20px ${accent}28` : 'none',
              cursor: 'pointer', fontFamily: 'var(--font-sport)',
            }}>
            <span className="text-sm">{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
