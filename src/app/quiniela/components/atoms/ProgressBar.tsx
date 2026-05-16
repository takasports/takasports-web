'use client'

// ─────────────────────────────────────────────────────────────────
// Barra de progreso de picks
// ─────────────────────────────────────────────────────────────────
export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct  = total === 0 ? 0 : Math.round((done / total) * 100)
  const full = done === total && total > 0
  return (
    <div
      className="rounded-2xl px-4 py-3.5"
      style={{
        background: full
          ? 'linear-gradient(135deg,rgba(34,197,94,0.07) 0%,rgba(16,185,129,0.03) 100%)'
          : 'rgba(124,58,237,0.06)',
        border: full
          ? '1px solid rgba(34,197,94,0.18)'
          : '1px solid rgba(124,58,237,0.14)',
        transition: 'background 0.4s ease, border-color 0.4s ease',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: full ? '#4ade80' : '#9080C0', fontFamily: 'var(--font-sport)' }}>
          {done === 0 ? 'Elige tus picks' : done < total ? `${done} de ${total} elegidos` : '¡Todo listo! Confirma →'}
        </span>
        <span
          className="text-[11px] font-black tabular-nums"
          style={{ color: full ? '#22c55e' : '#A78BFA', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
        >
          {pct}%
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: full ? 'linear-gradient(to right,#22c55e,#4ade80)' : 'linear-gradient(to right,#7C3AED,#A78BFA)',
          borderRadius: 999, transition: 'width 0.35s ease, background 0.4s ease',
          boxShadow: full ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(124,58,237,0.4)',
        }} />
      </div>
    </div>
  )
}
