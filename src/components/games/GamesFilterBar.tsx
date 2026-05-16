'use client'

// Barra de filtros para la sección "Disponibles" de /juegos.
// Estado persistido en URL (?cat=trivia&cad=daily) para que sea
// compartible. Los filtros no recargan la página (shallow routing).

import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export type CategoryKey = 'all' | 'Predicción' | 'Trivia' | 'Fantasy' | 'Puzzle' | 'Grid' | 'Arcade'
export type CadenceKey  = 'all' | 'Diario' | 'Semanal' | 'Infinito'

interface ChipSpec<T> { id: T; label: string }

const CATS: ChipSpec<CategoryKey>[] = [
  { id: 'all',         label: 'Todas' },
  { id: 'Predicción',  label: 'Predicción' },
  { id: 'Trivia',      label: 'Trivia' },
  { id: 'Fantasy',     label: 'Fantasy' },
  { id: 'Puzzle',      label: 'Puzzle' },
  { id: 'Grid',        label: 'Grid' },
  { id: 'Arcade',      label: 'Arcade' },
]

const CADENCES: ChipSpec<CadenceKey>[] = [
  { id: 'all',      label: 'Todas' },
  { id: 'Diario',   label: 'Diarios' },
  { id: 'Semanal',  label: 'Semanales' },
  { id: 'Infinito', label: 'Infinitos' },
]

export interface FilterState {
  category: CategoryKey
  cadence:  CadenceKey
  pending:  boolean
}

/** Lee filtros del URL. Server-safe (devuelve defaults sin window). */
export function readFilters(params: URLSearchParams): FilterState {
  return {
    category: (params.get('cat') as CategoryKey) || 'all',
    cadence:  (params.get('cad') as CadenceKey)  || 'all',
    pending:  params.get('pending') === '1',
  }
}

export default function GamesFilterBar() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const state = useMemo<FilterState>(() => readFilters(new URLSearchParams(searchParams.toString())), [searchParams])

  const update = useCallback((patch: Partial<FilterState>) => {
    const next = new URLSearchParams(searchParams.toString())
    const merged = { ...state, ...patch }
    if (merged.category === 'all') next.delete('cat'); else next.set('cat', merged.category)
    if (merged.cadence  === 'all') next.delete('cad'); else next.set('cad', merged.cadence)
    if (merged.pending)            next.set('pending', '1'); else next.delete('pending')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams, state])

  return (
    <div className="mb-5 flex flex-col gap-2.5">
      <ChipRow label="Categoría" chips={CATS}     active={state.category} onClick={c => update({ category: c })} />
      <ChipRow label="Cadencia"  chips={CADENCES} active={state.cadence}  onClick={c => update({ cadence:  c })} />
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest flex-shrink-0 pr-1" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)', minWidth: 64 }}>
          Estado
        </span>
        <button
          onClick={() => update({ pending: !state.pending })}
          aria-pressed={state.pending}
          className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all flex items-center gap-2"
          style={{
            background:    state.pending ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.03)',
            color:         state.pending ? '#4ade80' : '#5A5A7A',
            border:        state.pending ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(255,255,255,0.04)',
            fontFamily:    'var(--font-sport)',
            letterSpacing: '0.06em',
            cursor:        'pointer',
          }}
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0 transition-colors"
            style={{
              background: state.pending ? '#4ade80' : 'transparent',
              border: state.pending ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.15)',
            }}
          />
          Solo no jugados
        </button>
      </div>
    </div>
  )
}

function ChipRow<T extends string>({
  label, chips, active, onClick,
}: {
  label: string; chips: ChipSpec<T>[]; active: T; onClick: (id: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="text-[9px] font-black uppercase tracking-widest flex-shrink-0 pr-1" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)', minWidth: 64 }}>
        {label}
      </span>
      {chips.map(c => {
        const on = c.id === active
        return (
          <button
            key={c.id}
            onClick={() => onClick(c.id)}
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full transition-all flex-shrink-0"
            style={{
              background:    on ? 'rgba(167,139,250,0.16)' : 'rgba(255,255,255,0.03)',
              color:         on ? '#A78BFA' : '#5A5A7A',
              border:        on ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.04)',
              fontFamily:    'var(--font-sport)',
              letterSpacing: '0.06em',
              cursor:        'pointer',
            }}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
