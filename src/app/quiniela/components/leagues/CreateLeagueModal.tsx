'use client'

import { useState } from 'react'
import type { QuinielaMatch } from '@/components/QuinielaModule'
import { LEAGUES_KEY } from '../../lib/constants'
import { getPlayerAlias, setPlayerAlias } from '../../lib/helpers'
import type { League } from '../../lib/types'
import { JerseyIcon } from '../atoms/TeamBadge'

// ─────────────────────────────────────────────────────────────────
// Modal: Crear liga
// ─────────────────────────────────────────────────────────────────
type CreateStep = 'name' | 'matches' | 'done'

export function CreateLeagueModal({ onClose, onCreated, apiMatches, apiJornada }: {
  onClose: () => void
  onCreated: (l: League) => void
  apiMatches: QuinielaMatch[]
  apiJornada: string
}) {
  const [step, setStep]               = useState<CreateStep>('name')
  const [name, setName]               = useState('')
  const [alias, setAlias]             = useState(() => getPlayerAlias())
  const [selectedMatches, setMatches] = useState<number[]>([])
  const [createdCode, setCreatedCode] = useState('')
  const [creating, setCreating]       = useState(false)
  const [copied, setCopied]           = useState(false)

  const toggleMatch = (i: number) =>
    setMatches((prev) => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

  const handleCreate = async () => {
    if (selectedMatches.length === 0 || creating) return
    if (alias.trim()) setPlayerAlias(alias)
    setCreating(true)
    try {
      const res = await fetch('/api/quiniela/leagues', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), jornada: apiJornada }),
      })
      const data = await res.json()
      const code = data.id as string

      const league: League = {
        id: code,
        name: data.name,
        competitionId: 'mixed',
        matchIds: selectedMatches,
        picks: {},
        submitted: false,
        createdAt: new Date().toISOString(),
        nickname: alias.trim() || undefined,
      }
      try {
        const raw = localStorage.getItem(LEAGUES_KEY)
        const existing = raw ? JSON.parse(raw) : []
        localStorage.setItem(LEAGUES_KEY, JSON.stringify([...existing, league]))
      } catch { /* ignore */ }
      setCreatedCode(code)
      onCreated(league)
      setStep('done')
    } finally {
      setCreating(false)
    }
  }

  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiniela?liga=${createdCode}` : ''

  const copyLink = () => {
    navigator.clipboard?.writeText(inviteUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const stepDots: CreateStep[] = ['name', 'matches']

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg,#12001E 0%,#0A0016 60%,#06000F 100%)',
          border: '1px solid rgba(124,58,237,0.3)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,58,237,0.1)',
        }}
      >
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
          <div>
            <p className="font-black text-base" style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
              {step === 'done' ? '¡Liga creada!' : 'Nueva liga privada'}
            </p>
            {step !== 'done' && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {stepDots.map((s) => (
                  <div key={s} style={{ width: step === s ? 16 : 6, height: 4, borderRadius: 2, background: step === s ? '#7C3AED' : 'rgba(255,255,255,0.1)', transition: 'width 0.25s, background 0.25s' }} />
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: '#5A5A6A' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">

          {/* ── Paso 1: Nombre ── */}
          {step === 'name' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                  Tu nombre · visible para el resto
                </label>
                <input
                  autoFocus
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.slice(0, 24))}
                  placeholder="Ej: Kun, Marta, ElPibe10..."
                  className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1.5px solid rgba(255,255,255,0.08)',
                    color: '#E0E0F0',
                    fontFamily: 'var(--font-display)',
                  }}
                />
                <p className="text-[10px] mt-1.5" style={{ color: '#2E2E48', fontFamily: 'var(--font-sport)' }}>
                  Así te verán tus amigos en el ranking de la liga.
                </p>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                  Nombre de la liga
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && alias.trim() && setStep('matches')}
                  placeholder="Ej: Liga del trabajo, Familia..."
                  className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1.5px solid rgba(255,255,255,0.08)',
                    color: '#E0E0F0',
                    fontFamily: 'var(--font-display)',
                  }}
                />
                <p className="text-[10px] mt-1.5" style={{ color: '#2E2E48', fontFamily: 'var(--font-sport)' }}>
                  Puedes dejarlo en blanco para un nombre automático.
                </p>
              </div>
              <button
                onClick={() => { if (!alias.trim()) return; setPlayerAlias(alias); setStep('matches') }}
                disabled={!alias.trim()}
                className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest transition-opacity hover:opacity-85"
                style={{
                  background: alias.trim() ? 'linear-gradient(135deg,#7C3AED,#5B21B6)' : 'rgba(255,255,255,0.04)',
                  color: alias.trim() ? '#fff' : '#3A3A52',
                  fontSize: 12, fontFamily: 'var(--font-sport)', letterSpacing: '0.09em',
                  boxShadow: alias.trim() ? '0 6px 20px rgba(124,58,237,0.35)' : 'none',
                  cursor: alias.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Siguiente →
              </button>
            </div>
          )}

          {/* ── Paso 2: Partidos ── */}
          {step === 'matches' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Selecciona los partidos de la quiniela. Mínimo 1.
              </p>

              {apiMatches.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--text-faint)' }}>
                  No hay partidos disponibles esta semana.
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 scrollbar-hide">
                  {apiMatches.map((m, i) => {
                    const sel = selectedMatches.includes(i)
                    return (
                      <button
                        key={i}
                        onClick={() => m.away && toggleMatch(i)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                        style={{
                          background: sel ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)',
                          border: sel ? '1.5px solid rgba(124,58,237,0.35)' : '1.5px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div className="flex-shrink-0 w-4.5 h-4.5 rounded-md flex items-center justify-center" style={{ width: 18, height: 18, background: sel ? '#7C3AED' : 'rgba(255,255,255,0.05)', border: sel ? '1px solid #7C3AED' : '1px solid rgba(255,255,255,0.1)' }}>
                          {sel && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <JerseyIcon name={m.home} size={18} />
                          <JerseyIcon name={m.away ?? ''} size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black" style={{ color: sel ? '#D0C0FF' : '#A0A0C0', fontFamily: 'var(--font-display)' }}>
                            {m.home} <span style={{ color: '#252540' }}>vs</span> {m.away ?? '—'}
                          </p>
                          <p className="text-[9px]" style={{ color: '#2E2E48', fontFamily: 'var(--font-sport)' }}>
                            {m.comp} · {m.time}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-between text-[10px]" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>
                <button onClick={() => setMatches(apiMatches.map((_, i) => i))} style={{ background: 'none', border: 'none', color: '#5A5A7A', cursor: 'pointer', fontFamily: 'var(--font-sport)', fontSize: 10 }}>
                  Seleccionar todos
                </button>
                <span>{selectedMatches.length} seleccionados</span>
              </div>

              <div className="flex gap-2.5">
                <button onClick={() => setStep('name')} className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.04)', color: '#5A5A7A', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-sport)' }}>
                  Atrás
                </button>
                <button
                  onClick={handleCreate}
                  disabled={selectedMatches.length === 0 || creating}
                  className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-opacity"
                  style={{
                    background: selectedMatches.length > 0 ? 'linear-gradient(135deg,#7C3AED,#5B21B6)' : 'rgba(255,255,255,0.03)',
                    color: selectedMatches.length > 0 ? '#fff' : '#252535',
                    border: selectedMatches.length > 0 ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.05)',
                    fontFamily: 'var(--font-sport)',
                    cursor: selectedMatches.length > 0 && !creating ? 'pointer' : 'not-allowed',
                  }}
                >
                  {creating ? 'Creando…' : 'Crear liga →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Done: código de invitación ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center text-center gap-5 py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13L9 17L19 7" stroke="#A78BFA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="font-black text-base mb-1" style={{ color: '#E0E0F8', fontFamily: 'var(--font-display)' }}>¡Liga creada!</p>
                <p className="text-sm mb-0" style={{ color: 'var(--text-muted)' }}>Comparte este código con tus amigos:</p>
              </div>

              {/* Código */}
              <div className="w-full px-5 py-4 rounded-2xl flex items-center justify-between gap-3" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <span className="font-black text-2xl tracking-[0.25em]" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)', letterSpacing: '0.2em' }}>{createdCode}</span>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all"
                  style={{ background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(124,58,237,0.15)', color: copied ? '#4ade80' : '#A78BFA', border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(124,58,237,0.3)', fontFamily: 'var(--font-sport)' }}
                >
                  {copied ? '✓ Copiado' : 'Copiar link'}
                </button>
              </div>
              <p className="text-[10px]" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>
                Tus amigos podrán unirse en <span style={{ color: '#5A4878' }}>takasports.com/quiniela?liga={createdCode}</span>
              </p>

              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', fontSize: 12, fontFamily: 'var(--font-sport)', letterSpacing: '0.09em', boxShadow: '0 6px 20px rgba(124,58,237,0.35)' }}
              >
                Ver mis ligas
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
