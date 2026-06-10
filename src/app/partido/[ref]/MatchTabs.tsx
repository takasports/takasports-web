'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export interface TabDef {
  id: string
  label: string
  available: boolean
}

export function MatchTabs({
  tabs,
  children,
  topSlot,
}: {
  tabs: TabDef[]
  children: React.ReactNode[]
  topSlot?: React.ReactNode
}) {
  const firstAvailableIdx = tabs.findIndex(t => t.available)
  const [activeIdx, setActiveIdx] = useState(firstAvailableIdx >= 0 ? firstAvailableIdx : 0)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Scroll active tab into view on mobile when switching
  useEffect(() => {
    btnRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeIdx])

  // Teclado: flechas ←/→ navegan entre pestañas disponibles (patrón WAI-ARIA
  // tabs), Home/End saltan a la primera/última disponible. Mueve foco + activa.
  const focusActivate = useCallback((i: number) => {
    setActiveIdx(i)
    btnRefs.current[i]?.focus()
  }, [])

  const step = useCallback((dir: 1 | -1) => {
    const n = tabs.length
    let i = activeIdx
    for (let s = 0; s < n; s++) {
      i = (i + dir + n) % n
      if (tabs[i]?.available) { focusActivate(i); return }
    }
  }, [activeIdx, tabs, focusActivate])

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    else if (e.key === 'Home') {
      e.preventDefault()
      const i = tabs.findIndex(t => t.available)
      if (i >= 0) focusActivate(i)
    } else if (e.key === 'End') {
      e.preventDefault()
      for (let i = tabs.length - 1; i >= 0; i--) if (tabs[i].available) { focusActivate(i); break }
    }
  }

  return (
    <div>
      {/* Sticky group: optional compact scoreboard + tab bar */}
      <div
        className="sticky z-30 -mx-4 px-4 pb-2"
        style={{
          top: 56,
          background: 'rgba(9,9,15,0.92)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {topSlot}
        <div
          role="tablist"
          aria-label="Secciones del partido"
          onKeyDown={onKeyDown}
          className="flex gap-1 overflow-x-auto p-1 rounded-xl"
          style={{
            scrollbarWidth: 'none',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {tabs.map((tab, i) => {
            const isActive   = activeIdx === i
            const isDisabled = !tab.available
            return (
              <button
                key={tab.id}
                ref={(el) => { btnRefs.current[i] = el }}
                role="tab"
                id={`match-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`match-panel-${tab.id}`}
                aria-disabled={isDisabled || undefined}
                tabIndex={isActive ? 0 : -1}
                onClick={() => !isDisabled && setActiveIdx(i)}
                disabled={isDisabled}
                className="relative px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all whitespace-nowrap flex-shrink-0 rounded-lg"
                style={{
                  color:      isActive   ? '#C4B5FD' : isDisabled ? '#2A2A3A' : '#5A5A6A',
                  background: isActive   ? 'rgba(124,58,237,0.20)' : 'transparent',
                  border:     isActive   ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
                  cursor:     isDisabled ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sport)',
                  boxShadow:  isActive   ? '0 0 12px rgba(124,58,237,0.15)' : 'none',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content — all rendered, visibility toggled. Margin top compensates for sticky pb-2 */}
      <div className="mt-4">
        {children.map((child, i) => {
          const tab = tabs[i]
          return (
            <div
              key={i}
              role="tabpanel"
              id={tab ? `match-panel-${tab.id}` : undefined}
              aria-labelledby={tab ? `match-tab-${tab.id}` : undefined}
              hidden={activeIdx !== i}
              tabIndex={0}
            >
              {child}
            </div>
          )
        })}
      </div>
    </div>
  )
}
