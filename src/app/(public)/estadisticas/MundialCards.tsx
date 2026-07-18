'use client'

// Tarjetas del Mundial 2026 (countdown + grupos). Extraído del monolito.

import { useEffect, useState } from 'react'
import type { StatBlock } from './stats-types'
import type { BlockMeta } from './live-data'
import { FreshnessBadge } from './StatCards'

export const WC_START = new Date('2026-06-11T17:00:00Z')

export function WorldCupCountdown() {
  // now arranca en null para que SSR y el primer render de cliente coincidan
  // (placeholder "--"); los dígitos reales aparecen tras montar. Evita #418.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const diff = now ? WC_START.getTime() - now.getTime() : 1
  if (diff <= 0) return (
    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
      ● EN CURSO
    </span>
  )
  const days    = Math.floor(diff / 86400000)
  const hours   = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000)  / 60000)
  const seconds = Math.floor((diff % 60000)    / 1000)
  return (
    <div className="flex gap-3">
      {([['días', days], ['h', hours], ['min', minutes], ['seg', seconds]] as [string, number][]).map(([l, v]) => (
        <div key={l} className="text-center min-w-[2rem]">
          <div className="text-2xl font-black tabular-nums leading-none"
            style={{ fontFamily: 'var(--font-sport)', color: '#f59e0b' }}>
            {now ? String(v).padStart(2, '0') : '--'}
          </div>
          <div className="text-[9px] uppercase tracking-widest mt-0.5"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {l}
          </div>
        </div>
      ))}
    </div>
  )
}

export function WorldCupGroupCard({ block, accent, isLive, meta }: {
  block: StatBlock; accent: string; isLive?: boolean; meta?: BlockMeta
}) {
  const wcStarted = block.rows.some(r => r.sub !== 'Sin jugar')
  const WC_COLS = ['PJ', 'V', 'E', 'D', 'GD', 'PTS']

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)' }}>
      <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="section-accent" style={{ background: accent }} />
          <h3 className="font-black text-sm" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {block.title}
          </h3>
          <FreshnessBadge isLive={isLive} meta={meta} />
        </div>
        {wcStarted && (
          <span className="text-[10px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>PTS</span>
        )}
      </div>

      {wcStarted && (
        <div className="px-4 pt-1.5 pb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
          style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.015)' }}>
          <span className="w-5 flex-shrink-0" />
          <span className="flex-1">Selección</span>
          {/* Mobile: solo PJ, GD, PTS */}
          <span className="w-6 text-center sm:hidden">PJ</span>
          <span className="w-7 text-center sm:hidden">GD</span>
          <span className="w-7 text-center sm:hidden">PTS</span>
          {/* Desktop: las 6 columnas */}
          {WC_COLS.map(col => (
            <span key={col} className="w-6 text-center hidden sm:block">{col}</span>
          ))}
        </div>
      )}

      <div className="flex flex-col">
        {block.rows.map((row, i) => {
          const pj = row.extra?.PJ ?? '0'
          const v  = row.extra?.V  ?? '0'
          const e  = row.extra?.E  ?? '0'
          const d  = row.extra?.D  ?? '0'
          const gf = parseInt(row.extra?.GF ?? '0')
          const gc = parseInt(row.extra?.GC ?? '0')
          const gdNum = gf - gc
          const pts = row.value
          const isPromoted = i < 2

          return (
            <div key={row.rank}
              className="flex items-center gap-1 px-4 py-2.5 transition-colors hover:bg-white/[0.025]"
              style={{
                borderBottom: i < block.rows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                background: isPromoted ? `${accent}06` : 'transparent',
                borderLeft: isPromoted ? `3px solid ${accent}50` : '3px solid transparent',
              }}>
              <span className="w-5 flex-shrink-0 text-[10px] font-black tabular-nums"
                style={{ color: isPromoted ? accent : '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                {row.rank}
              </span>
              <span className="flex-1 min-w-0 text-[12px] font-semibold truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                {row.name}
              </span>
              {wcStarted ? (
                <>
                  {/* Mobile: PJ, GD, PTS */}
                  <span className="w-6 text-center text-[11px] tabular-nums font-semibold sm:hidden" style={{ color: '#5A5A82', fontFamily: 'var(--font-display)' }}>{pj}</span>
                  <span className="w-7 text-center text-[11px] tabular-nums font-semibold sm:hidden" style={{ color: '#5A5A82', fontFamily: 'var(--font-display)' }}>{gdNum >= 0 ? '+' : ''}{gdNum}</span>
                  <span className="w-7 text-center text-[11px] tabular-nums font-black sm:hidden" style={{ color: parseInt(pts) > 0 ? accent : '#7A7A92', fontFamily: 'var(--font-display)' }}>{pts}</span>
                  {/* Desktop: 6 columnas */}
                  {[pj, v, e, d, `${gdNum >= 0 ? '+' : ''}${gdNum}`, pts].map((val, j) => (
                    <span key={j} className="w-6 text-center text-[11px] tabular-nums font-semibold hidden sm:block"
                      style={{ color: j === 5 ? (parseInt(pts) > 0 ? accent : '#7A7A92') : '#5A5A82', fontFamily: 'var(--font-display)' }}>
                      {val}
                    </span>
                  ))}
                </>
              ) : (
                <span className="text-[10px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>Sin jugar</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

