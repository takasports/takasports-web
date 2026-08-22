'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Clasificación de la Jornada — quién gana ESTA semana.
//
// La única tabla que había era la Liga Taka, acumulada de toda la vida. En un
// juego semanal eso envejece mal: a las cinco semanas quien llega nuevo no
// puede alcanzar a nadie y el líder puede dormirse. Aquí se puede ganar hoy
// aunque hayas empezado hoy, que es lo que hace que valga la pena volver.
//
// Se monta solo cuando la Jornada ya está cerrada: con todo por jugar la tabla
// sería una lista de ceros, y una tabla vacía enseña que la sección está vacía.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

interface Entry {
  userId: string
  name:   string | null
  avatar: string | null
  points: number
  hits:   number
  played: number
  rank:   number
}

interface Respuesta {
  weekKey: string | null
  total:   number
  entries: Entry[]
  me:      { userId: string; points: number; hits: number; played: number; rank: number } | null
}

export default function JornadaLeaderboard({
  weekKey, accent,
}: {
  weekKey: string
  accent:  string
}) {
  const [data, setData] = useState<Respuesta | null>(null)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/ranked/jornada-leaderboard?week=${encodeURIComponent(weekKey)}`)
      .then(r => r.ok ? r.json() as Promise<Respuesta> : null)
      .then(d => { if (!cancelado && d) setData(d) })
      .catch(() => { /* silencioso: es un extra, no el contenido */ })
    return () => { cancelado = true }
  }, [weekKey])

  if (!data || data.entries.length === 0) return null

  const fueraDelTop = data.me && !data.entries.some(e => e.userId === data.me!.userId)

  return (
    <div
      className="mt-4 overflow-hidden"
      style={{ borderRadius: 'var(--radius-card)', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span style={{
          fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>Clasificación de la Jornada</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-sport)', fontSize: 10, color: 'var(--text-muted)' }}>
          {data.total} {data.total === 1 ? 'jugador' : 'jugadores'}
        </span>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {data.entries.map(e => (
          <Fila key={e.userId} e={e} accent={accent} yo={data.me?.userId === e.userId} />
        ))}
        {fueraDelTop && data.me && (
          <>
            <li aria-hidden style={{
              textAlign: 'center', color: 'var(--text-muted)',
              fontFamily: 'var(--font-sport)', fontSize: 11, padding: '2px 0',
            }}>···</li>
            <Fila
              accent={accent}
              yo
              e={{ ...data.me, name: 'Tú', avatar: null }}
            />
          </>
        )}
      </ol>
    </div>
  )
}

function Fila({ e, accent, yo }: { e: Entry; accent: string; yo: boolean }) {
  const podio = e.rank <= 3
  return (
    <li
      className="flex items-center gap-3 px-4 py-2"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: yo ? `${accent}0F` : 'transparent',
      }}
    >
      <span style={{
        minWidth: 22, textAlign: 'right',
        fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
        color: podio ? accent : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums',
      }}>{e.rank}</span>

      <span className="flex-1 min-w-0 truncate" style={{
        fontFamily: 'var(--font-sport)', fontSize: 13, fontWeight: yo ? 900 : 600,
        color: yo ? '#F4F4FA' : 'var(--text-secondary)',
      }}>{e.name ?? 'Jugador'}</span>

      <span style={{
        fontFamily: 'var(--font-sport)', fontSize: 11, color: 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      }}>{e.hits}/{e.played}</span>

      <span style={{
        minWidth: 44, textAlign: 'right',
        fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 900,
        color: podio ? accent : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums',
      }}>{e.points}</span>
    </li>
  )
}
