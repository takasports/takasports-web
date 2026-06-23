'use client'

import { useState, useEffect, useRef } from 'react'
import { trackGameStart } from '@/lib/analytics'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { trackGameEvent } from '@/lib/games-telemetry'
import { shareResult } from '@/lib/share'
import type { GamePlay } from '@/lib/games-store'
import type { QuinielaMatch, Pick } from '@/components/QuinielaModule'
import { nameMatch } from '@/lib/quiniela'
import { PICK_COLOR, PICK_BG, PICK_BORDER } from '../../lib/constants'
import { isCorrect } from '../../lib/helpers'
import type { MatchResult } from '../../lib/types'
import { TeamBadge } from '../atoms/TeamBadge'
import { ConfettiPiece } from '../atoms/ConfettiPiece'
import { BoltIcon, CheckIcon, CloseIcon, TrophyIcon, StarIcon, FlexIcon } from '@/components/icons/GameIcons'

export function RevealCeremony({ picks, results, matchData, onComplete }: {
  picks: Array<{ home: string; away: string; pick: string }>
  results: MatchResult[]
  matchData?: QuinielaMatch[]
  onComplete: () => void
}) {
  const [phase, setPhase] = useState<'intro' | 'cards' | 'summary'>('intro')
  const [cardIdx, setCardIdx] = useState(0)
  const [showCard, setShowCard] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  // Overlay modal: Escape sale de la ceremonia (a "mis picks") y el Tab queda
  // atrapado dentro. Devuelve el foco al disparador al cerrar.
  useFocusTrap(true, dialogRef, onComplete)

  const evaluated = picks.map(p => ({
    ...p,
    result: results.find(r => nameMatch(r.home, p.home) && nameMatch(r.away, p.away)),
  })).filter(p => !!p.result) as Array<{ home: string; away: string; pick: string; result: MatchResult }>

  const total = evaluated.length
  const scored = evaluated.filter(p => isCorrect(p.pick as Pick, p.result.outcome)).length

  useEffect(() => {
    if (phase !== 'cards') return
    setShowCard(false)
    const t = setTimeout(() => setShowCard(true), 130)
    return () => clearTimeout(t)
  }, [cardIdx, phase])

  const current = evaluated[cardIdx]
  const correct = current ? isCorrect(current.pick as Pick, current.result.outcome) : false

  const advance = () => {
    if (cardIdx < total - 1) setCardIdx(i => i + 1)
    else setPhase('summary')
  }

  // Share del resultado usando el helper genérico de lib/share.ts.
  // Construye un GamePlay sintético con el shape que espera encodeQuiniela:
  // payload.picks y payload.results como strings.
  const handleShare = async () => {
    const period = new Date().toISOString().slice(0, 10)
    const play = {
      game_id: 'quiniela',
      period,
      score: scored,
      payload: {
        picks: evaluated.map(p => p.pick),
        results: evaluated.map(p => p.result.outcome),
      },
    } as unknown as GamePlay
    const res = await shareResult(play)
    if (res !== 'failed') {
      trackGameEvent({ gameId: 'quiniela', event: 'shared', period, meta: { via: res } })
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Revelación de resultados de la quiniela"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: 'rgba(3,0,9,0.97)', backdropFilter: 'blur(20px)' }}
    >
      {/* ── Intro ── */}
      {phase === 'intro' && (
        <div className="flex flex-col items-center gap-8 text-center px-8" style={{ animation: 'revealPop 0.5s ease both' }}>
          <div style={{ lineHeight: 1, color: '#FDE68A', display: 'flex' }}><BoltIcon size={72} /></div>
          <div>
            <p className="font-black leading-none mb-3" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem,6vw,3.4rem)', color: '#F8F8FF', letterSpacing: '-0.03em' }}>
              Revelar resultados
            </p>
            <p className="text-sm" style={{ color: '#9090A4', fontFamily: 'var(--font-sport)' }}>
              {total} partidos evaluados · ¿Cuántos habrás acertado?
            </p>
          </div>
          <button
            onClick={() => { trackGameStart('quiniela'); setPhase('cards') }}
            className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)',
              color: '#fff', fontSize: 14, fontFamily: 'var(--font-sport)', letterSpacing: '0.1em',
              boxShadow: '0 8px 36px rgba(124,58,237,0.55)',
              animation: 'quinielaPulse 2.2s ease-in-out infinite',
            }}
          >
            ¡Comenzar! →
          </button>
        </div>
      )}

      {/* ── Card reveal ── */}
      {phase === 'cards' && current && (
        <div className="flex flex-col items-center gap-5 px-6 w-full max-w-xs">
          {/* Progress bar */}
          <div className="flex items-center gap-1.5">
            {evaluated.map((ep, i) => {
              const done = i < cardIdx
              const active = i === cardIdx
              const wasCorrect = done && isCorrect(ep.pick as Pick, ep.result.outcome)
              return (
                <div key={i} style={{
                  height: 4, borderRadius: 2,
                  width: active ? 28 : done ? 20 : 6,
                  background: active ? '#C4B5FD' : done ? (wasCorrect ? '#22c55e' : '#ef4444') : 'rgba(255,255,255,0.07)',
                  transition: 'all 0.35s ease',
                }} />
              )
            })}
          </div>

          {showCard && (
            <div
              className="w-full flex flex-col items-center gap-5 rounded-3xl p-6"
              style={{
                background: correct
                  ? 'linear-gradient(160deg, rgba(34,197,94,0.1) 0%, rgba(0,0,0,0.5) 100%)'
                  : 'linear-gradient(160deg, rgba(239,68,68,0.1) 0%, rgba(0,0,0,0.5) 100%)',
                border: correct ? '1.5px solid rgba(34,197,94,0.3)' : '1.5px solid rgba(239,68,68,0.25)',
                boxShadow: correct ? '0 0 50px rgba(34,197,94,0.14)' : '0 0 50px rgba(239,68,68,0.1)',
                animation: 'revealSlam 0.38s cubic-bezier(0.34,1.56,0.64,1) both',
              }}
            >
              {/* Teams + score */}
              {(() => {
                const md = matchData?.find(m => nameMatch(m.home, current.home) && nameMatch(m.away, current.away))
                return (
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex-1 flex flex-col items-center gap-2">
                  <TeamBadge name={current.home} logo={md?.homeLogo} size={48} />
                  <span className="font-black text-xs text-center leading-tight" style={{ color: '#C0C0E0', fontFamily: 'var(--font-display)', maxWidth: 80 }}>
                    {current.home}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-black tabular-nums" style={{
                    fontSize: 36, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', lineHeight: 1,
                    color: correct ? '#4ade80' : '#f87171',
                    textShadow: correct ? '0 0 30px rgba(34,197,94,0.5)' : '0 0 30px rgba(239,68,68,0.5)',
                    animation: 'scoreFlash 0.45s ease both 0.15s',
                  }}>
                    {current.result.homeGoals}–{current.result.awayGoals}
                  </span>
                  <span style={{ fontSize: 7, color: '#3A3A58', fontFamily: 'var(--font-sport)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>resultado</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-2">
                  <TeamBadge name={current.away} logo={md?.awayLogo} size={48} />
                  <span className="font-black text-xs text-center leading-tight" style={{ color: '#C0C0E0', fontFamily: 'var(--font-display)', maxWidth: 80 }}>
                    {current.away}
                  </span>
                </div>
              </div>
                )
              })()}

              {/* Pick + verdict */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>Tu pick</span>
                  <span className="font-black px-3 py-2 rounded-xl text-center leading-tight" style={{
                    fontSize: 'clamp(0.7rem,3vw,0.9rem)', maxWidth: 90,
                    fontFamily: 'var(--font-display)',
                    background: PICK_BG[current.pick as Pick],
                    color: PICK_COLOR[current.pick as Pick],
                    border: `1.5px solid ${PICK_BORDER[current.pick as Pick]}`,
                  }}>
                    {current.pick === '1' ? current.home : current.pick === '2' ? current.away : 'Empate'}
                  </span>
                </div>
                <span style={{
                  fontSize: 52, lineHeight: 1,
                  animation: correct
                    ? 'revealPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both 0.25s'
                    : 'cardShake 0.45s ease both 0.25s',
                }}>
                  {correct
                    ? <span style={{ color: '#4ade80', display: 'inline-flex' }}><CheckIcon size={48} /></span>
                    : <span style={{ color: '#f87171', display: 'inline-flex' }}><CloseIcon size={48} /></span>}
                </span>
              </div>
            </div>
          )}

          {showCard && (
            <button
              onClick={advance}
              className="w-full py-3.5 rounded-2xl font-black uppercase tracking-widest transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: correct ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                color: correct ? '#4ade80' : '#f87171',
                border: correct ? '1.5px solid rgba(34,197,94,0.35)' : '1.5px solid rgba(239,68,68,0.25)',
                fontFamily: 'var(--font-sport)', fontSize: 12,
              }}
            >
              {cardIdx < total - 1 ? 'Siguiente →' : 'Ver resultado final →'}
            </button>
          )}
        </div>
      )}

      {/* ── Summary ── */}
      {phase === 'summary' && scored >= Math.ceil(total * 0.6) && (
        Array.from({ length: 22 }).map((_, i) => <ConfettiPiece key={i} i={i} />)
      )}
      {phase === 'summary' && (
        <div className="flex flex-col items-center gap-8 px-6 text-center" style={{ animation: 'revealPop 0.55s ease both' }}>
          <div style={{ lineHeight: 1, display: 'flex', justifyContent: 'center' }}>
            {scored >= Math.ceil(total * 0.8)
              ? <span style={{ color: '#FDE68A', display: 'inline-flex' }}><TrophyIcon size={80} /></span>
              : scored >= Math.ceil(total * 0.5)
                ? <span style={{ color: '#FDE68A', display: 'inline-flex' }}><StarIcon size={80} /></span>
                : <span style={{ color: '#A78BFA', display: 'inline-flex' }}><FlexIcon size={80} /></span>}
          </div>
          <div>
            <p className="font-black leading-none mb-4" style={{
              fontFamily: 'var(--font-display)', letterSpacing: '-0.03em',
              fontSize: 'clamp(4rem,10vw,6rem)',
              color: scored >= total * 0.5 ? '#fbbf24' : '#C0C0D8',
            }}>
              {scored}<span style={{ fontSize: '0.45em', color: '#4A4A6A' }}>/{total}</span>
            </p>
            <p className="text-sm font-black" style={{
              fontFamily: 'var(--font-sport)',
              color: scored >= total * 0.7 ? '#4ade80' : scored >= total * 0.4 ? '#fbbf24' : '#f87171',
            }}>
              {scored >= Math.ceil(total * 0.8) ? '¡Increíble! Eres un experto.'
               : scored >= Math.ceil(total * 0.5) ? '¡Buen resultado! Estuviste cerca.'
               : 'La próxima jornada te va mejor.'}
            </p>
            {/* Recompensa: NO inventamos cifra. Antes se mostraba aciertos×10 (+100
                pleno), una fórmula de "monedas" muerta que NO coincide con el
                scoring real fijo que acredita el servidor al cerrar la jornada.
                Mostramos solo un aviso honesto de que los puntos se suman a la
                Liga Taka; la cifra real la pone el backend (award_points). */}
            {scored > 0 && (
              <div className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl" style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.25)' }}>
                <span className="text-[11px] font-black uppercase" style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)', letterSpacing: '0.07em' }}>
                  Suma a tu Liga Taka
                </span>
                {scored === total && total > 0 && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.18)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', fontFamily: 'var(--font-sport)' }}>
                    PLENO
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(124,58,237,0.12)',
                color: '#C4B5FD',
                border: '1px solid rgba(124,58,237,0.35)',
                fontSize: 12, fontFamily: 'var(--font-sport)', letterSpacing: '0.09em',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M9 4l-4 3 4 3M5 7h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="3" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              Compartir
            </button>
            <button
              onClick={onComplete}
              className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg,#7C3AED,#5B21B6)',
                color: '#fff', fontSize: 13, fontFamily: 'var(--font-sport)', letterSpacing: '0.09em',
                boxShadow: '0 8px 28px rgba(124,58,237,0.4)',
              }}
            >
              Ver mis picks
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
