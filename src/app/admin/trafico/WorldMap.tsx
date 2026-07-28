// Mapamundi de "de dónde te ven": el fondo son los países (WORLD_PATHS, ya
// proyectados equirectangular a 1000x500) y encima un punto por país con tráfico,
// posicionado por lat/long con LA MISMA proyección → encajan exactos. El radio
// del punto ∝ nº de usuarios. Sin librerías: solo SVG. Server component (estático).

import { WORLD_PATHS } from '@/lib/world-paths'

// Centroides aprox. (lon, lat) de los países frecuentes. Si un país no está aquí,
// simplemente no pinta su punto (raro). ISO A2 en mayúsculas.
const LATLNG: Record<string, [number, number]> = {
  ES: [-3.7, 40.4], AR: [-64, -34], CL: [-71, -30], MX: [-102, 23], US: [-98, 39],
  PE: [-75, -10], EC: [-78, -1.5], CO: [-73, 4], FR: [2.3, 47], SN: [-14.5, 14.5],
  JP: [138, 36], DK: [10, 56], GB: [-2, 54], DE: [10, 51], IT: [12.5, 42],
  PT: [-8, 39.5], BR: [-51, -10], CA: [-106, 56], IN: [78, 22], NL: [5.3, 52],
  BE: [4.5, 50.5], CH: [8, 47], UY: [-56, -33], VE: [-66, 8], BO: [-64, -17],
  PY: [-58, -23], CR: [-84, 10], PA: [-80, 9], GT: [-90.5, 15.5], DO: [-70.5, 19],
  HN: [-86.5, 15], SV: [-88.9, 13.8], NI: [-85, 13], MA: [-6, 32], PR: [-66.5, 18.2],
  AU: [134, -25], CN: [104, 35], RU: [100, 61], TR: [35, 39], PL: [19, 52],
  SE: [15, 62], NO: [8, 61], IE: [-8, 53], AT: [14, 47.5], GR: [22, 39],
  RO: [25, 46], UA: [32, 49], EG: [30, 27], NG: [8, 10], ZA: [24, -29],
  KR: [128, 36], PH: [122, 13], ID: [120, -5], TH: [101, 15], VN: [106, 16],
  AE: [54, 24], SA: [45, 24], IL: [35, 31], CU: [-79, 21.5], KE: [38, 0],
  CI: [-5.5, 7.5], GH: [-1, 8], MZ: [35, -18], AO: [17, -12], TN: [9, 34],
}

function proj(lon: number, lat: number): [number, number] {
  return [((lon + 180) / 360) * 1000, ((90 - lat) / 180) * 500]
}

export default function WorldMap({ items }: { items: { country: string; countryCode: string; users: number }[] }) {
  const pts = items
    .map((i) => ({ ...i, ll: LATLNG[(i.countryCode || '').toUpperCase()] }))
    .filter((p): p is typeof p & { ll: [number, number] } => Array.isArray(p.ll))
    .sort((a, b) => a.users - b.users) // menores primero → los grandes se pintan encima
  const max = Math.max(...pts.map((p) => p.users), 1)

  return (
    <div className="tk-glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', overflow: 'hidden' }}>
      <svg viewBox="0 30 1000 380" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Mapa de dónde te ven">
        {/* Landmasses */}
        <g>
          {WORLD_PATHS.map((c) => (
            <path key={c.id} d={c.d} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} />
          ))}
        </g>
        {/* Puntos de tráfico */}
        {pts.map((p, i) => {
          const [x, y] = proj(p.ll[0], p.ll[1])
          const r = 4 + Math.sqrt(p.users / max) * 20
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill="#A78BFA" fillOpacity={0.28} />
              <circle cx={x} cy={y} r={Math.max(2.2, r * 0.32)} fill="#C4B5FD">
                <title>{`${p.country}: ${p.users}`}</title>
              </circle>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
