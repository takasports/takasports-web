'use client'

import type { ReactNode } from 'react'
import type { SportEvent } from '@/lib/types'
import { COMPETITIONS, FEATURED_COMPETITIONS, matchesCompetition } from '@/lib/calendar-competitions'
import { getCompAccent } from '@/lib/competitions'
import { SportIcon } from '@/components/icons/GameIcons'

// Barra unificada de categorías del calendario, TODO en estilo "ficha con logo"
// y scrollable lateralmente. Orden: Destacados (principal) → Todo → deportes
// paraguas (Fútbol/Tenis/Pádel, con icono) → competiciones (con escudo oficial).
// Filtra EN EL SITIO: modos/deportes ajustan el filtro de deporte; competiciones
// fijan la competición y muestran su banner. NBA/F1/UFC viven como competición
// (con escudo) → no se repiten como deporte.

const UMBRELLA_SPORTS = ['Fútbol', 'Tenis', 'Pádel'] // siempre visibles; agrupan varias competiciones

function StarIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill={color} aria-hidden>
      <path d="M6 1l1.5 3.2 3.5.5-2.5 2.4.6 3.4L6 8.9 2.9 10.5l.6-3.4L1 4.7l3.5-.5L6 1z" />
    </svg>
  )
}
function AllIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.6" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1.2" /><rect x="9" y="2" width="5" height="5" rx="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" /><rect x="9" y="9" width="5" height="5" rx="1.2" />
    </svg>
  )
}

function Card({
  active, accent, primary, badge, label, sub, onClick, ariaLabel,
}: {
  active: boolean
  accent: string
  primary?: boolean
  badge: ReactNode
  label: string
  sub: string
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className="cal-press group flex items-center gap-2.5 flex-shrink-0 rounded-xl pl-2.5 pr-3 py-2 transition-all"
      style={{
        background: active ? `${accent}22` : (primary ? `${accent}14` : 'rgba(255,255,255,0.03)'),
        borderTop: `1px solid ${active ? accent + '99' : (primary ? accent + '55' : 'rgba(255,255,255,0.07)')}`,
        borderRight: `1px solid ${active ? accent + '99' : (primary ? accent + '55' : 'rgba(255,255,255,0.07)')}`,
        borderBottom: `1px solid ${active ? accent + '99' : (primary ? accent + '55' : 'rgba(255,255,255,0.07)')}`,
        borderLeft: `3px solid ${accent}`,
        cursor: 'pointer',
        boxShadow: active ? `0 0 14px ${accent}33` : 'none',
      }}
    >
      <span className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 30, height: 30, background: `${accent}1A` }}>
        {badge}
      </span>
      <span className="flex flex-col leading-tight items-start">
        <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: active || primary ? '#fff' : '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
          {label}
        </span>
        <span className="text-[9px] font-black uppercase tracking-wider tabular-nums whitespace-nowrap" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
          {sub}
        </span>
      </span>
    </button>
  )
}

export default function CompetitionSelector({
  events,
  activeFilter,
  activeComp,
  onSelectSport,
  onSelectComp,
}: {
  events: SportEvent[]
  activeFilter: string
  activeComp: string | null
  onSelectSport: (key: string) => void
  onSelectComp: (slug: string) => void
}) {
  const countBySlug = new Map<string, number>()
  for (const c of COMPETITIONS) countBySlug.set(c.slug, events.filter((e) => matchesCompetition(c, e)).length)
  const countBySport = (s: string) => events.filter((e) => e.sport === s).length

  const extras = COMPETITIONS
    .filter((c) => !c.featured && (countBySlug.get(c.slug) ?? 0) > 0)
    .sort((a, b) => (countBySlug.get(b.slug) ?? 0) - (countBySlug.get(a.slug) ?? 0))
  // Primero los deportes (NBA/F1/UFC son una sola competición → van con Fútbol/
  // Tenis/Pádel, al principio); después las competiciones de fútbol (LaLiga,
  // Champions, Premier…).
  const featuredSports = FEATURED_COMPETITIONS.filter((c) => c.sport !== 'Fútbol')
  const featuredLeagues = FEATURED_COMPETITIONS.filter((c) => c.sport === 'Fútbol')
  const comps = [...featuredSports, ...featuredLeagues, ...extras]

  const purple = '#7C3AED'
  const eventsLabel = (n: number) => (n > 0 ? `${n} ${n === 1 ? 'evento' : 'eventos'}` : 'Ver')

  return (
    <section aria-label="Categorías del calendario">
      <div
        className="cal-rail flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide"
        style={{
          maskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 20px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 20px), transparent 100%)',
        }}
      >
        {/* Destacados — principal, primera */}
        <Card
          active={!activeComp && activeFilter === 'Destacados'}
          accent={purple}
          primary
          badge={<StarIcon color={purple} />}
          label="Destacados"
          sub="Top del día"
          onClick={() => onSelectSport('Destacados')}
          ariaLabel="Ver partidos destacados"
        />
        {/* Todo */}
        <Card
          active={!activeComp && activeFilter === 'Todo'}
          accent={purple}
          badge={<AllIcon color={purple} />}
          label="Todo"
          sub="Todo el calendario"
          onClick={() => onSelectSport('Todo')}
          ariaLabel="Ver todo el calendario"
        />
        {/* Deportes paraguas (icono) */}
        {UMBRELLA_SPORTS.map((s) => {
          const accent = getCompAccent(s)
          return (
            <Card
              key={`sport-${s}`}
              active={!activeComp && activeFilter === s}
              accent={accent}
              badge={<SportIcon sport={s} size={18} />}
              label={s}
              sub={eventsLabel(countBySport(s))}
              onClick={() => onSelectSport(s)}
              ariaLabel={`Filtrar por ${s}`}
            />
          )
        })}
        {/* Competiciones (escudo) */}
        {comps.map((c) => {
          const accent = getCompAccent(c.shortName)
          return (
            <Card
              key={c.slug}
              active={activeComp === c.slug}
              accent={accent}
              badge={
                c.crest ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={c.crest} alt="" aria-hidden="true" width={22} height={22} loading="lazy" decoding="async" style={{ objectFit: 'contain', width: 22, height: 22 }} />
                ) : (
                  <span className="text-[12px] font-black" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>{c.shortName.slice(0, 1)}</span>
                )
              }
              label={c.shortName}
              sub={eventsLabel(countBySlug.get(c.slug) ?? 0)}
              onClick={() => onSelectComp(c.slug)}
              ariaLabel={`${activeComp === c.slug ? 'Quitar' : 'Filtrar por'} ${c.displayName}`}
            />
          )
        })}
      </div>
    </section>
  )
}
