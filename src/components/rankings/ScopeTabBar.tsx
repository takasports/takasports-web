'use client'

import { type KeyboardEvent } from 'react'

export default function ScopeTabBar<T extends string>({
  tabs, active, onChange, ariaLabel = 'Alcance del ranking',
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  ariaLabel?: string
}) {
  if (tabs.length <= 1) return null
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
    if (typeof document !== 'undefined') document.getElementById(`rk-scope-${t.id}`)?.focus()
  }
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-1 pb-0.5">
      {tabs.map((t, idx) => {
        const isActive = active === t.id
        return (
          <button key={t.id} id={`rk-scope-${t.id}`}
            role="tab" aria-selected={isActive} tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(ev) => onKeyDown(ev, idx)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{
              background: isActive ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
              color: isActive ? '#C4B5FD' : '#5A5A72',
              border: isActive ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.06)',
              boxShadow: isActive ? '0 2px 12px rgba(124,58,237,0.2)' : 'none',
              cursor: 'pointer', fontFamily: 'var(--font-sport)',
            }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
