'use client'

import { useState } from 'react'
import type { CoinTxn } from '../../lib/types'
import TakaPoint from '@/components/TakaPoint'

// ─────────────────────────────────────────────────────────────────
// Wallet de puntos (legacy CoinWallet — la variable interna sigue
// llamándose `coins` por historia del código, pero el user solo ve
// "puntos" como concepto unificado).
// ─────────────────────────────────────────────────────────────────
export function CoinWallet({ balance, txns }: { balance: number; txns: CoinTxn[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid rgba(251,191,36,0.2)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-opacity hover:opacity-90"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.28)' }}>
          <TakaPoint size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}>Puntos</p>
          <p className="font-black leading-none tabular-nums" style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#fbbf24', letterSpacing: '-0.02em' }}>
            {balance.toLocaleString()}
          </p>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: '#4A4A2A', flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Rewards reference */}
      {!open && (
        <div className="px-5 pb-4 flex flex-wrap gap-1.5">
          {[
            { label: 'Pick correcto', val: '+10' },
            { label: 'Capitán correcto', val: '+20' },
            { label: 'Marcador exacto', val: '+50' },
            { label: 'Pleno', val: '+100' },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)' }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: '#fbbf24', fontFamily: 'var(--font-sport)' }}>{r.val}</span>
              <span style={{ fontSize: 7.5, color: '#5A4A1A', fontFamily: 'var(--font-sport)' }}>{r.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Transaction history */}
      {open && (
        <div className="px-5 pb-4" style={{ borderTop: '1px solid rgba(251,191,36,0.1)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2 pt-3" style={{ color: '#4A3A10', fontFamily: 'var(--font-sport)' }}>
            Últimas transacciones
          </p>
          {txns.length === 0 ? (
            <p className="text-[10px]" style={{ color: '#3A3A40', fontFamily: 'var(--font-sport)' }}>
              Sin historial aún · ¡juega tu primera jornada!
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {txns.slice(0, 6).map((t, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: 8, fontWeight: 900, fontFamily: 'var(--font-sport)', color: t.amount >= 0 ? '#4ade80' : '#f87171', minWidth: 32, textAlign: 'right' }}>
                    {t.amount >= 0 ? '+' : ''}{t.amount}
                  </span>
                  <span className="flex-1 text-[9px]" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}>{t.reason}</span>
                  <span style={{ fontSize: 7.5, color: '#2A2A3A', fontFamily: 'var(--font-sport)' }}>
                    {new Date(t.ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Comodín cost info */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <span style={{ fontSize: 13 }}>⚡</span>
            <span style={{ fontSize: 9, color: '#78550A', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>
              Comodín cuesta <span style={{ color: '#A78BFA', fontWeight: 900 }}>25 pts</span> · Desbloquea consenso anticipado <span style={{ color: '#A78BFA', fontWeight: 900 }}>10 pts</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
