'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SportEvent } from '@/lib/types'
import { COMPETITIONS, FEATURED_COMPETITIONS, matchesCompetition } from '@/lib/calendar-competitions'
import { getCompAccent, getLeagueScore } from '@/lib/competitions'
import { SportIcon } from '@/components/icons/GameIcons'

// Barra unificada de categorías del calendario, TODO en estilo "ficha con logo"
// y scrollable lateralmente. Orden: Destacados (principal) → Todo → deportes
// paraguas (Fútbol/Tenis/Pádel, con icono) → botón "Ligas" (desplegable).
//
// Las COMPETICIONES ya no viven en la tira: eran 16 fichas que la alargaban sin
// fin y que se confundían con los deportes. Ahora van en un desplegable ordenado
// por IMPORTANCIA (getLeagueScore: Champions y LaLiga arriba, no por número de
// partidos ni por orden alfabético), con lo que hay HOY primero.
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
      className="cal-press group flex items-center gap-2 sm:gap-2.5 flex-shrink-0 rounded-xl pl-2 pr-2.5 py-1.5 sm:pl-2.5 sm:pr-3 sm:py-2 transition-all"
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
      <span className="flex items-center justify-center rounded-lg flex-shrink-0 w-6 h-6 sm:w-[30px] sm:h-[30px]" style={{ background: `${accent}1A` }}>
        {badge}
      </span>
      <span className="flex flex-col leading-tight items-start">
        <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: active || primary ? '#fff' : '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
          {label}
        </span>
        {/* 2ª línea (recuento/sub) solo en escritorio: en móvil la ficha se reduce
            a un chip de una línea para que los partidos suban (estilo 365scores). */}
        <span className="hidden sm:block text-[9px] font-black uppercase tracking-wider tabular-nums whitespace-nowrap" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
          {sub}
        </span>
      </span>
    </button>
  )
}


/** Desplegable de competiciones, ordenadas por importancia. */
function LeagueMenu({
  comps, countBySlug, activeComp, onSelectComp,
}: {
  comps: typeof COMPETITIONS
  countBySlug: Map<string, number>
  activeComp: string | null
  onSelectComp: (slug: string) => void
}) {
  const [open, setOpen] = useState(false)
  // Posición del botón: el menú se pinta en un PORTAL porque la tira de fichas
  // tiene overflow-x y una máscara — las dos lo recortaban, y el desplegable
  // quedaba tapado por el contenido (comprobado: elementFromPoint caía fuera).
  // Mismo apaño que ya usa el selector de fecha (CalendarDropdown).
  const [ancla, setAncla] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const activa = comps.find((c) => c.slug === activeComp) ?? null
  const purple = '#7C3AED'

  // Cierra al pulsar fuera o con Escape: es un menú, no un panel pegado.
  useEffect(() => {
    if (!open) return
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        ref={btnRef}
        onClick={() => {
          if (btnRef.current) setAncla(btnRef.current.getBoundingClientRect())
          setOpen((v) => !v)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={activa ? `Liga: ${activa.displayName}. Cambiar` : 'Filtrar por liga'}
        className="cal-press flex items-center gap-2 flex-shrink-0 rounded-xl pl-2 pr-2.5 py-1.5 sm:py-2 transition-all"
        style={{
          background: activa ? `${purple}22` : 'rgba(255,255,255,0.03)',
          borderTop: `1px solid ${activa ? purple + '99' : 'rgba(255,255,255,0.07)'}`,
          borderRight: `1px solid ${activa ? purple + '99' : 'rgba(255,255,255,0.07)'}`,
          borderBottom: `1px solid ${activa ? purple + '99' : 'rgba(255,255,255,0.07)'}`,
          borderLeft: `3px solid ${purple}`,
          cursor: 'pointer',
        }}
      >
        <span className="flex items-center justify-center rounded-lg flex-shrink-0 w-6 h-6 sm:w-[30px] sm:h-[30px]" style={{ background: `${purple}1A` }}>
          {activa?.crest ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={activa.crest} alt="" aria-hidden="true" width={20} height={20} loading="lazy" style={{ objectFit: 'contain', width: 20, height: 20 }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={purple} strokeWidth="1.6" aria-hidden>
              <path d="M4 2h8v3a4 4 0 01-8 0V2zM3 3H1v1a3 3 0 003 3M13 3h2v1a3 3 0 01-3 3M6 12h4M8 9v3M5 14h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="flex flex-col leading-tight items-start">
          <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: activa ? '#fff' : '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {activa ? activa.shortName : 'Ligas'}
          </span>
          <span className="hidden sm:block text-[9px] font-black uppercase tracking-wider whitespace-nowrap" style={{ color: purple, fontFamily: 'var(--font-sport)' }}>
            {activa ? 'Cambiar' : `${comps.length} competiciones`}
          </span>
        </span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.7, marginLeft: 2 }} aria-hidden>
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && ancla && typeof document !== 'undefined' && createPortal(
        <div
          role="listbox"
          ref={menuRef}
          className="rounded-xl overflow-hidden"
          style={{
            position: 'fixed',
            top: Math.round(ancla.bottom + 6),
            left: Math.round(Math.min(ancla.left, window.innerWidth - 244)),
            zIndex: 60,
            minWidth: 232, maxHeight: 340, overflowY: 'auto',
            background: '#101017', border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 18px 40px -12px rgba(0,0,0,0.8)',
          }}
        >
          {activeComp && (
            <button
              onClick={() => { onSelectComp(activeComp); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9A9AAE', fontSize: 12.5, fontFamily: 'var(--font-sport)', fontWeight: 700 }}
            >
              ✕ Quitar filtro de liga
            </button>
          )}
          {comps.map((c) => {
            const n = countBySlug.get(c.slug) ?? 0
            const activo = activeComp === c.slug
            return (
              <button
                key={c.slug}
                role="option"
                aria-selected={activo}
                onClick={() => { onSelectComp(c.slug); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:brightness-125"
                style={{ background: activo ? 'rgba(124,58,237,0.16)' : 'transparent', border: 'none', cursor: 'pointer' }}
              >
                {c.crest ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={c.crest} alt="" aria-hidden="true" width={18} height={18} loading="lazy" style={{ objectFit: 'contain', width: 18, height: 18, flexShrink: 0 }} />
                ) : (
                  <span className="flex items-center justify-center flex-shrink-0" style={{ width: 18, height: 18 }}>
                    <SportIcon sport={c.sport} size={14} />
                  </span>
                )}
                <span className="flex-1 min-w-0 truncate text-[12.5px] font-bold" style={{ color: activo ? '#fff' : '#D8D8E4', fontFamily: 'var(--font-sport)' }}>
                  {c.shortName}
                </span>
                {n > 0 && (
                  <span className="text-[10px] font-black tabular-nums flex-shrink-0" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>{n}</span>
                )}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
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
  // Las competiciones del desplegable van por IMPORTANCIA (Champions y LaLiga
  // arriba), no por número de partidos ni por el orden en que estén escritas. A
  // igualdad de peso, primero la que tenga partidos hoy.
  const menuComps = [...FEATURED_COMPETITIONS.filter((c) => c.sport === 'Fútbol'), ...extras]
    .sort((a, b) => {
      const pesoA = getLeagueScore(a.displayName) || getLeagueScore(a.shortName)
      const pesoB = getLeagueScore(b.displayName) || getLeagueScore(b.shortName)
      if (pesoA !== pesoB) return pesoB - pesoA
      return (countBySlug.get(b.slug) ?? 0) - (countBySlug.get(a.slug) ?? 0)
    })

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
        {/* Ligas — desplegable ordenado por importancia. Va TERCERO, no al final:
            al fondo de la tira quedaba fuera de pantalla en un móvil y había que
            desplazar para encontrarlo, que es peor que los 16 chips de antes. */}
        <LeagueMenu
          comps={menuComps}
          countBySlug={countBySlug}
          activeComp={activeComp}
          onSelectComp={onSelectComp}
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
        {/* Deportes de una sola competición (NBA/F1/UFC) siguen como ficha */}
        {featuredSports.map((c) => {
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
