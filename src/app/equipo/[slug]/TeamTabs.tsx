'use client'

import { useState } from 'react'

export interface TabDef {
  id: string
  label: string
}

export function TeamTabs({
  tabs,
  children,
}: {
  tabs: TabDef[]
  children: React.ReactNode[]
}) {
  const [activeIdx, setActiveIdx] = useState(0)

  return (
    <div>
      <div
        className="flex gap-0 mb-5 overflow-x-auto"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab, i) => {
          const isActive = activeIdx === i
          return (
            <button
              key={tab.id}
              onClick={() => setActiveIdx(i)}
              className="relative px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition-all whitespace-nowrap flex-shrink-0"
              style={{
                color: isActive ? '#C4B5FD' : '#5A5A6A',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
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
      {children.map((child, i) => (
        <div key={i} style={{ display: activeIdx === i ? 'block' : 'none' }}>
          {child}
        </div>
      ))}
    </div>
  )
}
