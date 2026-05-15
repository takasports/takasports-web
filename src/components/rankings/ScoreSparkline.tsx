'use client'

/**
 * Mini-sparkline visible siempre que haya scorePrev. Con solo 2 puntos
 * (prev → now) dibuja un trazo direccional con relleno suave. Cuando
 * exista historial real (ranking_snapshots) se podrá pasar `points`
 * con más muestras y el mismo componente lo dibuja.
 */
export default function ScoreSparkline({
  prev,
  now,
  points,
  width = 44,
  height = 18,
}: {
  prev?: number
  now: number
  points?: number[]
  width?: number
  height?: number
}) {
  const series = points && points.length >= 2
    ? points
    : (prev !== undefined ? [prev, now] : null)
  if (!series) return null

  const min = Math.min(...series) - 1
  const max = Math.max(...series) + 1
  const range = Math.max(1, max - min)
  const stepX = width / (series.length - 1)
  const coords = series.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return { x, y }
  })

  const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const last = series[series.length - 1]
  const first = series[0]
  const up = last >= first
  const color = up ? '#22c55e' : '#f87171'
  const areaPath = `${path} L${width.toFixed(1)} ${height.toFixed(1)} L0 ${height.toFixed(1)} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="flex-shrink-0"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <path d={areaPath} fill={color} fillOpacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={1.8} fill={color} />
    </svg>
  )
}
