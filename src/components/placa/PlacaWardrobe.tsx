'use client'

// ─────────────────────────────────────────────────────────────────
// PlacaWardrobe — modal full-screen para customizar la placa.
//
// Estructura:
//   · Header: título + cerrar
//   · Layout split: PlacaCard preview (izq) + catálogo filtrable (der)
//   · Click cosmético desbloqueado → equipa instantáneamente (POST
//     /api/quiniela/me/equip + optimistic update). Click otra vez en
//     el ya equipado → desequipa.
//   · Cosméticos locked se muestran grayscale con tooltip del criterio.
//   · Filtros: por tipo/slot + por estado (todos/desbloqueados/locked).
//
// El preview es la MISMA PlacaCardV3 que ve el público, recalculada
// en vivo desde el equipment optimista local.
// ─────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PlacaCardV4 } from './PlacaCardV4'
import { CosmeticPreview, type CosmeticForPreview } from './CosmeticPreview'
import { buildPlacaData, type ApiEquipment } from './adapter'
import type { LeaderboardBadge } from '@/lib/leaderboard-badges'
import type { EquipSlot } from '@/lib/equipment'

interface Cosmetic extends CosmeticForPreview {
  description:      string | null
  rarity:           string
  unlock_source:    string
  unlock_condition: Record<string, unknown>
}

interface Props {
  open: boolean
  onClose: () => void
  // Identidad del user para la placa preview
  displayName: string
  handle:      string
  avatarUrl?:  string | null
  // Progresión
  level:     number
  levelName: string
  liveStats?: Record<string, string | number>
  // Badges del user (para secondary chips)
  badges?:   LeaderboardBadge[]
  // Callback opcional para que el padre refresque tras cerrar
  onEquipmentChange?: (eq: ApiEquipment) => void
}

// ── Mapeo type cosmético → slot equipable
const TYPE_TO_SLOT: Record<string, EquipSlot> = {
  badge_chip:         'badge',
  title:              'title',
  frame:              'frame',
  card_bg:            'card_bg',
  avatar_frame:       'avatar_frame',
  name_effect:        'name_effect',
  corner_sticker:     'corner_sticker',
  signature_stat:     'signature_stat',
  background_pattern: 'background_pattern',
}

const SLOT_LABEL: Record<string, string> = {
  frame:        'Marco',
  card_bg:      'Fondo',
  avatar_frame: 'Anillo',
  name_effect:  'Nombre',
  title:        'Título',
}

// Los 5 slots de personalización (consolidación 2026-06-02).
// Slots legacy ocultos del vestidor: badge_chip, corner_sticker,
// signature_stat, background_pattern (fusionado en card_bg). Quedan
// en DB pero no se ofrecen — la placa V4 tampoco los renderiza.
const VISIBLE_SLOTS: EquipSlot[] = [
  'frame', 'card_bg', 'avatar_frame', 'name_effect', 'title',
]
const SLOT_ORDER: EquipSlot[] = VISIBLE_SLOTS

const RARITY_COLOR: Record<string, string> = {
  common:    '#94a3b8',
  rare:      '#60a5fa',
  epic:      '#c084fc',
  legendary: '#fbbf24',
}

const RARITY_LABEL: Record<string, string> = {
  common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario',
}

// Criterio textual de unlock para cosméticos locked
function unlockHint(c: Cosmetic): string {
  const cond = c.unlock_condition as Record<string, string | number>
  switch (c.unlock_source) {
    case 'badge':
      return `Desbloquea el badge "${cond.badge_id}"`
    case 'level':
      return `Alcanza el nivel ${cond.min_level}`
    case 'sport_pick':
      return `Sigue ${cond.sport} como deporte favorito`
    case 'event':
      return 'Disponible por evento'
    case 'manual':
      return 'Otorgado manualmente por el admin'
    default:
      return 'Bloqueado'
  }
}

type StatusFilter = 'all' | 'unlocked' | 'locked'
type SlotFilter   = 'all' | EquipSlot

export function PlacaWardrobe({
  open, onClose,
  displayName, handle, avatarUrl,
  level, levelName, liveStats,
  badges,
  onEquipmentChange,
}: Props) {
  const [catalog,  setCatalog]  = useState<Cosmetic[]>([])
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [equipment, setEquipment] = useState<ApiEquipment>({})
  const [loaded, setLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [slotFilter,   setSlotFilter]   = useState<SlotFilter>('all')
  const [equipping, setEquipping] = useState<string | null>(null)

  // ── Fetch al abrir ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setLoaded(false)
    fetch('/api/cosmetics/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setLoaded(true); return }
        setCatalog((data.catalog ?? []) as Cosmetic[])
        const unl: { id: string }[] = data.unlocked ?? []
        setUnlocked(new Set(unl.map(u => u.id)))
        setEquipment((data.equipment ?? {}) as ApiEquipment)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [open])

  // ── ESC cierra + bloquear scroll body ─────────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOv = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOv
    }
  }, [open, onClose])

  // ── Equipped por slot (lookup) ────────────────────────────────
  const equippedBySlot: Partial<Record<EquipSlot, string>> = useMemo(() => {
    const out: Partial<Record<EquipSlot, string>> = {}
    for (const [slot, val] of Object.entries(equipment) as [EquipSlot, { cosmeticId?: string }][]) {
      if (val?.cosmeticId) out[slot] = val.cosmeticId
    }
    return out
  }, [equipment])

  // ── Catálogo filtrado ─────────────────────────────────────────
  // Solo los 5 slots visibles (consolidación). Cosmetics de tipos
  // legacy (chip/sticker/stat/pattern) se ocultan del vestidor.
  const filteredCatalog = useMemo(() => {
    return catalog.filter(c => {
      const itemSlot = TYPE_TO_SLOT[c.type]
      if (!itemSlot || !VISIBLE_SLOTS.includes(itemSlot)) return false
      const isUnlocked = unlocked.has(c.id)
      if (statusFilter === 'unlocked' && !isUnlocked) return false
      if (statusFilter === 'locked'   && isUnlocked)  return false
      if (slotFilter !== 'all' && itemSlot !== slotFilter) return false
      return true
    })
  }, [catalog, unlocked, statusFilter, slotFilter])

  // Catálogo de los 5 slots visibles (sin filtros de estado) — base
  // para contadores honestos.
  const catalogVisible = useMemo(
    () => catalog.filter(c => {
      const s = TYPE_TO_SLOT[c.type]
      return s && VISIBLE_SLOTS.includes(s)
    }),
    [catalog],
  )
  const visibleCount = catalogVisible.length
  const unlockedVisible = useMemo(
    () => catalogVisible.filter(c => unlocked.has(c.id)).length,
    [catalogVisible, unlocked],
  )

  // Slots presentes (con ≥1 cosmético) para los filtros
  const visibleSlots = useMemo(() => {
    const set = new Set<EquipSlot>()
    for (const c of catalogVisible) {
      const s = TYPE_TO_SLOT[c.type]
      if (s) set.add(s)
    }
    return SLOT_ORDER.filter(s => set.has(s))
  }, [catalogVisible])

  // ── Acción: equipar / desequipar ──────────────────────────────
  const equipCosmetic = useCallback(async (c: Cosmetic) => {
    if (!unlocked.has(c.id)) return  // locked
    const slot = TYPE_TO_SLOT[c.type]
    if (!slot) return
    if (equipping) return  // throttle

    const currentlyEquipped = equippedBySlot[slot] === c.id

    // Optimistic update
    const snapshot = equipment
    const optimistic: ApiEquipment = { ...equipment }

    if (currentlyEquipped) {
      // Desequipar
      delete (optimistic as Record<string, unknown>)[slot]
    } else {
      // Equipar — el preview construye desde data, así que insertamos
      // una shape compatible con ApiEquipment
      const d = c.data as Record<string, string | undefined>
      switch (slot) {
        case 'title':
          optimistic.title = { cosmeticId: c.id, text: d.text ?? c.name, color: d.color ?? '#7C3AED' }
          break
        case 'frame':
          optimistic.frame = { cosmeticId: c.id, color: d.color ?? '#7C3AED' }
          break
        case 'card_bg':
          optimistic.card_bg = { cosmeticId: c.id, gradient: d.gradient ?? '' }
          break
        case 'avatar_frame':
          optimistic.avatar_frame = {
            cosmeticId: c.id, color: d.color ?? '#7C3AED',
            style: (d.style as 'solid' | 'gradient' | undefined) ?? 'solid',
          }
          break
        case 'name_effect':
          optimistic.name_effect = { cosmeticId: c.id, gradient: d.gradient ?? '', glow: d.glow }
          break
        case 'corner_sticker':
          optimistic.corner_sticker = {
            cosmeticId: c.id, iconId: d.icon_id ?? 'star', color: d.color ?? '#fbbf24',
          }
          break
        case 'signature_stat':
          optimistic.signature_stat = { cosmeticId: c.id, key: d.key ?? 'xp', label: d.label ?? 'XP' }
          break
        case 'background_pattern':
          optimistic.background_pattern = {
            cosmeticId: c.id, pattern: (d.pattern as 'dots' | 'lines' | 'stripes' | undefined) ?? 'dots',
          }
          break
        case 'badge':
          optimistic.badge = {
            cosmeticId: c.id, emoji: '',
            color: d.color ?? '#7C3AED', bg: d.bg ?? 'rgba(124,58,237,0.18)',
            name: c.name,
          }
          break
      }
    }

    setEquipment(optimistic)
    setEquipping(c.id)

    try {
      const res = await fetch('/api/quiniela/me/equip', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slot,
          cosmeticId: currentlyEquipped ? null : c.id,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onEquipmentChange?.(optimistic)
    } catch (err) {
      // Revertir
      setEquipment(snapshot)
      console.warn('[wardrobe] equip failed', err)
    } finally {
      setEquipping(null)
    }
  }, [unlocked, equippedBySlot, equipment, equipping, onEquipmentChange])

  // ── Placa preview en vivo ─────────────────────────────────────
  const placaPreview = useMemo(() => buildPlacaData({
    displayName, handle, avatarUrl,
    level, levelName,
    equipment,
    badges,
    liveStats,
  }), [displayName, handle, avatarUrl, level, levelName, equipment, badges, liveStats])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customizar placa"
      className="fixed inset-0 z-[9990] flex items-stretch justify-center"
      style={{ background: 'rgba(4,4,8,0.92)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1280px] flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ height: '100vh', maxHeight: '100vh' }}
      >
        {/* HEADER */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <p
              className="uppercase tracking-[0.28em]"
              style={{ fontSize: 10, color: '#7A7A92', fontFamily: 'var(--font-headline)' }}
            >
              Customizar
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22, fontWeight: 900,
                color: '#F0F0F8', letterSpacing: '-0.02em',
                margin: 0, marginTop: 2,
              }}
            >
              Mi placa
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-100"
            style={{
              color: '#9090B0',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.10)',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'var(--font-headline)',
              opacity: 0.75,
            }}
          >
            Cerrar ✕
          </button>
        </div>

        {/* SPLIT LAYOUT */}
        <div className="flex-1 grid overflow-hidden" style={{
          gridTemplateColumns: 'minmax(0, 380px) 1fr',
          gap: 0,
        }}>

          {/* IZQ — PLACA PREVIEW */}
          <div
            className="flex flex-col items-center justify-start"
            style={{
              padding: '32px 24px',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              background: 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(167,139,250,0.06) 0%, transparent 70%)',
              overflowY: 'auto',
            }}
          >
            <PlacaCardV4 placa={placaPreview} interactive />
            <p
              className="text-center mt-6"
              style={{
                fontSize: 11, color: '#5A5A78',
                fontFamily: 'var(--font-sport)', lineHeight: 1.6,
                maxWidth: 280,
              }}
            >
              Vista previa en vivo · pasa el cursor sobre la placa
            </p>
          </div>

          {/* DER — CATÁLOGO */}
          <div className="flex flex-col overflow-hidden" style={{ background: 'rgba(8,8,14,0.6)' }}>

            {/* Filtros */}
            <div
              className="flex flex-col gap-3"
              style={{ padding: '20px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              {/* Estado */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="uppercase tracking-[0.24em] mr-1"
                  style={{ fontSize: 9, color: '#5A5A78', fontFamily: 'var(--font-headline)' }}
                >
                  Estado
                </span>
                {(['all', 'unlocked', 'locked'] as StatusFilter[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition-opacity"
                    style={{
                      background:  statusFilter === s ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.03)',
                      color:       statusFilter === s ? '#C4B5FD' : '#7A7A92',
                      border:      statusFilter === s ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      fontFamily: 'var(--font-sport)', cursor: 'pointer',
                    }}
                  >
                    {s === 'all' ? `Todos · ${visibleCount}`
                      : s === 'unlocked' ? `Desbloqueados · ${unlockedVisible}`
                      : `Bloqueados · ${visibleCount - unlockedVisible}`}
                  </button>
                ))}
              </div>

              {/* Slot */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="uppercase tracking-[0.24em] mr-1"
                  style={{ fontSize: 9, color: '#5A5A78', fontFamily: 'var(--font-headline)' }}
                >
                  Tipo
                </span>
                <button
                  type="button"
                  onClick={() => setSlotFilter('all')}
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition-opacity"
                  style={{
                    background:  slotFilter === 'all' ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.03)',
                    color:       slotFilter === 'all' ? '#C4B5FD' : '#7A7A92',
                    border:      slotFilter === 'all' ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    fontFamily: 'var(--font-sport)', cursor: 'pointer',
                  }}
                >
                  Todos
                </button>
                {visibleSlots.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlotFilter(s)}
                    className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition-opacity"
                    style={{
                      background:  slotFilter === s ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.03)',
                      color:       slotFilter === s ? '#C4B5FD' : '#7A7A92',
                      border:      slotFilter === s ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      fontFamily: 'var(--font-sport)', cursor: 'pointer',
                    }}
                  >
                    {SLOT_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '16px 24px 32px' }}>
              {!loaded && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{
                      height: 100,
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.03)',
                    }} />
                  ))}
                </div>
              )}

              {loaded && filteredCatalog.length === 0 && (
                <p className="text-center py-12 text-[12px]" style={{ color: '#5A5A78', fontFamily: 'var(--font-sport)' }}>
                  No hay cosméticos en este filtro.
                </p>
              )}

              {loaded && filteredCatalog.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredCatalog.map(c => {
                    const isUnlocked = unlocked.has(c.id)
                    const slot = TYPE_TO_SLOT[c.type]
                    const isEquipped = slot && equippedBySlot[slot] === c.id
                    const isLoading = equipping === c.id
                    const rarityColor = RARITY_COLOR[c.rarity] ?? '#94a3b8'

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => equipCosmetic(c)}
                        disabled={!isUnlocked || isLoading}
                        title={isUnlocked ? c.description ?? c.name : unlockHint(c)}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          padding: 10,
                          borderRadius: 10,
                          background: isEquipped
                            ? `${rarityColor}15`
                            : isUnlocked
                              ? 'rgba(255,255,255,0.03)'
                              : 'rgba(255,255,255,0.015)',
                          border: isEquipped
                            ? `1.5px solid ${rarityColor}`
                            : `1px solid ${isUnlocked ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)'}`,
                          cursor: isUnlocked ? 'pointer' : 'not-allowed',
                          opacity: isUnlocked ? 1 : 0.55,
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          transition: 'transform 0.12s, border-color 0.12s, background 0.12s',
                          transform: isLoading ? 'scale(0.97)' : 'scale(1)',
                        }}
                        className="hover:brightness-110"
                      >
                        <CosmeticPreview cosmetic={c} locked={!isUnlocked} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: 12, fontWeight: 900,
                              color: isUnlocked ? '#F0F0F8' : '#5A5A78',
                              letterSpacing: '-0.01em',
                              lineHeight: 1.1,
                            }} className="truncate">
                              {c.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span style={{
                              fontSize: 8, fontWeight: 800,
                              padding: '2px 5px', borderRadius: 3,
                              background: `${rarityColor}18`,
                              color: rarityColor,
                              border: `1px solid ${rarityColor}30`,
                              fontFamily: 'var(--font-sport)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              lineHeight: 1,
                            }}>
                              {RARITY_LABEL[c.rarity] ?? c.rarity}
                            </span>
                            {isEquipped && (
                              <span style={{
                                fontSize: 8, fontWeight: 800,
                                padding: '2px 5px', borderRadius: 3,
                                background: `${rarityColor}30`,
                                color: '#F0F0F8',
                                fontFamily: 'var(--font-sport)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                lineHeight: 1,
                              }}>
                                Equipado
                              </span>
                            )}
                          </div>
                          {!isUnlocked && (
                            <p style={{
                              fontSize: 9, color: '#6A6A88',
                              fontFamily: 'var(--font-sport)',
                              marginTop: 3, lineHeight: 1.3,
                            }} className="line-clamp-2">
                              {unlockHint(c)}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
