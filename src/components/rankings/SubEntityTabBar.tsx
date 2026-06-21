'use client'

import { type KeyboardEvent } from 'react'

export default function SubEntityTabBar({
  tabs, active, onChange, accent = '#9B7CF6', ariaLabel = 'Categoría',
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
  accent?: string
  ariaLabel?: string
}) {
  // Navegación WAI-ARIA del tablist (flechas + Home/End con foco). Filtra la
  // misma lista en sitio → sin tabpanel asociado. Espejo de LeaderboardTabs.
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    let next = -1
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    else return
    e.preventDefault()
    const t = tabs[next]
    onChange(t.id)
    if (typeof document !== 'undefined') document.getElementById(`rk-sub-${t.id}`)?.focus()
  }
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 overflow-x-auto scrollbar-hide"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {tabs.map((t, idx) => {
        const isActive = active === t.id
        return (
          <button key={t.id} id={`rk-sub-${t.id}`}
            role="tab" aria-selected={isActive} tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(ev) => onKeyDown(ev, idx)}
            className="flex-shrink-0 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{
              fontFamily: 'var(--font-sport)',
              color: isActive ? accent : 'var(--text-muted)',
              background: 'none', border: 'none',
              borderBottom: isActive ? `2px solid ${accent}` : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer',
            }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
