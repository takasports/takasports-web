'use client'

import type { RankingEntry } from '@/lib/rankings'
import { SPORT_EMOJI } from '@/lib/rankings-ui'
import { SLUG_TO_LABEL, getSportStyle } from '@/lib/sports'
import Podium from './Podium'
import RankRow from './RankRow'

// El podio de UN deporte dentro de la vista «Todos»: cabecera con el nombre del
// deporte y un atajo a su ranking completo, y debajo el podio de tres.
//
// Si el deporte no llega a tres nombres NO se dibuja un podio cojo: hoy la F1
// tiene un solo piloto en el índice (Antonelli) y un pedestal con dos huecos
// vacíos contaría una mentira. En ese caso se pintan las filas de siempre.

export default function SportPodium({
  sport, entries, total, seguido, onOpen, maxScore, minScore,
}: {
  sport: string
  entries: RankingEntry[]
  total: number
  seguido?: boolean
  /** Abre el ranking completo de este deporte (fija el filtro, no navega). */
  onOpen: (sport: string) => void
  maxScore?: number
  minScore?: number
}) {
  if (entries.length === 0) return null
  const accent = getSportStyle(sport).accent
  const label = SLUG_TO_LABEL[sport] ?? sport
  const emoji = SPORT_EMOJI[sport] ?? '🏅'

  return (
    <section className="mb-1">
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true" className="leading-none" style={{ fontSize: 15 }}>{emoji}</span>
          <h2
            className="font-black truncate"
            style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: '#F8F8FF', letterSpacing: '-0.01em', lineHeight: 1 }}
          >
            {label}
          </h2>
          {seguido && (
            <span
              className="flex-shrink-0 text-[8px] font-black uppercase tracking-[0.14em] px-1.5 py-[3px] rounded-full"
              style={{ color: '#22c55e', background: 'rgba(34,197,94,0.11)', border: '1px solid rgba(34,197,94,0.28)', fontFamily: 'var(--font-sport)' }}
            >
              Sigues
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpen(sport)}
          className="flex-shrink-0 text-[9px] font-black uppercase tracking-[0.14em] transition-opacity hover:opacity-70"
          style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
        >
          Ver {total > 3 ? `los ${total}` : 'todos'} →
        </button>
      </div>

      {entries.length >= 3 ? (
        <Podium entries={entries} accent={accent} />
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {/* Numeradas DENTRO del deporte: el podio de al lado dice 1-2-3 por
              deporte, así que colar aquí el puesto global (Antonelli salía como
              «6» siendo el único piloto del índice) se leía como un error. */}
          {entries.map((entry, i) => (
            <RankRow key={entry.id} entry={{ ...entry, rank: i + 1 }} maxScore={maxScore} minScore={minScore} />
          ))}
          <p className="text-[10.5px] leading-snug px-1" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
            {total === 1
              ? 'Solo hay un nombre de este deporte en el índice: sin tres no hay podio.'
              : 'Aún no hay tres nombres de este deporte en el índice.'}
          </p>
        </div>
      )}
    </section>
  )
}
