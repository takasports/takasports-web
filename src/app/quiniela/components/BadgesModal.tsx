'use client'

import { useMemo, useRef, useState } from 'react'
import { BadgeIcon, hasBadgeIcon } from '@/components/icons/badges/BadgeIcon'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// ─────────────────────────────────────────────────────────────────
// BadgesModal — catálogo completo de hitos del user.
//
// Renderiza TODOS los badges del catálogo, dividiendo entre desbloqueados
// y bloqueados. Filtros por categoría (chip-style) y un buscador no son
// necesarios al volumen actual (<20 badges) — si crece, refactor.
//
// Locked: muestra emoji en gris + descripción para que el user vea cómo
// desbloquearlo (mecánica de "achievement hunter").
//
// Equip system (v2):
//   Cada badge desbloqueado muestra botones de slot equipables.
//   Equipment = { badge?, title?, frame?, card_bg? } → badge_id activo.
//   onEquip(slot, badgeId) → llamado para equipar/desequipar.
// ─────────────────────────────────────────────────────────────────

type EquipSlot = 'badge' | 'title' | 'frame' | 'card_bg'

interface Badge {
  id: string
  name: string
  emoji: string
  color: string
  bg: string
  rarity: string
  category: string
  description: string
  unlockedAt: string | null
  equipSlots?: EquipSlot[]
}

interface Equipment {
  badge?:   string  // badge_id equipado en ese slot
  title?:   string
  frame?:   string
  card_bg?: string
}

const CATEGORY_LABEL: Record<string, string> = {
  milestone: 'Hitos',
  jornada:   'Jornada',
  season:    'Temporada',
  mundial:   'Mundial 2026',
  special:   'Especiales',
}

const CATEGORY_ORDER = ['mundial', 'milestone', 'jornada', 'season', 'special']
const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }

const SLOT_LABEL: Record<EquipSlot, string> = {
  badge:   'Badge',
  title:   'Título',
  frame:   'Marco',
  card_bg: 'Fondo',
}

export function BadgesModal({
  badges, level, levelName, levelColor, xp, unlockedCount, totalBadges,
  equipment, onEquip, onClose,
}: {
  badges: Badge[]
  level: number
  levelName: string
  levelColor: string
  xp: number
  unlockedCount: number
  totalBadges: number
  equipment?: Equipment
  onEquip?: (slot: EquipSlot, badgeId: string | null) => Promise<void>
  onClose: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all')
  const [equipping, setEquipping] = useState<string | null>(null)  // `${badge_id}:${slot}`

  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(true, dialogRef, onClose)

  const grouped = useMemo(() => {
    const filtered = badges.filter(b => {
      if (filter === 'unlocked') return b.unlockedAt != null
      if (filter === 'locked')   return b.unlockedAt == null
      return true
    })
    const byCat = new Map<string, Badge[]>()
    for (const b of filtered) {
      const list = byCat.get(b.category) ?? []
      list.push(b)
      byCat.set(b.category, list)
    }
    for (const list of byCat.values()) {
      list.sort((a, b) =>
        (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) ||
        a.name.localeCompare(b.name)
      )
    }
    return CATEGORY_ORDER
      .map(cat => ({ cat, items: byCat.get(cat) ?? [] }))
      .filter(g => g.items.length > 0)
  }, [badges, filter])

  async function handleEquip(slot: EquipSlot, badgeId: string) {
    if (!onEquip) return
    const key = `${badgeId}:${slot}`
    setEquipping(key)
    try {
      // Toggle: si ya está equipado, desequipar; si no, equipar
      const currentlyEquipped = equipment?.[slot] === badgeId
      await onEquip(slot, currentlyEquipped ? null : badgeId)
    } finally {
      setEquipping(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tus insignias y nivel"
        className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[88vh] flex flex-col"
        style={{
          background: 'linear-gradient(165deg, #15082A 0%, #0A0118 100%)',
          border: '1px solid rgba(124,58,237,0.3)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ borderBottom: '1px solid rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.04)' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center font-black"
            style={{
              background: `${levelColor}22`,
              border: `1px solid ${levelColor}88`,
              color: levelColor,
              fontFamily: 'var(--font-display)',
              fontSize: 18,
            }}
          >
            L{level}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-base truncate" style={{ color: '#E5E1FF', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
              {levelName}
            </p>
            <p className="text-[10px] tabular-nums" style={{ color: '#8080A0', fontFamily: 'var(--font-sport)' }}>
              {xp.toLocaleString()} XP · {unlockedCount}/{totalBadges} badges
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#8080A0', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Equipamiento activo — resumen compacto */}
        {equipment && onEquip && (
          <div
            className="px-5 py-2.5 flex items-center gap-2 flex-wrap"
            style={{ borderBottom: '1px solid rgba(124,58,237,0.12)', background: 'rgba(124,58,237,0.02)' }}
          >
            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
              Equipado:
            </span>
            {(['badge', 'title', 'frame', 'card_bg'] as EquipSlot[]).map(slot => {
              const equippedId = equipment?.[slot]
              const equippedBadge = equippedId ? badges.find(b => b.id === equippedId) : null
              return (
                <span
                  key={slot}
                  className="text-[8px] font-black px-1.5 py-0.5 rounded"
                  style={{
                    background: equippedBadge ? equippedBadge.bg : 'rgba(255,255,255,0.03)',
                    color: equippedBadge ? equippedBadge.color : '#3A3A52',
                    border: `1px solid ${equippedBadge ? equippedBadge.color + '55' : 'rgba(255,255,255,0.06)'}`,
                    fontFamily: 'var(--font-sport)',
                  }}
                >
                  {SLOT_LABEL[slot]}
                  {equippedBadge
                    ? <>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 2 }}>
                          {hasBadgeIcon(equippedBadge.id)
                            ? <BadgeIcon id={equippedBadge.id} size={9} strokeWidth={1.6} />
                            : equippedBadge.emoji}
                          {equippedBadge.name}
                        </span>
                      </>
                    : ': —'}
                </span>
              )
            })}
          </div>
        )}

        {/* Filtros */}
        <div className="px-5 pt-3 flex items-center gap-1.5">
          {([
            ['all',      `Todos · ${totalBadges}`],
            ['unlocked', `Desbloqueados · ${unlockedCount}`],
            ['locked',   `Por desbloquear · ${totalBadges - unlockedCount}`],
          ] as const).map(([key, label]) => {
            const active = filter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
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

        {/* Lista scrolleable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {grouped.length === 0 && (
            <p className="text-center text-[11px]" style={{ color: '#5A5A78', fontFamily: 'var(--font-sport)' }}>
              No hay badges en este filtro.
            </p>
          )}
          {grouped.map(({ cat, items }) => (
            <div key={cat} className="flex flex-col gap-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                {CATEGORY_LABEL[cat] ?? cat}
              </p>
              {items.map(b => {
                const unlocked = b.unlockedAt != null
                const slots = b.equipSlots ?? ['badge']

                return (
                  <div
                    key={b.id}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: unlocked ? b.bg : 'rgba(255,255,255,0.02)',
                      border: unlocked ? `1px solid ${b.color}55` : '1px solid rgba(255,255,255,0.06)',
                      opacity: unlocked ? 1 : 0.55,
                    }}
                  >
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        background: unlocked ? `${b.color}22` : 'rgba(255,255,255,0.04)',
                        border: unlocked ? `1px solid ${b.color}` : '1px solid rgba(255,255,255,0.08)',
                        fontSize: 20,
                        filter: unlocked ? 'none' : 'grayscale(1)',
                        color: unlocked ? b.color : '#5A5A78',
                      }}
                    >
                      {hasBadgeIcon(b.id)
                        ? <BadgeIcon id={b.id} size={20} strokeWidth={1.7} />
                        : b.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-black" style={{ color: unlocked ? b.color : '#7A7A98', fontFamily: 'var(--font-display)' }}>
                          {b.name}
                        </p>
                        <span
                          className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            color: unlocked ? b.color : '#5A5A78',
                            fontFamily: 'var(--font-sport)',
                          }}
                        >
                          {b.rarity}
                        </span>
                      </div>
                      <p className="text-[10px] leading-snug mt-0.5" style={{ color: unlocked ? '#A8A8C8' : '#5A5A78', fontFamily: 'var(--font-sport)' }}>
                        {b.description}
                      </p>
                      {unlocked && b.unlockedAt && (
                        <p className="text-[8px] mt-1" style={{ color: '#5A5A78', fontFamily: 'var(--font-sport)' }}>
                          Desbloqueado el {new Date(b.unlockedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}

                      {/* Equip buttons — solo para desbloqueados y si hay equip system */}
                      {unlocked && onEquip && slots.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {slots.map(slot => {
                            const key = `${b.id}:${slot}`
                            const isEquipped = equipment?.[slot] === b.id
                            const isLoading  = equipping === key
                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={isLoading}
                                onClick={() => void handleEquip(slot, b.id)}
                                className="text-[8px] font-black px-2 py-0.5 rounded-full transition-all"
                                style={{
                                  background: isEquipped
                                    ? `${b.color}33`
                                    : 'rgba(255,255,255,0.05)',
                                  color: isEquipped ? b.color : '#6A6A8A',
                                  border: isEquipped
                                    ? `1px solid ${b.color}88`
                                    : '1px solid rgba(255,255,255,0.1)',
                                  fontFamily: 'var(--font-sport)',
                                  cursor: isLoading ? 'wait' : 'pointer',
                                  opacity: isLoading ? 0.6 : 1,
                                }}
                              >
                                {isLoading ? '…' : isEquipped ? `✓ ${SLOT_LABEL[slot]}` : `⊕ ${SLOT_LABEL[slot]}`}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
