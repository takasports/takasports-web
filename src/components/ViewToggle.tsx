'use client'

interface Props {
  view: 'list' | 'grid'
  onToggle: (v: 'list' | 'grid') => void
}

export default function ViewToggle({ view, onToggle }: Props) {
  return (
    <div
      className="hidden sm:flex items-center gap-0.5 p-1 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.05)' }}
    >
      {/* List */}
      <button
        onClick={() => onToggle('list')}
        aria-label="Vista lista"
        className="p-2 rounded-lg transition-all duration-200"
        style={{
          background: view === 'list' ? 'rgba(124,58,237,0.3)' : 'transparent',
          color: view === 'list' ? '#A78BFA' : '#8E8E9E',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="0" y="1"  width="14" height="2" rx="1" fill="currentColor" />
          <rect x="0" y="6"  width="14" height="2" rx="1" fill="currentColor" />
          <rect x="0" y="11" width="14" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      {/* Grid */}
      <button
        onClick={() => onToggle('grid')}
        aria-label="Vista grilla"
        className="p-2 rounded-lg transition-all duration-200"
        style={{
          background: view === 'grid' ? 'rgba(124,58,237,0.3)' : 'transparent',
          color: view === 'grid' ? '#A78BFA' : '#8E8E9E',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="0" y="0" width="6" height="6" rx="1.5" fill="currentColor" />
          <rect x="8" y="0" width="6" height="6" rx="1.5" fill="currentColor" />
          <rect x="0" y="8" width="6" height="6" rx="1.5" fill="currentColor" />
          <rect x="8" y="8" width="6" height="6" rx="1.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
