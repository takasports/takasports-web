'use client'

import type { SportEvent } from '@/lib/types'
import { COMPETITIONS, FEATURED_COMPETITIONS, matchesCompetition } from '@/lib/calendar-competitions'
import { getCompAccent } from '@/lib/competitions'

// Selector "Por competición" de la PORTADA del calendario. Filtra EN EL SITIO
// (no navega a sub-páginas escondidas). Muestra SIEMPRE las destacadas (entrada
// evergreen, aunque estén fuera de temporada) + cualquier otra con eventos
// cargados. Al activar una, CalendarioContent filtra el feed y enseña su banner.
export default function CompetitionSelector({
  events,
  activeComp,
  onSelect,
}: {
  events: SportEvent[]
  activeComp: string | null
  onSelect: (slug: string | null) => void
}) {
  const countBySlug = new Map<string, number>()
  for (const c of COMPETITIONS) {
    countBySlug.set(c.slug, events.filter((e) => matchesCompetition(c, e)).length)
  }
  // Destacadas siempre + no destacadas con eventos (ordenadas por nº de eventos).
  const extras = COMPETITIONS
    .filter((c) => !c.featured && (countBySlug.get(c.slug) ?? 0) > 0)
    .sort((a, b) => (countBySlug.get(b.slug) ?? 0) - (countBySlug.get(a.slug) ?? 0))
  const items = [...FEATURED_COMPETITIONS, ...extras]
  if (items.length === 0) return null

  return (
    <section aria-label="Calendarios por competición">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="section-accent" />
          <h2 className="section-label" style={{ fontFamily: 'var(--font-sport)', textTransform: 'uppercase' }}>
            Por competición
          </h2>
        </div>
        {activeComp && (
          <button
            onClick={() => onSelect(null)}
            className="text-[10px] font-black uppercase tracking-wider transition-colors hover:text-white"
            style={{ color: '#9090A4', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕ Ver todo
          </button>
        )}
      </div>

      <div
        className="cal-rail flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide"
        style={{
          maskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 20px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 20px), transparent 100%)',
        }}
      >
        {items.map((c) => {
          const accent = getCompAccent(c.shortName)
          const count = countBySlug.get(c.slug) ?? 0
          const active = activeComp === c.slug
          return (
            <button
              key={c.slug}
              onClick={() => onSelect(active ? null : c.slug)}
              aria-pressed={active}
              aria-label={`${active ? 'Quitar' : 'Filtrar por'} ${c.displayName}`}
              className="cal-press group flex items-center gap-2.5 flex-shrink-0 rounded-xl pl-2.5 pr-3 py-2 transition-all"
              style={{
                background: active ? `${accent}1f` : 'rgba(255,255,255,0.03)',
                borderTop: `1px solid ${active ? accent + '99' : 'rgba(255,255,255,0.07)'}`,
                borderRight: `1px solid ${active ? accent + '99' : 'rgba(255,255,255,0.07)'}`,
                borderBottom: `1px solid ${active ? accent + '99' : 'rgba(255,255,255,0.07)'}`,
                borderLeft: `3px solid ${accent}`,
                cursor: 'pointer',
                boxShadow: active ? `0 0 14px ${accent}33` : 'none',
              }}
            >
              <span
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ width: 30, height: 30, background: `${accent}1A` }}
              >
                {c.crest ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={c.crest}
                    alt=""
                    aria-hidden="true"
                    width={22}
                    height={22}
                    loading="lazy"
                    decoding="async"
                    style={{ objectFit: 'contain', width: 22, height: 22 }}
                  />
                ) : (
                  <span className="text-[12px] font-black" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                    {c.shortName.slice(0, 1)}
                  </span>
                )}
              </span>
              <span className="flex flex-col leading-tight items-start">
                <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: active ? '#fff' : '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                  {c.shortName}
                </span>
                <span
                  className="text-[9px] font-black uppercase tracking-wider tabular-nums"
                  style={{ color: count > 0 ? accent : '#6A6A80', fontFamily: 'var(--font-sport)' }}
                >
                  {count > 0 ? `${count} ${count === 1 ? 'evento' : 'eventos'}` : 'Ver'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
