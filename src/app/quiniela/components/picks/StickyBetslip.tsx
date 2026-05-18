'use client'

// ─────────────────────────────────────────────────────────────────
// Sticky betslip — footer fijo con progreso y CTA
// ─────────────────────────────────────────────────────────────────
export function StickyBetslip({ done, total, allDone, captainSet, onSubmit, urgent }: { done: number; total: number; allDone: boolean; captainSet: boolean; onSubmit: () => void; urgent: boolean }) {
  const potential = done * 10 + (captainSet ? 10 : 0) + (allDone ? 100 : 0)
  const cta = allDone
    ? '🎯 Sellar predicción'
    : `Te quedan ${total - done} partido${total - done !== 1 ? 's' : ''}`
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 -mx-1 pt-3 pb-3" style={{ background: 'linear-gradient(to top, #060010 0%, #060010 60%, transparent 100%)' }}>
      <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(10,2,20,0.96)', backdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.28)', boxShadow: '0 -8px 24px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center gap-3 mb-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-black tabular-nums" style={{ fontSize: 18, color: '#F8F8FF', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{done}/{total}</span>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>picks</span>
            </div>
            <div className="mt-1.5 w-full rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: allDone ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#7C3AED,#A78BFA)', transition: 'width 0.3s' }} />
            </div>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>Si aciertas todo</span>
            <span className="font-black tabular-nums" style={{ fontSize: 16, color: '#fbbf24', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {potential}🪙
            </span>
          </div>
        </div>
        <button
          onClick={onSubmit}
          disabled={!allDone}
          aria-label={cta}
          className="w-full rounded-xl font-black uppercase tracking-widest transition-opacity"
          style={{
            minHeight: 48, fontSize: 12, fontFamily: 'var(--font-sport)', letterSpacing: '0.09em',
            background: allDone ? 'linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)' : 'rgba(255,255,255,0.04)',
            color: allDone ? '#fff' : '#3A3A50',
            border: allDone ? '1px solid rgba(124,58,237,0.45)' : '1px solid rgba(255,255,255,0.05)',
            boxShadow: allDone ? '0 6px 22px rgba(124,58,237,0.35)' : 'none',
            cursor: allDone ? 'pointer' : 'not-allowed',
            animation: allDone && urgent ? 'quinielaPulse 0.85s ease-in-out infinite' : 'none',
          }}
        >
          {cta}
        </button>
      </div>
    </div>
  )
}
