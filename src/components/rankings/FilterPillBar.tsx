'use client'

import { getSportStyle } from '@/lib/sports'

export default function FilterPillBar({
  filters, active, onChange, accentColor,
}: {
  filters: { label: string; slug: string }[]
  active: string
  onChange: (s: string) => void
  accentColor?: string
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 pb-0.5">
      {filters.map((f) => {
        const isActive = active === f.slug
        const accent = accentColor ?? (f.slug ? getSportStyle(f.slug).accent : '#7C3AED')
        const activeAccent = accentColor ?? '#7C3AED'
        return (
          <button key={f.slug} onClick={() => onChange(f.slug)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
            style={{
              background: isActive ? `${activeAccent}18` : 'rgba(255,255,255,0.05)',
              color: isActive ? (accentColor ?? accent) : '#8E8E9E',
              border: isActive ? `1px solid ${activeAccent}40` : '1px solid rgba(255,255,255,0.06)',
              boxShadow: isActive ? `0 2px 12px ${activeAccent}25` : 'none',
              cursor: 'pointer', fontFamily: 'var(--font-sport)',
            }}>
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
