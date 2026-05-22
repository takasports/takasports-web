'use client'

// Mini-podio inline para el hub /juegos: muestra top 3 de un juego en su
// periodo actual sin abrir el LeaderboardTabs completo. Es eyecandy con
// utilidad: ver quién manda hoy/esta semana en un vistazo.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getGamePeriod } from '@/lib/games-periods'
import type { GameId } from '@/lib/games-store'

interface Entry {
  user_id: string
  score: number
  display_name: string | null
  avatar_url: string | null
  position: number
}

interface Props {
  gameId: GameId
  accent: string
  label: string                   // "CrackQuiz", "Sopa", etc.
  href?: string                   // dónde lleva el "Ver todos" (default: /juegos/leaderboard/{gameId})
  cadenceLabel?: string           // "Hoy" | "Esta semana" — override visual
}

const PODIUM = ['🥇', '🥈', '🥉']

export default function LeaderboardPreview({ gameId, accent, label, href, cadenceLabel }: Props) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const { period, cadence } = getGamePeriod(gameId)
    if (!period) { setLoading(false); return }

    fetch(`/api/games/leaderboard?game=${gameId}&period=${encodeURIComponent(period)}&limit=3`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        setEntries(Array.isArray(data?.entries) ? data.entries.slice(0, 3) : [])
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setEntries([]); setLoading(false) } })
    // El cadence label viene de fuera o del periodo.
    void cadence
    return () => { cancelled = true }
  }, [gameId])

  const seeAllHref = href ?? `/juegos/leaderboard/${gameId}`
  const dynamicCadence = cadenceLabel ?? (() => {
    const { cadence } = getGamePeriod(gameId)
    if (cadence === 'daily') return 'Hoy'
    if (cadence === 'weekly') return 'Esta semana'
    return 'Periodo actual'
  })()

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: `linear-gradient(135deg, ${accent}10 0%, transparent 80%)`,
        border: `1px solid ${accent}30`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-black uppercase tracking-[0.16em]"
            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
          >
            {dynamicCadence} · {label}
          </span>
        </div>
        <Link
          href={seeAllHref}
          className="text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)] rounded-md"
          style={{ color: 'var(--text-muted)', opacity: 0.7, fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
        >
          Ver todos →
        </Link>
      </div>

      {loading ? (
        <ul className="flex flex-col gap-1.5" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <li
              key={i}
              style={{
                height: 32,
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          ))}
        </ul>
      ) : entries && entries.length > 0 ? (
        <ol className="flex flex-col gap-1.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {entries.map((e, i) => (
            <li
              key={e.user_id}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1, width: 22, textAlign: 'center', flexShrink: 0 }}>
                {PODIUM[i]}
              </span>
              {e.avatar_url ? (
                <img
                  src={e.avatar_url}
                  alt=""
                  width={24}
                  height={24}
                  style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: `${accent}20` }}
                />
              ) : (
                <span
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: `${accent}25`, color: accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 900, fontFamily: 'var(--font-display)',
                    flexShrink: 0,
                  }}
                >
                  {(e.display_name ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
              <span
                className="flex-1 min-w-0 truncate text-[12px] font-bold"
                style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}
              >
                {e.display_name ?? 'Anónimo'}
              </span>
              <span
                className="tabular-nums text-[12px] font-black flex-shrink-0"
                style={{ color: accent, fontFamily: 'var(--font-display)' }}
              >
                {e.score}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          Sé el primero en jugar. {' '}
          <Link href={seeAllHref} style={{ color: accent, textDecoration: 'underline' }}>
            Ir a {label} →
          </Link>
        </p>
      )}
    </div>
  )
}
