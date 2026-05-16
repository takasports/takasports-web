'use client'

import type { QuinielaMatch, Pick } from '@/components/QuinielaModule'
import { aiSuggest } from '../../lib/helpers'

// ─────────────────────────────────────────────────────────────────
// Quick-pick IA — autocompleta picks pendientes con la sugerencia
// ─────────────────────────────────────────────────────────────────
export function QuickPickIA({ matches, picks, onApply }: { matches: QuinielaMatch[]; picks: Record<number, Pick>; onApply: (next: Record<number, Pick>) => void }) {
  const pendientes = matches.reduce((n, m, i) => (picks[i] === undefined && (!m.isoDate || new Date(m.isoDate).getTime() > Date.now()) ? n + 1 : n), 0)
  if (pendientes === 0) return null
  const handle = () => {
    const next = { ...picks }
    matches.forEach((m, i) => {
      if (next[i] !== undefined) return
      if (m.isoDate && new Date(m.isoDate).getTime() <= Date.now()) return
      if (!m.odds) { next[i] = 'X'; return }
      const { pick } = aiSuggest(m.odds)
      next[i] = pick === '1X' ? '1' : pick === 'X2' ? '2' : pick
    })
    onApply(next)
  }
  return (
    <button
      onClick={handle}
      className="w-full rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
      style={{ background: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(124,58,237,0.35)', color: '#C4B5FD', fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', minHeight: 44 }}
    >
      <span style={{ fontSize: 14 }}>🤖</span>
      Rellena los {pendientes} restantes con la IA
      <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4 }}>(editable)</span>
    </button>
  )
}
