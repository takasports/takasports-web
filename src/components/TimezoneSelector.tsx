'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { TZ_KEY, TZ_OPTIONS, getTZOffset, type TZOption } from '@/lib/timezone'

interface Props {
  value: string
  onChange: (tz: string) => void
  /** Muestra solo el icono en contextos muy compactos */
  compact?: boolean
}

function GlobeIcon({ size = 12, color = '#6A6A84' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.3" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6.5" stroke={color} strokeWidth="1.1" />
      <path d="M1.5 6h13M1.5 10h13" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="#7C3AED" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Agrupa las opciones por región
function groupByRegion(options: TZOption[]): Record<string, TZOption[]> {
  return options.reduce<Record<string, TZOption[]>>((acc, opt) => {
    if (!acc[opt.region]) acc[opt.region] = []
    acc[opt.region].push(opt)
    return acc
  }, {})
}

export default function TimezoneSelector({ value, onChange, compact = false }: Props) {
  const [open, setOpen]           = useState(false)
  const [search, setSearch]       = useState('')
  const [offsets, setOffsets]     = useState<Record<string, string>>({})
  const [anchorRect, setAnchor]   = useState<DOMRect | null>(null)
  // TZ del browser detectada en client (puede diferir de `value` que viene del servidor)
  const [browserTZ, setBrowserTZ] = useState<string | null>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const currentOpt = TZ_OPTIONS.find((t) => t.iana === value) ?? {
    iana: value,
    city: value.split('/').pop()?.replace('_', ' ') ?? value,
    region: 'Otro',
    flag: '🌍',
  }

  // Calcular offsets una sola vez al montar
  useEffect(() => {
    const map: Record<string, string> = {}
    TZ_OPTIONS.forEach((t) => { map[t.iana] = getTZOffset(t.iana) })
    setOffsets(map)
  }, [])

  // Detectar TZ del browser para mostrar el badge de sugerencia
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
      // Solo sugerir si el usuario no ha guardado preferencia y la TZ detectada difiere
      const stored = typeof window !== 'undefined' ? localStorage.getItem(TZ_KEY) : null
      if (!stored && detected !== value) {
        setBrowserTZ(detected)
      }
    } catch { /* ignore */ }
  }, [value])

  // Focus en búsqueda al abrir
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30)
    else setSearch('')
  }, [open])

  // Cerrar al hacer click fuera (via overlay del portal)
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return TZ_OPTIONS
    return TZ_OPTIONS.filter(
      (t) =>
        t.city.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q) ||
        t.iana.toLowerCase().includes(q),
    )
  }, [search])

  const grouped = useMemo(() => groupByRegion(filtered), [filtered])
  const regions = Object.keys(grouped)

  const select = (tz: string) => {
    onChange(tz)
    setBrowserTZ(null) // dismiss suggestion once user makes a choice
    setOpen(false)
  }

  const handleOpen = () => {
    if (btnRef.current) setAnchor(btnRef.current.getBoundingClientRect())
    setOpen(v => !v)
  }

  // Detectar TZ del browser para label del badge
  const browserOpt = browserTZ
    ? (TZ_OPTIONS.find(t => t.iana === browserTZ) ?? {
        iana: browserTZ,
        city: browserTZ.split('/').pop()?.replace('_', ' ') ?? browserTZ,
        flag: '📍',
        region: 'Otro',
      })
    : null

  // Calcular posición del dropdown usando el anchorRect (portal = fuera del sticky)
  const dropStyle = (() => {
    if (!anchorRect || typeof window === 'undefined') return {}
    const PANEL_W = 264
    const margin  = 8
    let left = anchorRect.right - PANEL_W
    if (left < margin) left = margin
    if (left + PANEL_W > window.innerWidth - margin) left = window.innerWidth - PANEL_W - margin
    return {
      position: 'fixed' as const,
      top:  anchorRect.bottom + 6,
      left,
      width: PANEL_W,
      zIndex: 99999,
    }
  })()

  const dropdown = open ? (
    <>
      {/* Overlay para cerrar */}
      <div className="fixed inset-0" style={{ zIndex: 99998 }} onClick={() => setOpen(false)} />

      <div
        className="flex flex-col"
        style={{
          ...dropStyle,
          background: 'linear-gradient(145deg, #0F0F1C 0%, #0A0A15 100%)',
          border: '1px solid rgba(124,58,237,0.22)',
          borderRadius: 14,
          boxShadow: '0 24px 56px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="5" cy="5" r="3.5" stroke="#4A4A64" strokeWidth="1.3" />
            <path d="M8 8l2 2" stroke="#4A4A64" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ciudad..."
            className="flex-1 bg-transparent outline-none text-[11px]"
            style={{
              color: '#D0D0E0',
              fontFamily: 'var(--font-sport)',
              caretColor: '#7C3AED',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#3A3A50' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* List */}
        <div
          style={{
            maxHeight: 260,
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#2A2A3A transparent',
          }}
        >
          {regions.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: '#3A3A50', fontFamily: 'var(--font-sport)' }}>
              Sin resultados
            </p>
          ) : (
            regions.map((region) => (
              <div key={region}>
                {regions.length > 1 && (
                  <div
                    className="px-3 pt-2.5 pb-1"
                    style={{ position: 'sticky', top: 0, background: '#0F0F1C', zIndex: 1 }}
                  >
                    <span
                      className="text-[8px] font-black uppercase tracking-[0.18em]"
                      style={{ color: '#2E2E44', fontFamily: 'var(--font-sport)' }}
                    >
                      {region}
                    </span>
                  </div>
                )}
                {grouped[region].map((opt) => {
                  const isActive = opt.iana === value
                  return (
                    <button
                      key={opt.iana}
                      onClick={() => select(opt.iana)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left"
                      style={{
                        background: isActive ? 'rgba(124,58,237,0.1)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
                      }}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{opt.flag}</span>
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-[12px] font-semibold block"
                          style={{ color: isActive ? '#C4B5FD' : '#B0B0C8', fontFamily: 'var(--font-sport)' }}
                        >
                          {opt.city}
                        </span>
                      </div>
                      <span
                        className="text-[9px] flex-shrink-0"
                        style={{ color: isActive ? '#7C5AAA' : '#2E2E44', fontFamily: 'var(--font-sport)' }}
                      >
                        {offsets[opt.iana] ?? ''}
                      </span>
                      {isActive && (
                        <div className="flex-shrink-0">
                          <CheckIcon />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="px-3 py-2 flex items-center justify-between gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-[9px]" style={{ color: '#2A2A3A', fontFamily: 'var(--font-sport)' }}>
            Base: Madrid (CET/CEST)
          </span>
          <button
            onClick={() => {
              const bTZ = Intl.DateTimeFormat().resolvedOptions().timeZone
              select(bTZ)
            }}
            className="text-[9px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: '#5A4878', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Usar mi zona →
          </button>
        </div>
      </div>
    </>
  ) : null

  return (
    <div className="relative flex items-center gap-2">
      {/* Trigger pill */}
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all"
        style={{
          background: open ? 'rgba(124,58,237,0.14)' : 'rgba(255,255,255,0.04)',
          border: open ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer',
          boxShadow: open ? '0 0 10px rgba(124,58,237,0.1)' : 'none',
        }}
      >
        <GlobeIcon size={11} color={open ? '#C4B5FD' : '#5A5A74'} />
        {!compact && (
          <>
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{
                fontFamily: 'var(--font-sport)',
                color: open ? '#C4B5FD' : '#5A5A74',
                whiteSpace: 'nowrap',
              }}
            >
              {currentOpt.city}
            </span>
            <span
              className="text-[8px]"
              style={{ color: open ? '#7C5AAA' : '#3A3A50', fontFamily: 'var(--font-sport)' }}
            >
              {offsets[value] ?? ''}
            </span>
          </>
        )}
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}
        >
          <path d="M1.5 3L4 5.5 6.5 3" stroke={open ? '#C4B5FD' : '#4A4A64'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Badge de sugerencia geolocalización (solo primera visita, TZ distinta) */}
      {browserOpt && !open && (
        <button
          onClick={() => select(browserOpt.iana)}
          className="flex items-center gap-1 px-2 py-1 rounded-full transition-all hover:brightness-110 flex-shrink-0"
          style={{
            background: 'rgba(124,58,237,0.10)',
            border: '1px solid rgba(124,58,237,0.22)',
            cursor: 'pointer',
          }}
          title={`Detectado: ${browserOpt.city} — clic para usar`}
        >
          <span style={{ fontSize: 10 }}>📍</span>
          <span className="text-[8.5px] font-bold" style={{ color: '#9B6DB5', fontFamily: 'var(--font-sport)', whiteSpace: 'nowrap' }}>
            {browserOpt.city}
          </span>
          <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
            <path d="M3 1.5l2.5 2.5-2.5 2.5" stroke="#7C3AED" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Dropdown via portal (escapa al stacking context del backdrop-filter sticky) */}
      {typeof window !== 'undefined' && open && createPortal(dropdown, document.body)}
    </div>
  )
}
