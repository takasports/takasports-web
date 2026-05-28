'use client'

import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────
// Ranking del Mundial 2026 — acumulado a través de TODAS las
// jornadas del torneo (11 jun – 19 jul 2026). Pega al endpoint
// /api/quiniela/leaderboard?tournament=mundial2026 que filtra
// jornadas con prefijo "Mundial%" y suma totalCoins por user.
//
// Render condicional: solo cuando QuinielaClient detecta isMundial
// (jornada activa empieza con "Mundial"). Skin dorado distintivo
// del badge "Copa 2026".
//
// Equipment rendering (v2):
//   · frame → border color de la fila
//   · card_bg → fondo de la fila (legendary)
//   · title → epíteto bajo el nick
//   · badge → chip equipado (priority sobre auto-select)
// ─────────────────────────────────────────────────────────────────

interface MundialBadge { id: string; name: string; emoji: string; color: string; bg: string; rarity: string }
interface MundialEquipment {
  badge?:   { emoji: string; color: string; bg: string; name: string }
  title?:   { text: string; color: string }
  frame?:   { color: string }
  card_bg?: { gradient: string }
}
interface MundialEntry {
  nickname: string
  score: number
  total: number
  badges?: MundialBadge[]
  equipment?: MundialEquipment
}

function BadgeChip({ badge }: { badge: { emoji: string; color: string; bg: string; name?: string } }) {
  return (
    <span
      title={badge.name ?? ''}
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

export function MundialLeaderboardPanel() {
  const [board, setBoard] = useState<MundialEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/quiniela/leaderboard?tournament=mundial2026&limit=10', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        if (data?.entries) setBoard(data.entries)
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  // Skeleton mientras carga, panel vacío si nadie jugó todavía.
  if (!loaded) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.06), rgba(180,83,9,0.03))', border: '1px solid rgba(245,158,11,0.22)' }}>
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
          <span style={{ fontSize: 14 }}>🏆</span>
          <h2 className="section-label" style={{ color: '#fbbf24' }}>Ranking Mundial 2026</h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: 'rgba(245,158,11,0.05)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (board.length === 0) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.06), rgba(180,83,9,0.03))', border: '1px solid rgba(245,158,11,0.22)' }}>
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
          <span style={{ fontSize: 14 }}>🏆</span>
          <h2 className="section-label" style={{ color: '#fbbf24' }}>Ranking Mundial 2026</h2>
        </div>
        <div className="px-5 py-5 text-center">
          <p className="text-[11px]" style={{ color: '#8A6B30', fontFamily: 'var(--font-sport)' }}>
            Sé el primero en apostar en una jornada del Mundial.<br />
            El ranking se va acumulando jornada a jornada.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(245,158,11,0.08), rgba(180,83,9,0.03) 60%, rgba(8,0,15,0.5))', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 10px 30px rgba(180,83,9,0.18)' }}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(245,158,11,0.22)', background: 'rgba(0,0,0,0.18)' }}>
        <span style={{ fontSize: 14 }}>🏆</span>
        <div className="flex-1">
          <h2 className="section-label" style={{ color: '#fbbf24' }}>Ranking Mundial 2026</h2>
          <p className="text-[8px]" style={{ color: '#8A6B30', fontFamily: 'var(--font-sport)' }}>
            Acumulado · todas las jornadas del torneo
          </p>
        </div>
      </div>

      {/* Comunicación del premio físico — visible siempre que haya leaderboard */}
      <div className="mx-4 mt-3 mb-1 px-3 py-2.5 rounded-xl flex items-center gap-2.5" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.32)' }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>👕</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)' }}>
            Premio del torneo
          </p>
          <p className="text-[9px] leading-snug" style={{ color: '#C99858', fontFamily: 'var(--font-sport)' }}>
            El TOP 3 al final del Mundial recibe una camiseta oficial de su selección. Te contactamos por email al cerrar el torneo.
          </p>
        </div>
      </div>

      <div className="px-4 py-3 flex flex-col gap-1">
        {board.slice(0, 5).map((p, i) => {
          const medal         = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
          const eq            = p.equipment
          const frameColor    = eq?.frame?.color
          const cardBg        = eq?.card_bg?.gradient
          const equippedBadge = eq?.badge
          const title         = eq?.title
          const chipBadge     = equippedBadge ?? p.badges?.[0]

          return (
            <div
              key={`${p.nickname}-${i}`}
              className="flex flex-col px-3 py-2 rounded-xl"
              style={{
                background: cardBg
                  ? cardBg
                  : i === 0
                  ? 'rgba(245,158,11,0.10)'
                  : 'rgba(255,255,255,0.02)',
                border: frameColor
                  ? `1px solid ${frameColor}`
                  : i === 0
                  ? '1px solid rgba(245,158,11,0.3)'
                  : '1px solid transparent',
              }}
            >
              <div className="flex items-center gap-2.5">
                <span style={{ fontSize: 11, width: 18, textAlign: 'center', fontFamily: 'var(--font-display)', color: '#6A5020', fontWeight: 900 }}>
                  {medal ?? `${i + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black truncate" style={{ color: i === 0 ? '#fbbf24' : '#A89878', fontFamily: 'var(--font-display)' }}>
                      {p.nickname}
                    </span>
                    {chipBadge && <BadgeChip badge={chipBadge} />}
                    {!equippedBadge && p.badges && p.badges.length > 1 && (
                      <span className="flex items-center gap-0.5 flex-shrink-0">
                        {p.badges.slice(1, 3).map(b => <BadgeChip key={b.id} badge={b} />)}
                      </span>
                    )}
                  </div>
                  {title && (
                    <p className="text-[8px] font-black" style={{ color: title.color, fontFamily: 'var(--font-sport)', opacity: 0.8 }}>
                      {title.text}
                    </p>
                  )}
                </div>
                <span className="text-[9px]" style={{ color: '#6A5020', fontFamily: 'var(--font-sport)' }}>
                  {p.total}j
                </span>
                <span className="text-[11px] font-black tabular-nums" style={{ color: i === 0 ? '#fbbf24' : '#8A7050', fontFamily: 'var(--font-display)' }}>
                  {p.score}🪙
                </span>
              </div>
            </div>
          )
        })}

        <p className="text-[8px] text-center pt-1" style={{ color: '#5A3F18', fontFamily: 'var(--font-sport)' }}>
          {board.length} participante{board.length !== 1 ? 's' : ''} · Copa 2026
        </p>
      </div>
    </div>
  )
}
