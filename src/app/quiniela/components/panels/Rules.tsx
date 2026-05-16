'use client'

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────
// Cómo funciona
// ─────────────────────────────────────────────────────────────────
export function Rules() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-left" style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)' }}>Cómo funciona</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          {[
            'Elige 1 (local), X (empate) o 2 (visitante) para cada partido.',
            'Cierra antes del comienzo del primer partido de la jornada.',
            'Acumula puntos por cada resultado acertado.',
            'Crea ligas privadas e invita a amigos para competir entre vosotros.',
            'El ranking se publica al final de cada jornada.',
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3 pt-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5" style={{ background: 'rgba(124,58,237,0.12)', color: '#9B7CF6' }}>{i + 1}</span>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{rule}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
