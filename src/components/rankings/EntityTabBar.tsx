'use client'

import { type KeyboardEvent } from 'react'
import type { RankingTab } from '@/lib/rankings'

export default function EntityTabBar({
  entities, active, onChange, activeAccent, ariaLabel = 'Tipo de ranking',
}: {
  entities: { id: RankingTab; label: string }[]
  active: RankingTab
  onChange: (tab: RankingTab) => void
  activeAccent: string
  ariaLabel?: string
}) {
  // Navegación WAI-ARIA del tablist: las flechas mueven entre pestañas y
  // trasladan el foco a la recién activada; Home/End a los extremos (espejo de
  // LeaderboardTabs / MatchTabs). Estas pestañas filtran la MISMA lista de
  // resultados en sitio, no muestran/ocultan paneles → sin tabpanel asociado.
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    let next = -1
    if (e.key === 'ArrowRight') next = (idx + 1) % entities.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + entities.length) % entities.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = entities.length - 1
    else return
    e.preventDefault()
    const t = entities[next]
    onChange(t.id)
    if (typeof document !== 'undefined') document.getElementById(`rk-entity-${t.id}`)?.focus()
  }
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto scrollbar-hide"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {entities.map((e, idx) => {
        const isActive = active === e.id
        return (
          <button key={e.id} id={`rk-entity-${e.id}`}
            role="tab" aria-selected={isActive} tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(e.id)}
            onKeyDown={(ev) => onKeyDown(ev, idx)}
            className="flex-shrink-0 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{
              fontFamily: 'var(--font-sport)',
              color: isActive ? activeAccent : 'var(--text-muted)',
              background: 'none', border: 'none',
              borderBottom: isActive ? `2px solid ${activeAccent}` : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer',
            }}>
            {e.label}
          </button>
        )
      })}
    </div>
  )
}
