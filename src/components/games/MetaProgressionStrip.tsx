'use client'

// Barra compacta con la racha meta + nivel y barra de XP de la "Liga Taka".
// Se monta en /juegos (hero) y se autoactualiza cuando cualquier juego
// llama a addXp() — vía el event ts:meta-changed.

import { useEffect, useState } from 'react'
import { FireIcon } from '@/components/icons/GameIcons'
import { getLevel, loadMeta, onMetaChange, type MetaState } from '@/lib/meta-progression'

interface Props {
  /** Tonalidad de acento del juego activo. Por defecto, azul Liga Taka. */
  accent?: string
  /** Compacto: oculta el subtítulo y reduce padding. */
  compact?: boolean
}

export default function MetaProgressionStrip({ accent = '#93C5FD', compact = false }: Props) {
  const [meta, setMeta] = useState<MetaState | null>(null)

  useEffect(() => {
    setMeta(loadMeta())
    return onMetaChange(() => setMeta(loadMeta()))
  }, [])

  if (!meta) {
    // Skeleton breve para evitar layout shift
    return (
      <div className="rounded-2xl h-[72px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }} aria-hidden />
    )
  }

  const lvl = getLevel(meta.xp.total)
  const streak = meta.streak.current
  const streakActive = streak >= 2

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
            {streak} <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{streak === 1 ? 'día' : 'días'}</span>
          </p>
        </div>
      </div>

      <div className="hidden sm:block w-px self-stretch" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Nivel + barra de XP */}
      <div className="flex-1 min-w-[160px]">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <p className="text-[10px] uppercase tracking-widest font-black inline-flex items-center gap-1.5" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
            <span>⚡</span>
            <span>Liga Taka · Nivel {lvl.level}</span>
          </p>
          <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {lvl.xpIntoLevel} / {lvl.xpForNext} XP
          </p>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${lvl.progressPct}%`,
              background: `linear-gradient(90deg, ${accent}, #F0F0F5)`,
            }}
          />
        </div>
        {!compact && (
          <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Juega cualquier juego para sumar XP y mantener la racha.
          </p>
        )}
      </div>
    </div>
  )
}
