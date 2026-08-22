'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Qué ha puesto la gente en este partido.
//
// Solo se enseña en partidos que el usuario YA ha pronosticado. Es deliberado:
// verlo antes le anclaría la decisión, y entonces el consenso dejaría de medir
// lo que piensa la gente para medir lo que vio la gente que llegó antes.
//
// Y solo con muestra suficiente. "El 100% ha puesto al Madrid" sobre un voto no
// es consenso, es una persona; enseñarlo haría parecer que la sección está más
// viva de lo que está, que es la peor mentira que puede contar un producto
// pequeño. Por eso el número de jugadores va escrito al lado, siempre.
// ─────────────────────────────────────────────────────────────────────────────

import type { SoccerPick } from './types'

/** Por debajo de esto no se enseña nada. Tres es poco, pero ya es "la gente" y
 *  no "alguien"; el recuento va a la vista para que se pueda juzgar. */
export const CONSENSUS_MIN_VOTES = 3

export interface Consensus { p1: number; px: number; p2: number; total: number }

/** Reparto en porcentajes enteros que SUMAN 100. Redondear cada uno por su
 *  cuenta da 33/33/33 o 34/33/34 según el caso; el resto se le da al mayor,
 *  que es donde menos se nota. */
export function toPercents(c: Consensus): { p1: number; px: number; p2: number } {
  if (c.total <= 0) return { p1: 0, px: 0, p2: 0 }
  const crudo = [
    { k: 'p1' as const, v: (c.p1 / c.total) * 100 },
    { k: 'px' as const, v: (c.px / c.total) * 100 },
    { k: 'p2' as const, v: (c.p2 / c.total) * 100 },
  ]
  const out = { p1: Math.floor(crudo[0].v), px: Math.floor(crudo[1].v), p2: Math.floor(crudo[2].v) }
  let resto = 100 - (out.p1 + out.px + out.p2)
  // Se reparte de mayor a menor parte decimal, como manda el reparto de restos.
  const orden = [...crudo].sort((a, b) => (b.v % 1) - (a.v % 1))
  for (const { k } of orden) {
    if (resto <= 0) break
    out[k] += 1
    resto -= 1
  }
  return out
}

export default function ConsensusBar({
  consensus, myPick, accent, homeShort, awayShort,
}: {
  consensus: Consensus | undefined
  myPick: SoccerPick | null
  accent: string
  homeShort: string
  awayShort: string
}) {
  if (!myPick || !consensus || consensus.total < CONSENSUS_MIN_VOTES) return null

  const pct = toPercents(consensus)
  const mio = myPick === '1' ? pct.p1 : myPick === 'X' ? pct.px : pct.p2
  const mayor = Math.max(pct.p1, pct.px, pct.p2)
  // "Contra la mayoría" solo cuando de verdad hay una mayoría distinta a la
  // tuya, no cuando la cosa está repartida y tu opción va segunda por un punto.
  const contraCorriente = mio < mayor && mayor - mio >= 10

  const tramos: { k: SoccerPick; pct: number; label: string; color: string }[] = [
    { k: '1', pct: pct.p1, label: homeShort, color: accent },
    { k: 'X', pct: pct.px, label: 'Empate', color: '#94A3B8' },
    { k: '2', pct: pct.p2, label: awayShort, color: '#A78BFA' },
  ]

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          La gente
        </span>
        <span style={{ fontFamily: 'var(--font-sport)', fontSize: 9, color: 'var(--text-muted)', opacity: 0.75 }}>
          {consensus.total} {consensus.total === 1 ? 'jugador' : 'jugadores'}
        </span>
        {contraCorriente && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--color-warning)',
          }}>
            Vas contra la mayoría
          </span>
        )}
      </div>

      <div
        role="img"
        aria-label={`Reparto de pronósticos: ${pct.p1}% ${homeShort}, ${pct.px}% empate, ${pct.p2}% ${awayShort}, sobre ${consensus.total} jugadores`}
        style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}
      >
        {tramos.map(t => t.pct > 0 && (
          <div
            key={t.k}
            style={{
              width: `${t.pct}%`,
              background: t.color,
              // La tuya se ve entera; las otras, apagadas. Sin esto hay que
              // acordarse de qué elegiste para leer la barra.
              opacity: t.k === myPick ? 1 : 0.28,
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {tramos.map(t => (
          <span
            key={t.k}
            style={{
              fontFamily: 'var(--font-sport)', fontSize: 9.5,
              fontWeight: t.k === myPick ? 900 : 600,
              color: t.k === myPick ? '#F4F4FA' : 'var(--text-muted)',
              maxWidth: '33%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {t.pct}% {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}
