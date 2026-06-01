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

// Stake: monedas que se apuestan por pick. Reglas idénticas server-side.
const STAKE_MIN = SCORING.STAKE_MIN
const STAKE_MAX = SCORING.STAKE_MAX
const STAKE_DEFAULT = SCORING.STAKE_DEFAULT

export function PicksForm({
  matches, jornada, onSubmit, streakCurrent = 0, onParticipation,
  coinBalance = 0, authed = false,
}: {
  matches: QuinielaMatch[]
  jornada: string
  onSubmit: (s: QuinielaSaved) => void
  streakCurrent?: number
  onParticipation?: (jornada: string) => void
  /** Saldo actual del wallet (del usuario o invitado) — para validar que tiene saldo para apostar. */
  coinBalance?: number
  /** Hay sesión Supabase activa — sin auth no hay cobro real, así que ocultamos el botón. */
  authed?: boolean
}) {
  const [picks, setPicks]             = useState<Record<number, Pick>>({})
  const [stakes, setStakes]           = useState<Record<number, number>>({})
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
  // Stake "bulk" para el control rápido "Aplicar a todos". Default al
  // mismo valor que cada pick individual. Cambia cuando el user usa
  // los botones del bulk picker arriba del listado de matches.
  const [bulkStake, setBulkStake]     = useState<number>(STAKE_DEFAULT)
  // Picks que el user fijó explícitamente. Es UX para "confirmar y bajar
  // al siguiente" — compacta la card y permite enfoque en lo pendiente.
  // No es estrictamente obligatorio fijar para sellar: si el user pulsa
  // "Cerrar apuesta" en el sticky, los stakes > 0 cuentan igual.
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
      setStakes((prev) => (prev[idx] != null ? prev : { ...prev, [idx]: STAKE_DEFAULT }))
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

  // Helper para extraer la cuota del lado elegido de un pick.
  const oddFor = (m: QuinielaMatch, p: Pick | undefined): number => {
    const o = m.odds
    if (!o || !p) return 1
    return p === '1' ? o.home : p === '2' ? o.away : (o.draw || 1)
  }

  // Stake total apostado en esta jornada. Suma los stakes de los picks
  // elegidos. Picks sin pick (1X2) o con stake 0 no cuentan.
  const totalStake = matches.reduce((sum, _, i) => {
    if (!picks[i]) return sum
    return sum + Math.max(0, Math.floor(stakes[i] ?? 0))
  }, 0)

  // Potencial total: suma de stake × cuota efectiva.
  // + bonus pleno escalado si allDone (max(totalStake, COINS_PLENO_FLOOR)).
  const potentialCoins = (() => {
    let sum = 0
    let totalStakeLocal = 0
    matches.forEach((m, i) => {
      const p = picks[i]
      if (!p) return
      const stake = Math.max(0, Math.floor(stakes[i] ?? 0))
      const odd = Math.max(1, oddFor(m, p))
      sum += stake * odd
      totalStakeLocal += stake
    })
    if (allDone) sum += Math.max(SCORING.COINS_PLENO_FLOOR, totalStakeLocal)
    return sum
  })()
  const potentialCoinsRound = Math.round(potentialCoins)

  // ── Validaciones pre-submit ──
  // Sin cuotas en algún pick = jornada bloqueada (modelo Ranked exige
  // multiplicador real; sin él no se puede calcular retorno).
  const oddsAvailable = matches.every(m => !!m.odds)
  const enoughBalance = !authed || totalStake <= coinBalance
  const canSeal = allDone && oddsAvailable && totalStake > 0 && enoughBalance && !submitting

  const handleSubmit = async () => {
    if (!allDone || submitting) return
    setSubmitError(null)

    // Validaciones de pre-flight — defendemos el client antes de
    // golpear el server (que igual valida).
    if (!oddsAvailable) {
      setSubmitError('Jornada bloqueada: cuotas no disponibles. Volvé en unos minutos.')
      return
    }
    if (totalStake <= 0) {
      setSubmitError('Tenés que apostar al menos 1 pts en algún pick.')
      return
    }
    if (authed && totalStake > coinBalance) {
      setSubmitError(`Saldo insuficiente. Necesitás ${totalStake} pts y tenés ${coinBalance} pts.`)
      return
    }

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
        stake: Math.max(0, Math.floor(stakes[i] ?? 0)),
        // E3 — Incluir exactScore solo si el user lo definió.
        ...(exactScores[i] ? { exactScore: exactScores[i] } : {}),
      })),
    }

    // PHASE STAKE — descontar del wallet ANTES de sellar localmente.
    // Sin auth: skip (modo invitado no descuenta nada, juega cosmético).
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
          const j = await res.json().catch(() => ({})) as { error?: string; needed?: number; balance?: number }
          const msg =
              j.error === 'insufficient_balance' ? `Saldo insuficiente. Necesitás ${j.needed} pts y tenés ${j.balance} pts.`
            : j.error === 'odds_unavailable'    ? 'Jornada bloqueada: cuotas no disponibles.'
            : j.error === 'already_staked'      ? 'Ya sellaste esta jornada.'
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
                Si aciertas todo: hasta {potentialCoinsRound} pts
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

      {/* Banner bloqueo por falta de cuotas (jornada en modo Ranked
          exige cuotas reales — si the-odds-api se cayó, no se sella) */}
      {!oddsAvailable && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <span style={{ fontSize: 22 }}>⏸</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>Jornada en pausa</p>
            <p className="text-[10px]" style={{ color: '#7A5A20', fontFamily: 'var(--font-sport)' }}>
              Cuotas en actualización. Volvé en unos minutos para apostar.
            </p>
          </div>
        </div>
      )}

      {/* ── Quick-set: aplicar el mismo stake a todos los picks ──────
          Reduce fricción para usuarios casuales que solo quieren
          jugar rápido. Solo aparece cuando hay al menos 1 pick para
          no estorbar antes de elegir L/E/V. */}
      {Object.keys(picks).length > 0 && oddsAvailable && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
          style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)' }}
        >
          <span style={{ fontSize: 18 }}>⚡</span>
          <div className="flex-1 min-w-[160px]">
            <p className="text-[11px] font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
              Apostar lo mismo en todos
            </p>
            <p className="text-[9px]" style={{ color: '#7060A0', fontFamily: 'var(--font-sport)' }}>
              Atajo para aplicar el mismo stake a tus {Object.keys(picks).length} pick{Object.keys(picks).length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkStake(v => Math.max(STAKE_MIN, v - 5))}
              aria-label="Bajar stake bulk"
              className="w-7 h-7 rounded font-black flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#A78BFA', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1, cursor: 'pointer' }}
            >−</button>
            <input
              type="number"
              min={STAKE_MIN}
              max={STAKE_MAX}
              value={bulkStake}
              onChange={e => {
                const v = Math.max(STAKE_MIN, Math.min(STAKE_MAX, Math.floor(Number(e.target.value) || STAKE_MIN)))
                setBulkStake(v)
              }}
              aria-label="Stake para aplicar a todos"
              className="w-14 px-2 py-1 rounded text-sm font-black tabular-nums text-center outline-none"
              style={{ background: 'rgba(0,0,0,0.4)', color: '#E0E0F0', border: '1px solid rgba(167,139,250,0.3)', fontFamily: 'var(--font-display)' }}
            />
            <button
              type="button"
              onClick={() => setBulkStake(v => Math.min(STAKE_MAX, v + 5))}
              aria-label="Subir stake bulk"
              className="w-7 h-7 rounded font-black flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#A78BFA', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1, cursor: 'pointer' }}
            >+</button>
            <button
              type="button"
              onClick={() => {
                setStakes(prev => {
                  const next = { ...prev }
                  Object.keys(picks).forEach(k => {
                    next[Number(k)] = bulkStake
                  })
                  return next
                })
              }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-85"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)', color: '#fff', border: '1px solid rgba(124,58,237,0.5)', fontFamily: 'var(--font-sport)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)', cursor: 'pointer' }}
            >
              Aplicar
            </button>
          </div>
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
              setStakes((prev) => prev[i] != null ? prev : { ...prev, [i]: STAKE_DEFAULT })
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
            showStakeBar
            stake={stakes[i]}
            onStakeChange={(v) => setStakes((prev) => ({ ...prev, [i]: v }))}
            fixed={fixedPicks.has(i)}
            stakeMin={STAKE_MIN}
            stakeMax={STAKE_MAX}
            stakeDefault={STAKE_DEFAULT}
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

      {/* Resumen MÍNIMO al pie — solo cuando hay al menos un pick.
          No es un panel separado de "boleta" (eso se eliminó por
          ser confuso) sino un recordatorio compacto del estado:
          cuánto va apostado en total + saldo restante.
          La apuesta real se hace DENTRO de cada MatchCard. */}
      {Object.keys(picks).length > 0 && oddsAvailable && (
        <div
          className="rounded-2xl px-5 py-3 flex items-center justify-between flex-wrap gap-2"
          style={{
            background: 'rgba(34,197,94,0.05)',
            border: '1px solid rgba(34,197,94,0.18)',
          }}
        >
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 16, lineHeight: 1 }}>💰</span>
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>
                Total apostado en la fecha
              </p>
              <p className="text-lg font-black tabular-nums" style={{ color: '#86efac', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                {totalStake} pts
              </p>
            </div>
          </div>
          {authed && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] uppercase tracking-widest" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>Saldo</span>
              <span className="text-sm font-black tabular-nums" style={{ color: '#86efac', fontFamily: 'var(--font-display)' }}>{coinBalance} pts</span>
            </div>
          )}
          {authed && !enoughBalance && (
            <div className="w-full rounded-lg px-3 py-2 text-[10px] text-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>
              Saldo insuficiente · necesitás {totalStake - coinBalance} pts más
            </div>
          )}
        </div>
      )}

      {/* Error de submit (sin saldo, sin cuotas, red, etc) */}
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

      <StickyBetslip done={done} total={total} allDone={canSeal} captainSet={false} urgent={urgent} onSubmit={handleSubmit} potential={potentialCoinsRound} totalStake={totalStake} />
    </div>
  )
}
