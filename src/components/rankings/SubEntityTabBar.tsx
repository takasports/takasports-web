'use client'

export default function SubEntityTabBar({
  tabs, active, onChange, accent = '#9B7CF6',
}: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
  accent?: string
}) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-hide" style={{ borderBottom: '1px solid var(--border)' }}>
      {tabs.map((t) => {
        const isActive = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className="flex-shrink-0 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap"
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
