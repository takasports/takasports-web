import type { PlayerStat } from '@/app/api/jugador/[slug]/route'

/*
 * Perfil de rendimiento del jugador — radar SVG (0 KB, sin librerías).
 *
 * Honestidad (norma del proyecto "no mentir"):
 *  - SOLO métricas donde "más = mejor" y comparables (contribución ofensiva /
 *    defensiva / acierto). Se EXCLUYEN disciplina (faltas, amarillas, rojas,
 *    pérdidas), contexto (partidos, minutos) y compuestos (PER).
 *  - Los porcentajes se escalan a 100 (significado exacto). Los conteos/medias,
 *    a una referencia de temporada destacada (tope realista, conservador).
 *  - El valor REAL se etiqueta siempre en cada eje → el radar es forma visual,
 *    el dato manda.
 *  - Si hay <5 ejes válidos cae a barras; con <3 no se pinta nada.
 *
 * La animación de entrada (escala) solo corre bajo html[data-cap="full"] y se
 * neutraliza con prefers-reduced-motion. El color sale de --sport-accent del
 * contenedor (data-sport).
 */

// Tope de referencia por métrica (etiquetas exactas que emite la API de jugador).
const RADAR_CEILINGS: Record<string, number> = {
  // ── Fútbol (más = mejor) ──
  'Goles': 25,
  'Asistencias': 15,
  'Tiros': 100,
  'Tiros a puerta': 45,
  'Ocasiones creadas': 12,
  'Pases acertados': 2200,
  '% Pases': 100,
  'Intercepciones': 70,
  'Paradas': 140,
  'Porterías a 0': 18,
  // ── NBA (todas más = mejor) ──
  'Puntos/partido': 32,
  'Rebotes/partido': 13,
  'Asist./partido': 11,
  'Robos/partido': 2.4,
  'Tapones/partido': 2.8,
  '% Tiros campo': 100,
  '% Triples': 100,
  '% T. libres': 100,
}

function parseNum(value: string): number | null {
  // Quita símbolos, separadores de miles (inglés) y %: "85%" → 85, "2,200" → 2200.
  const cleaned = value.replace(/[^0-9.\-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

interface Axis {
  label: string
  raw: string
  pct: number // 0–100, recortado al tope de referencia
}

function buildAxes(stats: PlayerStat[]): Axis[] {
  const axes: Axis[] = []
  for (const s of stats) {
    const ceil = RADAR_CEILINGS[s.label]
    if (ceil == null) continue
    const n = parseNum(s.value)
    if (n == null || n <= 0) continue
    axes.push({ label: s.label, raw: s.value, pct: Math.min((n / ceil) * 100, 100) })
    if (axes.length >= 8) break
  }
  return axes
}

// Abreviaturas cortas para etiquetas de eje (caben en el SVG sin solaparse).
const SHORT_LABEL: Record<string, string> = {
  'Tiros a puerta': 'T. puerta',
  'Ocasiones creadas': 'Ocasiones',
  'Pases acertados': 'Pases ✓',
  'Intercepciones': 'Intercep.',
  'Porterías a 0': 'Port. a 0',
  'Puntos/partido': 'Puntos',
  'Rebotes/partido': 'Rebotes',
  'Asist./partido': 'Asist.',
  'Robos/partido': 'Robos',
  'Tapones/partido': 'Tapones',
  '% Tiros campo': '% Campo',
  '% T. libres': '% Libres',
}

/** ¿Hay material suficiente para pintar el panel? (evita un panel vacío). */
export function hasRadarData(stats: PlayerStat[]): boolean {
  return buildAxes(stats).length >= 3
}

export default function PlayerStatsRadar({ stats }: { stats: PlayerStat[] }) {
  const axes = buildAxes(stats)
  if (axes.length < 3) return null

  // ── Pocas métricas: barras horizontales (más honesto que un radar escaso) ──
  if (axes.length < 5) {
    return (
      <div
        className="flex flex-col gap-2.5"
        role="img"
        aria-label={`Perfil de rendimiento: ${axes.map(a => `${a.label} ${a.raw}`).join(', ')}`}
      >
        {axes.map(a => (
          <div key={a.label} className="flex items-center gap-2.5 text-[12px]">
            <span className="w-24 flex-shrink-0 truncate" style={{ color: 'var(--text-muted)' }}>
              {a.label}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full ts-bar-fill"
                style={{ width: `${a.pct}%`, background: 'var(--sport-accent)' }}
              />
            </div>
            <span
              className="w-12 text-right font-black tabular-nums"
              style={{ color: '#EBEBF5', fontFamily: 'var(--font-display)' }}
            >
              {a.raw}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // ── Radar ──
  const n = axes.length
  const cx = 150
  const cy = 150
  const R = 108
  const step = (Math.PI * 2) / n
  const angle = (i: number) => step * i - Math.PI / 2 // arranca arriba

  const point = (i: number, r: number) => {
    const a = angle(i)
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const
  }

  const dataPoints = axes.map((ax, i) => point(i, (ax.pct / 100) * R))
  const dataPolygon = dataPoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  const ringPolys = [0.25, 0.5, 0.75, 1].map(f =>
    axes.map((_, i) => {
      const [x, y] = point(i, f * R)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' '),
  )

  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={`Radar de perfil de rendimiento: ${axes.map(a => `${a.label} ${a.raw}`).join(', ')}`}
    >
      <svg viewBox="-45 -45 390 390" width="100%" style={{ maxWidth: 340, aspectRatio: '1 / 1' }}>
        {/* Rejilla concéntrica */}
        {ringPolys.map((pts, i) => (
          <polygon key={`ring-${i}`} points={pts} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        ))}
        {/* Radios */}
        {axes.map((_, i) => {
          const [x, y] = point(i, R)
          return <line key={`spoke-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        })}
        {/* Forma de datos (animada bajo data-cap=full) */}
        <g className="ts-radar__shape">
          <polygon points={dataPolygon} fill="var(--sport-accent)" fillOpacity="0.16" stroke="var(--sport-accent)" strokeWidth="2" strokeLinejoin="round" />
          {dataPoints.map(([x, y], i) => (
            <circle key={`dot-${i}`} cx={x} cy={y} r="3" fill="var(--sport-accent)" stroke="var(--bg-base)" strokeWidth="1.5" />
          ))}
        </g>
        {/* Etiquetas: métrica (arriba) + valor real (abajo) */}
        {axes.map((ax, i) => {
          const [x, y] = point(i, R + 20)
          const a = angle(i)
          const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'
          return (
            <text key={`label-${i}`} x={x.toFixed(1)} y={y.toFixed(1)} textAnchor={anchor} dominantBaseline="middle">
              <tspan x={x.toFixed(1)} dy="-0.3em" fill="#7C7C8C" fontSize="8.5" fontWeight="700" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {SHORT_LABEL[ax.label] ?? ax.label}
              </tspan>
              <tspan x={x.toFixed(1)} dy="1.25em" fill="#EBEBF5" fontSize="11" fontWeight="900" style={{ fontFamily: 'var(--font-display)' }}>
                {ax.raw}
              </tspan>
            </text>
          )
        })}
      </svg>
      <p className="text-[10px] text-center mt-1" style={{ color: 'var(--text-faint)' }}>
        Cada radio, sobre una referencia de temporada destacada · el dato real manda
      </p>
    </div>
  )
}
