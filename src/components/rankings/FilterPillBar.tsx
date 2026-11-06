'use client'


export default function FilterPillBar({
  filters, active, onChange, accentColor,
}: {
  filters: { label: string; slug: string }[]
  active: string
  onChange: (s: string) => void
  accentColor?: string
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-0.5">
      {filters.map((f) => {
        const isActive = active === f.slug
        return (
          <button key={f.slug} onClick={() => onChange(f.slug)}
            className={`ts-chip${isActive ? ' is-on' : ''}`}
            aria-pressed={isActive}
            style={{ height: 32, fontSize: 11 }}>
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
