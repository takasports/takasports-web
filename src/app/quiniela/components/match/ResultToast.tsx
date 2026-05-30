'use client'

import { useEffect } from 'react'

// ─────────────────────────────────────────────────────────────────
// Flash card toast — resultado partido a partido en tiempo real
// ─────────────────────────────────────────────────────────────────
export function ResultToast({ home, away, homeGoals, awayGoals, correct, onDismiss }: {
  home: string; away: string; homeGoals: number; awayGoals: number; correct: boolean; onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div
      className="fixed top-20 left-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        transform: 'translateX(-50%)',
        background: correct ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.15)',
        border: correct ? '1.5px solid rgba(34,197,94,0.5)' : '1.5px solid rgba(239,68,68,0.45)',
        backdropFilter: 'blur(16px)',
        boxShadow: correct ? '0 8px 32px rgba(34,197,94,0.25)' : '0 8px 32px rgba(239,68,68,0.2)',
        animation: 'revealSlam 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
        minWidth: 260, maxWidth: 340,
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{correct ? '✅' : '❌'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-black text-xs leading-tight" style={{ color: correct ? '#4ade80' : '#f87171', fontFamily: 'var(--font-display)' }}>
          {home} {homeGoals}–{awayGoals} {away}
        </p>
        <p className="text-[9px]" style={{ color: correct ? '#1A6A3A' : '#6A1A1A', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>
          {correct ? '¡Acertaste! +10 pts' : 'No era esta vez'}
        </p>
      </div>
      <button onClick={onDismiss} style={{ color: '#3A3A52', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
    </div>
  )
}
