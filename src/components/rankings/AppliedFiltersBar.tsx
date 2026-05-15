'use client'

/**
 * Pill bar that summarizes which filters are currently applied above the
 * results list. Each pill is dismissable (×) — clears that specific filter.
 * A "Limpiar todo" button on the right resets every filter at once.
 *
 * Renders nothing when only the implicit "Global / Jugadores" baseline is
 * active so the page stays clean on the default state.
 */
export type AppliedFilter = {
  key: string             // unique key — used to deduplicate
  label: string           // text inside the pill ("Liga: LaLiga")
  color?: string          // tailwind/hex accent for the pill
  onClear?: () => void    // if provided, shows × button
}

export default function AppliedFiltersBar({
  filters,
  onClearAll,
  accent = '#9B7CF6',
}: {
  filters: AppliedFilter[]
  onClearAll?: () => void
  accent?: string
}) {
  const visible = filters.filter(f => !!f.label)
  if (visible.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4 mt-1 pb-1">
      <span className="text-[8px] font-black uppercase tracking-[0.18em] flex-shrink-0"
        style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
        Filtros activos
      </span>
      <div className="flex items-center gap-1.5 flex-wrap flex-1">
        {visible.map((f) => {
          const color = f.color ?? accent
          return (
            <span
              key={f.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide"
              style={{
                background: `${color}14`,
                color: color,
                border: `1px solid ${color}33`,
                fontFamily: 'var(--font-sport)',
              }}
            >
              {f.label}
              {f.onClear && (
                <button
                  onClick={f.onClear}
                  className="leading-none transition-opacity hover:opacity-100 opacity-70"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: color, padding: 0, marginLeft: 1 }}
                  aria-label={`Quitar filtro ${f.label}`}
                >
                  ×
                </button>
              )}
            </span>
          )
        })}
      </div>
      {onClearAll && visible.some(f => f.onClear) && (
        <button
          onClick={onClearAll}
          className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full transition-all hover:brightness-150 flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.04)',
            color: '#7A7A92',
            border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sport)',
          }}
        >
          Limpiar todo
        </button>
      )}
    </div>
  )
}
