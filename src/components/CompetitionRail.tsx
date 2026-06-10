// "Por competición" — fila horizontal de competiciones EN LA PÁGINA PRINCIPAL
// del calendario. Resuelve la queja del dueño: las competiciones (LaLiga,
// Champions, NBA, F1…) ya no quedan escondidas en /calendario/[slug]; aquí
// aparecen al frente, con su escudo oficial + color + nº de eventos próximos,
// y enlazan a su página. Solo se muestran las que tienen eventos cargados.
// Server-friendly (sin estado): se calcula sobre los eventos ya disponibles.

import Link from 'next/link'
import type { SportEvent } from '@/lib/types'
import { COMPETITIONS, matchesCompetition } from '@/lib/calendar-competitions'
import { getCompAccent } from '@/lib/competitions'

export default function CompetitionRail({ events }: { events: SportEvent[] }) {
  const items = COMPETITIONS
    .map((c) => ({ c, count: events.filter((e) => matchesCompetition(c, e)).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)

  if (items.length === 0) return null

  return (
    <section aria-label="Calendarios por competición">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="section-accent" />
        <h2 className="section-label" style={{ fontFamily: 'var(--font-sport)', textTransform: 'uppercase' }}>
          Por competición
        </h2>
      </div>

      <div
        className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide"
        style={{
          maskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 20px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, #000 0, #000 calc(100% - 20px), transparent 100%)',
        }}
      >
        {items.map(({ c, count }) => {
          const accent = getCompAccent(c.shortName)
          return (
            <Link
              key={c.slug}
              href={`/calendario/${c.slug}`}
              prefetch={false}
              className="group flex items-center gap-2.5 flex-shrink-0 rounded-xl pl-2.5 pr-3 py-2 transition-all hover:brightness-125 no-underline"
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                borderRight: '1px solid rgba(255,255,255,0.07)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                borderLeft: `3px solid ${accent}`,
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
              <span className="flex flex-col leading-tight">
                <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                  {c.shortName}
                </span>
                <span className="text-[9px] font-black uppercase tracking-wider tabular-nums" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                  {count} {count === 1 ? 'evento' : 'eventos'}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
