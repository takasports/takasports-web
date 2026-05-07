'use client'

import type { RankingTab } from '@/lib/rankings'

export default function EntityTabBar({
  entities, active, onChange, activeAccent,
}: {
  entities: { id: RankingTab; label: string }[]
  active: RankingTab
  onChange: (tab: RankingTab) => void
  activeAccent: string
}) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide" style={{ borderBottom: '1px solid var(--border)' }}>
      {entities.map((e) => {
        const isActive = active === e.id
        return (
          <button key={e.id} onClick={() => onChange(e.id)}
            className="flex-shrink-0 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap"
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
