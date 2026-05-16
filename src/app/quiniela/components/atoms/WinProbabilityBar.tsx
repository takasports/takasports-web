'use client'

import type { Pick } from '@/components/QuinielaModule'

// ─────────────────────────────────────────────────────────────────
// Win probability bar (derivada de odds, no sintética)
// ─────────────────────────────────────────────────────────────────
export function WinProbabilityBar({ odds, userPick }: { odds?: { home: number; draw: number; away: number }; userPick?: Pick }) {
  if (!odds || !odds.home || !odds.draw || !odds.away) return null
  const invH = 1 / odds.home, invD = 1 / odds.draw, invA = 1 / odds.away
  const sum = invH + invD + invA
  const pH = Math.round((invH / sum) * 100)
  const pD = Math.round((invD / sum) * 100)
  const pA = 100 - pH - pD
  const seg = (color: string, value: number, active: boolean) => (
    <div style={{ flex: value, height: 4, background: color, opacity: active ? 1 : 0.55, transition: 'opacity 0.2s' }} />
  )
  return (
    <div className="mt-2 mb-2.5">
      <div className="flex w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {seg('#22c55e', pH, !userPick || userPick === '1' || userPick === '1X')}
        {seg('#f59e0b', pD, !userPick || userPick === 'X' || userPick === '1X' || userPick === 'X2')}
        {seg('#ef4444', pA, !userPick || userPick === '2' || userPick === 'X2')}
      </div>
      <div className="flex justify-between mt-1 tabular-nums" style={{ fontSize: 8, fontFamily: 'var(--font-sport)', fontWeight: 800, letterSpacing: '0.04em' }}>
        <span style={{ color: '#16a34a' }}>{pH}%</span>
        <span style={{ color: '#d97706' }}>{pD}%</span>
        <span style={{ color: '#dc2626' }}>{pA}%</span>
      </div>
    </div>
  )
}
