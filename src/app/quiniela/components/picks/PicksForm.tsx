'use client'

import { useState, useEffect } from 'react'
import { trackGameComplete } from '@/lib/analytics'
import { QUINIELA_PICKS_KEY } from '@/components/QuinielaModule'
import type { QuinielaMatch, QuinielaSaved, Pick } from '@/components/QuinielaModule'
import type { Confidence } from '@/lib/quiniela'
import { CONFIDENCE_LABELS } from '@/lib/quiniela'
import { PICK_COLOR, PICK_BG, PICK_BORDER, PICK_GLOW, TUTORED_KEY, LEAGUES_KEY, STREAK_KEY } from '../../lib/constants'
import type { League } from '../../lib/types'
import { getISOWeek, scorelinesFor } from '../../lib/helpers'
import { InfoTip } from '../atoms/InfoTip'
import { ProgressBar } from '../atoms/ProgressBar'
import { TeamBadge } from '../atoms/TeamBadge'
import { MatchCard } from '../match/MatchCard'
import { ConsensusBar } from '../match/ConsensusBar'
import { OnboardingSheet } from './OnboardingSheet'
import { StreakHero } from './StreakHero'
import { QuickPickIA } from './QuickPickIA'
import { StickyBetslip } from './StickyBetslip'

export function PicksForm({ matches, jornada, onSubmit, streakCurrent = 0, onParticipation }: { matches: QuinielaMatch[]; jornada: string; onSubmit: (s: QuinielaSaved) => void; streakCurrent?: number; onParticipation?: (jornada: string) => void }) {
  const [picks, setPicks]             = useState<Record<number, Pick>>({})
  const [captainIdx, setCaptainIdx]   = useState<number | null>(null)
  const [exactScores, setExactScores] = useState<Record<number, { home: number; away: number }>>({})
  const [confidences, setConfidences] = useState<Record<number, Confidence>>({})
  const [step, setStep]               = useState<'picks' | 'bonus'>('picks')
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
  const urgent      = step === 'picks' && !allDone && nearestMs < 30 * 60_000
  const streakAtRisk = step === 'picks' && !allDone && !urgent && nearestMs < 8 * 3_600_000

  const handleSubmit = () => {
    if (!allDone || submitting) return
    trackGameComplete({ game: 'quiniela', correct: matches.length, total: matches.length })
    setSubmitting(true)
    const saved: QuinielaSaved = {
      jornada,
      picks: matches.map((m, i) => ({
        home: m.home, away: m.away, pick: picks[i],
        exactHome: exactScores[i]?.home, exactAway: exactScores[i]?.away,
        confidence: confidences[i] ?? 1,
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
        for (const l of leagueList) {
          fetch('/api/quiniela/leagues', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: l.id, nickname: 'Tú', picks: picksMap }),
          }).catch(() => {})
        }
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(STREAK_KEY)
      const weeks: string[] = raw ? JSON.parse(raw) : []
      const thisWeek = getISOWeek()
      if (!weeks.includes(thisWeek)) {
        localStorage.setItem(STREAK_KEY, JSON.stringify([...weeks, thisWeek]))
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

  // ── Step 1: picks ──────────────────────────────────────────────
  if (step === 'picks') return (
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
                Si aciertas todo: hasta {matches.length * 10 + (captainIdx != null ? 10 : 0) + 100}🪙
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
          />
          {done >= 3 && <ConsensusBar match={m} userPick={picks[i]} jornada={jornada} />}
        </div>
      ))}

      <StickyBetslip done={done} total={total} allDone={allDone} captainSet={false} urgent={urgent} onSubmit={() => allDone && setStep('bonus')} />
    </div>
  )

  // ── Step 2: bonus (captain + exact scores) ──────────────────────
  return (
    <div className="flex flex-col gap-4" style={{ animation: 'feedReveal 0.2s ease both' }}>
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
                Si aciertas todo: hasta {matches.length * 10 + (captainIdx != null ? 10 : 0) + 100}🪙
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <button onClick={() => setStep('picks')} className="flex items-center gap-2 text-[10px] font-black self-start" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer' }}>
        ← Editar picks
      </button>

      {/* Captain */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.18)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ fontSize: 18 }}>👑</span>
          <div className="flex-1">
            <p className="text-xs font-black flex items-center gap-1.5" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)' }}>
              Capitán · pick que más te convence
              <InfoTip label="Capitán" text="Marca el partido del que más seguro estés. Si aciertas ese pick, sus puntos se doblan. Si fallas, no descuenta. Solo 1 capitán por jornada." />
            </p>
            <p className="text-[9px]" style={{ color: '#4A3A10', fontFamily: 'var(--font-sport)' }}>Si aciertas, ganas el doble: +20🪙 en vez de +10🪙</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {matches.map((m, i) => {
            const p = picks[i]
            if (!p) return null
            const label = p === '1' ? (m.homeShort ?? m.home) : p === '2' ? (m.awayShort ?? m.away) : 'Empate'
            const isCap = captainIdx === i
            return (
              <button
                key={i}
                onClick={() => setCaptainIdx(prev => prev === i ? null : i)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background: isCap ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.03)',
                  border: isCap ? '1.5px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: isCap ? '0 0 16px rgba(251,191,36,0.2)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <TeamBadge name={m.home} logo={m.homeLogo} size={28} />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[11px] font-black truncate" style={{ color: isCap ? '#fbbf24' : '#C0C0D8', fontFamily: 'var(--font-display)' }}>
                    {m.homeShort ?? m.home} vs {m.awayShort ?? m.away}
                  </p>
                  <p className="text-[9px] font-black" style={{ color: PICK_COLOR[p], fontFamily: 'var(--font-sport)' }}>Tu pick: {label}</p>
                </div>
                <TeamBadge name={m.away} logo={m.awayLogo} size={28} />
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: isCap ? '#fbbf24' : 'rgba(255,255,255,0.06)', border: isCap ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
                  {isCap && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6.5L5 9.5L10 3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Confidence points */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ fontSize: 18 }}>⚡</span>
          <div>
            <p className="text-xs font-black" style={{ color: '#93C5FD', fontFamily: 'var(--font-display)' }}>Confianza · más riesgo, más puntos</p>
            <p className="text-[9px]" style={{ color: '#1E3A5F', fontFamily: 'var(--font-sport)' }}>Normal ×1 · Seguro ×1.5 · ¡Clave! ×2 puntos</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {matches.map((m, i) => {
            const p = picks[i]
            if (!p) return null
            const conf = confidences[i] ?? 1
            const label = p === '1' ? (m.homeShort ?? m.home) : p === '2' ? (m.awayShort ?? m.away) : 'Empate'
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] flex-1 truncate font-black" style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}>
                  {m.homeShort ?? m.home} vs {m.awayShort ?? m.away}
                  <span className="ml-1 font-semibold" style={{ color: PICK_COLOR[p] }}>{label}</span>
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  {([1, 2, 3] as Confidence[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setConfidences(prev => ({ ...prev, [i]: c }))}
                      className="rounded-lg text-[10px] font-black px-2 py-1 transition-all"
                      style={{
                        background: conf === c ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.04)',
                        color: conf === c ? '#93C5FD' : '#4A4A6A',
                        border: conf === c ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        fontFamily: 'var(--font-sport)',
                        transform: conf === c ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      {CONFIDENCE_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Exact scores */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ fontSize: 18 }}>🎯</span>
          <div>
            <p className="text-xs font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>Marcador exacto · opcional</p>
            <p className="text-[9px]" style={{ color: '#3A2A50', fontFamily: 'var(--font-sport)' }}>+50🪙 por cada marcador que aciertes</p>
          </div>
        </div>
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

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-2xl font-black uppercase tracking-widest transition-all"
        style={{
          minHeight: 56, fontSize: 13, fontFamily: 'var(--font-sport)', letterSpacing: '0.09em',
          background: 'linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)',
          color: '#fff',
          border: '1px solid rgba(124,58,237,0.45)',
          boxShadow: '0 8px 28px rgba(124,58,237,0.38), inset 0 1px 0 rgba(255,255,255,0.1)',
          cursor: submitting ? 'not-allowed' : 'pointer',
          animation: 'quinielaPulse 0.85s ease-in-out infinite',
        }}
      >
        🎯 Sellar predicción · gana hasta {matches.length * 10 + (captainIdx != null ? 10 : 0) + 100}🪙
      </button>
    </div>
  )
}
