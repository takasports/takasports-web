import Link from 'next/link'
import QuinielaModule from './QuinielaModule'
import { HOME_EVENTS } from '@/lib/events'
import { RANKING_JUGADORES, type RankingEntry } from '@/lib/rankings'
import { PersonIcon } from '@/components/icons/GameIcons'

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <span style={{ display: 'block', width: 3, height: 14, background: '#7C3AED', borderRadius: 2 }} />
        <h3 className="section-label">{children}</h3>
      </div>
      {action}
    </div>
  )
}

const TREND_COLOR: Record<string, string> = {
  up2: '#22c55e', up: '#4ade80', flat: '#6B6B8A', down: '#f87171', down2: '#ef4444',
}
const TREND_ICON: Record<string, string> = {
  up2: '↑↑', up: '↑', flat: '—', down: '↓', down2: '↓↓',
}

export default function Sidebar({ topPlayers }: { topPlayers?: RankingEntry[] }) {
  const TOP_PLAYERS = (topPlayers && topPlayers.length > 0 ? topPlayers : RANKING_JUGADORES).slice(0, 5)

  return (
    <div className="flex flex-col gap-7 pt-1">

      {/* ── Índice Taka — Rankings ───────────────────── */}
      <div>
        <SectionHeader
          action={
            <Link
              href="/rankings"
              className="text-[10px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}
            >
              Ver ranking →
            </Link>
          }
        >
          Índice Taka
        </SectionHeader>
        <div className="flex flex-col gap-1">
          {TOP_PLAYERS.map((player, i) => (
            <Link
              key={player.id}
              href={`/rankings?tab=jugadores`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:brightness-110"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              {/* Posición */}
              <span
                className="text-[11px] font-black tabular-nums w-4 flex-shrink-0 text-center"
                style={{ color: i < 3 ? '#A78BFA' : '#3A3A52', fontFamily: 'var(--font-sport)' }}
              >
                {i + 1}
              </span>
              {/* Avatar */}
              {player.image ? (
                <img
                  src={player.image}
                  alt={player.name}
                  width={28}
                  height={28}
                  style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', color: '#A78BFA' }}
                >
                  {player.emoji ?? <PersonIcon size={16} />}
                </div>
              )}
              {/* Nombre */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate" style={{ color: '#D0D0E0', fontFamily: 'var(--font-display)' }}>
                  {player.name}
                </p>
                <p className="text-[9px] truncate" style={{ color: '#4A4A6A' }}>{player.subtitle}</p>
              </div>
              {/* Score + trend */}
              <div className="flex-shrink-0 text-right">
                <p className="text-[12px] font-black tabular-nums" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
                  {player.score}
                </p>
                <p className="text-[9px] font-bold" style={{ color: TREND_COLOR[player.trend as string] ?? '#6B6B8A' }}>
                  {TREND_ICON[player.trend as string] ?? '—'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Quiniela ────────────────────────────────── */}
      <div>
        <SectionHeader>Quiniela</SectionHeader>
        <QuinielaModule />
      </div>

      {/* ── Próximos ────────────────────────────────── */}
      <div>
        <SectionHeader
          action={
            <Link
              href="/calendario"
              className="text-[10px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}
            >
              Ver todos →
            </Link>
          }
        >
          Próximos
        </SectionHeader>
        <div className="flex flex-col gap-1.5">
          {HOME_EVENTS.length > 0 ? HOME_EVENTS.map((event) => (
            <Link
              key={event.id}
              href="/calendario"
              className="flex items-center justify-between p-2.5 rounded-xl transition-all hover:brightness-110"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${event.accent}`,
                textDecoration: 'none',
              }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-semibold leading-tight truncate"
                  style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}
                >
                  {event.home}{event.away ? ` vs ${event.away}` : ''}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: event.accent, opacity: 0.7 }}>
                  {event.sport} · {event.comp}
                </p>
              </div>
              <div className="flex-shrink-0 ml-2 text-right">
                <p className="text-[11px] font-black tabular-nums" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                  {event.time}
                </p>
                <p className="text-[9px]" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                  {event.date}
                </p>
              </div>
            </Link>
          )) : (
            <p className="text-xs px-1" style={{ color: 'var(--text-faint)' }}>
              Próximos eventos próximamente.
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
