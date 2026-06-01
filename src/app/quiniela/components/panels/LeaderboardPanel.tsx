'use client'

import { useState, useEffect } from 'react'
import { BadgeIcon, hasBadgeIcon } from '@/components/icons/badges/BadgeIcon'

// ─────────────────────────────────────────────────────────────────
// Leaderboard con tabs:
//   · Semanal — ranking de la jornada activa (modo ranked)
//   · Temporada — acumulado de TODAS las jornadas de clubes (NO Mundial,
//     que tiene su propio MundialLeaderboardPanel). Permite a un user
//     que entra tarde ver su progreso global aunque no esté en el TOP
//     semanal.
//
// Ambos tabs comparten render, solo cambia el endpoint y la label
// inferior. El tab se preserva en localStorage para que el user no
// tenga que re-elegir cada visita.
//
// Equipment rendering (v2):
//   · frame → border color de la fila
//   · card_bg → fondo de la fila (legendary)
//   · title → epíteto bajo el nick
//   · badge → chip de badge equipado (priority sobre auto-select)
// ─────────────────────────────────────────────────────────────────

interface LBBadge { id: string; name: string; emoji: string; color: string; bg: string; rarity: string }
interface LBEquipment {
  badge?:   { emoji: string; color: string; bg: string; name: string }
  title?:   { text: string; color: string }
  frame?:   { color: string }
  card_bg?: { gradient: string }
}
interface LBEntry {
  nickname: string
  score: number
  total: number
  badges?: LBBadge[]
  equipment?: LBEquipment
}
type LBMode = 'ranked' | 'season' | 'legacy'
type LBTab = 'weekly' | 'season'

const TAB_KEY = 'ts_quiniela_lb_tab_v1'

// Chip compacto que se renderiza junto al nickname en el ranking.
function BadgeChip({ badge }: { badge: LBBadge | LBEquipment['badge'] }) {
  if (!badge) return null
  const badgeId = 'id' in badge ? badge.id : undefined
  const useIcon = badgeId && hasBadgeIcon(badgeId)
  return (
    <span
      title={'name' in badge ? badge.name : ''}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 16, height: 16, borderRadius: 4,
        background: badge.bg, border: `1px solid ${badge.color}`,
        fontSize: 9, lineHeight: 1,
        color: badge.color,
      }}
    >
      {useIcon && badgeId
        ? <BadgeIcon id={badgeId} size={11} strokeWidth={1.6} />
        : badge.emoji}
    </span>
  )
}

export function LeaderboardPanel({ jornada, totalMatches, myScore }: { jornada: string; totalMatches: number; myScore?: number }) {
  const [tab, setTab] = useState<LBTab>('weekly')
  const [board, setBoard] = useState<LBEntry[]>([])
  const [mode, setMode] = useState<LBMode>('ranked')
  const [loaded, setLoaded] = useState(false)

  // Restaurar tab del localStorage (1 sola vez al montar).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY)
      if (saved === 'season' || saved === 'weekly') setTab(saved)
    } catch { /* ignore */ }
  }, [])

  // Refetch al cambiar tab o jornada.
  useEffect(() => {
    if (tab === 'weekly' && (!jornada || jornada === 'Cargando…')) return

    setLoaded(false)
    setBoard([])

    const url = tab === 'season'
      ? `/api/quiniela/leaderboard?mode=season&limit=10`
      : `/api/quiniela/leaderboard?jornada=${encodeURIComponent(jornada)}&limit=10`

    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setLoaded(true)
        if (data?.entries) {
          setBoard(data.entries)
          if (data.mode === 'ranked' || data.mode === 'legacy' || data.mode === 'season') {
            setMode(data.mode)
          }
        }
      })
      .catch(() => setLoaded(true))
  }, [jornada, tab])

  function selectTab(t: LBTab) {
    setTab(t)
    try { localStorage.setItem(TAB_KEY, t) } catch { /* ignore */ }
  }

  // En modo Ranked semanal, score = monedas de la jornada → "150 🪙".
  // En modo Season, score = monedas acumuladas → "1240 🪙" (igual formato).
  // En modo legacy, score = pickCount → "5/10".
  const formatScore = (s: number, t: number) => {
    if (mode === 'legacy') return `${s}/${t || totalMatches}`
    return `${s} pts`
  }

  // myPos / myScore: solo aplica al tab semanal con mode legacy histórico.
  const myPos = tab === 'weekly' && mode === 'legacy' && myScore != null && board.length > 0
    ? board.findIndex(p => p.score <= myScore) + 1 || board.length + 1
    : null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="section-accent" />
        <h2 className="section-label">Ranking</h2>
        {myPos != null && (
          <span className="ml-auto text-[10px] font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
            Tu pos. #{myPos}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-1.5">
        {([
          ['weekly', 'Semanal'],
          ['season', 'Temporada'],
        ] as const).map(([key, label]) => {
          const active = tab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition-opacity"
              style={{
                background: active ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                color: active ? '#C4B5FD' : '#5A5A78',
                border: active ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                fontFamily: 'var(--font-sport)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-2 flex flex-col gap-1">
        {!loaded ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))
        ) : board.length === 0 ? (
          <p className="text-[10px] text-center py-3" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
            {tab === 'season'
              ? 'Aún no hay datos suficientes de temporada. Cuando se cierre la jornada, los aciertos cuentan al acumulado.'
              : 'Nadie ha apostado en esta jornada todavía. Sé el primero.'}
          </p>
        ) : (
          board.slice(0, 5).map((p, i) => {
            const medal   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
            const isMe    = myScore != null && p.score === myScore && myPos === i + 1
            const eq      = p.equipment
            const frameColor  = eq?.frame?.color
            const cardBg      = eq?.card_bg?.gradient
            const equippedBadge = eq?.badge
            const title       = eq?.title

            // Chip: badge equipado tiene priority; si no, auto-select del array
            const chipBadge = equippedBadge ?? p.badges?.[0]

            return (
              <div
                key={`${p.nickname}-${i}`}
                className="flex flex-col px-3 py-2 rounded-xl"
                style={{
                  background: cardBg
                    ? cardBg
                    : isMe
                    ? 'rgba(124,58,237,0.12)'
                    : i === 0
                    ? 'rgba(251,191,36,0.05)'
                    : 'transparent',
                  border: frameColor
                    ? `1px solid ${frameColor}`
                    : isMe
                    ? '1px solid rgba(124,58,237,0.3)'
                    : '1px solid transparent',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span style={{ fontSize: 11, width: 18, textAlign: 'center', fontFamily: 'var(--font-display)', color: '#3A3A58', fontWeight: 900 }}>
                    {medal ?? `${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black truncate" style={{ color: isMe ? '#C4B5FD' : '#8080A0', fontFamily: 'var(--font-display)' }}>
                        {isMe ? 'Tú' : p.nickname}
                      </span>
                      {chipBadge && <BadgeChip badge={chipBadge} />}
                      {/* Additional badges (si hay más y no hay equipment.badge) */}
                      {!equippedBadge && p.badges && p.badges.length > 1 && (
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          {p.badges.slice(1, 3).map(b => <BadgeChip key={b.id} badge={b} />)}
                        </span>
                      )}
                    </div>
                    {/* Título equipado */}
                    {title && (
                      <p className="text-[8px] font-black" style={{ color: title.color, fontFamily: 'var(--font-sport)', opacity: 0.8 }}>
                        {title.text}
                      </p>
                    )}
                  </div>
                  {tab === 'season' && (
                    <span className="text-[9px]" style={{ color: '#5A5A78', fontFamily: 'var(--font-sport)' }}>
                      {p.total}j
                    </span>
                  )}
                  <span className="text-[11px] font-black tabular-nums" style={{ color: i === 0 ? '#fbbf24' : '#4A4A6A', fontFamily: 'var(--font-display)' }}>
                    {formatScore(p.score, p.total)}
                  </span>
                </div>
              </div>
            )
          })
        )}

        {/* Mi posición si está fuera del top 5 (solo legacy) */}
        {myPos != null && myPos > 5 && (
          <>
            <div className="flex justify-center py-0.5">
              <span style={{ fontSize: 9, color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>···</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <span style={{ fontSize: 11, width: 18, textAlign: 'center', fontFamily: 'var(--font-display)', color: '#C4B5FD', fontWeight: 900 }}>{myPos}</span>
              <span className="flex-1 text-[11px] font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>Tú</span>
              <span className="text-[11px] font-black tabular-nums" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
                {`${myScore}/${totalMatches}`}
              </span>
            </div>
          </>
        )}

        {loaded && board.length > 0 && (
          <p className="text-[8px] text-center pt-1" style={{ color: '#1E1E38', fontFamily: 'var(--font-sport)' }}>
            {board.length} participante{board.length !== 1 ? 's' : ''} · {tab === 'season' ? 'Temporada acumulada' : jornada}
          </p>
        )}
      </div>
    </div>
  )
}
