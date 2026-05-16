'use client'

import { useState, useEffect } from 'react'
import type { QuinielaMatch, Pick } from '@/components/QuinielaModule'
import { communityConsensus, communityTrend } from '../../lib/helpers'
import { nameMatch } from '@/lib/quiniela'

interface ConsensusRow { home: string; away: string; p1: number; px: number; p2: number; total: number }

// Cache por jornada — un fetch por sesión, compartido entre cards
const cache = new Map<string, Promise<ConsensusRow[]>>()
function loadConsensus(jornada: string): Promise<ConsensusRow[]> {
  const cached = cache.get(jornada)
  if (cached) return cached
  const p = fetch(`/api/quiniela/consensus?jornada=${encodeURIComponent(jornada)}`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : { rows: [] })
    .then(j => (j.rows ?? []) as ConsensusRow[])
    .catch(() => [] as ConsensusRow[])
  cache.set(jornada, p)
  return p
}

// Mínimo de votos para mostrar datos reales; por debajo, fallback heurístico
const REAL_MIN_VOTES = 5

export function ConsensusBar({ match, userPick, jornada }: { match: QuinielaMatch; userPick: Pick | undefined; jornada?: string }) {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 180_000))
  const [real, setReal] = useState<ConsensusRow | null>(null)

  useEffect(() => {
    const t = setInterval(() => setTick(Math.floor(Date.now() / 180_000)), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!jornada) return
    let cancelled = false
    loadConsensus(jornada).then(rows => {
      if (cancelled) return
      const found = rows.find(r => nameMatch(r.home, match.home) && nameMatch(r.away, match.away))
      if (found && found.total >= REAL_MIN_VOTES) setReal(found)
    })
    return () => { cancelled = true }
  }, [jornada, match.home, match.away])

  const useReal = real !== null
  let p1: number, pX: number, p2: number
  if (useReal && real) {
    const tot = real.p1 + real.px + real.p2 || 1
    p1 = Math.round((real.p1 / tot) * 100)
    pX = Math.round((real.px / tot) * 100)
    p2 = 100 - p1 - pX
  } else {
    const c = communityConsensus(match)
    p1 = c.p1; pX = c.pX; p2 = c.p2
  }
  const { d1, dX, d2 } = useReal ? { d1: 0, dX: 0, d2: 0 } : communityTrend(match, tick)
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
          {useReal ? `Comunidad · ${real!.total} votos` : 'Comunidad'}
        </p>
        {useReal ? (
          <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.08)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.18)', fontFamily: 'var(--font-sport)' }}>
            REAL
          </span>
        ) : (
          <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.18)', fontFamily: 'var(--font-sport)' }}>
            ESTIMADO
          </span>
        )}
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
