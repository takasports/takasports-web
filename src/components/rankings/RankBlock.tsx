'use client'

import { useState } from 'react'
import type { RankingEntry } from '@/lib/rankings'
import RankRow from './RankRow'

export default function RankBlock({
  label, entries, showSportEmoji = false, typeTagFn, defaultOpen = false,
}: {
  label: string; entries: RankingEntry[]; showSportEmoji?: boolean
  typeTagFn?: (entry: RankingEntry) => string | undefined
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (entries.length === 0) return null
  return (
    <div className="mb-3">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:brightness-110"
        style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)', cursor: 'pointer' }}>
        <div className="flex items-center gap-2.5">
          <span className="font-black text-xs" style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}>
            {open ? '▲' : '▼'}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}>
            {label}
          </span>
        </div>
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: '#7C3AED', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)' }}>
          {entries.length} entradas
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 mt-2">
          {entries.map((entry) => (
            <RankRow key={entry.id} entry={entry} showSportEmoji={showSportEmoji} typeTag={typeTagFn?.(entry)} />
          ))}
        </div>
      )}
    </div>
  )
}
