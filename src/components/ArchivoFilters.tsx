'use client'

import { useEffect, useRef, useState } from 'react'
import { CATEGORY_TO_SLUG, HOME_SPORT_CATEGORIES, MORE_SPORT_CATEGORIES } from '@/lib/sports'
import type { DateRangePreset } from '@/lib/archivo'

export type { DateRangePreset } from '@/lib/archivo'
export { presetToRange } from '@/lib/archivo'

export interface ArchivoFilterState {
  q: string
  sport: string // slug ('' = all)
  preset: DateRangePreset
  from: string // YYYY-MM-DD (only used when preset === 'custom')
  to: string
}

// Sólo deportes (no ligas/competiciones). Reusa la lista canónica del header.
const SPORT_PILLS: { slug: string; label: string }[] = [
  { slug: '', label: 'Todos' },
  ...[...HOME_SPORT_CATEGORIES, ...MORE_SPORT_CATEGORIES]
    .filter(label => label !== 'Todo')
    .map(label => ({ slug: CATEGORY_TO_SLUG[label] ?? '', label })),
]

const DATE_PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: 'todo', label: 'Cualquier fecha' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: '3m', label: 'Últimos 3 meses' },
  { key: 'ano', label: 'Último año' },
  { key: 'custom', label: 'Personalizado' },
]

export default function ArchivoFilters({
  value,
  onChange,
  onReset,
  resultCount,
}: {
  value: ArchivoFilterState
  onChange: (next: ArchivoFilterState) => void
  onReset: () => void
  resultCount?: number
}) {
  const [qLocal, setQLocal] = useState(value.q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sincronizar input local con prop (e.g. al pulsar "Limpiar")
  useEffect(() => { setQLocal(value.q) }, [value.q])

  const onQChange = (raw: string) => {
    setQLocal(raw)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange({ ...value, q: raw.trim() }), 300)
  }

  const hasActiveFilter =
    value.q !== '' ||
    value.sport !== '' ||
    value.preset !== 'todo'

  return (
    <div
      className="sticky z-30 px-4 sm:px-6 xl:px-10 py-3"
      style={{
        top: 56,
        background: 'rgba(9,9,15,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Search */}
      <div className="relative mb-3">
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-faint)' }}
        >
          <path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={qLocal}
          onChange={e => onQChange(e.target.value)}
          placeholder="Buscar en el archivo (jugador, equipo, palabra clave…)"
          maxLength={80}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-colors"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </div>

      {/* Sport pills */}
      <div className="flex flex-wrap gap-2 mb-2">
        {SPORT_PILLS.map(({ slug, label }) => {
          const active = value.sport === slug
          return (
            <button
              key={slug || 'all'}
              onClick={() => onChange({ ...value, sport: slug })}
              className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all"
              style={{
                background: active ? 'rgba(124,58,237,0.18)' : 'var(--bg-card)',
                color: active ? '#C4B5FD' : 'var(--text-muted)',
                border: active ? '1px solid rgba(124,58,237,0.4)' : '1px solid var(--border)',
                fontFamily: 'var(--font-sport)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Date presets + custom range */}
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map(({ key, label }) => {
          const active = value.preset === key
          return (
            <button
              key={key}
              onClick={() => onChange({ ...value, preset: key })}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
              style={{
                background: active ? 'rgba(124,58,237,0.18)' : 'transparent',
                color: active ? '#C4B5FD' : 'var(--text-muted)',
                border: active ? '1px solid rgba(124,58,237,0.4)' : '1px solid var(--border)',
                fontFamily: 'var(--font-sport)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}

        {value.preset === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={e => onChange({ ...value, from: e.target.value })}
              className="px-2 py-1.5 rounded-lg text-[11px]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>→</span>
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={e => onChange({ ...value, to: e.target.value })}
              className="px-2 py-1.5 rounded-lg text-[11px]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {typeof resultCount === 'number' && (
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-sport)' }}>
              {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
            </span>
          )}
          {hasActiveFilter && (
            <button
              onClick={onReset}
              className="text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
              style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)', cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
