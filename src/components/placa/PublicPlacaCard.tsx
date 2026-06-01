'use client'

// ─────────────────────────────────────────────────────────────────
// PublicPlacaCard — placa pública de otro usuario.
//
// Self-fetch de /api/placa/[userId]. NO permite customizar (no es
// el dueño). Renderiza PlacaCardV3 con interactive=true para que el
// visitante pueda hacer hover y ver el foil/tilt.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { PlacaCardV3 } from './PlacaCardV3'
import { buildPlacaData, type ApiEquipment } from './adapter'
import type { LeaderboardBadge } from '@/lib/leaderboard-badges'

interface PlacaApiResponse {
  displayName: string
  handle:      string
  avatarUrl:   string | null
  level:       number
  levelName:   string
  xp:          number
  equipment:   ApiEquipment
  badges:      LeaderboardBadge[]
  liveStats:   Record<string, string | number>
}

interface Props {
  userId: string
}

export function PublicPlacaCard({ userId }: Props) {
  const [data, setData]     = useState<PlacaApiResponse | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/placa/${userId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!cancelled) { setData(d ?? null); setLoaded(true) }
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [userId])

  if (!loaded) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: 340, height: 480, margin: '0 auto',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      />
    )
  }
  if (!data) return null

  const placa = buildPlacaData({
    displayName: data.displayName,
    handle:      data.handle,
    avatarUrl:   data.avatarUrl,
    level:       data.level,
    levelName:   data.levelName,
    xp:          data.xp,
    equipment:   data.equipment,
    badges:      data.badges,
    liveStats:   data.liveStats,
  })

  return (
    <div className="flex justify-center" style={{ padding: '8px 0' }}>
      <PlacaCardV3 placa={placa} interactive />
    </div>
  )
}
