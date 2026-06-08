'use client'

import { useState, useEffect } from 'react'
import { trackGameComplete, trackPorraExactAdded, trackPorraExactRemoved } from '@/lib/analytics'
import { QUINIELA_PICKS_KEY } from '@/components/QuinielaModule'
import type { QuinielaMatch, QuinielaSaved, Pick } from '@/components/QuinielaModule'
import { TUTORED_KEY, LEAGUES_KEY, STREAK_KEY } from '../../lib/constants'
import type { League } from '../../lib/types'
import { ensurePlayerAlias, liveOdds } from '../../lib/helpers'
import { loadConsensus } from '../../lib/consensus'
import { nameMatch, SCORING } from '@/lib/quiniela'
import { ProgressBar } from '../atoms/ProgressBar'
import { MatchCard } from '../match/MatchCard'
import { ConsensusBar } from '../match/ConsensusBar'
import { OnboardingSheet } from './OnboardingSheet'
import { StreakHero } from './StreakHero'
import { QuickPickIA } from './QuickPickIA'
import { StickyBetslip } from './StickyBetslip'

export function PicksForm({
  matches, jornada, onSubmit, streakCurrent = 0, onParticipation,
  authed = false,
}: {
  matches: QuinielaMatch[]
  jornada: string
  onSubmit: (s: QuinielaSaved) => void
  streakCurrent?: number
  onParticipation?: (jornada: string) => void
  /** Hay sesión Supabase activa — sin auth no se persiste server-side. */
  authed?: boolean
}) {
  const [picks, setPicks]             = useState<Record<number, Pick>>({})
  // E3 — Marcador exacto opcional por pick. Mapa index → {home, away}.
  // Solo entradas presentes cuentan al MAX_EXACT_PER_JORNADA.
  const [exactScores, setExactScores] = useState<Record<number, { home: number; away: number }>>({})
  // Z2 — Tooltip de descubrimiento del marcador exacto. Visible una sola
  // vez por user, dismisseable con ✕ o usando el botón.
  const [exactTooltipDismissed, setExactTooltipDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' &&
        localStorage.getItem('porra:exactTooltipDismissed') === '1'
    } catch { return true }
  })
  function dismissExactTooltip() {
    if (exactTooltipDismissed) return
    setExactTooltipDismissed(true)
    try { localStorage.setItem('porra:exactTooltipDismissed', '1') } catch { /* */ }
  }
  // Picks que el user fijó explícitamente. Es UX para "confirmar y bajar
  // al siguiente" — compacta la card y permite enfoque en lo pendiente.
  // No es obligatorio fijar para sellar: el botón del sticky sella todos
  // los picks elegidos igualmente.
  const [fixedPicks, setFixedPicks]   = useState<Set<number>>(new Set())
  const [now, setNow]                 = useState(Date.now())
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [tutored, setTutored]         = useState(() => {
    try { return typeof window !== 'undefined' && !!localStorage.getItem(TUTORED_KEY) } catch { return true }
  })
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { if (!localStorage.getItem(TUTORED_KEY)) setShowOnboarding(true) } catch { /* */ }
  }, [])

  // Consume preselección depositada por el widget de la noticia (PorraMatchWidget):
  // si encontramos un partido cuyos nombres coinciden, lo seleccionamos como pick
  // inicial y le damos stake por defecto. Auto-scroll a la card del partido.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (matches.length === 0) return
    let raw: string | null = null
    try { raw = sessionStorage.getItem('porra:pendingPick') } catch { return }
    if (!raw) return
    try { sessionStorage.removeItem('porra:pendingPick') } catch { /* */ }
    try {
      const pending = JSON.parse(raw) as { home?: string; away?: string; pick?: Pick; ts?: number }
      if (!pending?.home || !pending?.away || !pending?.pick) return
      // Caducidad 5 min — evita arrastrar preselecciones viejas.
      if (typeof pending.ts === 'number' && Date.now() - pending.ts > 5 * 60_000) return
      const idx = matches.findIndex(
        (m) => nameMatch(m.home, pending.home!) && nameMatch(m.away, pending.away!),
      )
      if (idx < 0) return
      setPicks((prev) => (prev[idx] != null ? prev : { ...prev, [idx]: pending.pick! }))
      // Auto-scroll a la card del partido en el próximo tick.
      requestAnimationFrame(() => {
        const el = document.getElementById(`pick-card-${idx}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    } catch { /* JSON malformado — ignora */ }
  }, [matches])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(t)
  }, [])

  const openMatches = matches.filter(m => !m.isoDate || new Date(m.isoDate).getTime() > now)
  const done    = openMatches.filter((_, i) => picks[matches.indexOf(openMatches[i])] !== undefined).length
  const total   = openMatches.length
  const allDone = done === total && total > 0

  const nearestMs = openMatches.reduce((min, m) => {
    if (!m.isoDate) return min
    const diff = new Date(m.isoDate).getTime() - now
    return diff > 0 && diff < min ? diff : min
  }, Infinity)
  const urgent      = !allDone && nearestMs < 30 * 60_000
  const streakAtRisk = !allDone && !urgent && nearestMs < 8 * 3_600_000

  // Puntos POSIBLES si aciertas todo (fijos, NO apuesta): tendencia 1
  // (×2 destacado) + marcador exacto 3 (×2 destacado) + pleno 5 si están
  // todos los picks. Solo informativo para el gancho del footer.
  const potentialPoints = (() => {
    let sum = 0
    matches.forEach((m, i) => {
      if (!picks[i]) return
      const mult = m.isFeatured ? 2 : 1
      sum += SCORING.TENDENCY * mult
      if (exactScores[i]) sum += SCORING.EXACT_BONUS * mult
    })
    if (allDone) sum += SCORING.PLENO_BONUS
    return sum
  })()

  // ── Validación pre-submit ──
  // Modelo SIN apuestas: basta con tener todos los picks. Las cuotas ya
  // NO bloquean (son informativas) y no hay saldo que validar.
  const canSeal = allDone && !submitting

  const handleSubmit = async () => {
    if (!allDone || submitting) return
    setSubmitError(null)

    trackGameComplete({ game: 'quiniela', correct: matches.length, total: matches.length })
    setSubmitting(true)

    // Congela la cuota VIVA de la opción elegida (consenso real + tiempo),
    // igual que la que ve el usuario en la tarjeta. Es el multiplicador.
    let consRows: Awaited<ReturnType<typeof loadConsensus>> = []
    try { consRows = await loadConsensus(jornada) } catch { /* sin consenso → cuota base */ }
    const oddsForPick = (m: QuinielaMatch, p: Pick): number | undefined => {
      const row = consRows.find(r => nameMatch(r.home, m.home) && nameMatch(r.away, m.away))
      const o = liveOdds(m.odds, row ?? null, m.isoDate, Date.now())
      if (!o) return undefined
      return p === '1' ? o.home : p === '2' ? o.away : o.draw || undefined
    }
    const saved: QuinielaSaved = {
      jornada,
      picks: matches.map((m, i) => ({
        home: m.home, away: m.away, pick: picks[i],
        oddsAtPick: oddsForPick(m, picks[i]),
        // E3 — Incluir exactScore solo si el user lo definió.
        ...(exactScores[i] ? { exactScore: exactScores[i] } : {}),
      })),
    }

    // PHASE STAKE — sellar el pronóstico server-side (sin coste).
    // Sin auth: skip (modo invitado, cosmético en localStorage).
    if (authed) {
      try {
        const res = await fetch('/api/quiniela/score', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jornada: saved.jornada,
            picks: saved.picks,
            phase: 'stake',
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({})) as { error?: string }
          const msg = j.error === 'already_staked'
            ? 'Ya sellaste esta jornada.'
            : `No pudimos sellar (${j.error ?? 'error desconocido'}).`
          setSubmitError(msg)
          setSubmitting(false)
          return
        }
      } catch {
        setSubmitError('Error de red. Intentá de nuevo.')
        setSubmitting(false)
        return
      }
    }

    localStorage.setItem(QUINIELA_PICKS_KEY, JSON.stringify(saved))
    try {
      const raw = localStorage.getItem(LEAGUES_KEY)
      if (raw) {
        const leagueList: League[] = JSON.parse(raw)
        const picksMap: Record<number, string> = {}
        saved.picks.forEach((p, i) => { picksMap[i] = p.pick })
        const alias = ensurePlayerAlias()
        for (const l of leagueList) {
          fetch('/api/quiniela/leagues', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: l.id, nickname: l.nickname || alias, picks: picksMap }),
          }).catch(() => {})
        }
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(STREAK_KEY)
      const played: string[] = raw ? JSON.parse(raw) : []
      if (!played.includes(jornada)) {
        localStorage.setItem(STREAK_KEY, JSON.stringify([...played, jornada]))
      }
    } catch { /* ignore */ }
    onParticipation?.(jornada)
    setTimeout(() => { setSubmitting(false); onSubmit(saved) }, 1800)
  }

  if (matches.length === 0) {
    return (
      <div className="py-14 flex flex-col items-center gap-5 text-center px-4">
        <OnboardingSheet open={showOnboarding} onClose={() => { setShowOnboarding(false); setTutored(true); try { localStorage.setItem(TUTORED_KEY, '1') } catch {/* */} }} />
        <div style={{ fontSize: 56, lineHeight: 1 }}>📅</div>
        <div>
          <p className="font-black text-base mb-1" style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>Sin partidos esta semana</p>
          <p className="text-xs" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>La próxima jornada se activa automáticamente cuando haya partidos</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-md">
          <button onClick={() => setShowOnboarding(true)} className="w-full rounded-2xl px-5 py-4 flex items-center gap-4 text-left transition-opacity hover:opacity-90" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.22)', cursor: 'pointer', minHeight: 64 }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div className="flex-1">
              <p className="text-xs font-black mb-0.5" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>Aprende a jugar en 1 minuto</p>
              <p className="text-[10px]" style={{ color: '#7060A0', fontFamily: 'var(--font-sport)' }}>Tutorial rápido para no perderte nada</p>
            </div>
            <span style={{ fontSize: 14, color: '#C4B5FD' }}>→</span>
          </button>
          <div className="w-full rounded-2xl px-5 py-4 flex items-center gap-4" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}>
            <span style={{ fontSize: 24 }}>🎯</span>
            <div className="text-left">
              <p className="text-xs font-black mb-0.5" style={{ color: '#86efac', fontFamily: 'var(--font-display)' }}>Crea una liga privada</p>
              <p className="text-[10px]" style={{ color: '#3a6a4a', fontFamily: 'var(--font-sport)' }}>Compite con amigos sin esperar la jornada oficial</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Una sola pantalla: picks + ajustes opcionales ──────────────
  return (
    <div className="flex flex-col gap-3">
      {/* Submit seal animation */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(3,0,9,0.95)', backdropFilter: 'blur(20px)', animation: 'fadeIn 0.2s ease both' }}>
          <div className="flex flex-col items-center gap-6 text-center px-8" style={{ animation: 'sealPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div style={{ fontSize: 80, lineHeight: 1 }}>🎯</div>
            <div>
              <p className="font-black leading-none mb-3" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,5vw,2.8rem)', color: '#F8F8FF', letterSpacing: '-0.03em' }}>
                ¡Predicción sellada!
              </p>
              <p className="text-sm mb-2" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>Suerte esta jornada 🤞</p>
              <p className="text-xs font-black inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', fontFamily: 'var(--font-sport)' }}>
                Si aciertas todo: +{potentialPoints} pts
              </p>
            </div>
          </div>
        </div>
      )}

      <OnboardingSheet open={showOnboarding} onClose={() => { setShowOnboarding(false); setTutored(true); try { localStorage.setItem(TUTORED_KEY, '1') } catch {/* */} }} />

      {tutored && (
        <div className="flex justify-end -mb-1">
          <button onClick={() => setShowOnboarding(true)} className="text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ color: '#7C7CA0', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)', cursor: 'pointer', minHeight: 32 }}>
            <span style={{ fontSize: 11 }}>💡</span> Cómo se juega
          </button>
        </div>
      )}

      <StreakHero current={streakCurrent} />
      <QuickPickIA matches={matches} picks={picks} onApply={(next) => { setPicks(next); if (!tutored) { setTutored(true); try { localStorage.setItem(TUTORED_KEY, '1') } catch {/* */} } }} />

      {/* Urgency: <30min to first match */}
      {urgent && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-4" style={{ background: 'rgba(239,68,68,0.1)', animation: 'urgentPulse 1.5s ease-in-out infinite' }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: '#f87171', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
              ¡Último aviso! {Math.floor(nearestMs / 60_000)}:{String(Math.floor((nearestMs % 60_000) / 1000)).padStart(2, '0')} para el cierre
            </p>
            <p className="text-[10px]" style={{ color: '#5A2020', fontFamily: 'var(--font-sport)' }}>
              {total - done} partido{total - done !== 1 ? 's' : ''} sin pick · No pierdas puntos
            </p>
          </div>
        </div>
      )}

      {/* Streak at risk: <8h */}
      {streakAtRisk && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)' }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <p className="text-xs font-black" style={{ color: '#fb923c', fontFamily: 'var(--font-sport)' }}>
            ¡Cierra en menos de 8h — no rompas tu racha!
          </p>
        </div>
      )}

      <ProgressBar done={done} total={total} />

      {/* E3 — Contador de marcadores exactos. Solo visible si el user ya
          usó al menos uno o cuando todos los slots están ocupados. */}
      {Object.keys(exactScores).length > 0 && (
        <div className="flex items-center justify-between px-1 -mt-2">
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            color: '#A78BFA', fontFamily: 'var(--font-sport)',
          }}>
            🎯 MARCADORES EXACTOS{' '}
            <span style={{ color: '#fff', fontWeight: 900 }}>
              {Object.keys(exactScores).length}/{SCORING.MAX_EXACT_PER_JORNADA}
            </span>
          </span>
          <span style={{
            fontSize: 9, color: 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-sport)', letterSpacing: '0.04em',
          }}>
            +3 pts por cada acierto
          </span>
        </div>
      )}

      {matches.map((m, i) => (
        <div key={i} id={`pick-card-${i}`} className="flex flex-col">
          <MatchCard
            match={m}
            index={i}
            pick={picks[i]}
            onPick={(p) => {
              setPicks((prev) => ({ ...prev, [i]: p }))
              // Si cambia de pick, sale del estado fijado (la cuota
              // efectiva cambió, hay que reconfirmar).
              setFixedPicks((prev) => {
                if (!prev.has(i)) return prev
                const next = new Set(prev)
                next.delete(i)
                return next
              })
              if (!tutored) { setTutored(true); try { localStorage.setItem(TUTORED_KEY, '1') } catch {/* */} }
            }}
            comp={m.comp}
            time={m.time}
            odds={m.odds}
            oddsSource={m.oddsSource}
            isoDate={m.isoDate}
            jornada={jornada}
            fixed={fixedPicks.has(i)}
            exactScore={exactScores[i]}
            exactSlotAvailable={
              !!exactScores[i] ||
              Object.keys(exactScores).length < SCORING.MAX_EXACT_PER_JORNADA
            }
            showExactTooltip={
              // Z2 — Solo en el PRIMER card que cumple las condiciones:
              //  · user ya picked algo en este card (sin pick no tiene sentido)
              //  · no tiene exact aún
              //  · todavía hay slot
              //  · tooltip no dismisseado nunca
              //  · ningún exact usado en ningún card aún
              !exactTooltipDismissed &&
              !!picks[i] &&
              !exactScores[i] &&
              Object.keys(exactScores).length === 0 &&
              matches.findIndex((_, j) => picks[j] && !exactScores[j]) === i
            }
            onExactTooltipDismiss={dismissExactTooltip}
            onExactScoreChange={(v) => {
              setExactScores((prev) => {
                const wasPresent = prev[i] != null
                const next = { ...prev }
                if (v == null) delete next[i]
                else next[i] = v
                // Analytics: solo eventos de transición (no spam al editar goles).
                if (!wasPresent && v != null) {
                  // Añadido por primera vez en este card.
                  trackPorraExactAdded({
                    slot: Object.keys(next).length,
                    featured: !!m.isFeatured,
                  })
                } else if (wasPresent && v == null) {
                  trackPorraExactRemoved({ remaining: Object.keys(next).length })
                }
                return next
              })
            }}
            onFix={() => {
              setFixedPicks((prev) => {
                const next = new Set(prev)
                next.add(i)
                return next
              })
              // Scroll suave al próximo pick pendiente (sin pick o
              // con pick pero sin fijar). Si no queda ninguno, scroll
              // al sticky bottom para que vea "Cerrar apuesta".
              if (typeof window !== 'undefined') {
                requestAnimationFrame(() => {
                  const nextIdx = matches.findIndex((_, j) =>
                    j > i && (!picks[j] || !fixedPicks.has(j))
                  )
                  const target = nextIdx >= 0
                    ? document.getElementById(`pick-card-${nextIdx}`)
                    : null
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                })
              }
            }}
            onEdit={() => {
              setFixedPicks((prev) => {
                if (!prev.has(i)) return prev
                const next = new Set(prev)
                next.delete(i)
                return next
              })
            }}
          />
          {done >= 3 && <ConsensusBar match={m} userPick={picks[i]} jornada={jornada} />}
        </div>
      ))}

      {/* Error de submit (red, ya sellada, etc) */}
      {submitError && (
        <div className="rounded-2xl px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <span style={{ fontSize: 16, lineHeight: 1, marginTop: 2 }}>⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black" style={{ color: '#f87171', fontFamily: 'var(--font-display)' }}>{submitError}</p>
          </div>
          <button
            onClick={() => setSubmitError(null)}
            className="text-[10px] font-black px-2 py-1 rounded"
            style={{ background: 'transparent', color: '#7a3838', border: '1px solid rgba(239,68,68,0.25)', fontFamily: 'var(--font-sport)' }}
            aria-label="Cerrar mensaje"
          >
            Cerrar
          </button>
        </div>
      )}

      <StickyBetslip done={done} total={total} allDone={canSeal} captainSet={false} urgent={urgent} onSubmit={handleSubmit} potential={potentialPoints} />
    </div>
  )
}
