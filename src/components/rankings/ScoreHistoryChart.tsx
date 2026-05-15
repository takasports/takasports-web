'use client'

import { useEffect, useState } from 'react'

type Point = {
  week: string
  score: number
  rank: number | null
}

/**
 * Gráfico SVG ligero (sin libs) que dibuja el Índice Taka semana a semana.
 *
 * Fetcha `/api/rankings/[id]/history`. Si no hay datos (migración sin aplicar,
 * primer snapshot aún sin generar…) muestra fallback con prev→now.
 *
 * Diseño deliberadamente "tipo broadcast" — eje vertical implícito 60-100,
 * último punto destacado con badge de score actual.
 */
export default function ScoreHistoryChart({
  entryId,
  category,
  current,
  prev,
  trendReason,
  weeks = 12,
}: {
  entryId: string
  category?: string
  current: number
  prev?: number
  trendReason?: string
  weeks?: number
}) {
  const [points, setPoints] = useState<Point[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const qs = new URLSearchParams({ weeks: String(weeks) })
    if (category) qs.set('category', category)
    fetch(`/api/rankings/${encodeURIComponent(entryId)}/history?${qs}`, { cache: 'force-cache' })
      .then(r => r.json())
      .then((data: { points?: Point[] }) => {
        if (!cancelled) setPoints(data.points ?? [])
      })
      .catch(() => { if (!cancelled) setPoints([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entryId, category, weeks])

  // Serie a dibujar: histórico real o fallback prev→now
  let series: number[]
  let weekLabels: string[]
  if (points && points.length >= 2) {
    series = points.map(p => p.score)
    weekLabels = points.map(p => p.week)
  } else if (prev !== undefined) {
    series = [prev, current]
    weekLabels = ['ant.', 'hoy']
  } else {
    series = [current]
    weekLabels = ['hoy']
  }

  const W = 640
  const H = 180
  const padX = 36
  const padY = 28
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const min = Math.max(0, Math.floor(Math.min(...series) - 2))
  const max = Math.min(100, Math.ceil(Math.max(...series) + 2))
  const range = Math.max(1, max - min)
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0

  const coords = series.map((v, i) => ({
    x: padX + i * stepX,
    y: padY + innerH - ((v - min) / range) * innerH,
    v,
  }))

  const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const last = coords[coords.length - 1]
  const first = coords[0]
  const up = last.v >= first.v
  const color = up ? '#22c55e' : '#f87171'
  const accent = '#9B7CF6'

  const areaPath = `${path} L${last.x.toFixed(1)} ${(padY + innerH).toFixed(1)} L${first.x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-black uppercase tracking-[0.2em]"
          style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
          Histórico · últimas {Math.max(series.length, 2)} {series.length === 1 ? 'lectura' : 'lecturas'}
        </p>
        {points && points.length >= 2 && (
          <span className="text-[9px] font-bold tabular-nums px-2 py-0.5 rounded-full"
            style={{
              background: `${color}14`, color, border: `1px solid ${color}33`,
              fontFamily: 'var(--font-display)',
            }}>
            {up ? '↑' : '↓'} {Math.abs(last.v - first.v).toFixed(1)} pts vs hace {points.length - 1}s
          </span>
        )}
      </div>

      <div className="relative w-full overflow-hidden rounded-xl"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: 180, display: 'block' }}
        >
          {/* Líneas guía cada 10 pts */}
          {Array.from({ length: 5 }).map((_, i) => {
            const y = padY + (innerH * i) / 4
            return <line key={i} x1={padX} x2={W - padX} y1={y} y2={y}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="2 4" />
          })}

          {/* Etiquetas eje Y */}
          <text x={padX - 6} y={padY + 4} textAnchor="end"
            fontSize="9" fill="#3A3A4A" fontFamily="var(--font-display)">{max}</text>
          <text x={padX - 6} y={padY + innerH + 3} textAnchor="end"
            fontSize="9" fill="#3A3A4A" fontFamily="var(--font-display)">{min}</text>

          {/* Área */}
          <path d={areaPath} fill={color} fillOpacity={0.10} />

          {/* Línea */}
          <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Puntos */}
          {coords.map((p, i) => {
            const isLast = i === coords.length - 1
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={isLast ? 4 : 2.5}
                  fill={isLast ? color : '#0F0F1A'} stroke={color}
                  strokeWidth={isLast ? 2 : 1.5} />
                {isLast && (
                  <>
                    <rect
                      x={p.x - 24} y={p.y - 26} width={48} height={18} rx={4}
                      fill="#0F0F1A" stroke={color} strokeOpacity={0.5}
                    />
                    <text x={p.x} y={p.y - 13} textAnchor="middle"
                      fontSize="11" fontWeight="900" fill={color} fontFamily="var(--font-display)">
                      {p.v.toFixed(1)}
                    </text>
                  </>
                )}
              </g>
            )
          })}

          {/* Labels eje X — primer y último */}
          {coords.length > 1 && (
            <>
              <text x={coords[0].x} y={H - 8} textAnchor="middle"
                fontSize="9" fill="#4A4A5E" fontFamily="var(--font-sport)">
                {weekLabels[0].length === 10 ? weekLabels[0].slice(5).replace('-', '/') : weekLabels[0]}
              </text>
              <text x={coords[coords.length - 1].x} y={H - 8} textAnchor="middle"
                fontSize="9" fill="#9B7CF6" fontFamily="var(--font-sport)" fontWeight="700">
                {weekLabels[weekLabels.length - 1].length === 10
                  ? weekLabels[weekLabels.length - 1].slice(5).replace('-', '/')
                  : weekLabels[weekLabels.length - 1]}
              </text>
            </>
          )}
        </svg>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px]" style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)' }}>
              Cargando histórico…
            </span>
          </div>
        )}
      </div>

      {trendReason && (
        <p className="text-[11px] text-center max-w-md mx-auto mt-3"
          style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
          &ldquo;{trendReason}&rdquo;
        </p>
      )}

      {points !== null && points.length < 2 && (
        <p className="text-[10px] text-center mt-2"
          style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)' }}>
          {/* Aún sin historial completo: cada domingo se añade un snapshot nuevo */}
          Aún sin historial completo · cada domingo se añade un snapshot nuevo
        </p>
      )}
    </div>
  )
}
