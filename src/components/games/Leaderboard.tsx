'use client'

// Tarjeta de leaderboard para un juego+periodo. Top N + tu posición.
// Se hidrata client-side desde /api/games/leaderboard (cache 60s en CDN)
// y /api/games/me para la fila del usuario.

import { useLeaderboard, useMyPosition } from '@/hooks/useGameState'
import type { GameId } from '@/lib/games-store'

interface Props {
  gameId:    GameId
  period:    string
  limit?:    number
  accent?:   string
  title?:    string
  /** Refresca cada N ms si > 5000. */
  refreshMs?: number
}

export default function Leaderboard({
  gameId, period, limit = 10, accent = '#A78BFA', title, refreshMs,
}: Props) {
  const { entries, loading } = useLeaderboard(gameId, period, { limit, refreshMs })
  const { data: me }         = useMyPosition(gameId, period)

  const myInTop = me.position && me.position <= limit
  const heading = title ?? `Top ${limit}`

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${accent}80, ${accent})` }} />

      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black uppercase tracking-widest" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
            {heading}
          </h3>
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)' }}>
            {period}
          </span>
        </div>

        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-7 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }} />
            ))}
          </div>
        )}

        {!loading && entries.length === 0 && (
          <p className="text-[11px] py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Aún no hay jugadores en este periodo. Sé el primero.
          </p>
        )}

        {!loading && entries.length > 0 && (
          <ul className="space-y-1.5">
            {entries.slice(0, limit).map(e => (
              <Row
                key={e.user_id}
                position={e.position}
                name={e.display_name ?? 'Jugador'}
                avatar={e.avatar_url}
                score={e.score}
                isMe={me.position === e.position}
                accent={accent}
              />
            ))}
          </ul>
        )}

        {!loading && me.position !== null && !myInTop && me.play && (
          <>
            <div className="my-3 flex items-center gap-2">
              <span className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
              <span className="text-[9px]" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)' }}>tu posición</span>
              <span className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
            </div>
            <Row
              position={me.position}
              name="Tú"
              avatar={null}
              score={me.play.score}
              isMe
              accent={accent}
            />
          </>
        )}

        {!loading && me.total > 0 && (
          <p className="text-center text-[9px] mt-3" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)' }}>
            {me.total} {me.total === 1 ? 'jugador' : 'jugadores'} en total
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ position, name, avatar, score, isMe, accent }: {
  position: number; name: string; avatar: string | null; score: number; isMe: boolean; accent: string;
}) {
  const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null
  return (
    <li
      className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg"
      style={{
        background: isMe ? `${accent}14` : 'rgba(255,255,255,0.02)',
        border:     isMe ? `1px solid ${accent}30` : '1px solid transparent',
      }}
    >
      <span
        className="text-[10px] font-black w-6 text-center"
        style={{ color: isMe ? accent : '#5A5A7A', fontFamily: 'var(--font-display)' }}
      >
        {medal ?? `#${position}`}
      </span>

      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" width={20} height={20} className="rounded-full" style={{ objectFit: 'cover' }} />
      ) : (
        <span className="w-5 h-5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
      )}

      <span
        className="flex-1 text-[11px] font-black truncate"
        style={{ color: isMe ? '#F0F0F5' : '#9090B0', fontFamily: 'var(--font-display)' }}
      >
        {name}
      </span>

      <span
        className="text-[11px] font-black"
        style={{ color: isMe ? accent : '#7676A0', fontFamily: 'var(--font-sport)' }}
      >
        {score} pts
      </span>
    </li>
  )
}
