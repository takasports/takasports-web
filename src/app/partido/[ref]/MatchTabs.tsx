'use client'

import { useState } from 'react'

export interface TabDef {
  id: string
  label: string
  available: boolean
}

export function MatchTabs({
  tabs,
  children,
}: {
  tabs: TabDef[]
  children: React.ReactNode[]
}) {
  const firstAvailableIdx = tabs.findIndex(t => t.available)
  const [activeIdx, setActiveIdx] = useState(firstAvailableIdx >= 0 ? firstAvailableIdx : 0)

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex gap-0 mb-5 overflow-x-auto"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab, i) => {
          const isActive = activeIdx === i
          const isDisabled = !tab.available
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && setActiveIdx(i)}
              disabled={isDisabled}
              className="relative px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition-all whitespace-nowrap flex-shrink-0"
              style={{
                color: isActive ? '#C4B5FD' : isDisabled ? '#2A2A3A' : '#5A5A6A',
                background: 'transparent',
                border: 'none',
                cursor: isDisabled ? 'default' : 'pointer',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {tab.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-2 right-2 rounded-t-full"
                  style={{ height: 2, background: '#7C3AED' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content — all rendered, visibility toggled */}
      {children.map((child, i) => (
        <div key={i} style={{ display: activeIdx === i ? 'block' : 'none' }}>
          {child}
        </div>
      ))}
    </div>
  )
}
