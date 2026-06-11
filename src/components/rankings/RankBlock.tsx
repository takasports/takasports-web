'use client'

import { useState } from 'react'
import type { RankingEntry } from '@/lib/rankings'
import RankRow from './RankRow'

export default function RankBlock({
  label, entries, showSportEmoji = false, typeTagFn, defaultOpen = false, maxScore, minScore,
}: {
  label: string; entries: RankingEntry[]; showSportEmoji?: boolean
  typeTagFn?: (entry: RankingEntry) => string | undefined
  defaultOpen?: boolean
  maxScore?: number
  minScore?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (entries.length === 0) return null
  // Cuenta cuántas posiciones del bloque llevan una nota editorial.
  // Si hay, las anunciamos en la cabecera del acordeón para que el lector
  // sepa que dentro encontrará contexto editorial (transparencia del Índice
  // Taka — la nota explica el porqué de cada ajuste).
  const notesCount = entries.reduce(
    (acc, e) => acc + (e.editorialNote ? 1 : 0),
    0,
  )
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
        <div className="flex items-center gap-1.5">
          {notesCount > 0 && (
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{
                color: 'var(--purple-light)',
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.3)',
                fontFamily: 'var(--font-sport)',
              }}
              title="Posiciones con nota editorial dentro del bloque"
            >
              <span aria-hidden="true">✎</span>
              {notesCount} {notesCount === 1 ? 'nota' : 'notas'}
            </span>
          )}
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: '#7C3AED', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)' }}>
            {entries.length} entradas
          </span>
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-2 mt-2">
          {entries.map((entry) => (
            <RankRow key={entry.id} entry={entry} showSportEmoji={showSportEmoji} typeTag={typeTagFn?.(entry)} maxScore={maxScore} minScore={minScore} />
          ))}
        </div>
      )}
    </div>
  )
}
