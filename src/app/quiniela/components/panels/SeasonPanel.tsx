'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { GoogleSignInButton } from '../atoms/GoogleSignInButton'

// ─────────────────────────────────────────────────────────────────
// Season Predictions Panel
// ─────────────────────────────────────────────────────────────────
interface SeasonQuestion {
  id: string
  competition: string
  season: string
  question: string
  options: Array<{ value: string; label: string; logo?: string }>
  closes_at: string
  resolved: string | null
  /** Monedas que recibe el user si acierta (escalado por dificultad). */
  prize_coins?: number
  /** ID del torneo agrupador (ej. 'mundial2026') — para badges. */
  tournament?: string | null
}

export function SeasonPanel({ user }: { user: User | null }) {
  const [questions, setQuestions] = useState<SeasonQuestion[]>([])
  const [mine, setMine] = useState<Record<string, string>>({})
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    fetch('/api/quiniela/season')
      .then(r => r.ok ? r.json() : { questions: [], mine: {}, authed: false })
      .then(data => {
        setQuestions(data.questions ?? [])
        setMine(data.mine ?? {})
        setAuthed(data.authed ?? false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  async function pickAnswer(questionId: string, answer: string) {
    if (!authed && !user) { setShowAuth(true); return }
    setSaving(questionId)
    try {
      const res = await fetch('/api/quiniela/season', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId, answer }),
      })
      if (res.ok) setMine(prev => ({ ...prev, [questionId]: answer }))
    } catch { /* ignore */ }
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl h-32 animate-pulse" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} />
        ))}
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 32 }}>🔮</span>
        <p className="font-black text-sm" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>Predicciones de temporada</p>
        <p className="text-xs" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          Las preguntas de temporada aparecerán aquí cuando el admin las active.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="section-accent" />
        <h2 className="section-label">Predicciones de temporada</h2>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.1)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)' }}>
          {questions.filter(q => !q.resolved).length} activas
        </span>
      </div>

      {questions.map(q => {
        const closed = new Date(q.closes_at).getTime() <= Date.now()
        const myAnswer = mine[q.id]
        const isSaving = saving === q.id

        return (
          <div key={q.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {/* Header */}
            <div className="px-5 py-3.5 flex items-start justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                    {q.competition} · {q.season}
                  </p>
                  {/* Chip de PREMIO — destacado para incentivar predicción */}
                  {(q.prize_coins ?? 0) > 0 && (
                    <span
                      className="text-[9px] font-black tabular-nums px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', fontFamily: 'var(--font-sport)' }}
                      title="Monedas que recibís si acertás esta pregunta"
                    >
                      +{q.prize_coins}🪙 si acertás
                    </span>
                  )}
                </div>
                <p className="text-sm font-black leading-snug" style={{ color: '#D0D0F0', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                  {q.question}
                </p>
              </div>
              {q.resolved ? (
                <span className="flex-shrink-0 text-[9px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)', fontFamily: 'var(--font-sport)' }}>
                  Resuelta
                </span>
              ) : closed ? (
                <span className="flex-shrink-0 text-[9px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', fontFamily: 'var(--font-sport)' }}>
                  Cerrada
                </span>
              ) : (
                <span className="flex-shrink-0 text-[9px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.1)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)' }}>
                  Abierta
                </span>
              )}
            </div>

            {/* Options */}
            <div className="px-4 py-3 flex flex-col gap-1.5">
              {q.options.map(opt => {
                const selected = myAnswer === opt.value
                const isWinner = q.resolved === opt.value
                const isWrong  = !!q.resolved && selected && !isWinner

                let bg = 'rgba(255,255,255,0.02)'
                let border = '1px solid transparent'
                let color = '#4A4A6A'
                if (isWinner) { bg = 'rgba(34,197,94,0.08)'; border = '1px solid rgba(34,197,94,0.25)'; color = '#4ade80' }
                else if (isWrong)  { bg = 'rgba(239,68,68,0.07)'; border = '1px solid rgba(239,68,68,0.2)'; color = '#f87171' }
                else if (selected) { bg = 'rgba(124,58,237,0.1)'; border = '1px solid rgba(124,58,237,0.3)'; color = '#C4B5FD' }

                return (
                  <button
                    key={opt.value}
                    disabled={closed || !!q.resolved || isSaving}
                    onClick={() => pickAnswer(q.id, opt.value)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{ background: bg, border, cursor: closed || q.resolved ? 'default' : 'pointer', opacity: isSaving ? 0.6 : 1 }}
                  >
                    {opt.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opt.logo} alt="" width={20} height={20} style={{ borderRadius: 4, objectFit: 'contain' }} />
                    )}
                    <span className="flex-1 text-[11px] font-semibold" style={{ color, fontFamily: 'var(--font-display)' }}>
                      {opt.label}
                    </span>
                    {selected && !q.resolved && (
                      <span style={{ fontSize: 9, color: '#7C3AED' }}>✓ Tu pick</span>
                    )}
                    {isWinner && selected && (q.prize_coins ?? 0) > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', fontFamily: 'var(--font-sport)' }}>
                        +{q.prize_coins}🪙
                      </span>
                    )}
                    {isWinner && <span style={{ fontSize: 13 }}>🏆</span>}
                    {isWrong  && <span style={{ fontSize: 11, color: '#f87171' }}>✗</span>}
                  </button>
                )
              })}
            </div>

            {!authed && !closed && !q.resolved && (
              <div className="px-4 pb-3">
                <button
                  onClick={() => setShowAuth(true)}
                  className="w-full py-2 rounded-xl text-[10px] font-black transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(124,58,237,0.08)', color: '#9B7CF6', border: '1px solid rgba(124,58,237,0.18)', fontFamily: 'var(--font-sport)' }}
                >
                  Inicia sesión para guardar tu predicción
                </button>
              </div>
            )}

            {/* Closes at */}
            {!q.resolved && (
              <div className="px-5 pb-3">
                <p className="text-[8px]" style={{ color: '#252535', fontFamily: 'var(--font-sport)' }}>
                  {closed ? 'Cerrada el' : 'Cierra el'}{' '}
                  {new Date(q.closes_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                </p>
              </div>
            )}
          </div>
        )
      })}

      {showAuth && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowAuth(false)}
        >
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-3" style={{ background: '#110020', border: '1px solid rgba(124,58,237,0.3)' }} onClick={e => e.stopPropagation()}>
            <p className="font-black text-base" style={{ color: '#D0C0FF', fontFamily: 'var(--font-display)' }}>Accede para votar</p>
            <p className="text-xs" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>Tus predicciones de temporada se guardan en tu cuenta.</p>
            <GoogleSignInButton onClose={() => setShowAuth(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
