'use client'

import { useState, useEffect } from 'react'
import { CalendarIcon } from '@/components/icons/GameIcons'

export interface QuinielaMatch {
  home: string
  away: string
  comp?: string
  time?: string
  isoDate?: string
  odds?: { home: number; draw: number; away: number }
  /** Origen de las cuotas: 'bookmaker' = the-odds-api, 'internal' = sistema interno (standings ESPN + neutrales). */
  oddsSource?: 'bookmaker' | 'internal'
  /** Slug ESPN de la competición (necesario para summary endpoint y standings). */
  leagueSlug?: string
  /** El partido destacado de la jornada — usado para el feature de goleador. */
  isFeatured?: boolean
  espnId?: string
  homeLogo?: string
  awayLogo?: string
  homeAbbr?: string
  awayAbbr?: string
  homeShort?: string
  awayShort?: string
}

export const QUINIELA_PICKS_KEY = 'ts_quiniela_picks'

// 'open' = picks editables · 'started' = partidos en curso, bloqueado · 'finished' = jornada cerrada
export const MATCH_STATUS: 'open' | 'started' | 'finished' = 'open'

export type Pick = '1' | 'X' | '2' | '1X' | 'X2'

export type QuinielaSaved = {
  jornada: string
  picks: { home: string; away: string; pick: Pick; oddsAtPick?: number; stake?: number }[]
}

// Sin fallback estático: si /api/quiniela aún no responde mostramos "Cargando…",
// si responde vacío mostramos "Sin partidos esta semana".
export const QUINIELA_MATCHES: QuinielaMatch[] = []
export const QUINIELA_JORNADA = 'Esta semana'

function TeamLogo({ name, logo }: { name: string; logo?: string }) {
  const [err, setErr] = useState(false)
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={name}
        width={18}
        height={18}
        onError={() => setErr(true)}
        style={{ objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      style={{
        width: 18, height: 18, borderRadius: 4,
        background: 'rgba(124,58,237,0.18)',
        border: '1px solid rgba(124,58,237,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7, fontWeight: 900, color: '#A78BFA', flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </span>
  )
}

function PredictionModal({
  matches, jornada, onClose,
}: {
  matches: QuinielaMatch[]
  jornada: string
  onClose: (submitted?: boolean) => void
}) {
  const [picks, setPicks] = useState<Record<number, Pick>>({})
  const [submitted, setSubmitted] = useState(false)

  const allPicked = matches.every((_, i) => picks[i] !== undefined)
  const PICK_OPTIONS: Pick[] = ['1', 'X', '2']
  const PICK_LABELS: Record<Pick, string> = { '1': 'Local', X: 'Empate', '2': 'Visitante', '1X': 'Loc/Emp', 'X2': 'Emp/Vis' }
  const PICK_COLOR: Record<Pick, string> = { '1': '#22c55e', X: '#f59e0b', '2': '#ef4444', '1X': '#6ee7b7', 'X2': '#fb923c' }

  const handleSubmit = () => {
    if (!allPicked) return
    const saved: QuinielaSaved = {
      jornada,
      picks: matches.map((m, i) => ({ home: m.home, away: m.away, pick: picks[i] })),
    }
    try { localStorage.setItem(QUINIELA_PICKS_KEY, JSON.stringify(saved)) } catch { /* ignore */ }
    // Sincroniza al servidor — falla silenciosamente si no hay sesión
    fetch('/api/quiniela/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jornada, picks: saved.picks }),
    }).catch(() => { /* ok offline */ })
    setSubmitted(true)
  }

  return (
    <div className="quiniela-modal-backdrop" onClick={() => onClose(submitted)}>
      <div
        className="w-full relative"
        style={{ maxWidth: 460, borderRadius: 20, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            background: 'linear-gradient(160deg,#1A0030 0%,#120025 50%,#08000F 100%)',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 blur-3xl opacity-15 pointer-events-none" style={{ background: '#7C3AED' }} />

          {submitted ? (
            <div className="px-6 py-8 text-center relative z-10">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13L9 17L19 7" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-lg font-black mb-1" style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5', letterSpacing: '-0.01em' }}>
                ¡Predicción enviada!
              </h3>
              <p className="text-sm mb-5" style={{ color: '#9090A4' }}>Tus picks para {jornada}</p>
              <button onClick={() => onClose(true)} className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.06)', color: '#9090A4', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cerrar
              </button>
            </div>
          ) : (
            <div className="relative z-10">
              <div className="px-5 pt-5 pb-4 flex items-start justify-between" style={{ borderBottom: '1px solid rgba(124,58,237,0.12)' }}>
                <div>
                  <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5', letterSpacing: '-0.01em' }}>
                    Quiniela · {jornada}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: '#5A4878' }}>Selecciona el resultado de cada partido</p>
                </div>
                <button onClick={() => onClose(false)} className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)', color: '#5A5A6A' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-4 flex flex-col gap-4">
                {matches.map((m, i) => {
                  const oddsValues = m.odds
                    ? [m.odds.home, m.odds.draw, m.odds.away]
                    : [null, null, null]
                  return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-right flex-1 truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>{m.home}</span>
                      <div className="flex flex-col items-center mx-2 flex-shrink-0">
                        <span className="text-[9px] font-black px-3 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: '#3A3A50', letterSpacing: '0.05em' }}>VS</span>
                        {m.comp && <span className="text-[8px] mt-0.5" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>{m.comp}</span>}
                      </div>
                      <span className="text-xs font-black text-left flex-1 truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>{m.away}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {PICK_OPTIONS.map((opt, oi) => {
                        const selected = picks[i] === opt
                        const col = PICK_COLOR[opt]
                        const odd = oddsValues[oi]
                        return (
                          <button
                            key={opt}
                            onClick={() => setPicks((p) => ({ ...p, [i]: opt }))}
                            className="rounded-xl font-black transition-all flex flex-col items-center justify-center gap-0.5"
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: 15,
                              minHeight: 52,
                              background: selected ? `${col}22` : 'rgba(255,255,255,0.04)',
                              color: selected ? col : '#4A4A6A',
                              border: selected ? `1px solid ${col}55` : '1px solid rgba(255,255,255,0.06)',
                              boxShadow: selected ? `0 0 14px ${col}30` : 'none',
                              transform: selected ? 'scale(1.04)' : 'scale(1)',
                            }}
                          >
                            <span>{opt}</span>
                            {odd ? (
                              <span style={{ fontSize: 9, fontFamily: 'var(--font-sport)', color: selected ? col : '#5A5A7A', opacity: 0.9 }}>{odd.toFixed(2)}</span>
                            ) : (
                              <span style={{ fontSize: 8, fontFamily: 'var(--font-sport)', opacity: 0.6 }}>{PICK_LABELS[opt]}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  )
                })}
              </div>

              <div className="px-5 pb-5">
                <button
                  onClick={handleSubmit}
                  disabled={!allPicked}
                  className="w-full py-3 rounded-xl font-black uppercase tracking-widest transition-all"
                  style={{
                    background: allPicked ? 'linear-gradient(135deg,#7C3AED,#5B21B6)' : 'rgba(255,255,255,0.04)',
                    color: allPicked ? '#fff' : '#3A3A4A',
                    border: allPicked ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.05)',
                    fontSize: 12,
                    fontFamily: 'var(--font-sport)',
                    letterSpacing: '0.08em',
                    boxShadow: allPicked ? '0 4px 18px rgba(124,58,237,0.3)' : 'none',
                    cursor: allPicked ? 'pointer' : 'not-allowed',
                  }}
                >
                  {allPicked ? 'Confirmar predicción →' : `Elige ${matches.length - Object.keys(picks).length} partido${matches.length - Object.keys(picks).length !== 1 ? 's' : ''} más`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function QuinielaModule() {
  const [showModal, setShowModal] = useState(false)
  const [alreadyVoted, setAlreadyVoted] = useState(false)
  const [matches, setMatches] = useState<QuinielaMatch[]>(QUINIELA_MATCHES)
  const [jornada, setJornada] = useState(QUINIELA_JORNADA)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/quiniela')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setLoaded(true)
        if (data?.matches?.length) {
          setMatches(data.matches)
          setJornada(data.jornada)
          try {
            const raw = localStorage.getItem(QUINIELA_PICKS_KEY)
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed?.picks && Array.isArray(parsed.picks) && parsed.jornada === data.jornada) {
                setAlreadyVoted(true)
              } else {
                localStorage.removeItem(QUINIELA_PICKS_KEY)
              }
            }
          } catch { /* ignore */ }
        } else {
          setMatches([])
        }
      })
      .catch(() => { setLoaded(true) })
  }, [])

  const handleClose = (submitted?: boolean) => {
    if (submitted) setAlreadyVoted(true)
    setShowModal(false)
  }

  return (
    <>
      <div
        id="quiniela"
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: 'rgba(124,58,237,0.04)',
          border: '1px solid rgba(124,58,237,0.14)',
        }}
      >
        <div className="px-4 pt-3.5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.22)' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.3" />
                <rect x="8" y="1" width="5" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.3" />
                <rect x="1" y="8" width="5" height="5" rx="1" stroke="#A78BFA" strokeWidth="1.3" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="#7C3AED" stroke="#7C3AED" strokeWidth="1.3" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-black" style={{ color: '#fff', fontFamily: 'var(--font-sport)' }}>Quiniela</p>
              <p className="text-[10px]" style={{ color: '#7a7a92' }}>{jornada}</p>
            </div>
          </div>
          {MATCH_STATUS === 'open' && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1" style={{ background: 'rgba(124,58,237,0.12)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.25)', fontFamily: 'var(--font-sport)' }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#A78BFA' }} />
              Abierta
            </span>
          )}
        </div>

        <div className="px-4 py-3 flex flex-col gap-1.5 relative z-10">
          {matches.length > 0 ? matches.map((m, i) => (
            <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                <span className="text-[11px] font-black truncate" style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}>{m.homeShort ?? m.home}</span>
                <TeamLogo name={m.home} logo={m.homeLogo} />
              </div>
              <span className="flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded-lg" style={{ background: 'rgba(124,58,237,0.1)', color: '#4A4A6A', minWidth: 28, textAlign: 'center' }}>VS</span>
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                <TeamLogo name={m.away} logo={m.awayLogo} />
                <span className="text-[11px] font-black truncate" style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}>{m.awayShort ?? m.away}</span>
              </div>
            </div>
          )) : loaded ? (
            <div className="py-5 flex flex-col items-center gap-1.5">
              <span style={{ color: '#4A4A6A' }}><CalendarIcon size={26} /></span>
              <p className="text-xs font-black" style={{ color: '#4A4A6A', fontFamily: 'var(--font-display)' }}>Sin partidos esta semana</p>
              <p className="text-[10px]" style={{ color: '#3A3A58' }}>Vuelve cuando haya jornada activa</p>
            </div>
          ) : (
            <div className="py-5 flex items-center justify-center">
              <span className="text-[10px] animate-pulse" style={{ color: '#3A3A58' }}>Cargando…</span>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 relative z-10">
          {alreadyVoted ? (
            <div className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M5 13L9 17L19 7" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: '#4ade80', fontFamily: 'var(--font-sport)' }}>Predicción enviada</span>
            </div>
          ) : matches.length === 0 ? null : (
            <button
              onClick={() => setShowModal(true)}
              className="w-full py-2.5 rounded-xl font-black transition-colors hover:bg-purple-500/15"
              style={{
                background: 'rgba(124,58,237,0.10)',
                color: '#A78BFA',
                fontSize: 11,
                fontFamily: 'var(--font-sport)',
                letterSpacing: '0.05em',
                border: '1px solid rgba(124,58,237,0.28)',
              }}
            >
              Hacer predicción →
            </button>
          )}
        </div>
      </div>

      {showModal && <PredictionModal matches={matches} jornada={jornada} onClose={handleClose} />}
    </>
  )
}
