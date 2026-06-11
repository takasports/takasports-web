'use client'

import { FireIcon } from '@/components/icons/GameIcons'

// ─────────────────────────────────────────────────────────────────
// Streak hero — Duolingo-style si racha ≥ 2
// ─────────────────────────────────────────────────────────────────
export function StreakHero({ current }: { current: number }) {
  if (current < 2) return null
  return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,rgba(251,146,60,0.14),rgba(239,68,68,0.08))', border: '1px solid rgba(251,146,60,0.35)' }}>
      <span style={{ display: 'inline-flex', color: '#fb923c', filter: 'drop-shadow(0 0 6px rgba(251,146,60,0.6))' }}><FireIcon size={28} /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black leading-none" style={{ color: '#fb923c', fontFamily: 'var(--font-display)' }}>
          {current} jornada{current !== 1 ? 's' : ''} seguida{current !== 1 ? 's' : ''}
        </p>
        <p className="text-[10px] mt-1" style={{ color: '#7A4530', fontFamily: 'var(--font-sport)' }}>
          Manda tus picks antes del cierre para no perderla
        </p>
      </div>
    </div>
  )
}
