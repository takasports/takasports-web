'use client'

// Mapamundi INTERACTIVO de "de dónde te ven". Fondo = países (WORLD_PATHS, ya
// proyectados equirectangular a 1000x500); encima un punto por país con tráfico
// (radio ∝ √usuarios de 28d), posicionado por lat/long con la MISMA proyección.
// Al pasar el cursor por un punto → tooltip con usuarios en 24h / 7 días / mes.
// Sin librerías: solo SVG + estado de hover.

import { useState } from 'react'
import { WORLD_PATHS } from '@/lib/world-paths'
import type { CountryWindow } from '@/lib/traffic'

// Centroides aprox. (lon, lat) de los países frecuentes. ISO A2 en mayúsculas.
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
function flag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🌐'
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

// viewBox recortado (fuera Antártida y polos vacíos): 0 30 1000 380.
const VB = { x: 0, y: 30, w: 1000, h: 380 }

export default function WorldMap({ items }: { items: CountryWindow[] }) {
  const [hover, setHover] = useState<string | null>(null)

  const pts = items
    .map((i) => ({ ...i, ll: LATLNG[(i.countryCode || '').toUpperCase()] }))
    .filter((p): p is typeof p & { ll: [number, number] } => Array.isArray(p.ll))
    .sort((a, b) => a.d28 - b.d28) // menores primero → los grandes encima
  const max = Math.max(...pts.map((p) => p.d28), 1)
  const hovered = pts.find((p) => p.countryCode.toUpperCase() === hover)
  const tip = hovered ? proj(hovered.ll[0], hovered.ll[1]) : null
  const tipLeft = tip ? ((tip[0] - VB.x) / VB.w) * 100 : 0
  const tipTop = tip ? ((tip[1] - VB.y) / VB.h) * 100 : 0

  return (
    <div className="tk-glass" style={{ borderRadius: 'var(--radius-lg)', padding: 12, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Mapa de dónde te ven">
          <g>
            {WORLD_PATHS.map((c) => (
              <path key={c.id} d={c.d} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.4} />
            ))}
          </g>
          {pts.map((p, i) => {
            const [x, y] = proj(p.ll[0], p.ll[1])
            const r = 4 + Math.sqrt(p.d28 / max) * 20
            const active = p.countryCode.toUpperCase() === hover
            return (
              <g key={i} onMouseEnter={() => setHover(p.countryCode.toUpperCase())} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r={Math.max(r, 11)} fill="transparent" />
                <circle cx={x} cy={y} r={r} fill="#A78BFA" fillOpacity={active ? 0.55 : 0.28} />
                <circle cx={x} cy={y} r={Math.max(2.2, r * 0.32)} fill={active ? '#FFFFFF' : '#C4B5FD'} />
              </g>
            )
          })}
        </svg>

        {hovered && (
          <div
            style={{
              position: 'absolute', left: `${tipLeft}%`, top: `${tipTop}%`, transform: 'translate(-50%, -118%)',
              pointerEvents: 'none', zIndex: 5, minWidth: 140,
              background: 'rgba(13,13,20,0.96)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10,
              padding: '8px 12px', boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-sport)', fontWeight: 800, fontSize: 13, color: '#F8F8FF', marginBottom: 6 }}>
              {flag(hovered.countryCode)} {hovered.country}
            </div>
            {([['24h', hovered.h24], ['7 días', hovered.d7], ['Mes', hovered.d28]] as const).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 12, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <b style={{ color: '#F8F8FF', fontVariantNumeric: 'tabular-nums' }}>{val}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
