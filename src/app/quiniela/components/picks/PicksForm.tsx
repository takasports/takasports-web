'use client'

import { useState, useEffect } from 'react'
import { trackGameComplete } from '@/lib/analytics'
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
  // + 100🪙 bonus si pleno (allDone).
  const potentialCoins = matches.reduce((sum, m, i) => {
    const p = picks[i]
    if (!p) return sum
    const stake = Math.max(0, Math.floor(stakes[i] ?? 0))
    const odd = Math.max(1, oddFor(m, p))
    return sum + stake * odd
  }, 0) + (allDone ? SCORING.COINS_PLENO : 0)
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
      setSubmitError('Tenés que apostar al menos 1🪙 en algún pick.')
      return
    }
    if (authed && totalStake > coinBalance) {
      setSubmitError(`Saldo insuficiente. Necesitás ${totalStake}🪙 y tenés ${coinBalance}🪙.`)
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
              j.error === 'insufficient_balance' ? `Saldo insuficiente. Necesitás ${j.needed}🪙 y tenés ${j.balance}🪙.`
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
                Si aciertas todo: hasta {potentialCoinsRound}🪙
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

      {matches.map((m, i) => (
        <div key={i} className="flex flex-col">
          <MatchCard
            match={m}
            index={i}
            pick={picks[i]}
            onPick={(p) => {
              setPicks((prev) => ({ ...prev, [i]: p }))
              setStakes((prev) => prev[i] != null ? prev : { ...prev, [i]: STAKE_DEFAULT })
              if (!tutored) { setTutored(true); try { localStorage.setItem(TUTORED_KEY, '1') } catch {/* */} }
            }}
            comp={m.comp}
            time={m.time}
            odds={m.odds}
            oddsSource={m.oddsSource}
            isoDate={m.isoDate}
            jornada={jornada}
          />
          {done >= 3 && <ConsensusBar match={m} userPick={picks[i]} jornada={jornada} />}
        </div>
      ))}

      {/* ── BOLETA DE APUESTAS (estilo casa de apuestas real) ────────
          Cada pick es UNA APUESTA INDEPENDIENTE — no se combina.
          stake × cuota por pick, suma de stakes = total apostado. */}
      {Object.keys(picks).length > 0 && oddsAvailable && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(155deg, rgba(34,197,94,0.10) 0%, rgba(16,185,129,0.04) 60%, rgba(8,0,14,0.6) 100%)', border: '1px solid rgba(34,197,94,0.28)', boxShadow: '0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(134,239,172,0.08)' }}>
          {/* Header con icono ticket + título grande + saldo */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(34,197,94,0.2)', background: 'rgba(0,0,0,0.25)' }}>
            <div className="flex items-center gap-2.5">
              <span style={{ fontSize: 22, lineHeight: 1 }}>🎫</span>
              <div>
                <p className="text-sm font-black uppercase tracking-widest" style={{ color: '#86efac', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em' }}>
                  Tu boleta
                </p>
                <p className="text-[9px]" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>
                  Cada partido es una apuesta independiente · no combinada
                </p>
              </div>
            </div>
            {authed ? (
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase tracking-widest" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>Saldo</span>
                <span className="text-sm font-black tabular-nums" style={{ color: '#86efac', fontFamily: 'var(--font-display)' }}>{coinBalance}🪙</span>
              </div>
            ) : (
              <span className="text-[10px] font-black" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>
                Iniciá sesión para apostar
              </span>
            )}
          </div>

          {/* Lista de picks como "boletas" individuales */}
          <div className="px-3 py-3 flex flex-col gap-2">
            {matches.map((m, i) => {
              const p = picks[i]
              if (!p) return null
              const stake = Math.max(0, Math.floor(stakes[i] ?? 0))
              const odd = Math.max(1, oddFor(m, p))
              const ret = Math.round(stake * odd)
              const profit = ret - stake
              const lado = p === '1' ? (m.homeShort ?? m.home) : p === '2' ? (m.awayShort ?? m.away) : 'Empate'
              return (
                <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.32)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Fila superior: nº + equipos + cuota grande */}
                  <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
                    <span className="text-[9px] font-black tabular-nums flex-shrink-0" style={{ color: '#3A5A48', fontFamily: 'var(--font-sport)', minWidth: 18, textAlign: 'center' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold truncate" style={{ color: '#D0E8D8', fontFamily: 'var(--font-display)' }}>
                        {(m.homeShort ?? m.home).slice(0, 12)} <span style={{ color: '#4A5A55' }}>vs</span> {(m.awayShort ?? m.away).slice(0, 12)}
                      </p>
                      <p className="text-[9px] truncate" style={{ color: '#3A5A48', fontFamily: 'var(--font-sport)' }}>
                        Tu pick: <span style={{ color: '#86efac', fontWeight: 700 }}>{lado}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-[8px] uppercase tracking-widest" style={{ color: '#3A5A48', fontFamily: 'var(--font-sport)' }}>Cuota</span>
                      <span className="text-base font-black tabular-nums" style={{ color: '#86efac', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                        ×{odd.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Fila inferior: stake input + retorno */}
                  <div className="px-3 py-2.5 flex items-center gap-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>Apostás</span>
                      <button
                        type="button"
                        onClick={() => setStakes(prev => ({ ...prev, [i]: Math.max(STAKE_MIN, (prev[i] ?? STAKE_DEFAULT) - 5) }))}
                        aria-label="Bajar stake"
                        className="w-6 h-6 rounded font-black flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#86efac', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-display)', fontSize: 14, lineHeight: 1, cursor: 'pointer' }}
                      >−</button>
                      <input
                        type="number"
                        min={STAKE_MIN}
                        max={STAKE_MAX}
                        value={stake}
                        onChange={e => {
                          const v = Math.max(0, Math.min(STAKE_MAX, Math.floor(Number(e.target.value) || 0)))
                          setStakes(prev => ({ ...prev, [i]: v }))
                        }}
                        aria-label={`Stake para ${m.home} vs ${m.away}`}
                        className="w-14 px-2 py-1 rounded text-sm font-black tabular-nums text-center outline-none"
                        style={{ background: 'rgba(0,0,0,0.4)', color: '#E0F0E5', border: '1px solid rgba(134,239,172,0.25)', fontFamily: 'var(--font-display)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setStakes(prev => ({ ...prev, [i]: Math.min(STAKE_MAX, (prev[i] ?? STAKE_DEFAULT) + 5) }))}
                        aria-label="Subir stake"
                        className="w-6 h-6 rounded font-black flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#86efac', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-display)', fontSize: 14, lineHeight: 1, cursor: 'pointer' }}
                      >+</button>
                      <span className="text-[10px] font-bold" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>🪙</span>
                    </div>
                    <span className="flex-1" />
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-[8px] uppercase tracking-widest" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>Si acertás</span>
                      <span className="text-sm font-black tabular-nums" style={{ color: stake > 0 ? '#fbbf24' : '#3A4A45', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                        {ret}🪙
                      </span>
                      {stake > 0 && profit > 0 && (
                        <span className="text-[8px] font-bold tabular-nums" style={{ color: '#86efac', fontFamily: 'var(--font-sport)' }}>
                          +{profit} ganancia
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Totales destacados */}
          <div className="px-5 py-4" style={{ background: 'rgba(0,0,0,0.35)', borderTop: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>
                Total apostado en la fecha
              </span>
              <span className="text-lg font-black tabular-nums" style={{ color: '#86efac', fontFamily: 'var(--font-display)' }}>
                {totalStake}🪙
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>
                Si acertás todos los partidos
              </span>
              <span className="text-base font-black tabular-nums" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)' }}>
                {potentialCoinsRound}🪙
              </span>
            </div>

            {authed && !enoughBalance && (
              <div className="mt-3 rounded-lg px-3 py-2 text-[10px] text-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>
                Saldo insuficiente · necesitás {totalStake - coinBalance}🪙 más
              </div>
            )}
          </div>
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

      <StickyBetslip done={done} total={total} allDone={canSeal} captainSet={false} urgent={urgent} onSubmit={handleSubmit} potential={potentialCoinsRound} />
    </div>
  )
}
