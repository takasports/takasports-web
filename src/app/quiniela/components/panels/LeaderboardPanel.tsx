'use client'

import { useState, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────
// Leaderboard semanal — modo Ranked: ordena por monedas reales
// ganadas en la jornada (no por pickCount como en versiones previas).
// ─────────────────────────────────────────────────────────────────
interface LBBadge { id: string; name: string; emoji: string; color: string; bg: string; rarity: string }
interface LBEntry { nickname: string; score: number; total: number; badges?: LBBadge[] }
type LBMode = 'ranked' | 'legacy'

// Chip compacto que se renderiza junto al nickname en el ranking.
// Tooltip nativo (title) muestra el nombre del badge para no inventar UI.
function BadgeChip({ badge }: { badge: LBBadge }) {
  return (
    <span
      title={badge.name}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 16, height: 16, borderRadius: 4,
        background: badge.bg, border: `1px solid ${badge.color}`,
        fontSize: 9, lineHeight: 1,
      }}
    >
      {badge.emoji}
    </span>
  )
}

export function LeaderboardPanel({ jornada, totalMatches, myScore }: { jornada: string; totalMatches: number; myScore?: number }) {
  const [board, setBoard] = useState<LBEntry[]>([])
  const [mode, setMode] = useState<LBMode>('ranked')

  useEffect(() => {
    if (!jornada || jornada === 'Cargando…') return
    fetch(`/api/quiniela/leaderboard?jornada=${encodeURIComponent(jornada)}&limit=10`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.entries?.length) {
          setBoard(data.entries)
          if (data.mode === 'ranked' || data.mode === 'legacy') setMode(data.mode)
        }
      })
      .catch(() => {})
  }, [jornada])

  // En modo Ranked, score = monedas → mostramos "150 🪙" en vez de "150/10".
  // En modo legacy, score = pickCount → mantenemos el formato histórico "5/10".
  const formatScore = (s: number, t: number) =>
    mode === 'ranked' ? `${s} 🪙` : `${s}/${t || totalMatches}`

  // En modo ranked, score = monedas (no aciertos), así que comparar
  // contra myScore (aciertos local) daría posición errónea. Lo
  // desactivamos hasta que el endpoint emita isMe con auth real.
  const myPos = mode === 'legacy' && myScore != null && board.length > 0
    ? board.findIndex(p => p.score <= myScore) + 1 || board.length + 1
    : null

  if (board.length === 0) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="section-accent" />
          <h2 className="section-label">Ranking jornada</h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="section-accent" />
        <h2 className="section-label">Ranking jornada</h2>
        {myPos != null && (
          <span className="ml-auto text-[10px] font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
            Tu pos. #{myPos}
          </span>
        )}
      </div>
      <div className="px-4 py-3 flex flex-col gap-1">
        {board.slice(0, 5).map((p, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
          const isMe = myScore != null && p.score === myScore && myPos === i + 1
          return (
            <div
              key={`${p.nickname}-${i}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{
                background: isMe ? 'rgba(124,58,237,0.12)' : i === 0 ? 'rgba(251,191,36,0.05)' : 'transparent',
                border: isMe ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
              }}
            >
              <span style={{ fontSize: 11, width: 18, textAlign: 'center', fontFamily: 'var(--font-display)', color: '#3A3A58', fontWeight: 900 }}>
                {medal ?? `${i + 1}`}
              </span>
              <span className="flex-1 text-[11px] font-black flex items-center gap-1.5 min-w-0" style={{ color: isMe ? '#C4B5FD' : '#8080A0', fontFamily: 'var(--font-display)' }}>
                <span className="truncate">{isMe ? 'Tú' : p.nickname}</span>
                {p.badges && p.badges.length > 0 && (
                  <span className="flex items-center gap-0.5 flex-shrink-0">
                    {p.badges.map(b => <BadgeChip key={b.id} badge={b} />)}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-black tabular-nums" style={{ color: i === 0 ? '#fbbf24' : '#4A4A6A', fontFamily: 'var(--font-display)' }}>
                {formatScore(p.score, p.total)}
              </span>
            </div>
          )
        })}

        {/* Mi posición si está fuera del top 5 */}
        {myPos != null && myPos > 5 && (
          <>
            <div className="flex justify-center py-0.5">
              <span style={{ fontSize: 9, color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>···</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <span style={{ fontSize: 11, width: 18, textAlign: 'center', fontFamily: 'var(--font-display)', color: '#C4B5FD', fontWeight: 900 }}>{myPos}</span>
              <span className="flex-1 text-[11px] font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>Tú</span>
              <span className="text-[11px] font-black tabular-nums" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
                {mode === 'ranked' ? `${myScore} ✓` : `${myScore}/${totalMatches}`}
              </span>
            </div>
          </>
        )}

        <p className="text-[8px] text-center pt-1" style={{ color: '#1E1E38', fontFamily: 'var(--font-sport)' }}>
          {board.length} participante{board.length !== 1 ? 's' : ''} · {mode === 'ranked' ? 'Ranked' : 'Ligas'} · {jornada}
        </p>
      </div>
    </div>
  )
}
