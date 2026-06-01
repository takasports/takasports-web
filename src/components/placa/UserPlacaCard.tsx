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
// Click en la placa → abre el vestidor (PlacaWardrobe) para customizar.
// ─────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { PlacaCardV3 } from './PlacaCardV3'
import { PlacaWardrobe } from './PlacaWardrobe'
import { buildPlacaData, type ApiEquipment } from './adapter'
import type { LeaderboardBadge } from '@/lib/leaderboard-badges'
import { SITE_URL } from '@/lib/constants'

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
  const [wardrobeOpen, setWardrobeOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const refresh = useCallback(() => {
    Promise.all([
      fetch('/api/quiniela/me',  { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/cosmetics/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]).then(([meData, cosmData]) => {
      setMe(meData ?? null)
      setEquipment((cosmData as CosmeticsMeResponse | null)?.equipment ?? null)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

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

  if (!me) return null

  const handle = (user.email?.split('@')[0] ?? displayName.toLowerCase().replace(/\s+/g, ''))
    .slice(0, 20)

  const unlockedBadges: LeaderboardBadge[] = (me.badges ?? [])
    .filter(b => b.unlockedAt)
    .map(b => ({
      id: b.id, name: b.name, emoji: b.emoji,
      color: b.color, bg: b.bg, rarity: b.rarity,
    }))

  // liveStats — keys alimentando los signature_stat cosmetic.
  // badgesCount va directo desde unlockedBadges.length. Plenos/racha/
  // predictions no se exponen en /api/quiniela/me todavía — quedan
  // como '—' en la placa propia. La placa pública sí los tiene
  // resueltos en /api/placa/[userId].
  const plenosCount = unlockedBadges.filter(b => b.id === 'pleno_jornada').length
  const liveStats: Record<string, string | number> = {
    xp:           (me.xp ?? 0).toLocaleString('es-ES'),
    badgesCount:  String(unlockedBadges.length),
    plenos:       plenosCount > 0 ? `x${plenosCount}` : '0',
    racha:        '—',
    predictions:  '—',
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
    <>
      <div className="flex flex-col items-center" style={{ padding: '8px 0', gap: 12 }}>
        {/* Placa clickable */}
        <button
          type="button"
          onClick={() => setWardrobeOpen(true)}
          aria-label="Customizar mi placa"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <PlacaCardV3 placa={placa} interactive />
        </button>

        {/* CTAs debajo: customizar + compartir */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWardrobeOpen(true)}
            className="text-[10px] font-black uppercase tracking-[0.22em] transition-opacity hover:opacity-100"
            style={{
              background: 'rgba(167,139,250,0.10)',
              border: '1px solid rgba(167,139,250,0.30)',
              color: '#C4B5FD',
              padding: '8px 18px',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'var(--font-headline)',
              opacity: 0.92,
            }}
          >
            Customizar →
          </button>

          <button
            type="button"
            onClick={async () => {
              const url = `${SITE_URL}/perfil/${user.id}`
              const shareData = {
                title: `Mi placa · TakaSports`,
                text:  `Mira mi placa en TakaSports`,
                url,
              }
              try {
                if (typeof navigator !== 'undefined' && navigator.share) {
                  await navigator.share(shareData)
                } else {
                  await navigator.clipboard.writeText(url)
                  setShareCopied(true)
                  setTimeout(() => setShareCopied(false), 2500)
                }
              } catch { /* user canceled */ }
            }}
            className="text-[10px] font-black uppercase tracking-[0.22em] transition-opacity hover:opacity-100"
            style={{
              background: shareCopied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
              border:     shareCopied ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(255,255,255,0.10)',
              color:      shareCopied ? '#86efac' : '#9090B0',
              padding: '8px 18px',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'var(--font-headline)',
              opacity: 0.92,
            }}
          >
            {shareCopied ? '✓ Copiado' : 'Compartir →'}
          </button>
        </div>
      </div>

      {/* Modal vestidor */}
      <PlacaWardrobe
        open={wardrobeOpen}
        onClose={() => { setWardrobeOpen(false); refresh() }}
        displayName={displayName}
        handle={handle}
        avatarUrl={avatarUrl}
        level={me.level ?? 1}
        levelName={me.levelName ?? 'Novato'}
        badges={unlockedBadges}
        liveStats={liveStats}
        onEquipmentChange={(eq) => setEquipment(eq)}
      />
    </>
  )
}
