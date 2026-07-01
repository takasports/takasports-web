'use client'

import Link from 'next/link'
import {
  RANKING_JUGADORES, RANKING_JUGADORAS, RANKING_CLUBES,
  RANKING_LUCHADORAS_UFC,
  RANKING_CREADORES, RANKING_PERIODISTAS, RANKING_CREADORES_WWE,
  type RankingEntry,
} from '@/lib/rankings'
import { getDisplayScore, SPORT_EMOJI } from '@/lib/rankings-ui'
import { getSportStyle } from '@/lib/sports'
import { MAX_WEEKLY_DELTA, type MoverEntry } from '@/lib/rankings-data'

// ── Fallback desde arrays estáticos ──────────────────────────────────────
function getStaticMovers(limit: number): { movers: MoverEntry[]; fallers: MoverEntry[] } {
  const allEntries: RankingEntry[] = [
    ...RANKING_JUGADORES, ...RANKING_JUGADORAS, ...RANKING_CLUBES,
    ...RANKING_LUCHADORAS_UFC,
    ...RANKING_CREADORES, ...RANKING_PERIODISTAS, ...RANKING_CREADORES_WWE,
  ]
  const withPrev = allEntries.filter(e => e.scorePrev !== undefined)
  if (!withPrev.length) return { movers: [], fallers: [] }

  const toMover = (e: RankingEntry): MoverEntry => ({
    id:          e.id,
    name:        e.name,
    subtitle:    e.subtitle,
    sport:       e.sport,
    emoji:       e.emoji,
    country:     e.country,
    trendReason: e.trendReason,
    score:       getDisplayScore(e),
    scorePrev:   e.scorePrev!,
    delta:       Math.round((getDisplayScore(e) - e.scorePrev!) * 10) / 10,
  })

  // Mismo tope anti-artefacto que la vía de DB (rankings-data): un salto de
  // re-baseline (+34, +20) NO es un movimiento semanal real → se descarta, igual
  // que hace la ruta de servidor. Sin esto, el fallback estático mostraba esos
  // saltos como si fueran la subida de la semana.
  const sorted = [...withPrev]
    .map(toMover)
    .filter(e => Math.abs(e.delta) >= 1 && Math.abs(e.delta) <= MAX_WEEKLY_DELTA)
    .sort((a, b) => b.delta - a.delta)
  return {
    movers:  sorted.filter(e => e.delta >= 1).slice(0, limit),
    fallers: sorted.filter(e => e.delta <= -1).slice(-limit).reverse(),
  }
}

// ── Render de una fila ────────────────────────────────────────────────────
function MoverRow({ entry, color }: { entry: MoverEntry; color: string }) {
  const sportAccent = entry.sport ? getSportStyle(entry.sport).accent : '#7C3AED'
  const avatarEmoji = (entry.emoji && entry.emoji !== entry.country)
    ? entry.emoji
    : (entry.sport ? (SPORT_EMOJI[entry.sport] ?? '🏅') : '🏅')

  return (
    <Link
      href={`/rankings/${entry.id}`}
      className="flex items-center gap-2.5 py-1.5 transition-opacity hover:opacity-80"
    >
      <div className="flex items-center justify-center rounded-lg text-sm flex-shrink-0"
        style={{ width: 26, height: 26, background: `${sportAccent}14`, border: `1px solid ${sportAccent}20` }}>
        {avatarEmoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold truncate" style={{ color: '#C0C0D0', fontFamily: 'var(--font-sport)' }}>
          {entry.name}
        </p>
        {entry.trendReason && (
          <p className="text-[9px] truncate" style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)' }}>
            {entry.trendReason}
          </p>
        )}
      </div>
      <span className="font-black tabular-nums flex-shrink-0 text-xs"
        style={{ color, fontFamily: 'var(--font-display)' }}>
        {entry.delta >= 0 ? '+' : ''}{entry.delta.toFixed(1)}
      </span>
    </Link>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
interface Props {
  /** Datos pre-fetched server-side desde la DB. Si no se pasan, usa el estático. */
  movers?:  MoverEntry[]
  fallers?: MoverEntry[]
}

export default function MovimientoSemana({ movers: propMovers, fallers: propFallers }: Props) {
  const limit = 3
  // Si el servidor envió datos (aunque sea un array vacío) los usamos; si no vino nada usamos estático
  const hasPropData = propMovers !== undefined || propFallers !== undefined
  const { movers, fallers } = hasPropData
    ? { movers: propMovers ?? [], fallers: propFallers ?? [] }
    : getStaticMovers(limit)

  if (!movers.length && !fallers.length) return null

  const panels = [
    { list: movers,  label: 'Mayores subidas', color: '#22c55e', icon: '↑↑' },
    { list: fallers, label: 'Mayores caídas',  color: '#f87171', icon: '↓↓' },
  ].filter(p => p.list.length > 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      {panels.map(({ list, label, color, icon }) => (
        <div key={label} className="px-4 py-3 rounded-xl"
          style={{ background: `${color}08`, border: `1px solid ${color}18` }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1.5"
            style={{ color, fontFamily: 'var(--font-sport)' }}>
            {icon} {label}
          </p>
          <div className="flex flex-col" style={{ borderTop: `1px solid ${color}10` }}>
            {list.map(e => <MoverRow key={e.id} entry={e} color={color} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
