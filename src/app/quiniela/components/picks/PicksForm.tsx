'use client'

import { useState, useEffect } from 'react'
import { trackGameComplete } from '@/lib/analytics'
import { QUINIELA_PICKS_KEY } from '@/components/QuinielaModule'
import type { QuinielaMatch, QuinielaSaved, Pick } from '@/components/QuinielaModule'
import { PICK_COLOR, PICK_BG, PICK_BORDER, PICK_GLOW, TUTORED_KEY, LEAGUES_KEY, STREAK_KEY } from '../../lib/constants'
import type { League } from '../../lib/types'
import { scorelinesFor, ensurePlayerAlias, liveOdds } from '../../lib/helpers'
import { loadConsensus } from '../../lib/consensus'
import { nameMatch } from '@/lib/quiniela'
import { ProgressBar } from '../atoms/ProgressBar'
import { MatchCard } from '../match/MatchCard'
import { ConsensusBar } from '../match/ConsensusBar'
import { OnboardingSheet } from './OnboardingSheet'
import { StreakHero } from './StreakHero'
import { QuickPickIA } from './QuickPickIA'
import { StickyBetslip } from './StickyBetslip'

// Booster: cuesta BOOSTER_COST monedas, multiplica ×1.20 la cuota efectiva
// del pick boosted si acierta. Se descuenta server-side al sellar.
// Mantenemos el valor local sincronizado con SCORING.BOOSTER_* para que
// el cliente y el server vean lo mismo.
const BOOSTER_COST = 30
const BOOSTER_MULTIPLIER = 1.20

export function PicksForm({
  matches, jornada, onSubmit, streakCurrent = 0, onParticipation,
  coinBalance = 0, authed = false,
}: {
  matches: QuinielaMatch[]
  jornada: string
  onSubmit: (s: QuinielaSaved) => void
  streakCurrent?: number
  onParticipation?: (jornada: string) => void
  /** Saldo actual del wallet (del usuario o invitado) — para validar booster. */
  coinBalance?: number
  /** Hay sesión Supabase activa — sin auth no hay cobro real, así que ocultamos el botón. */
  authed?: boolean
}) {
  const [picks, setPicks]             = useState<Record<number, Pick>>({})
  const [captainIdx, setCaptainIdx]   = useState<number | null>(null)
  const [exactScores, setExactScores] = useState<Record<number, { home: number; away: number }>>({})
  const [boostedIdx, setBoostedIdx]   = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [now, setNow]                 = useState(Date.now())
  const [submitting, setSubmitting]   = useState(false)
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

  // Total potencial de monedas con cuota como multiplicador (espejo del
  // scoring server). Si no hay cuota → ×1 (fallback honesto, base 10).
  // Capitán dobla el pick correspondiente. Pleno +100 si todo lleno.
  const COIN_BASE = 10
  const potentialCoins = matches.reduce((sum, m, i) => {
    const p = picks[i]
    if (!p) return sum
    const o = m.odds
    const odd =
      o ? (p === '1' ? o.home : p === '2' ? o.away : o.draw || 1) : 1
    const captainMult = captainIdx === i ? 2 : 1
    const boostMult   = boostedIdx === i ? BOOSTER_MULTIPLIER : 1
    const mult = Math.max(1, odd) * captainMult * boostMult
    return sum + COIN_BASE * mult
  }, 0) + (allDone ? 100 : 0)
  const potentialCoinsRound = Math.round(potentialCoins)

  const handleSubmit = async () => {
    if (!allDone || submitting) return
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
        exactHome: exactScores[i]?.home, exactAway: exactScores[i]?.away,
        oddsAtPick: oddsForPick(m, picks[i]),
        // Solo marcamos booster si el usuario está autenticado Y tiene saldo
        // suficiente. Sin esto, el server lo strippearía igual; lo evitamos
        // de raíz para que la UI no muestre un boost que no se va a aplicar.
        boosted: authed && boostedIdx === i && coinBalance >= BOOSTER_COST,
      })),
      captainIdx: captainIdx ?? undefined,
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

      {matches.map((m, i) => (
        <div key={i} className="flex flex-col">
          <MatchCard
            match={m}
            index={i}
            pick={picks[i]}
            onPick={(p) => { setPicks((prev) => ({ ...prev, [i]: p })); if (!tutored) { setTutored(true); try { localStorage.setItem(TUTORED_KEY, '1') } catch {/* */} } }}
            comp={m.comp}
            time={m.time}
            odds={m.odds}
            isoDate={m.isoDate}
            jornada={jornada}
            isCaptain={captainIdx === i}
            onSetCaptain={picks[i] ? () => setCaptainIdx(prev => prev === i ? null : i) : undefined}
          />
          {done >= 3 && <ConsensusBar match={m} userPick={picks[i]} jornada={jornada} />}
        </div>
      ))}

      {/* Ajustes opcionales — colapsado por defecto, solo cuando ya hay picks */}
      {allDone && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 16 }}>⚡</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black" style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}>Más opciones · booster y marcador exacto</p>
              <p className="text-[9px]" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>+20% cuota en un pick con booster · +50🪙 por marcador exacto</p>
            </div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#5A5A7A' }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {showAdvanced && (
            <div className="px-4 pb-4 flex flex-col gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>

              {/* ── Booster (1 pick por jornada) ────────────────── */}
              {authed && (
                <div className="pt-4">
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-xs font-black" style={{ color: '#F9A8D4', fontFamily: 'var(--font-display)' }}>
                      Booster · +20% cuota
                    </p>
                    <span className="text-[10px] font-black tabular-nums" style={{ color: coinBalance >= BOOSTER_COST ? '#F472B6' : '#8E5A78', fontFamily: 'var(--font-sport)' }}>
                      Coste: {BOOSTER_COST} 🪙 · Saldo: {coinBalance}
                    </span>
                  </div>
                  <p className="text-[9px] mb-3" style={{ color: '#7A4A68', fontFamily: 'var(--font-sport)' }}>
                    Elegí 1 pick para multiplicar su cuota efectiva. Sólo se cobra si lo sellás.
                  </p>
                  {coinBalance < BOOSTER_COST ? (
                    <div className="rounded-xl px-3 py-2.5 text-[10px] text-center" style={{ background: 'rgba(255,255,255,0.03)', color: '#6A6A8A', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}>
                      Necesitás {BOOSTER_COST - coinBalance} 🪙 más para activar el booster.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {matches.map((m, i) => {
                        const p = picks[i] as Pick | undefined
                        if (!p) return null
                        const active = boostedIdx === i
                        return (
                          <button
                            key={i}
                            onClick={() => setBoostedIdx(prev => prev === i ? null : i)}
                            className="px-3 py-1.5 rounded-xl font-black transition-all inline-flex items-center gap-1.5"
                            style={{
                              fontSize: 11, fontFamily: 'var(--font-display)',
                              background: active ? 'rgba(244,114,182,0.18)' : 'rgba(255,255,255,0.04)',
                              color: active ? '#F9A8D4' : '#6A6A8A',
                              border: active ? '1.5px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.08)',
                              boxShadow: active ? '0 0 12px rgba(244,114,182,0.25)' : 'none',
                            }}
                            aria-pressed={active}
                          >
                            {active && <span style={{ fontSize: 10 }}>⚡</span>}
                            {(m.homeShort ?? m.home).slice(0, 3).toUpperCase()}-{(m.awayShort ?? m.away).slice(0, 3).toUpperCase()}
                            <span style={{ fontSize: 8, opacity: 0.7 }}>{p}</span>
                          </button>
                        )
                      })}
                      {boostedIdx != null && (
                        <button
                          onClick={() => setBoostedIdx(null)}
                          className="px-3 py-1.5 rounded-xl font-black"
                          style={{ fontSize: 10, fontFamily: 'var(--font-sport)', background: 'transparent', color: '#5A4070', border: '1px dashed rgba(255,255,255,0.1)' }}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Marcador exacto */}
              <div className={authed ? 'pt-4' : 'pt-4'} style={authed ? { borderTop: '1px solid rgba(255,255,255,0.05)' } : undefined}>
                <p className="text-xs font-black mb-1" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>Marcador exacto · opcional</p>
                <p className="text-[9px] mb-3" style={{ color: '#3A2A50', fontFamily: 'var(--font-sport)' }}>+50🪙 por cada marcador que aciertes</p>
                <div className="flex flex-col gap-4">
                  {matches.map((m, i) => {
                    const p = picks[i] as Pick
                    if (!p) return null
                    const lines = scorelinesFor(p)
                    const sel = exactScores[i]
                    return (
                      <div key={i}>
                        <p className="text-[9px] font-black mb-2 truncate" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {m.homeShort ?? m.home} vs {m.awayShort ?? m.away}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {lines.map(([h, a]) => {
                            const active = sel?.home === h && sel?.away === a
                            return (
                              <button
                                key={`${h}-${a}`}
                                onClick={() => setExactScores(prev => active ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== String(i))) : { ...prev, [i]: { home: h, away: a } })}
                                className="px-3 py-1.5 rounded-xl font-black transition-all"
                                style={{
                                  fontSize: 12, fontFamily: 'var(--font-display)',
                                  background: active ? PICK_BG[p] : 'rgba(255,255,255,0.04)',
                                  color: active ? PICK_COLOR[p] : '#4A4A6A',
                                  border: active ? `1.5px solid ${PICK_BORDER[p]}` : '1px solid rgba(255,255,255,0.08)',
                                  boxShadow: active ? `0 0 12px ${PICK_GLOW[p]}` : 'none',
                                  transform: active ? 'scale(1.06)' : 'scale(1)',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {h}–{a}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <StickyBetslip done={done} total={total} allDone={allDone} captainSet={captainIdx != null} urgent={urgent} onSubmit={handleSubmit} potential={potentialCoinsRound} />
    </div>
  )
}
