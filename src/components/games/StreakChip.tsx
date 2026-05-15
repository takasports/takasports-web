'use client'

// Chip "🔥 N días · mejor M" — visible cerca del hero de /juegos.
// Si no hay sesión o no hay racha, no renderiza nada (silencioso).

import { useStreak } from '@/hooks/useGameState'

export default function StreakChip() {
  const { streak, loading } = useStreak()

  if (loading || !streak || streak.current_streak <= 0) return null

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{
        background: 'linear-gradient(135deg, rgba(251,146,60,0.12), rgba(220,38,38,0.10))',
        border: '1px solid rgba(251,146,60,0.30)',
        fontFamily: 'var(--font-sport)',
      }}
    >
      <span aria-hidden style={{ fontSize: 13 }}>🔥</span>
      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#FDBA74' }}>
        {streak.current_streak} {streak.current_streak === 1 ? 'día' : 'días'}
      </span>
      {streak.best_streak > streak.current_streak && (
        <>
          <span className="w-px h-3" style={{ background: 'rgba(251,146,60,0.20)' }} />
          <span className="text-[9px]" style={{ color: '#9B6A4A', fontFamily: 'var(--font-sport)' }}>
            mejor {streak.best_streak}
          </span>
        </>
      )}
    </div>
  )
}
