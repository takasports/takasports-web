'use client'

import { SPORT_CATEGORIES } from '@/lib/sports'

interface Props {
  active: string
  onSelect: (cat: string) => void
}

export default function CategoriesFilter({ active, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
      {SPORT_CATEGORIES.map((sport) => {
        const isActive = sport === active
        return (
          <button
            key={sport}
            onClick={() => onSelect(sport)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
            style={{
              background: isActive ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : 'rgba(255,255,255,0.05)',
              color: isActive ? '#fff' : '#8E8E9E',
              boxShadow: isActive ? '0 2px 12px rgba(124,58,237,0.35)' : 'none',
              border: isActive ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {sport}
          </button>
        )
      })}
    </div>
  )
}
