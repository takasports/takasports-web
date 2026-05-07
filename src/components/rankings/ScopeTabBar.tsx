'use client'

export default function ScopeTabBar<T extends string>({
  tabs, active, onChange,
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  if (tabs.length <= 1) return null
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-1 pb-0.5">
      {tabs.map((t) => {
        const isActive = active === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-200"
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
