'use client'

// Mapamundi INTERACTIVO de "de dónde te ven", con ZOOM + arrastre (para separar
// países cercanos que se solapan). Fondo = países (WORLD_PATHS, proyectados
// equirectangular a 1000x500); punto por país (radio ∝ √usuarios 28d) por lat/long
// con la MISMA proyección. Hover → tooltip 24h / 7 días / mes. Sin librerías:
// SVG + estado (viewBox para zoom/pan, rueda no-pasiva, botones, arrastre puntero).

import { useEffect, useRef, useState } from 'react'
import { WORLD_PATHS } from '@/lib/world-paths'
import type { CountryWindow } from '@/lib/traffic'

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

interface View { x: number; y: number; w: number; h: number }
const FULL: View = { x: 0, y: 30, w: 1000, h: 380 }
const RATIO = FULL.h / FULL.w
const MIN_W = 130 // máximo zoom
function clamp(v: View): View {
  const w = Math.min(FULL.w, Math.max(MIN_W, v.w))
  const h = w * RATIO
  const x = Math.min(1000 - w, Math.max(0, v.x))
  const y = Math.min(500 - h, Math.max(0, v.y))
  return { x, y, w, h }
}

export default function WorldMap({ items }: { items: CountryWindow[] }) {
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState<View>(FULL)
  const [dragging, setDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewRef = useRef<View>(FULL)
  const dragRef = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null)

  const apply = (v: View) => { const c = clamp(v); viewRef.current = c; setView(c) }
  const zoomAt = (factor: number, cx: number, cy: number) => {
    const v = viewRef.current
    const w = v.w * factor
    const nw = Math.min(FULL.w, Math.max(MIN_W, w))
    const nh = nw * RATIO
    apply({ x: cx - (cx - v.x) * (nw / v.w), y: cy - (cy - v.y) * (nh / v.h), w: nw, h: nh })
  }
  const zoomCenter = (factor: number) => zoomAt(factor, viewRef.current.x + viewRef.current.w / 2, viewRef.current.y + viewRef.current.h / 2)

  // Rueda = zoom hacia el cursor (listener no-pasivo para poder preventDefault).
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const v = viewRef.current
      const cx = v.x + ((e.clientX - r.left) / r.width) * v.w
      const cy = v.y + ((e.clientY - r.top) / r.height) * v.h
      zoomAt(e.deltaY > 0 ? 1.18 : 1 / 1.18, cx, cy)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    setHover(null)
    setDragging(true)
    dragRef.current = { px: e.clientX, py: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current
    if (!d || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const v = viewRef.current
    apply({ ...v, x: d.vx - ((e.clientX - d.px) / r.width) * v.w, y: d.vy - ((e.clientY - d.py) / r.height) * v.h })
  }
  const onUp = () => { dragRef.current = null; setDragging(false) }

  const pts = items
    .map((i) => ({ ...i, ll: LATLNG[(i.countryCode || '').toUpperCase()] }))
    .filter((p): p is typeof p & { ll: [number, number] } => Array.isArray(p.ll))
    .sort((a, b) => a.d28 - b.d28)
  const max = Math.max(...pts.map((p) => p.d28), 1)
  const hovered = pts.find((p) => p.countryCode.toUpperCase() === hover)
  const tip = hovered ? proj(hovered.ll[0], hovered.ll[1]) : null
  const tipLeft = tip ? ((tip[0] - view.x) / view.w) * 100 : 0
  const tipTop = tip ? ((tip[1] - view.y) / view.h) * 100 : 0
  const dotScale = view.w / FULL.w // achica radios al alejar, mantiene tamaño visual al acercar

  const btn: React.CSSProperties = {
    width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(13,13,20,0.8)',
    color: '#F8F8FF', fontSize: 16, fontWeight: 800, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div className="tk-glass" style={{ borderRadius: 'var(--radius-lg)', padding: 12, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
          role="img"
          aria-label="Mapa de dónde te ven (zoom con rueda o botones, arrastra para mover)"
        >
          <g>
            {WORLD_PATHS.map((c) => (
              <path key={c.id} d={c.d} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.4 * dotScale} />
            ))}
          </g>
          {pts.map((p, i) => {
            const [x, y] = proj(p.ll[0], p.ll[1])
            const r = (4 + Math.sqrt(p.d28 / max) * 20) * dotScale
            const active = p.countryCode.toUpperCase() === hover
            return (
              <g
                key={i}
                onMouseEnter={() => !dragging && setHover(p.countryCode.toUpperCase())}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={x} cy={y} r={Math.max(r, 9 * dotScale)} fill="transparent" />
                <circle cx={x} cy={y} r={r} fill="#A78BFA" fillOpacity={active ? 0.6 : 0.28} />
                <circle cx={x} cy={y} r={Math.max(1.6 * dotScale, r * 0.32)} fill={active ? '#FFFFFF' : '#C4B5FD'} />
              </g>
            )
          })}
        </svg>

        {/* Controles de zoom */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button type="button" aria-label="Acercar" style={btn} onClick={() => zoomCenter(1 / 1.4)}>+</button>
          <button type="button" aria-label="Alejar" style={btn} onClick={() => zoomCenter(1.4)}>−</button>
          <button type="button" aria-label="Ver todo" style={{ ...btn, fontSize: 12 }} onClick={() => apply(FULL)}>⤢</button>
        </div>

        {hovered && !dragging && (
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
      <p style={{ color: 'var(--text-faint)', fontSize: 10.5, marginTop: 8, textAlign: 'center' }}>
        Rueda o botones para zoom · arrastra para mover · cursor sobre un país para ver 24h/7d/mes
      </p>
    </div>
  )
}
