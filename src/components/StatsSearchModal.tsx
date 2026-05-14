'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchIcon } from '@/components/icons/GameIcons'

interface SearchableRow {
  blockId: string
  blockTitle: string
  rowName: string
  rowTeam?: string
  rowValue: string
  metric: string
}

interface Props {
  open: boolean
  onClose: () => void
  rows: SearchableRow[]
  /** Called when user picks a result. Receives the block id so the page scrolls + expands. */
  onPick: (blockId: string) => void
}

// Lightweight ⌘K palette specific to /estadisticas. No fuzzy matching library —
// substring + a tiny normalize is enough for ~500 rows.
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function StatsSearchModal({ open, onClose, rows, onPick }: Props) {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      // RAF so the focus call happens after the modal is painted
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const matches = useMemo(() => {
    if (!q.trim()) return []
    const nq = normalize(q)
    return rows
      .filter(r => normalize(r.rowName).includes(nq) || (r.rowTeam ? normalize(r.rowTeam).includes(nq) : false))
      .slice(0, 12)
  }, [q, rows])

  if (!open) return null

  return (
    <div role="dialog" aria-modal="true" aria-label="Buscar en estadísticas"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 18px 48px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span aria-hidden style={{ color: '#5A5A72' }}><SearchIcon size={14} /></span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Busca jugador o equipo..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }} />
          <kbd className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {q.trim() === '' && (
            <p className="px-4 py-6 text-center text-[11px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
              Empieza a escribir un nombre, un equipo o una selección.
            </p>
          )}
          {q.trim() !== '' && matches.length === 0 && (
            <p className="px-4 py-6 text-center text-[11px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
              Nada encontrado para &ldquo;{q}&rdquo;.
            </p>
          )}
          {matches.map((m, i) => (
            <button key={`${m.blockId}-${m.rowName}-${i}`}
              onClick={() => { onPick(m.blockId); onClose() }}
              className="w-full text-left px-4 py-2.5 transition-colors hover:bg-white/[0.04]"
              style={{ borderBottom: i < matches.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate flex-1" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                  {m.rowName}
                </span>
                <span className="text-[11px] tabular-nums font-black flex-shrink-0" style={{ color: '#9B7CF6', fontFamily: 'var(--font-display)' }}>
                  {m.rowValue}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] mt-0.5" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                <span>{m.blockTitle}</span>
                {m.rowTeam && <><span>·</span><span>{m.rowTeam}</span></>}
                <span className="ml-auto" style={{ color: '#3A3A52' }}>{m.metric}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export type { SearchableRow }
