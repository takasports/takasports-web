'use client'

import { useState } from 'react'

const QUINIELA_MATCHES = [
  { home: 'Real Madrid', away: 'Barça'   },
  { home: 'Atlético',    away: 'Sevilla' },
  { home: 'Valencia',    away: 'Betis'   },
]

type Pick = '1' | 'X' | '2'

function PredictionModal({
  onClose,
}: {
  onClose: () => void
}) {
  const [picks, setPicks] = useState<Record<number, Pick>>({})
  const [submitted, setSubmitted] = useState(false)

  const allPicked = QUINIELA_MATCHES.every((_, i) => picks[i] !== undefined)

  const handleSubmit = () => {
    if (allPicked) setSubmitted(true)
  }

  const PICK_OPTIONS: Pick[] = ['1', 'X', '2']
  const PICK_LABELS: Record<Pick, string> = { '1': 'Local', 'X': 'Empate', '2': 'Visitante' }

  return (
    <div className="quiniela-modal-backdrop" onClick={onClose}>
      <div
        className="w-full relative"
        style={{ maxWidth: 480, borderRadius: 20, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fondo con glow */}
        <div
          style={{
            background: 'linear-gradient(150deg,#1E1040 0%,#130D32 50%,#0F0A1E 100%)',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          {/* Glow */}
          <div
            className="absolute -top-12 -right-12 w-48 h-48 blur-3xl opacity-20 pointer-events-none"
            style={{ background: '#7C3AED' }}
          />

          {submitted ? (
            /* ── Estado: enviado ── */
            <div className="px-6 py-8 text-center relative z-10">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13L9 17L19 7" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3
                className="text-lg font-black mb-1"
                style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5', letterSpacing: '-0.01em' }}
              >
                ¡Predicción enviada!
              </h3>
              <p className="text-sm mb-6" style={{ color: '#9090A4' }}>
                Tus picks para la Jornada 38
              </p>
              <div className="flex flex-col gap-2 mb-6">
                {QUINIELA_MATCHES.map((m, i) => {
                  const pick = picks[i]
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-xl"
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <span className="text-xs" style={{ color: '#9090A4', fontFamily: 'var(--font-sport)' }}>
                        {m.home} vs {m.away}
                      </span>
                      <span
                        className="text-xs font-black px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(124,58,237,0.25)', color: '#C4B5FD' }}
                      >
                        {pick} · {PICK_LABELS[pick!]}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs mb-5" style={{ color: '#5A5A6A' }}>
                Las predicciones se confirmarán cuando arranque la jornada.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#9090A4', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Cerrar
              </button>
            </div>
          ) : (
            /* ── Estado: seleccionando ── */
            <div className="relative z-10">
              {/* Header */}
              <div
                className="px-5 pt-5 pb-4 flex items-start justify-between"
                style={{ borderBottom: '1px solid rgba(124,58,237,0.12)' }}
              >
                <div>
                  <h3
                    className="text-base font-black"
                    style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5', letterSpacing: '-0.01em' }}
                  >
                    Quiniela · Jornada 38
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: '#5A4878' }}>
                    Selecciona el resultado de cada partido
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#5A5A6A' }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Picks */}
              <div className="px-5 py-4 flex flex-col gap-3">
                {QUINIELA_MATCHES.map((m, i) => (
                  <div key={i}>
                    {/* Partido */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
                        {m.home}
                      </span>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#4A4A5A' }}>
                        VS
                      </span>
                      <span className="text-xs font-semibold" style={{ color: '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
                        {m.away}
                      </span>
                    </div>
                    {/* Opciones 1/X/2 */}
                    <div className="grid grid-cols-3 gap-2">
                      {PICK_OPTIONS.map((opt) => {
                        const selected = picks[i] === opt
                        return (
                          <button
                            key={opt}
                            onClick={() => setPicks((prev) => ({ ...prev, [i]: opt }))}
                            className="py-2 rounded-xl font-black text-sm transition-all"
                            style={{
                              fontFamily: 'var(--font-display)',
                              background: selected
                                ? 'linear-gradient(135deg,#7C3AED,#6025C0)'
                                : 'rgba(255,255,255,0.05)',
                              color: selected ? '#fff' : '#5A5A6A',
                              border: selected
                                ? '1px solid rgba(124,58,237,0.5)'
                                : '1px solid rgba(255,255,255,0.07)',
                              boxShadow: selected ? '0 2px 12px rgba(124,58,237,0.3)' : 'none',
                              transform: selected ? 'scale(1.02)' : 'scale(1)',
                            }}
                          >
                            {opt}
                          </button>
                        )
                      })}
                    </div>
                    {picks[i] && (
                      <p className="text-[10px] mt-1 text-center" style={{ color: '#7C3AED' }}>
                        {picks[i] === '1' ? m.home : picks[i] === '2' ? m.away : 'Empate'}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="px-5 pb-5">
                <button
                  onClick={handleSubmit}
                  disabled={!allPicked}
                  className="w-full py-3 rounded-xl font-black uppercase tracking-widest transition-all"
                  style={{
                    background: allPicked
                      ? 'linear-gradient(135deg,#7C3AED,#6025C0)'
                      : 'rgba(255,255,255,0.04)',
                    color: allPicked ? '#fff' : '#3A3A4A',
                    border: allPicked
                      ? '1px solid rgba(124,58,237,0.4)'
                      : '1px solid rgba(255,255,255,0.05)',
                    fontSize: 12,
                    fontFamily: 'var(--font-sport)',
                    letterSpacing: '0.08em',
                    boxShadow: allPicked ? '0 4px 18px rgba(124,58,237,0.3)' : 'none',
                    cursor: allPicked ? 'pointer' : 'not-allowed',
                  }}
                >
                  {allPicked
                    ? 'Confirmar predicción →'
                    : `Elige ${QUINIELA_MATCHES.length - Object.keys(picks).length} partido${QUINIELA_MATCHES.length - Object.keys(picks).length !== 1 ? 's' : ''} más`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Módulo principal ─────────────────────────────────────────
export default function QuinielaModule() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div
        id="quiniela"
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(150deg,#1E1040 0%,#150D35 40%,#0F0A20 100%)',
          border: '1px solid rgba(124,58,237,0.28)',
        }}
      >
        {/* Glow */}
        <div
          className="absolute -top-10 -right-10 w-44 h-44 blur-3xl opacity-25 pointer-events-none"
          style={{ background: '#7C3AED' }}
        />

        {/* Header */}
        <div
          className="px-4 pt-4 pb-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(124,58,237,0.1)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.28)' }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.3" />
                <rect x="8" y="1" width="5" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.3" />
                <rect x="1" y="8" width="5" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.3" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="#7C3AED" stroke="#7C3AED" strokeWidth="1.3" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
                Quiniela
              </p>
              <p className="text-[10px]" style={{ color: '#5A4878' }}>Jornada 38 · LaLiga</p>
            </div>
          </div>
          <span
            className="text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-wider flex-shrink-0"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            Activa
          </span>
        </div>

        {/* Preview partidos */}
        <div className="px-4 py-3 flex flex-col gap-2 relative z-10">
          {QUINIELA_MATCHES.map((m, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl"
              style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="flex-1 text-[11px] font-semibold truncate text-right" style={{ color: '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
                {m.home}
              </span>
              <span className="flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.12)', color: '#5A5A7A', minWidth: 28, textAlign: 'center' }}>
                VS
              </span>
              <span className="flex-1 text-[11px] font-semibold truncate" style={{ color: '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
                {m.away}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-4 pb-4 relative z-10">
          <button
            onClick={() => setShowModal(true)}
            className="w-full py-2.5 rounded-xl font-black uppercase tracking-widest transition-opacity hover:opacity-85"
            style={{
              background: 'linear-gradient(135deg,#7C3AED,#6025C0)',
              color: '#fff',
              fontSize: 11,
              fontFamily: 'var(--font-sport)',
              letterSpacing: '0.08em',
              boxShadow: '0 4px 18px rgba(124,58,237,0.32)',
            }}
          >
            Hacer predicción →
          </button>
        </div>
      </div>

      {showModal && <PredictionModal onClose={() => setShowModal(false)} />}
    </>
  )
}
