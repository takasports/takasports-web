'use client'

// ─────────────────────────────────────────────────────────────────
// UserPlacaCard — placa personal del user logueado, renderizada en
// /perfil.
//
// Self-fetch:
//   · /api/cosmetics/me   → equipment + unlocks + catalog
//   · /api/quiniela/me    → level, xp, badges desbloqueados
//
// Si el user no tiene sesión o /me devuelve 401, no renderiza nada
// (la /perfil page ya tiene su propio empty state para guest).
//
// Renderiza PlacaCardV3 con datos REALES. Es el primer punto de
// contacto del user con el sistema de personalización en producción.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { PlacaCardV3 } from './PlacaCardV3'
import { buildPlacaData, type ApiEquipment } from './adapter'
import type { LeaderboardBadge } from '@/lib/leaderboard-badges'

interface MeBadge {
  id: string; name: string; emoji: string
  color: string; bg: string; rarity: string
  unlockedAt: string | null
}
interface MeResponse {
  level?: number
  levelName?: string
  xp?: number
  badges?: MeBadge[]
}
interface CosmeticsMeResponse {
  equipment?: ApiEquipment
}

interface Props {
  user: User
  displayName: string
  avatarUrl?: string | null
}

export function UserPlacaCard({ user, displayName, avatarUrl }: Props) {
  const [me, setMe]               = useState<MeResponse | null>(null)
  const [equipment, setEquipment] = useState<ApiEquipment | null>(null)
  const [loaded, setLoaded]       = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/quiniela/me',  { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/cosmetics/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]).then(([meData, cosmData]) => {
      if (cancelled) return
      setMe(meData ?? null)
      setEquipment((cosmData as CosmeticsMeResponse | null)?.equipment ?? null)
      setLoaded(true)
    }).catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [user.id])

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

  // Sin meData → no podemos render. Fallback silencioso (perfil sigue
  // mostrando el resto del contenido legacy).
  if (!me) return null

  // Handle desde email o display_name slugified
  const handle = (user.email?.split('@')[0] ?? displayName.toLowerCase().replace(/\s+/g, ''))
    .slice(0, 20)

  // Badges desbloqueados → LeaderboardBadge shape para el adapter
  const unlockedBadges: LeaderboardBadge[] = (me.badges ?? [])
    .filter(b => b.unlockedAt)
    .map(b => ({
      id: b.id, name: b.name, emoji: b.emoji,
      color: b.color, bg: b.bg, rarity: b.rarity,
    }))

  // Live stats — sólo XP por ahora (único signature_stat seedeado)
  const liveStats: Record<string, string | number> = {
    xp: (me.xp ?? 0).toLocaleString('es-ES'),
  }

  const placa = buildPlacaData({
    displayName,
    handle,
    avatarUrl,
    level:     me.level ?? 1,
    levelName: me.levelName ?? 'Novato',
    xp:        me.xp ?? 0,
    equipment: equipment ?? undefined,
    badges:    unlockedBadges,
    liveStats,
  })

  return (
    <div className="flex justify-center" style={{ padding: '8px 0' }}>
      <PlacaCardV3 placa={placa} interactive />
    </div>
  )
}
