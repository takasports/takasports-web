'use client'

// ─────────────────────────────────────────────────────────────────
// SportPickPanel — chooser de deporte favorito.
//
// Cada deporte tiene un avatar_frame cosmetic en el catálogo
// (sport_pick unlock_source). Click → POST /api/cosmetics/sport-pick
// otorga el cosmetic. Idempotente — los ya unlocked muestran ✓.
//
// Pensado para descubrimiento en /perfil: cualquier user (incluso L1
// sin badges) puede tener identidad visual eligiendo un anillo.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'
import { BadgeIcon } from '@/components/icons/badges/BadgeIcon'

interface Sport {
  slug:  string
  label: string
  color: string
  /** ID del cosmetic avatar_frame asociado (matches seed migration 056). */
  cosmeticId: string
  /** Icono custom (BadgeIcon registry) o emoji fallback. */
  iconId: string
}

const SPORTS: Sport[] = [
  { slug: 'futbol',     label: 'Fútbol',      color: '#22c55e', cosmeticId: 'avatar_frame_futbol',     iconId: 'globe'      },
  { slug: 'baloncesto', label: 'NBA',         color: '#f59e0b', cosmeticId: 'avatar_frame_baloncesto', iconId: 'target'     },
  { slug: 'formula1',   label: 'F1',          color: '#ef4444', cosmeticId: 'avatar_frame_formula1',   iconId: 'lightning'  },
  { slug: 'ufc',        label: 'UFC',         color: '#f97316', cosmeticId: 'avatar_frame_ufc',        iconId: 'shield'     },
  { slug: 'tenis',      label: 'Tenis',       color: '#d97706', cosmeticId: 'avatar_frame_tenis',      iconId: 'star'       },
  { slug: 'rugby',      label: 'Rugby',       color: '#a78bfa', cosmeticId: 'avatar_frame_rugby',      iconId: 'diamond'    },
  { slug: 'wwe',        label: 'Lucha',       color: '#facc15', cosmeticId: 'avatar_frame_wwe',        iconId: 'crown'      },
]

export function SportPickPanel() {
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)

  // Sondea qué cosmetics tiene unlocked el user para marcar los que ya tiene
  useEffect(() => {
    fetch('/api/cosmetics/me', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.unlocked) {
          setUnlocked(new Set((d.unlocked as { id: string }[]).map(u => u.id)))
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const pickSport = useCallback(async (sport: Sport) => {
    if (picking) return
    if (unlocked.has(sport.cosmeticId)) return  // ya unlocked, no-op
    setPicking(sport.slug)
    try {
      const res = await fetch('/api/cosmetics/sport-pick', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sport: sport.slug }),
      })
      if (res.ok) {
        setUnlocked(prev => new Set(prev).add(sport.cosmeticId))
      }
    } catch { /* silencioso */ }
    finally {
      setPicking(null)
    }
  }, [picking, unlocked])

  if (!loaded) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div
        className="px-5 py-3.5 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="section-accent" />
        <h2 className="section-label">Deportes que sigo</h2>
        <span
          className="ml-auto text-[10px] font-black tabular-nums"
          style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}
        >
          {unlocked.size > 0 ? `${[...unlocked].filter(id => SPORTS.some(s => s.cosmeticId === id)).length}/${SPORTS.length}` : `${SPORTS.length}`}
        </span>
      </div>
      <p
        className="px-5 pt-3 text-[11px]"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', lineHeight: 1.5 }}
      >
        Elige tu deporte y desbloquea su anillo para tu placa. Puedes coleccionar todos.
      </p>
      <div className="px-4 pb-4 pt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
        {SPORTS.map(s => {
          const isUnlocked = unlocked.has(s.cosmeticId)
          const isLoading  = picking === s.slug
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => pickSport(s)}
              disabled={isLoading}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all"
              style={{
                background: isUnlocked ? `${s.color}10` : 'rgba(255,255,255,0.02)',
                border:     isUnlocked ? `1px solid ${s.color}45` : '1px solid rgba(255,255,255,0.05)',
                cursor: isLoading ? 'wait' : (isUnlocked ? 'default' : 'pointer'),
                opacity: isLoading ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              {/* Ring preview */}
              <div style={{ position: 'relative', width: 36, height: 36 }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: s.color, padding: 2.5,
                  opacity: isUnlocked ? 1 : 0.5,
                  boxShadow: isUnlocked ? `0 0 12px ${s.color}55` : 'none',
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: '#0A0612',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: s.color,
                  }}>
                    <BadgeIcon id={s.iconId} size={16} strokeWidth={1.7} />
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 900,
                fontFamily: 'var(--font-sport)',
                color: isUnlocked ? s.color : '#5A5A78',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textAlign: 'center', lineHeight: 1,
              }}>
                {s.label}
              </span>
              {isUnlocked && (
                <span style={{
                  fontSize: 8, color: s.color,
                  fontFamily: 'var(--font-headline)',
                  letterSpacing: '0.16em', opacity: 0.7,
                }}>
                  DESBLOQUEADO
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
