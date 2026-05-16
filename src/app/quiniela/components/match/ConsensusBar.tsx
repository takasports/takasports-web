'use client'

import { useState, useEffect } from 'react'
import type { QuinielaMatch, Pick } from '@/components/QuinielaModule'
import { communityConsensus, communityTrend } from '../../lib/helpers'

export function ConsensusBar({ match, userPick }: { match: QuinielaMatch; userPick: Pick | undefined }) {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 180_000))
  useEffect(() => {
    const t = setInterval(() => setTick(Math.floor(Date.now() / 180_000)), 30_000)
    return () => clearInterval(t)
  }, [])

  const { p1, pX, p2 } = communityConsensus(match)
  const { d1, dX, d2 } = communityTrend(match, tick)
  const segs: { key: Pick; pct: number; color: string; delta: number }[] = [
    { key: '1', pct: p1, color: '#22c55e', delta: d1 },
    { key: 'X', pct: pX, color: '#f59e0b', delta: dX },
    { key: '2', pct: p2, color: '#ef4444', delta: d2 },
  ]
  const userBase: Pick | null = userPick === '1' || userPick === '1X' ? '1' : userPick === '2' || userPick === 'X2' ? '2' : userPick === 'X' ? 'X' : null
  return (
    <div className="rounded-b-2xl px-5 pb-3.5 pt-2.5" style={{ background: 'rgba(255,255,255,0.012)', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[7.5px] font-black uppercase tracking-widest" style={{ color: '#252538', fontFamily: 'var(--font-sport)' }}>
          Comunidad
        </p>
        <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)', fontFamily: 'var(--font-sport)' }}>
          <span className="w-1 h-1 rounded-full bg-red-400 inline-block animate-pulse mr-0.5" />
          EN VIVO
        </span>
      </div>
      <div className="flex rounded overflow-hidden mb-1.5" style={{ height: 5, gap: 1 }}>
        {segs.map(s => (
          <div key={s.key} style={{ width: `${s.pct}%`, background: userBase === s.key ? s.color : `${s.color}50`, transition: 'width 0.8s ease' }} />
        ))}
      </div>
      <div className="flex">
        {segs.map(s => (
          <div key={s.key} style={{ width: `${s.pct}%` }} className="flex justify-center">
            <div className="flex items-center gap-0.5">
              <span style={{ fontSize: 8, fontWeight: 900, fontFamily: 'var(--font-sport)', color: userBase === s.key ? s.color : '#2A2A42', whiteSpace: 'nowrap' }}>
                {s.key} {s.pct}%
              </span>
              {s.delta !== 0 && (
                <span style={{ fontSize: 7, fontWeight: 900, color: s.delta > 0 ? '#4ade80' : '#f87171', lineHeight: 1 }}>
                  {s.delta > 0 ? '↑' : '↓'}{Math.abs(s.delta)}
                </span>
              )}
              {userBase === s.key && (
                <span style={{ fontSize: 7, color: s.color, fontWeight: 900 }}>←</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {userBase && (
        <p className="mt-1.5 text-[7.5px] font-black tabular-nums text-center" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
          Vas con el {segs.find(s => s.key === userBase)?.pct ?? 0}% de la comunidad
        </p>
      )}
    </div>
  )
}
