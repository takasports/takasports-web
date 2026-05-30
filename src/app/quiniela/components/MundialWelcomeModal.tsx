'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────
// Modal de bienvenida al modo Mundial 2026.
//
// Aparece la PRIMERA vez que un user logueado entra a /quiniela
// durante la ventana del Mundial (auto-detectada por isMundial).
// Invita a hacer las 5 predicciones long-term ANTES de empezar
// a apostar partidos individuales — premios + badge "profeta".
//
// Comportamiento:
//   · Persiste un flag en localStorage para no aparecer dos veces.
//   · Si el user ya tiene predicciones registradas (>=1) en el
//     backend, no aparece (asume que ya pasó por el flow).
//   · Solo aparece si user autenticado (sin sesión no podría guardar).
//   · Acción "Hacer mis predicciones" cambia el tab activo a 'season'
//     y cierra el modal. Acción "Más tarde" solo cierra y marca visto.
// ─────────────────────────────────────────────────────────────────

const FLAG_KEY = 'ts_quiniela_mundial_welcomed_v1'

interface QuestionPreview {
  id: string
  question: string
  prize_coins: number
}

export function MundialWelcomeModal({
  user,
  isMundial,
  onGoToPredictions,
}: {
  user: User | null
  isMundial: boolean
  onGoToPredictions: () => void
}) {
  const [shouldShow, setShouldShow] = useState(false)
  const [questions, setQuestions] = useState<QuestionPreview[]>([])
  const [alreadyAnswered, setAlreadyAnswered] = useState<number>(0)

  useEffect(() => {
    if (!user || !isMundial) { setShouldShow(false); return }
    // Si el flag local está, no mostrar
    let dismissed = false
    try {
      dismissed = !!localStorage.getItem(FLAG_KEY)
    } catch { /* ignore */ }
    if (dismissed) return

    // Chequear backend: si ya tiene predicciones, no abrumar
    let cancelled = false
    fetch('/api/quiniela/season', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return
        const qs = (data.questions as { id: string; question: string; prize_coins?: number; tournament?: string | null }[] | undefined) ?? []
        const mundialQs = qs.filter(q => q.tournament === 'mundial2026')
        const mineCount = Object.keys(data.mine ?? {}).filter(qid =>
          mundialQs.some(mq => mq.id === qid)
        ).length

        if (mundialQs.length === 0) return        // sin preguntas → no hay nada que mostrar
        if (mineCount >= mundialQs.length) return // ya respondió todas → no estorbar

        setQuestions(mundialQs.map(q => ({
          id: q.id,
          question: q.question,
          prize_coins: q.prize_coins ?? 0,
        })).sort((a, b) => b.prize_coins - a.prize_coins))
        setAlreadyAnswered(mineCount)
        setShouldShow(true)
      })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [user, isMundial])

  function dismiss() {
    try { localStorage.setItem(FLAG_KEY, '1') } catch { /* ignore */ }
    setShouldShow(false)
  }

  function goToPredictions() {
    dismiss()
    onGoToPredictions()
  }

  if (!shouldShow) return null

  const totalPrize = questions.reduce((sum, q) => sum + q.prize_coins, 0)
  const pending = questions.length - alreadyAnswered

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)' }}
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(165deg, #1A0B30 0%, #0B0218 100%)',
          border: '1px solid rgba(245,158,11,0.35)',
          boxShadow: '0 30px 80px rgba(180,83,9,0.25), inset 0 1px 0 rgba(251,191,36,0.12)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center gap-3"
          style={{ borderBottom: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}
        >
          <span style={{ fontSize: 32, lineHeight: 1 }}>🏆</span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#fbbf24', fontFamily: 'var(--font-sport)' }}>
              Copa 2026
            </p>
            <p className="font-black text-lg" style={{ color: '#F8F8FF', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
              Antes de empezar, predecí el Mundial
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-[13px] leading-relaxed" style={{ color: '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
            Tenés {pending} predicción{pending !== 1 ? 'es' : ''} long-term del Mundial. Se votan
            <strong style={{ color: '#FBE4B0' }}> antes del 11 de junio</strong>, se resuelven al final del torneo.
          </p>

          {/* Lista de preguntas */}
          <div className="flex flex-col gap-1.5">
            {questions.map(q => (
              <div
                key={q.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="flex-1 text-[12px] font-bold truncate" style={{ color: '#D0D0F0', fontFamily: 'var(--font-display)' }}>
                  {q.question.replace(/^¿/, '').replace(/\?$/, '')}
                </span>
                <span className="text-[11px] font-black tabular-nums flex-shrink-0" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)' }}>
                  +{q.prize_coins} pts
                </span>
              </div>
            ))}
          </div>

          {/* Resumen del premio */}
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)' }}>
            <span style={{ fontSize: 22 }}>💰</span>
            <div className="flex-1">
              <p className="text-[11px] font-black" style={{ color: '#FBE4B0', fontFamily: 'var(--font-display)' }}>
                Si acertás las 5
              </p>
              <p className="text-[10px]" style={{ color: '#8A6B30', fontFamily: 'var(--font-sport)' }}>
                Hasta {totalPrize} pts + badge &quot;Profeta del Mundial 2026&quot;
              </p>
            </div>
          </div>

          {/* Botones */}
          <div className="grid grid-cols-[1fr_2fr] gap-2 pt-1">
            <button
              type="button"
              onClick={dismiss}
              className="py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#7A7A98', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
            >
              Más tarde
            </button>
            <button
              type="button"
              onClick={goToPredictions}
              className="py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                color: '#1A0B30',
                border: '1px solid rgba(251,191,36,0.5)',
                fontFamily: 'var(--font-sport)',
                boxShadow: '0 6px 22px rgba(245,158,11,0.35)',
                cursor: 'pointer',
                letterSpacing: '0.08em',
              }}
            >
              Hacer mis predicciones
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
