'use client'

import { getSportStyle } from '@/lib/sports'
import { MedalIcon, FootballIcon, BasketballIcon, F1Icon, TennisIcon, UFCIcon, WWEIcon } from '@/components/icons/GameIcons'

type IconC = React.ComponentType<{ size?: number }>

const SPORT_OPTIONS: { slug: string; label: string; Icon: IconC }[] = [
  { slug: '',           label: 'Todos',      Icon: MedalIcon },
  { slug: 'futbol',     label: 'Fútbol',     Icon: FootballIcon },
  { slug: 'baloncesto', label: 'Baloncesto', Icon: BasketballIcon },
  { slug: 'formula1',   label: 'F1',         Icon: F1Icon },
  { slug: 'tenis',      label: 'Tenis',      Icon: TennisIcon },
  { slug: 'ufc',        label: 'UFC',        Icon: UFCIcon },
  { slug: 'wwe',        label: 'WWE',        Icon: WWEIcon },
  { slug: 'contenido',  label: 'Contenido',  Icon: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M24 4l4 4-16 16-5 1 1-5L24 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M20 8l4 4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )},
]

export default function SportSelector({ active, onChange }: { active: string; onChange: (s: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
      {SPORT_OPTIONS.map((s) => {
        const isActive = active === s.slug
        const accent = s.slug ? getSportStyle(s.slug).accent : '#7C3AED'
        const Icon = s.Icon
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
            <span className="inline-flex items-center"><Icon size={14} /></span>
            <span>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
