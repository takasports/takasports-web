'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { BadgesModal } from '../BadgesModal'

// ─────────────────────────────────────────────────────────────────
// Hitos Panel — sidebar de /quiniela.
//
// Compacto. Muestra:
//   · Level + nombre (e.g. "L3 Quinielero") con barra de progreso
//   · "X/Y badges desbloqueados"
//   · Preview de hasta 5 badges desbloqueados (las más prestigiosas)
//   · Click → abre BadgesModal con catálogo completo (unlocked + locked)
//
// Si el user no está logueado, oculta el panel (no tiene sentido).
// ─────────────────────────────────────────────────────────────────

interface BadgePreview {
  id: string
  name: string
  emoji: string
  color: string
  bg: string
  rarity: string
  category: string
  description: string
  unlockedAt: string | null
}

interface MeData {
  level: number
  levelName: string
  levelColor: string
  nextLevel: { level: number; name: string; minXp: number } | null
  xp: number
  xpInLevel: number
  xpToNext: number
  progress: number
  badges: BadgePreview[]
  unlockedCount: number
  totalBadges: number
}

const RARITY_ORDER: Record<string, number> = {
  legendary: 0, epic: 1, rare: 2, common: 3,
}

export function HitosPanel({ user }: { user: User | null }) {
  const [data, setData] = useState<MeData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!user) { setLoaded(true); return }
    let cancelled = false
    fetch('/api/quiniela/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return
        if (d && !d.error) setData(d)
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [user])

  if (!user) return null
  if (!loaded) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>
        <div className="px-5 py-4 flex flex-col gap-2">
          <div className="h-10 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="h-8 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
        </div>
      </div>
    )
  }
  if (!data) return null

  const unlockedBadges = data.badges
    .filter(b => b.unlockedAt != null)
    .sort((a, b) =>
      (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9)
    )
    .slice(0, 5)

  const progressPct = Math.round(data.progress * 100)

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden cursor-pointer transition-opacity hover:opacity-95"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModalOpen(true) } }}
      >
        {/* Header con level + badges count */}
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="section-accent" />
          <h2 className="section-label">Mis hitos</h2>
          <span
            className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
              background: `${data.levelColor}1f`,
              color: data.levelColor,
              border: `1px solid ${data.levelColor}55`,
              fontFamily: 'var(--font-sport)',
            }}
          >
            L{data.level} · {data.levelName}
          </span>
        </div>

        {/* Barra de XP */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
              {data.xp.toLocaleString()} XP
            </span>
            <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
              {data.nextLevel
                ? `${data.xpToNext.toLocaleString()} XP a L${data.nextLevel.level}`
                : '✦ Nivel máximo'}
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${data.levelColor}, ${data.levelColor}dd)`,
                boxShadow: `0 0 12px ${data.levelColor}66`,
              }}
            />
          </div>
        </div>

        {/* Badges preview */}
        <div className="px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#5A5A78', fontFamily: 'var(--font-sport)' }}>
              Badges
            </span>
            <span className="text-[9px] font-black tabular-nums" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
              {data.unlockedCount}/{data.totalBadges}
            </span>
          </div>
          {unlockedBadges.length === 0 ? (
            <p className="text-[10px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
              Aún no desbloqueaste ningún badge. Apostá tu primera jornada para empezar.
            </p>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              {unlockedBadges.map(b => (
                <span
                  key={b.id}
                  title={b.name}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, borderRadius: 7,
                    background: b.bg, border: `1px solid ${b.color}`,
                    fontSize: 14, lineHeight: 1,
                  }}
                >
                  {b.emoji}
                </span>
              ))}
              {data.unlockedCount > unlockedBadges.length && (
                <span
                  className="text-[10px] font-black px-2 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#5A5A78', fontFamily: 'var(--font-sport)' }}
                >
                  +{data.unlockedCount - unlockedBadges.length}
                </span>
              )}
            </div>
          )}
          <p className="text-[8px] text-center pt-3" style={{ color: '#2A2A42', fontFamily: 'var(--font-sport)' }}>
            Click para ver todos los hitos
          </p>
        </div>
      </div>

      {modalOpen && (
        <BadgesModal
          badges={data.badges}
          level={data.level}
          levelName={data.levelName}
          levelColor={data.levelColor}
          xp={data.xp}
          unlockedCount={data.unlockedCount}
          totalBadges={data.totalBadges}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
