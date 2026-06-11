'use client'

// Barra compacta con la racha y el nivel de la "Liga Taka".
// Montada en /juegos (hero). Lee SIEMPRE la fuente autoritativa del servidor:
//   · Nivel + XP → /api/quiniela/me (los mismos datos que perfil y cabecera)
//   · Racha      → useStreak() (tabla game_streaks server-side)
// Para invitados no renderiza: el GuestRankingHint de /juegos ya invita a
// entrar. Antes el nivel se calculaba con XP local del navegador (trucable y
// divergente del nivel real) — esto lo elimina (una sola fuente, no falseable).

import { useEffect, useState } from 'react'
import { FireIcon, BoltIcon } from '@/components/icons/GameIcons'
import { useStreak } from '@/hooks/useGameState'

interface MeLevel {
  level:     number
  xpInLevel: number
  xpToNext:  number
  progress:  number   // 0..1
}

interface Props {
  /** Tonalidad de acento del juego activo. Por defecto, azul Liga Taka. */
  accent?: string
  /** Compacto: oculta el subtítulo y reduce padding. */
  compact?: boolean
}

export default function MetaProgressionStrip({ accent = '#93C5FD', compact = false }: Props) {
  // null = cargando · 'guest' = sin sesión · MeLevel = datos del servidor
  const [me, setMe] = useState<MeLevel | null | 'guest'>(null)
  const { streak } = useStreak()

  useEffect(() => {
    let cancelled = false
    fetch('/api/quiniela/me')
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: MeLevel) => { if (!cancelled) setMe(data) })
      .catch(() => { if (!cancelled) setMe('guest') })
    return () => { cancelled = true }
  }, [])

  // Invitado: el GuestRankingHint de /juegos ya cubre el aviso de "Entrar".
  if (me === 'guest') return null

  if (me === null) {
    // Skeleton breve para evitar layout shift
    return (
      <div className="rounded-2xl h-[72px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }} aria-hidden />
    )
  }

  const current      = streak?.current_streak ?? 0
  const streakActive = current >= 2
  const atMax        = me.xpToNext <= 0
  const span         = me.xpInLevel + me.xpToNext
  const progressPct  = Math.round(me.progress * 100)

  return (
    <div
      className={`rounded-2xl flex items-center gap-4 flex-wrap ${compact ? 'p-3' : 'p-4'}`}
      style={{
        background: `linear-gradient(135deg, ${accent}10, rgba(255,255,255,0.02))`,
        border: `1px solid ${accent}30`,
      }}
    >
      {/* Racha */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: streakActive ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.04)',
            color: streakActive ? '#FB923C' : '#5A5A7A',
            border: `1px solid ${streakActive ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.08)'}`,
          }}
          aria-hidden
        >
          <FireIcon size={16} />
        </span>
        <div>
          <p className="text-[9px] uppercase tracking-widest font-black leading-tight" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            Racha Taka
          </p>
          <p className="text-base font-black leading-tight" style={{ color: streakActive ? '#FB923C' : '#9090B0', fontFamily: 'var(--font-display)' }}>
            {current} <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{current === 1 ? 'día' : 'días'}</span>
          </p>
        </div>
      </div>

      <div className="hidden sm:block w-px self-stretch" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Nivel + barra de XP (Liga Taka, server-side) */}
      <div className="flex-1 min-w-[160px]">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <p className="text-[10px] uppercase tracking-widest font-black inline-flex items-center gap-1.5" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
            <span aria-hidden className="inline-flex"><BoltIcon size={13} /></span>
            <span>Liga Taka · Nivel {me.level}</span>
          </p>
          <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {atMax ? 'MÁX' : `${me.xpInLevel} / ${span} XP`}
          </p>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${accent}, #F0F0F5)`,
            }}
          />
        </div>
        {!compact && (
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Juega cualquier juego para sumar puntos y mantener la racha.
          </p>
        )}
      </div>
    </div>
  )
}
