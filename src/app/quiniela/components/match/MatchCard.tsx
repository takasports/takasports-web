'use client'

import { useState, useEffect } from 'react'
import type { Pick } from '@/components/QuinielaModule'
import { getClubColors } from '@/lib/clubs'
import { PICK_COLOR, PICK_BG, PICK_BORDER, PICK_GLOW } from '../../lib/constants'
import { getMatchContext, aiSuggest, liveOdds } from '../../lib/helpers'
import { loadConsensus } from '../../lib/consensus'
import { nameMatch, OUTCOME_LABEL } from '@/lib/quiniela'
import { useMatchCountdown } from '../../lib/hooks'
import { TeamBadge } from '../atoms/TeamBadge'
import { WinProbabilityBar } from '../atoms/WinProbabilityBar'

// ─────────────────────────────────────────────────────────────────
// Match Card con camisetas
// ─────────────────────────────────────────────────────────────────
export function MatchCard({
  match, index, pick, onPick, forceLocked, showOverlay, comp, time, odds, oddsSource, isoDate,
  comodinAvailable, isComodinUnlocked, onUseComodin, comodinCost, coinBalance, liveScore, finalScore, correct, friendPicks,
  jornada,
  // Sistema de apuesta integrada (Ranked). Si stake/onStakeChange están
  // definidos, el card muestra la barra de apuesta debajo de los picks.
  stake, onStakeChange, fixed, onFix, onEdit,
  stakeMin, stakeMax, stakeDefault,
  showStakeBar,
}: {
  match: { home: string; away: string; homeLogo?: string; awayLogo?: string; homeShort?: string; awayShort?: string }
  index: number; pick?: Pick; onPick: (p: Pick) => void
  forceLocked?: boolean; showOverlay?: boolean
  comp?: string; time?: string
  odds?: { home: number; draw: number; away: number }
  /** Origen de las cuotas. 'internal' muestra badge sutil "Estimada". */
  oddsSource?: 'bookmaker' | 'internal'
  isoDate?: string
  jornada?: string
  comodinAvailable?: boolean
  isComodinUnlocked?: boolean
  onUseComodin?: () => void
  comodinCost?: number
  coinBalance?: number
  liveScore?: { homeGoals: number | null; awayGoals: number | null; elapsed?: number | null; status?: string }
  finalScore?: { homeGoals: number; awayGoals: number }
  correct?: boolean
  friendPicks?: { name: string; pick: string }[]
  /** Monedas apostadas en este pick (Ranked). Undefined = aún sin apuesta. */
  stake?: number
  onStakeChange?: (v: number) => void
  /** true = el user fijó esta apuesta. Compacta la UI y muestra botón Editar. */
  fixed?: boolean
  onFix?: () => void
  onEdit?: () => void
  stakeMin?: number
  stakeMax?: number
  stakeDefault?: number
  /** Mostrar la barra de apuesta integrada. false en PicksSummary (lectura). */
  showStakeBar?: boolean
}) {
  const num = String(index + 1).padStart(2, '0')
  const { started, soon, label: countdownLabel } = useMatchCountdown(isoDate)
  const locked = forceLocked || (started && !isComodinUnlocked)
  const [animPick, setAnimPick] = useState<Pick | null>(null)
  const homeColors = getClubColors(match.home)
  const awayColors = getClubColors(match.away)

  // ── Cuotas vivas: la línea se mueve por el consenso real + tiempo ──
  const [consensus, setConsensus] = useState<{ p1: number; px: number; p2: number; total: number } | null>(null)
  const [oddsTick, setOddsTick] = useState(() => Date.now())
  useEffect(() => {
    if (!jornada || !odds || locked) return
    let cancelled = false
    loadConsensus(jornada).then(rows => {
      if (cancelled) return
      const row = rows.find(r => nameMatch(r.home, match.home) && nameMatch(r.away, match.away))
      if (row) setConsensus({ p1: row.p1, px: row.px, p2: row.p2, total: row.total })
    })
    const t = setInterval(() => setOddsTick(Date.now()), 45_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [jornada, odds, locked, match.home, match.away])
  const shownOdds = liveOdds(odds, consensus, isoDate, oddsTick)

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: pick
          ? `linear-gradient(160deg, ${PICK_BG[pick]} 0%, rgba(255,255,255,0.015) 100%)`
          : `linear-gradient(160deg, ${homeColors.primary}12 0%, rgba(8,0,14,0.92) 48%, ${awayColors.primary}0e 100%)`,
        border: correct === true
          ? '1.5px solid rgba(34,197,94,0.45)'
          : correct === false
          ? '1.5px solid rgba(239,68,68,0.4)'
          : pick ? `1px solid ${PICK_BORDER[pick]}` : '1px solid rgba(255,255,255,0.07)',
        boxShadow: correct === true
          ? '0 0 0 1px rgba(34,197,94,0.12), 0 4px 24px rgba(34,197,94,0.1)'
          : correct === false
          ? '0 0 0 1px rgba(239,68,68,0.1), 0 4px 24px rgba(239,68,68,0.07)'
          : 'none',
        transition: 'border-color 0.22s ease, background 0.22s ease, box-shadow 0.3s ease',
        animation: liveScore?.homeGoals != null && correct === true
          ? 'liveWinPulse 1.8s ease-in-out infinite'
          : liveScore?.homeGoals != null && correct === false
          ? 'liveLosePulse 1.8s ease-in-out infinite'
          : 'none',
      }}
    >
      {/* Team color strip */}
      <div className="absolute top-0 left-0 right-0 flex pointer-events-none" style={{ height: 2, zIndex: 5, opacity: 0.6 }}>
        <div style={{ flex: 1, background: homeColors.primary }} />
        <div style={{ flex: 1, background: awayColors.primary }} />
      </div>

      {pick && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 100%, ${PICK_GLOW[pick]} 0%, transparent 70%)`,
        }} />
      )}

      <div className="relative z-10 px-5 pt-4 pb-5">
        {/* Meta: número + competición + hora */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black tracking-widest" style={{ color: '#252540', fontFamily: 'var(--font-sport)' }}>{num}</span>
            {comp && (
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.04)', color: '#4A4A68', fontFamily: 'var(--font-sport)' }}>
                {comp}
              </span>
            )}
            {/* El badge "📊 EST" se quitó (commit pulidos UX): generaba
                duda en usuarios casuales sobre si las cuotas son "reales".
                Una cuota es una cuota. El prop oddsSource sigue activo
                por si se quiere reactivar el badge en algún flow concreto. */}
          </div>
          <div className="flex items-center gap-1.5">
            {started ? (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', fontFamily: 'var(--font-sport)' }}>
                <span className="w-1 h-1 rounded-full bg-red-400 inline-block animate-pulse" />
                En curso
              </span>
            ) : soon && countdownLabel ? (
              <span className="text-[9px] font-black tabular-nums px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', fontFamily: 'var(--font-sport)' }}>
                ⏱ {countdownLabel}
              </span>
            ) : (
              time && <span className="text-[10px] font-black tabular-nums" style={{ color: '#4A4A6A', fontFamily: 'var(--font-display)' }}>{time}</span>
            )}
            {pick && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: PICK_BG[pick], color: PICK_COLOR[pick], border: `1px solid ${PICK_BORDER[pick]}`, fontFamily: 'var(--font-sport)' }}>
                {pick === '1' ? match.home : pick === '2' ? match.away : 'Empate'}
              </span>
            )}
          </div>
        </div>

        {/* Enfrentamiento con escudos */}
        <div className="flex items-center gap-4 mb-1">
          {/* Equipo local */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <TeamBadge name={match.home} logo={match.homeLogo} size={44} />
            <span
              className="font-black text-center leading-tight"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(0.72rem, 1.5vw, 0.85rem)',
                color: pick === '1' ? '#FFFFFF' : '#C8C8E4',
                transition: 'color 0.2s',
                maxWidth: 90,
              }}
            >
              {match.homeShort ?? match.home}
            </span>
          </div>

          {/* VS central / live or final score */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5" style={{ minWidth: 60 }}>
            {liveScore?.homeGoals != null ? (
              <>
                <span className="font-black tabular-nums" style={{ fontSize: 22, color: '#fca5a5', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', textShadow: '0 0 16px rgba(239,68,68,0.5)', lineHeight: 1 }}>
                  {liveScore.homeGoals}–{liveScore.awayGoals}
                </span>
                <span className="flex items-center gap-1" style={{ fontSize: 7, color: '#f87171', fontFamily: 'var(--font-sport)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span className="w-1 h-1 rounded-full bg-red-400 inline-block animate-pulse" />
                  {liveScore.elapsed ? `${liveScore.elapsed}'` : liveScore.status ?? 'EN VIVO'}
                </span>
              </>
            ) : finalScore ? (
              <>
                <span className="font-black tabular-nums" style={{ fontSize: 22, color: '#C4B5FD', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', lineHeight: 1, animation: 'scoreFlash 0.4s ease both' }}>
                  {finalScore.homeGoals}–{finalScore.awayGoals}
                </span>
                <span style={{ fontSize: 7, color: '#4A3A6A', fontFamily: 'var(--font-sport)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>final</span>
              </>
            ) : (
              <>
                <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-[10px] font-black tracking-widest" style={{ color: '#5A5A80', fontFamily: 'var(--font-sport)' }}>VS</span>
                <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.06)' }} />
              </>
            )}
          </div>

          {/* Equipo visitante */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <TeamBadge name={match.away} logo={match.awayLogo} size={44} />
            <span
              className="font-black text-center leading-tight"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(0.72rem, 1.5vw, 0.85rem)',
                color: pick === '2' ? '#FFFFFF' : '#C8C8E4',
                transition: 'color 0.2s',
                maxWidth: 90,
              }}
            >
              {match.awayShort ?? match.away}
            </span>
          </div>
        </div>

        {/* Context line */}
        {(() => {
          const ctx = getMatchContext(match.home, match.away, odds)
          if (!ctx) return null
          return (
            <p className="text-center mb-4 px-2" style={{ fontSize: 9, color: '#3A3A56', fontFamily: 'var(--font-sport)', fontWeight: 700, letterSpacing: '0.04em' }}>
              {ctx}
            </p>
          )
        })()}

        <WinProbabilityBar odds={shownOdds} userPick={pick} />

        {/* Botones Local / Empate / Visitante */}
        <div className="grid grid-cols-3 gap-2 mt-1" role="radiogroup" aria-label={`Predicción para ${match.home} vs ${match.away}`}>
          {(['1', 'X', '2'] as Pick[]).map((opt) => {
            const selected = pick === opt
            const label = opt === '1' ? (match.homeShort ?? match.home) : opt === '2' ? (match.awayShort ?? match.away) : 'Empate'
            const sublabel = opt === '1' ? 'local' : opt === '2' ? 'visitante' : 'empate'
            const odd = opt === '1' ? shownOdds?.home ?? null : opt === 'X' ? shownOdds?.draw ?? null : shownOdds?.away ?? null
            const aria = opt === '1' ? `Gana local ${match.home}` : opt === '2' ? `Gana visitante ${match.away}` : `Empate entre ${match.home} y ${match.away}`
            return (
              <button
                key={opt}
                role="radio"
                aria-checked={selected}
                aria-label={aria}
                onClick={() => { if (!locked) { onPick(opt); setAnimPick(opt); setTimeout(() => setAnimPick(p => p === opt ? null : p), 350) } }}
                disabled={locked}
                className="rounded-2xl flex flex-col items-center justify-center gap-0.5 px-2"
                style={{
                  minHeight: 48, paddingTop: 10, paddingBottom: 10,
                  background: selected ? PICK_BG[opt] : 'rgba(255,255,255,0.04)',
                  color: selected ? PICK_COLOR[opt] : '#60607A',
                  border: selected ? `1.5px solid ${PICK_BORDER[opt]}` : '1.5px solid rgba(255,255,255,0.09)',
                  boxShadow: selected ? `0 0 18px ${PICK_GLOW[opt]}, inset 0 1px 0 rgba(255,255,255,0.06)` : 'none',
                  transform: animPick === opt ? undefined : selected ? 'scale(1.04) translateY(-1px)' : 'scale(1)',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  animation: animPick === opt ? 'chipPop 0.28s ease both' : 'none',
                  transition: animPick === opt ? 'none' : 'all 0.18s ease',
                }}
              >
                <span className="font-black text-center leading-none" style={{ fontSize: 'clamp(0.95rem,3vw,1.15rem)', fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                  {OUTCOME_LABEL[opt as keyof typeof OUTCOME_LABEL]}
                </span>
                <span className="text-center leading-tight truncate w-full" style={{ fontSize: 'clamp(0.55rem,1.7vw,0.66rem)', fontFamily: 'var(--font-sport)', color: selected ? PICK_COLOR[opt] : '#4A4A6A', maxWidth: 90, fontWeight: 700 }}>
                  {label}
                </span>
                {odd ? (
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: selected ? PICK_COLOR[opt] : '#6A6A8A', fontWeight: 900 }}>
                    ×{odd.toFixed(2)}
                  </span>
                ) : (
                  <span style={{ fontSize: 7, fontFamily: 'var(--font-sport)', opacity: 0.4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {sublabel}
                  </span>
                )}
                {!locked && (() => {
                  // "Si acertás +X🪙" en cada botón: usa el stake del card si
                  // está definido (modo Ranked con apuesta integrada), o el
                  // default 10 como aproximación si todavía no se eligió stake.
                  const effectiveStake = stake ?? stakeDefault ?? 10
                  const ret = odd ? Math.round(effectiveStake * odd) : effectiveStake
                  return (
                    <span style={{ fontSize: 7, fontFamily: 'var(--font-sport)', fontWeight: 900, color: selected ? PICK_COLOR[opt] : '#2A2A42', opacity: selected ? 0.85 : 0.45, marginTop: 1 }}>
                      +{ret}🪙
                    </span>
                  )
                })()}
              </button>
            )
          })}
        </div>

        {/* ── BARRA DE APUESTA INTEGRADA (Ranked) ────────────────────
            Aparece solo si hay pick + props de stake habilitadas.
            Dos modos: editando (input +/-) y fijado (compacto con Editar). */}
        {pick && !locked && showStakeBar && onStakeChange && (
          <div className="mt-3 rounded-xl overflow-hidden" style={{ background: 'rgba(34,197,94,0.04)', border: `1px solid ${fixed ? 'rgba(134,239,172,0.35)' : 'rgba(34,197,94,0.18)'}` }}>
            {(() => {
              const min = stakeMin ?? 1
              const max = stakeMax ?? 200
              const def = stakeDefault ?? 10
              const stk = Math.max(0, Math.floor(stake ?? def))
              const pickOdd = pick === '1' ? (shownOdds?.home ?? 1) : pick === '2' ? (shownOdds?.away ?? 1) : (shownOdds?.draw ?? 1)
              const eff = Math.max(1, pickOdd)
              const ret = Math.round(stk * eff)
              const profit = ret - stk

              if (fixed) {
                // Estado FIJADO: barra ultra compacta
                return (
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    <span style={{ fontSize: 14, lineHeight: 1, color: '#4ade80' }}>✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black tabular-nums" style={{ color: '#86efac', fontFamily: 'var(--font-display)' }}>
                        Apostás {stk}🪙 → ganás {ret}🪙 si acertás
                      </p>
                      <p className="text-[9px]" style={{ color: '#3A5A48', fontFamily: 'var(--font-sport)' }}>
                        Cuota fijada ×{eff.toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEdit?.()}
                      className="text-[10px] font-black px-2.5 py-1 rounded transition-opacity hover:opacity-80"
                      style={{ background: 'rgba(255,255,255,0.04)', color: '#86efac', border: '1px solid rgba(134,239,172,0.25)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                    >
                      Editar
                    </button>
                  </div>
                )
              }

              // Estado EDITANDO: input +/- + retorno + botón Fijar
              return (
                <div className="flex flex-col">
                  <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>
                      Apostás
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onStakeChange(Math.max(min, stk - 5))}
                        aria-label="Bajar stake"
                        className="w-7 h-7 rounded font-black flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#86efac', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1, cursor: 'pointer' }}
                      >−</button>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        value={stk}
                        onChange={e => {
                          const v = Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0)))
                          onStakeChange(v)
                        }}
                        aria-label={`Stake en ${match.home} vs ${match.away}`}
                        className="w-16 px-2 py-1 rounded text-sm font-black tabular-nums text-center outline-none"
                        style={{ background: 'rgba(0,0,0,0.4)', color: '#E0F0E5', border: '1px solid rgba(134,239,172,0.3)', fontFamily: 'var(--font-display)' }}
                      />
                      <button
                        type="button"
                        onClick={() => onStakeChange(Math.min(max, stk + 5))}
                        aria-label="Subir stake"
                        className="w-7 h-7 rounded font-black flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#86efac', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1, cursor: 'pointer' }}
                      >+</button>
                      <span className="text-[10px] font-bold" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>🪙</span>
                    </div>
                    <span className="flex-1" />
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] uppercase tracking-widest" style={{ color: '#5A7068', fontFamily: 'var(--font-sport)' }}>Si acertás</span>
                      <span className="text-sm font-black tabular-nums" style={{ color: stk > 0 ? '#fbbf24' : '#3A4A45', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                        {ret}🪙
                      </span>
                      {stk > 0 && profit > 0 && (
                        <span className="text-[8px] font-bold tabular-nums" style={{ color: '#86efac', fontFamily: 'var(--font-sport)' }}>
                          +{profit} neto
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFix?.()}
                    disabled={stk <= 0}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest transition-opacity disabled:opacity-40 hover:opacity-90"
                    style={{
                      background: stk > 0 ? 'linear-gradient(135deg, rgba(34,197,94,0.22), rgba(16,185,129,0.16))' : 'rgba(255,255,255,0.03)',
                      color: stk > 0 ? '#86efac' : '#3A5A48',
                      border: 'none',
                      borderTop: stk > 0 ? '1px solid rgba(134,239,172,0.25)' : '1px solid rgba(255,255,255,0.04)',
                      fontFamily: 'var(--font-sport)',
                      letterSpacing: '0.1em',
                      cursor: stk > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    ✓ Fijar apuesta
                  </button>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── AI Sugerencia ── */}
        {odds && !locked && (() => {
          const { pick: aiPick, confidence } = aiSuggest(odds)
          // Normalize double-chance to simple pick for comparison
          const aiBase = aiPick === '1X' ? '1' : aiPick === 'X2' ? '2' : aiPick
          const userAgreed = !pick ? null : (pick === aiBase || (aiPick === '1X' && pick === 'X') || (aiPick === 'X2' && pick === 'X'))
          const aiLabel = aiPick === '1' ? (match.homeShort ?? match.home) : aiPick === '2' ? (match.awayShort ?? match.away) : 'Empate'
          return (
            <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 12 }}>🤖</span>
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#2E2E48', fontFamily: 'var(--font-sport)' }}>IA sugiere</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md truncate max-w-[80px]" style={{ background: PICK_BG[aiBase as Pick], color: PICK_COLOR[aiBase as Pick], border: `1px solid ${PICK_BORDER[aiBase as Pick]}`, fontFamily: 'var(--font-display)' }}>
                {aiLabel}
              </span>
              <span className="text-[8px] font-black tabular-nums" style={{ color: '#353550', fontFamily: 'var(--font-sport)' }}>{confidence}%</span>
              {userAgreed !== null && (
                <span className="ml-auto text-[8px] font-black" style={{ color: userAgreed ? '#4ade80' : '#fb923c', fontFamily: 'var(--font-sport)' }}>
                  {userAgreed ? '↑ Con la IA' : '↓ Contra la IA'}
                </span>
              )}
            </div>
          )
        })()}

        {/* ── Picks de amigos ── */}
        {friendPicks && friendPicks.length > 0 && (
          <div className="mt-2 pt-2 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 9, color: '#2A2A40', fontFamily: 'var(--font-sport)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amigos:</span>
            {friendPicks.map(fp => {
              const fLabel = fp.pick === '1' ? match.homeShort ?? match.home : fp.pick === '2' ? match.awayShort ?? match.away : 'Empate'
              return (
                <span key={fp.name} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black" style={{
                  background: (PICK_BG as Record<string, string>)[fp.pick] ?? 'rgba(255,255,255,0.04)',
                  color: (PICK_COLOR as Record<string, string>)[fp.pick] ?? '#6060A0',
                  border: `1px solid ${(PICK_BORDER as Record<string, string>)[fp.pick] ?? 'rgba(255,255,255,0.08)'}`,
                  fontFamily: 'var(--font-sport)',
                }}>
                  {fp.name.split(' ')[0]} → {fLabel}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {(showOverlay || (started && !isComodinUnlocked)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-20" style={{ background: 'rgba(8,0,15,0.55)', backdropFilter: 'blur(2px)' }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#f87171', fontFamily: 'var(--font-sport)' }}>En curso · bloqueado</span>
          </div>
          {!forceLocked && comodinAvailable && (
            <button
              onClick={(e) => { e.stopPropagation(); onUseComodin?.() }}
              disabled={comodinCost != null && (coinBalance ?? 0) < comodinCost}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black transition-transform hover:scale-105 active:scale-95"
              style={{
                background: (comodinCost != null && (coinBalance ?? 0) < comodinCost) ? 'rgba(255,255,255,0.04)' : 'rgba(245,158,11,0.18)',
                color: (comodinCost != null && (coinBalance ?? 0) < comodinCost) ? '#3A3A4A' : '#fbbf24',
                border: (comodinCost != null && (coinBalance ?? 0) < comodinCost) ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(245,158,11,0.45)',
                fontFamily: 'var(--font-sport)',
                boxShadow: (comodinCost != null && (coinBalance ?? 0) < comodinCost) ? 'none' : '0 0 16px rgba(245,158,11,0.25)',
                cursor: (comodinCost != null && (coinBalance ?? 0) < comodinCost) ? 'not-allowed' : 'pointer',
              }}
            >
              ⚡ Usar comodín {comodinCost != null && <span style={{ opacity: 0.7 }}>· {comodinCost}🪙</span>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
