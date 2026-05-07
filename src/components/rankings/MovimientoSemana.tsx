'use client'

import Link from 'next/link'
import {
  RANKING_JUGADORES, RANKING_JUGADORAS, RANKING_CLUBES,
  RANKING_LUCHADORAS_UFC, RANKING_ENTRENADORES,
  RANKING_CREADORES, RANKING_PERIODISTAS, RANKING_CREADORES_WWE,
  type RankingEntry,
} from '@/lib/rankings'
import { getDisplayScore, SPORT_EMOJI } from '@/lib/rankings-ui'
import { getSportStyle } from '@/lib/sports'
import type { MoverEntry } from '@/lib/rankings-data'

// ── Fallback desde arrays estáticos ──────────────────────────────────────
function getStaticMovers(limit: number): { movers: MoverEntry[]; fallers: MoverEntry[] } {
  const allEntries: RankingEntry[] = [
    ...RANKING_JUGADORES, ...RANKING_JUGADORAS, ...RANKING_CLUBES,
    ...RANKING_LUCHADORAS_UFC, ...RANKING_ENTRENADORES,
    ...RANKING_CREADORES, ...RANKING_PERIODISTAS, ...RANKING_CREADORES_WWE,
  ]
  const withPrev = allEntries.filter(e => e.scorePrev !== undefined)
  if (withPrev.length < limit * 2) return { movers: [], fallers: [] }

  const sorted = [...withPrev].sort((a, b) => {
    const da = getDisplayScore(a) - a.scorePrev!
    const db = getDisplayScore(b) - b.scorePrev!
    return db - da
  })

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

  return {
    movers:  sorted.slice(0, limit).map(toMover),
    fallers: sorted.slice(-limit).reverse().map(toMover),
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
  const hasPropData = (propMovers?.length ?? 0) >= limit && (propFallers?.length ?? 0) >= limit

  const { movers, fallers } = hasPropData
    ? { movers: propMovers!, fallers: propFallers! }
    : getStaticMovers(limit)

  if (movers.length < limit && fallers.length < limit) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      {([
        { list: movers,  label: 'Mayores subidas', color: '#22c55e', icon: '↑↑' },
        { list: fallers, label: 'Mayores caídas',  color: '#f87171', icon: '↓↓' },
      ] as const).map(({ list, label, color, icon }) => (
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
