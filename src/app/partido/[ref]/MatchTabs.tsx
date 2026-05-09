'use client'

import { useState, useRef, useEffect } from 'react'

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
  const activeRef = useRef<HTMLButtonElement | null>(null)
  const barRef    = useRef<HTMLDivElement | null>(null)

  // Scroll active tab into view on mobile when switching
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeIdx])

  return (
    <div>
      {/* Tab bar — pill style */}
      <div
        ref={barRef}
        className="flex gap-1 mb-5 overflow-x-auto p-1 rounded-xl"
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
              ref={isActive ? activeRef : null}
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

      {/* Tab content — all rendered, visibility toggled */}
      {children.map((child, i) => (
        <div key={i} style={{ display: activeIdx === i ? 'block' : 'none' }}>
          {child}
        </div>
      ))}
    </div>
  )
}
