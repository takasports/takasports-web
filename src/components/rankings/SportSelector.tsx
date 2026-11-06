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

export default function SportSelector({ active, onChange, only }: { active: string; onChange: (s: string) => void; only?: string[] }) {
  const options = only ? SPORT_OPTIONS.filter(s => only.includes(s.slug)) : SPORT_OPTIONS
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
      {options.map((s) => {
        const isActive = active === s.slug
        const accent = s.slug ? getSportStyle(s.slug).accent : '#7C3AED'
        const Icon = s.Icon
        return (
          <button key={s.slug} onClick={() => onChange(s.slug)}
            className={`ts-chip${isActive ? ' is-on' : ''}`}
            aria-pressed={isActive}>
            <span className="inline-flex items-center" style={{ color: isActive ? '#fff' : accent }}><Icon size={14} /></span>
            <span>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
