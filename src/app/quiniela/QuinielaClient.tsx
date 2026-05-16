'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { trackGameStart, trackGameComplete } from '@/lib/analytics'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import {
  QUINIELA_PICKS_KEY,
} from '@/components/QuinielaModule'
import type { QuinielaMatch, QuinielaSaved, Pick } from '@/components/QuinielaModule'
import { getClubColors, COMPETITIONS } from '@/lib/clubs'
import type { Competition } from '@/lib/clubs'
import { nameMatch } from '@/lib/quiniela'
import type { Confidence } from '@/lib/quiniela'
import { CONFIDENCE_LABELS } from '@/lib/quiniela'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import {
  PICK_COLOR, PICK_BG, PICK_BORDER, PICK_GLOW,
  BADGES_KEY, COINS_KEY, COINS_TXN_KEY, COINS_INITIAL,
  STREAK_KEY, TUTORED_KEY, LEAGUES_KEY, ONBOARDING_STEPS,
} from './lib/constants'
import type { BadgeId, CoinTxn, League, MatchResult } from './lib/types'
import { BADGE_DEFS } from './lib/types'
import {
  getISOWeek, computeStreak, isCorrect, teamForm, communityTrend,
  getCoins, addCoins, computeCoinRewards, computeNewBadges,
  communityLeaderboard, communityConsensus, aiSuggest, scorelinesFor,
  getMatchContext, getDivision, scoreForMember,
} from './lib/helpers'
import { usePushSubscription, useMatchCountdown } from './lib/hooks'
import { InfoTip } from './components/atoms/InfoTip'
import { ProgressBar } from './components/atoms/ProgressBar'
import { WinProbabilityBar } from './components/atoms/WinProbabilityBar'
import { ConfettiPiece } from './components/atoms/ConfettiPiece'
import { TeamBadge, JerseyIcon } from './components/atoms/TeamBadge'
import { GoogleSignInButton } from './components/atoms/GoogleSignInButton'

function ConsensusBar({ match, userPick }: { match: QuinielaMatch; userPick: Pick | undefined }) {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 180_000))
  useEffect(() => {
    const t = setInterval(() => setTick(Math.floor(Date.now() / 180_000)), 30_000)
    return () => clearInterval(t)
  }, [])

  const { p1, pX, p2 } = communityConsensus(match)
  const { d1, dX, d2 } = communityTrend(match, tick)
  const segs: { key: Pick; pct: number; color: string; delta: number }[] = [
    { key: '1', pct: p1, color: '#22c55e', delta: d1 },
    { key: 'X', pct: pX, color: '#f59e0b', delta: dX },
    { key: '2', pct: p2, color: '#ef4444', delta: d2 },
  ]
  const userBase: Pick | null = userPick === '1' || userPick === '1X' ? '1' : userPick === '2' || userPick === 'X2' ? '2' : userPick === 'X' ? 'X' : null
  return (
    <div className="rounded-b-2xl px-5 pb-3.5 pt-2.5" style={{ background: 'rgba(255,255,255,0.012)', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[7.5px] font-black uppercase tracking-widest" style={{ color: '#252538', fontFamily: 'var(--font-sport)' }}>
          Comunidad
        </p>
        <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)', fontFamily: 'var(--font-sport)' }}>
          <span className="w-1 h-1 rounded-full bg-red-400 inline-block animate-pulse mr-0.5" />
          EN VIVO
        </span>
      </div>
      <div className="flex rounded overflow-hidden mb-1.5" style={{ height: 5, gap: 1 }}>
        {segs.map(s => (
          <div key={s.key} style={{ width: `${s.pct}%`, background: userBase === s.key ? s.color : `${s.color}50`, transition: 'width 0.8s ease' }} />
        ))}
      </div>
      <div className="flex">
        {segs.map(s => (
          <div key={s.key} style={{ width: `${s.pct}%` }} className="flex justify-center">
            <div className="flex items-center gap-0.5">
              <span style={{ fontSize: 8, fontWeight: 900, fontFamily: 'var(--font-sport)', color: userBase === s.key ? s.color : '#2A2A42', whiteSpace: 'nowrap' }}>
                {s.key} {s.pct}%
              </span>
              {s.delta !== 0 && (
                <span style={{ fontSize: 7, fontWeight: 900, color: s.delta > 0 ? '#4ade80' : '#f87171', lineHeight: 1 }}>
                  {s.delta > 0 ? '↑' : '↓'}{Math.abs(s.delta)}
                </span>
              )}
              {userBase === s.key && (
                <span style={{ fontSize: 7, color: s.color, fontWeight: 900 }}>←</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {userBase && (
        <p className="mt-1.5 text-[7.5px] font-black tabular-nums text-center" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
          Vas con el {segs.find(s => s.key === userBase)?.pct ?? 0}% de la comunidad
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Match Card con camisetas
// ─────────────────────────────────────────────────────────────────
function MatchCard({
  match, index, pick, onPick, forceLocked, showOverlay, comp, time, odds, isoDate,
  comodinAvailable, isComodinUnlocked, onUseComodin, comodinCost, coinBalance, liveScore, finalScore, correct, friendPicks,
  isCaptain, onSetCaptain,
}: {
  match: { home: string; away: string; homeLogo?: string; awayLogo?: string; homeShort?: string; awayShort?: string }
  index: number; pick?: Pick; onPick: (p: Pick) => void
  forceLocked?: boolean; showOverlay?: boolean
  comp?: string; time?: string
  odds?: { home: number; draw: number; away: number }
  isoDate?: string
  comodinAvailable?: boolean
  isComodinUnlocked?: boolean
  onUseComodin?: () => void
  comodinCost?: number
  coinBalance?: number
  liveScore?: { homeGoals: number | null; awayGoals: number | null; elapsed?: number | null; status?: string }
  finalScore?: { homeGoals: number; awayGoals: number }
  correct?: boolean
  friendPicks?: { name: string; pick: string }[]
  isCaptain?: boolean
  onSetCaptain?: () => void
}) {
  const num = String(index + 1).padStart(2, '0')
  const { started, soon, label: countdownLabel } = useMatchCountdown(isoDate)
  const locked = forceLocked || (started && !isComodinUnlocked)
  const [animPick, setAnimPick] = useState<Pick | null>(null)
  const homeColors = getClubColors(match.home)
  const awayColors = getClubColors(match.away)

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
          : isCaptain ? '1.5px solid rgba(251,191,36,0.55)'
          : pick ? `1px solid ${PICK_BORDER[pick]}` : '1px solid rgba(255,255,255,0.07)',
        boxShadow: correct === true
          ? '0 0 0 1px rgba(34,197,94,0.12), 0 4px 24px rgba(34,197,94,0.1)'
          : correct === false
          ? '0 0 0 1px rgba(239,68,68,0.1), 0 4px 24px rgba(239,68,68,0.07)'
          : isCaptain ? '0 0 0 1px rgba(251,191,36,0.15), 0 6px 28px rgba(251,191,36,0.12)'
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
            {/* Captain toggle */}
            {onSetCaptain && !locked && (
              <button
                onClick={(e) => { e.stopPropagation(); onSetCaptain() }}
                title={isCaptain ? 'Capitán activo · 2x puntos' : 'Hacer capitán · dobla puntos si aciertas'}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-all"
                style={{
                  background: isCaptain ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.04)',
                  border: isCaptain ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isCaptain ? '0 0 10px rgba(251,191,36,0.3)' : 'none',
                }}
              >
                <span style={{ fontSize: 11, filter: isCaptain ? 'none' : 'grayscale(1) opacity(0.4)' }}>👑</span>
                {isCaptain && <span style={{ fontSize: 8, fontWeight: 900, color: '#fbbf24', fontFamily: 'var(--font-sport)', letterSpacing: '0.04em' }}>2x</span>}
              </button>
            )}
            {isCaptain && !onSetCaptain && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' }}>
                <span style={{ fontSize: 10 }}>👑</span>
                <span style={{ fontSize: 8, fontWeight: 900, color: '#fbbf24', fontFamily: 'var(--font-sport)' }}>2x</span>
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
            <div className="flex items-center gap-0.5">
              {teamForm(match.home).map((r, i) => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: r === 'W' ? '#22c55e' : r === 'D' ? '#6b7280' : '#ef4444',
                  opacity: 0.6 + i * 0.08,
                }} title={r} />
              ))}
            </div>
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
            <div className="flex items-center gap-0.5">
              {teamForm(match.away).map((r, i) => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: r === 'W' ? '#22c55e' : r === 'D' ? '#6b7280' : '#ef4444',
                  opacity: 0.6 + i * 0.08,
                }} title={r} />
              ))}
            </div>
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

        <WinProbabilityBar odds={odds} userPick={pick} />

        {/* Botones Local / Empate / Visitante */}
        <div className="grid grid-cols-3 gap-2 mt-1" role="radiogroup" aria-label={`Predicción para ${match.home} vs ${match.away}`}>
          {(['1', 'X', '2'] as Pick[]).map((opt) => {
            const selected = pick === opt
            const label = opt === '1' ? (match.homeShort ?? match.home) : opt === '2' ? (match.awayShort ?? match.away) : 'Empate'
            const sublabel = opt === '1' ? 'local' : opt === '2' ? 'visitante' : 'empate'
            const odd = opt === '1' ? odds?.home ?? null : opt === 'X' ? odds?.draw ?? null : odds?.away ?? null
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
                <span className="font-black text-center leading-tight truncate w-full" style={{ fontSize: 'clamp(0.65rem,2vw,0.78rem)', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', maxWidth: 90 }}>
                  {label}
                </span>
                {odd ? (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-sport)', color: selected ? PICK_COLOR[opt] : '#4A4A6A', fontWeight: 700 }}>
                    {odd.toFixed(2)}
                  </span>
                ) : (
                  <span style={{ fontSize: 7, fontFamily: 'var(--font-sport)', opacity: 0.4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {sublabel}
                  </span>
                )}
                {!locked && (
                  <span style={{ fontSize: 7, fontFamily: 'var(--font-sport)', fontWeight: 900, color: selected ? PICK_COLOR[opt] : '#2A2A42', opacity: selected ? 0.85 : 0.45, marginTop: 1 }}>
                    +10🪙
                  </span>
                )}
              </button>
            )
          })}
        </div>

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

// ─────────────────────────────────────────────────────────────────
// Formulario — picks de la quiniela oficial
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Quick-pick IA — autocompleta picks pendientes con la sugerencia
// ─────────────────────────────────────────────────────────────────
function QuickPickIA({ matches, picks, onApply }: { matches: QuinielaMatch[]; picks: Record<number, Pick>; onApply: (next: Record<number, Pick>) => void }) {
  const pendientes = matches.reduce((n, m, i) => (picks[i] === undefined && (!m.isoDate || new Date(m.isoDate).getTime() > Date.now()) ? n + 1 : n), 0)
  if (pendientes === 0) return null
  const handle = () => {
    const next = { ...picks }
    matches.forEach((m, i) => {
      if (next[i] !== undefined) return
      if (m.isoDate && new Date(m.isoDate).getTime() <= Date.now()) return
      if (!m.odds) { next[i] = 'X'; return }
      const { pick } = aiSuggest(m.odds)
      next[i] = pick === '1X' ? '1' : pick === 'X2' ? '2' : pick
    })
    onApply(next)
  }
  return (
    <button
      onClick={handle}
      className="w-full rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
      style={{ background: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(124,58,237,0.35)', color: '#C4B5FD', fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', minHeight: 44 }}
    >
      <span style={{ fontSize: 14 }}>🤖</span>
      Rellena los {pendientes} restantes con la IA
      <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4 }}>(editable)</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
// Streak hero — Duolingo-style si racha ≥ 2
// ─────────────────────────────────────────────────────────────────
function StreakHero({ current }: { current: number }) {
  if (current < 2) return null
  return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,rgba(251,146,60,0.14),rgba(239,68,68,0.08))', border: '1px solid rgba(251,146,60,0.35)' }}>
      <span style={{ fontSize: 28, filter: 'drop-shadow(0 0 6px rgba(251,146,60,0.6))' }}>🔥</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black leading-none" style={{ color: '#fb923c', fontFamily: 'var(--font-display)' }}>
          {current} semana{current !== 1 ? 's' : ''} seguida{current !== 1 ? 's' : ''}
        </p>
        <p className="text-[10px] mt-1" style={{ color: '#7A4530', fontFamily: 'var(--font-sport)' }}>
          Manda tus picks antes del cierre para no perderla
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sticky betslip — footer fijo con progreso y CTA
// ─────────────────────────────────────────────────────────────────
function StickyBetslip({ done, total, allDone, captainSet, onSubmit, urgent }: { done: number; total: number; allDone: boolean; captainSet: boolean; onSubmit: () => void; urgent: boolean }) {
  const potential = done * 10 + (captainSet ? 10 : 0) + (allDone ? 100 : 0)
  const cta = allDone
    ? captainSet ? 'Siguiente: ajusta marcadores →' : 'Siguiente: elige capitán →'
    : `Te quedan ${total - done} partido${total - done !== 1 ? 's' : ''}`
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 -mx-1 pt-3 pb-3" style={{ background: 'linear-gradient(to top, #060010 0%, #060010 60%, transparent 100%)' }}>
      <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(10,2,20,0.96)', backdropFilter: 'blur(16px)', border: '1px solid rgba(124,58,237,0.28)', boxShadow: '0 -8px 24px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center gap-3 mb-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-black tabular-nums" style={{ fontSize: 18, color: '#F8F8FF', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{done}/{total}</span>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>picks</span>
            </div>
            <div className="mt-1.5 w-full rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: allDone ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#7C3AED,#A78BFA)', transition: 'width 0.3s' }} />
            </div>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>Si aciertas todo</span>
            <span className="font-black tabular-nums" style={{ fontSize: 16, color: '#fbbf24', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {potential}🪙
            </span>
          </div>
        </div>
        <button
          onClick={onSubmit}
          disabled={!allDone}
          aria-label={cta}
          className="w-full rounded-xl font-black uppercase tracking-widest transition-opacity"
          style={{
            minHeight: 48, fontSize: 12, fontFamily: 'var(--font-sport)', letterSpacing: '0.09em',
            background: allDone ? 'linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)' : 'rgba(255,255,255,0.04)',
            color: allDone ? '#fff' : '#3A3A50',
            border: allDone ? '1px solid rgba(124,58,237,0.45)' : '1px solid rgba(255,255,255,0.05)',
            boxShadow: allDone ? '0 6px 22px rgba(124,58,237,0.35)' : 'none',
            cursor: allDone ? 'pointer' : 'not-allowed',
            animation: allDone && urgent ? 'quinielaPulse 0.85s ease-in-out infinite' : 'none',
          }}
        >
          {cta}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Onboarding bottom-sheet (4 pasos swipeable + skippable)
// ─────────────────────────────────────────────────────────────────
function OnboardingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!open) return
    setStep(0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setStep(s => Math.min(s + 1, ONBOARDING_STEPS.length - 1))
      if (e.key === 'ArrowLeft') setStep(s => Math.max(s - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  const isLast = step === ONBOARDING_STEPS.length - 1
  const s = ONBOARDING_STEPS[step]
  return (
    <div role="dialog" aria-modal="true" aria-label="Cómo jugar a la Quiniela" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" style={{ background: 'rgba(3,0,9,0.85)', backdropFilter: 'blur(12px)', animation: 'fadeIn 0.2s ease both' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 relative" style={{ background: 'linear-gradient(160deg,#13002A 0%,#08000F 100%)', border: '1px solid rgba(124,58,237,0.3)', boxShadow: '0 -24px 60px rgba(0,0,0,0.6)', animation: 'sealPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <button aria-label="Cerrar" onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', color: '#9090B0', border: 'none', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <div className="flex items-center gap-1.5 mb-5">
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} aria-current={i === step} style={{ width: i === step ? 24 : 6, height: 4, borderRadius: 2, background: i <= step ? '#7C3AED' : 'rgba(255,255,255,0.1)', transition: 'width 0.25s, background 0.25s' }} />
          ))}
        </div>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>{s.emoji}</div>
        <h2 className="font-black mb-3" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem,4.4vw,2rem)', color: '#F8F8FF', letterSpacing: '-0.02em', lineHeight: 1.05 }}>{s.title}</h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: '#B8B0D0', fontFamily: 'var(--font-sport)' }}>{s.body}</p>
        {s.hint && (
          <div className="rounded-xl px-3 py-2.5 flex items-start gap-2 mb-5" style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)' }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>💡</span>
            <p className="text-[11px] leading-snug" style={{ color: '#9080C0', fontFamily: 'var(--font-sport)' }}>{s.hint}</p>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.05)', color: '#9090B0', border: '1px solid rgba(255,255,255,0.06)', minHeight: 48, fontFamily: 'var(--font-sport)', cursor: 'pointer' }}>
              ←
            </button>
          )}
          <button
            onClick={() => { if (isLast) onClose(); else setStep(s => s + 1) }}
            className="flex-1 rounded-xl text-xs font-black uppercase tracking-widest transition-opacity hover:opacity-90"
            style={{ minHeight: 48, background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', border: '1px solid rgba(124,58,237,0.5)', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em', boxShadow: '0 6px 22px rgba(124,58,237,0.35)', cursor: 'pointer' }}
          >
            {isLast ? '¡A jugar! 🎯' : `Siguiente · ${step + 2}/${ONBOARDING_STEPS.length}`}
          </button>
        </div>
        {!isLast && (
          <button onClick={onClose} className="w-full mt-3 text-[10px] font-black uppercase tracking-widest" style={{ color: '#4A4A6A', background: 'none', border: 'none', fontFamily: 'var(--font-sport)', cursor: 'pointer', minHeight: 36 }}>
            Saltar tutorial
          </button>
        )}
      </div>
    </div>
  )
}

function PicksForm({ matches, jornada, onSubmit, streakCurrent = 0 }: { matches: QuinielaMatch[]; jornada: string; onSubmit: (s: QuinielaSaved) => void; streakCurrent?: number }) {
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
    addCoins(5, `Participación ${jornada}`)
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
          {done >= 3 && <ConsensusBar match={m} userPick={picks[i]} />}
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

// ─────────────────────────────────────────────────────────────────
// Resumen picks enviados
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Ceremonia de revelación — pantalla fullscreen dramática
// ─────────────────────────────────────────────────────────────────
function RevealCeremony({ picks, results, matchData, onComplete }: {
  picks: Array<{ home: string; away: string; pick: string }>
  results: MatchResult[]
  matchData?: QuinielaMatch[]
  onComplete: () => void
}) {
  const [phase, setPhase] = useState<'intro' | 'cards' | 'summary'>('intro')
  const [cardIdx, setCardIdx] = useState(0)
  const [showCard, setShowCard] = useState(false)

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: 'rgba(3,0,9,0.97)', backdropFilter: 'blur(20px)' }}
    >
      {/* ── Intro ── */}
      {phase === 'intro' && (
        <div className="flex flex-col items-center gap-8 text-center px-8" style={{ animation: 'revealPop 0.5s ease both' }}>
          <div style={{ fontSize: 72, lineHeight: 1 }}>⚡</div>
          <div>
            <p className="font-black leading-none mb-3" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem,6vw,3.4rem)', color: '#F8F8FF', letterSpacing: '-0.03em' }}>
              Revelar resultados
            </p>
            <p className="text-sm" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>
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
                  {correct ? '✅' : '❌'}
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
          <div style={{ fontSize: 80, lineHeight: 1 }}>
            {scored >= Math.ceil(total * 0.8) ? '🏆' : scored >= Math.ceil(total * 0.5) ? '⭐' : '💪'}
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
            {/* Coin reward summary */}
            {(() => {
              const coinsEarned = scored * 10 + (scored === total && total > 0 ? 100 : 0)
              return coinsEarned > 0 ? (
                <div className="mt-4 flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}>
                  <span style={{ fontSize: 18 }}>🪙</span>
                  <span className="font-black" style={{ fontSize: 18, color: '#fbbf24', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                    +{coinsEarned} monedas
                  </span>
                  {scored === total && total > 0 && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full ml-1" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', fontFamily: 'var(--font-sport)' }}>
                      PLENO +100
                    </span>
                  )}
                </div>
              ) : null
            })()}
          </div>
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
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Flash card toast — resultado partido a partido en tiempo real
// ─────────────────────────────────────────────────────────────────
function ResultToast({ home, away, homeGoals, awayGoals, correct, onDismiss }: {
  home: string; away: string; homeGoals: number; awayGoals: number; correct: boolean; onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div
      className="fixed top-20 left-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        transform: 'translateX(-50%)',
        background: correct ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.15)',
        border: correct ? '1.5px solid rgba(34,197,94,0.5)' : '1.5px solid rgba(239,68,68,0.45)',
        backdropFilter: 'blur(16px)',
        boxShadow: correct ? '0 8px 32px rgba(34,197,94,0.25)' : '0 8px 32px rgba(239,68,68,0.2)',
        animation: 'revealSlam 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
        minWidth: 260, maxWidth: 340,
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{correct ? '✅' : '❌'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-black text-xs leading-tight" style={{ color: correct ? '#4ade80' : '#f87171', fontFamily: 'var(--font-display)' }}>
          {home} {homeGoals}–{awayGoals} {away}
        </p>
        <p className="text-[9px]" style={{ color: correct ? '#1A6A3A' : '#6A1A1A', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>
          {correct ? '¡Acertaste! +10 monedas' : 'No era esta vez'}
        </p>
      </div>
      <button onClick={onDismiss} style={{ color: '#3A3A52', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
    </div>
  )
}

// normalize/nameMatch movidos a @/lib/quiniela \u2014 ver import al inicio del archivo

function PicksSummary({ saved, matches, onReset, onScore, onUpdateSaved }: {
  saved: QuinielaSaved
  matches: QuinielaMatch[]
  onReset: () => void
  onScore?: (correct: number, total: number, results: MatchResult[]) => void
  onUpdateSaved?: (s: QuinielaSaved) => void
}) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [results, setResults] = useState<MatchResult[]>([])
  const [liveScores, setLiveScores] = useState<{ id: string; homeTeam: string; awayTeam: string; homeGoals: number | null; awayGoals: number | null; elapsed: number | null; status: string; matchRef?: string }[]>([])
  const [friendPicksData, setFriendPicksData] = useState<{ nickname: string; picks: Record<number, string> }[]>([])
  const [toast, setToast] = useState<{ home: string; away: string; homeGoals: number; awayGoals: number; correct: boolean } | null>(null)
  const prevResultKeysRef = useRef<Set<string>>(new Set())
  const now = Date.now()
  const anyStarted = matches.some(m => m.isoDate && new Date(m.isoDate).getTime() < now)

  // ── Reveal mechanic ──────────────────────────────────────────────
  const REVEAL_KEY = `ts_quiniela_revealed_${saved.jornada}`
  const [revealed, setRevealed] = useState(() => {
    try { return typeof window !== 'undefined' && !!localStorage.getItem(REVEAL_KEY) } catch { return false }
  })
  const [showCeremony, setShowCeremony] = useState(false)

  // ── Comodín ──────────────────────────────────────────────────────
  const COMODIN_KEY = `ts_quiniela_comodin_${saved.jornada}`
  const COMODIN_COST = 25
  const [comodinUsed, setComodinUsed] = useState(() => {
    try { return typeof window !== 'undefined' && !!localStorage.getItem(COMODIN_KEY) } catch { return false }
  })
  const [comodinTarget, setComodinTarget] = useState<number | null>(null)
  const [coinBalance, setCoinBalance] = useState(() => {
    try { return typeof window !== 'undefined' ? getCoins() : COINS_INITIAL } catch { return COINS_INITIAL }
  })

  useEffect(() => {
    // Load friend picks from first joined league
    try {
      const raw = localStorage.getItem(LEAGUES_KEY)
      if (raw) {
        const leagues: League[] = JSON.parse(raw as string)
        if (leagues.length > 0) {
          fetch(`/api/quiniela/leagues?id=${leagues[0].id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data?.members) {
                setFriendPicksData(data.members.filter((m: ServerMember) => m.nickname !== 'Tú'))
              }
            })
            .catch(() => {})
        }
      }
    } catch { /* ignore */ }

    // Poll results + detect new ones for flash cards
    const fetchResults = () =>
      fetch('/api/quiniela/results')
        .then(r => r.ok ? r.json() : [])
        .then((newResults: MatchResult[]) => {
          setResults(newResults)
          newResults.forEach(r => {
            const key = `${r.home}-${r.away}`
            if (!prevResultKeysRef.current.has(key)) {
              prevResultKeysRef.current.add(key)
              const myPick = saved.picks.find(p => nameMatch(p.home, r.home) && nameMatch(p.away, r.away))
              if (myPick) {
                const correct = isCorrect(myPick.pick as Pick, r.outcome)
                setToast({ home: r.home, away: r.away, homeGoals: r.homeGoals, awayGoals: r.awayGoals, correct })
              }
            }
          })
        })
        .catch(() => {})
    fetchResults()
    const t = setInterval(fetchResults, 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!anyStarted) return
    const fetchLive = () => {
      if (document.visibilityState === 'hidden') return
      fetch('/api/events/live')
        .then(r => r.ok ? r.json() : [])
        .then(setLiveScores)
        .catch(() => {})
    }
    fetchLive()
    const t = setInterval(fetchLive, 30_000)
    document.addEventListener('visibilitychange', fetchLive)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', fetchLive)
    }
  }, [anyStarted])


  function getResult(home: string, away: string, espnId?: string): MatchResult | undefined {
    if (espnId) {
      const byId = results.find(r => r.espnId === espnId)
      if (byId) return byId
    }
    return results.find(r => nameMatch(r.home, home) && nameMatch(r.away, away))
  }
  function getLive(home: string, away: string, espnId?: string) {
    if (espnId) {
      const byId = liveScores.find(f => f.id === espnId || f.matchRef?.endsWith(`_${espnId}`))
      if (byId) return byId
    }
    return liveScores.find(f => nameMatch(f.homeTeam, home) && nameMatch(f.awayTeam, away))
  }

  const evaluated = results.length > 0 ? saved.picks.filter((p, i) => getResult(p.home, p.away, matches[i]?.espnId)).length : 0
  const scored = saved.picks.filter((p, i) => {
    const r = getResult(p.home, p.away, matches[i]?.espnId)
    return r && isCorrect(p.pick as Pick, r.outcome)
  }).length
  const allEvaluated = evaluated > 0 && evaluated === saved.picks.length

  useEffect(() => {
    if (allEvaluated && revealed && onScore) onScore(scored, evaluated, results)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvaluated, revealed])

  const isResultVisible = (i: number) => {
    const hasResult = !!getResult(saved.picks[i].home, saved.picks[i].away)
    if (!hasResult) return false
    if (!allEvaluated) return true
    return revealed
  }

  const handleComodinPick = (idx: number, newPick: Pick) => {
    const newPicks = saved.picks.map((p, i) => i === idx ? { ...p, pick: newPick } : p)
    const newSaved = { ...saved, picks: newPicks }
    try { localStorage.setItem(QUINIELA_PICKS_KEY, JSON.stringify(newSaved)) } catch {}
    onUpdateSaved?.(newSaved)
    const newBalance = addCoins(-COMODIN_COST, 'Comodín usado')
    setCoinBalance(newBalance)
    setComodinUsed(true)
    setComodinTarget(null)
    try { localStorage.setItem(COMODIN_KEY, '1') } catch {}
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Flash card toast */}
      {toast && (
        <ResultToast
          {...toast}
          onDismiss={() => setToast(null)}
        />
      )}

      {showCeremony && (
        <RevealCeremony
          picks={saved.picks}
          results={results}
          matchData={matches}
          onComplete={() => {
            setShowCeremony(false)
            setRevealed(true)
            try { localStorage.setItem(REVEAL_KEY, '1') } catch {}
          }}
        />
      )}
      {/* Banner superior */}
      <div className="rounded-2xl px-5 py-4 flex items-center gap-4" style={{
        background: 'linear-gradient(135deg,rgba(34,197,94,0.08) 0%,rgba(16,185,129,0.04) 100%)',
        border: '1px solid rgba(34,197,94,0.2)',
      }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M5 13L9 17L19 7" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black" style={{ color: '#D0F0D8', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>Predicción registrada</p>
          <p className="text-[10px]" style={{ color: '#3A6A40', fontFamily: 'var(--font-sport)' }}>
            {saved.jornada} · {saved.picks.length} partidos · {anyStarted ? 'En curso · bloqueada' : 'Puedes cambiar hasta el pitido'}
          </p>
        </div>
        {!anyStarted && (
          confirmReset ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => { onReset(); setConfirmReset(false) }} className="text-[10px] font-black px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontFamily: 'var(--font-sport)' }}>
                Sí, cambiar
              </button>
              <button onClick={() => setConfirmReset(false)} className="text-[10px] font-black px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#6060A0', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}>
                No
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="text-[10px] font-black px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', color: '#4A4A6A', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-sport)' }}>
              Cambiar picks
            </button>
          )
        )}
        {anyStarted && (
          <div className="flex-shrink-0 flex items-center gap-1.5" style={{ color: '#4A4A6A' }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ fontFamily: 'var(--font-sport)' }}>Bloqueado</span>
          </div>
        )}
      </div>

      {/* Marcador final (tras reveal) */}
      {allEvaluated && revealed && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}>
          <span className="text-lg">⭐</span>
          <span className="text-sm font-black" style={{ color: '#fbbf24', fontFamily: 'var(--font-display)' }}>{scored} de {evaluated} acertados</span>
          <span className="text-[10px]" style={{ color: '#6A5020', fontFamily: 'var(--font-sport)' }}>Jornada cerrada</span>
          <button
            onClick={() => {
              const emoji = saved.picks.map(p => {
                const r = getResult(p.home, p.away)
                if (!r) return '⏳'
                return isCorrect(p.pick as Pick, r.outcome) ? '✅' : '❌'
              }).join('')
              const text = `Acerté ${scored}/${evaluated} en la Quiniela TakaSports ${emoji}\ntakasports.com/quiniela`
              if (navigator.share) navigator.share({ text }).catch(() => {})
              else navigator.clipboard?.writeText(text).catch(() => {})
            }}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black transition-opacity hover:opacity-75"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', fontFamily: 'var(--font-sport)' }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M8 1h3v3M5 7l6-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Compartir
          </button>
        </div>
      )}

      {/* Botón REVELAR — grande, sólo cuando todos los resultados están listos */}
      {allEvaluated && !revealed && (
        <button
          onClick={() => setShowCeremony(true)}
          className="w-full rounded-2xl font-black uppercase tracking-widest transition-transform hover:scale-[1.015] active:scale-[0.98]"
          style={{
            minHeight: 68,
            fontSize: 15,
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.1em',
            background: 'linear-gradient(135deg,#7C3AED 0%,#5B21B6 50%,#9333ea 100%)',
            color: '#fff',
            border: '1px solid rgba(124,58,237,0.5)',
            boxShadow: '0 8px 36px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
            animation: 'quinielaPulse 2.2s ease-in-out infinite',
          }}
        >
          ⚡ Revelar resultados
        </button>
      )}

      {/* Cards */}
      {saved.picks.map((p, i) => {
        const matchData = matches[i] ?? { home: p.home, away: p.away }
        const result    = getResult(p.home, p.away, matchData.espnId)
        const live      = !result ? getLive(p.home, p.away, matchData.espnId) : undefined
        const correct   = result ? isCorrect(p.pick as Pick, result.outcome) : false
        const visible   = isResultVisible(i)
        const isComodinTarget = comodinTarget === i
        const matchStarted = !!(matchData.isoDate && new Date(matchData.isoDate).getTime() < Date.now())

        return (
          <div key={i} className="flex flex-col">
            <div className="relative">
              <MatchCard
                match={{ home: p.home, away: p.away, homeLogo: matchData.homeLogo, awayLogo: matchData.awayLogo, homeShort: matchData.homeShort, awayShort: matchData.awayShort }}
                index={i}
                pick={p.pick as Pick}
                onPick={(newPick) => isComodinTarget && handleComodinPick(i, newPick)}
                forceLocked={!isComodinTarget}
                comp={matchData.comp}
                time={matchData.time}
                isoDate={matchData.isoDate}
                odds={matchData.odds}
                comodinAvailable={!comodinUsed && !comodinTarget && matchStarted}
                isComodinUnlocked={isComodinTarget}
                onUseComodin={() => setComodinTarget(i)}
                comodinCost={COMODIN_COST}
                coinBalance={coinBalance}
                liveScore={live && live.homeGoals != null ? { homeGoals: live.homeGoals, awayGoals: live.awayGoals, elapsed: live.elapsed, status: live.status } : undefined}
                finalScore={visible && result ? { homeGoals: result.homeGoals, awayGoals: result.awayGoals } : undefined}
                correct={visible && result ? correct : undefined}
                friendPicks={friendPicksData.filter(m => m.picks[i] !== undefined).map(m => ({ name: m.nickname, pick: m.picks[i] })).slice(0, 3)}
                isCaptain={saved.captainIdx === i}
              />
            </div>
            {/* Consenso de la comunidad */}
            <ConsensusBar match={matchData} userPick={p.pick as Pick} />
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Ligas guardadas (localStorage)
// ─────────────────────────────────────────────────────────────────

interface ServerMember { nickname: string; picks: Record<number, string> }

interface ChatMessage { id: string; nickname: string; message: string; created_at: string }

function LeagueChat({ leagueId }: { leagueId: string }) {
  const [msgs, setMsgs]       = useState<ChatMessage[]>([])
  const [input, setInput]     = useState('')
  const [nick, setNick]       = useState(() => { try { return localStorage.getItem('ts_quiniela_nickname') ?? '' } catch { return '' } })
  const [sending, setSending] = useState(false)
  const [showNick, setShowNick] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMsgs = useCallback(() => {
    fetch(`/api/quiniela/chat?liga=${leagueId}&limit=30`)
      .then(r => r.ok ? r.json() : [])
      .then((data: ChatMessage[]) => setMsgs(data))
      .catch(() => {})
  }, [leagueId])

  useEffect(() => { loadMsgs(); const t = setInterval(loadMsgs, 15_000); return () => clearInterval(t) }, [loadMsgs])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const send = async () => {
    const msg = input.trim()
    const nickname = nick.trim() || 'Anon'
    if (!msg || sending) return
    setSending(true)
    try {
      localStorage.setItem('ts_quiniela_nickname', nickname)
      await fetch('/api/quiniela/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ liga: leagueId, message: msg, nickname }),
      })
      setInput('')
      loadMsgs()
    } catch { /* ignore */ }
    setSending(false)
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>
        Chat de liga
      </p>

      {/* Messages */}
      <div className="flex flex-col gap-1.5 mb-2 max-h-48 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {msgs.length === 0 && (
          <p className="text-[10px]" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
            Sin mensajes aún. ¡Di algo!
          </p>
        )}
        {msgs.map(m => (
          <div key={m.id} className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>
              {m.nickname} · {new Date(m.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <p className="text-[11px] px-2.5 py-1.5 rounded-xl inline-block max-w-full break-words" style={{ background: 'rgba(255,255,255,0.04)', color: '#C0C0D8', fontFamily: 'var(--font-display)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {m.message}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Nickname prompt */}
      {showNick && (
        <input
          className="w-full rounded-xl px-3 py-2 text-xs mb-1.5 outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.3)', color: '#C0C0D8', fontFamily: 'var(--font-display)' }}
          placeholder="Tu nombre en la liga…"
          value={nick}
          maxLength={24}
          onChange={e => setNick(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setShowNick(false)}
          onBlur={() => setShowNick(false)}
          autoFocus
        />
      )}

      {/* Input */}
      <div className="flex gap-2">
        <button onClick={() => setShowNick(v => !v)} className="text-[10px] px-2 py-1.5 rounded-lg flex-shrink-0 truncate max-w-[60px]" style={{ background: 'rgba(124,58,237,0.1)', color: '#7C6AAA', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}>
          {nick || 'Anon'}
        </button>
        <input
          className="flex-1 rounded-xl px-3 py-1.5 text-[11px] outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#C0C0D8', fontFamily: 'var(--font-display)' }}
          placeholder="Mensaje…"
          value={input}
          maxLength={280}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="px-3 py-1.5 rounded-xl flex-shrink-0 text-[11px] font-black transition-opacity"
          style={{
            background: input.trim() ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
            color: input.trim() ? '#C4B5FD' : '#3A3A52',
            border: input.trim() ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
            cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
          }}
        >
          →
        </button>
      </div>
    </div>
  )
}

function LeagueExpanded({ league, localResults }: { league: League; localResults: MatchResult[] }) {
  const [members, setMembers] = useState<ServerMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/quiniela/leagues?id=${league.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.members) setMembers(data.members) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [league.id])

  const ranked = [...members]
    .map(m => ({ name: m.nickname, pts: scoreForMember(m.picks, localResults) }))
    .sort((a, b) => b.pts - a.pts)

  const hasResults = localResults.length > 0

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>
        Ranking
      </p>

      {loading && (
        <div className="flex flex-col gap-1 mb-3">
          {[0,1,2].map(i => (
            <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      )}

      {!loading && ranked.length === 0 && (
        <p className="text-[10px] mb-3" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          Nadie ha enviado picks todavía. Sé el primero.
        </p>
      )}

      {!loading && ranked.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {ranked.map((r, pos) => {
            const isMe = r.name === 'Tú'
            const gold = pos === 0
            return (
              <div key={r.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                style={{
                  background: gold ? 'rgba(245,158,11,0.08)' : isMe ? 'rgba(124,58,237,0.07)' : 'rgba(255,255,255,0.025)',
                  border: gold ? '1px solid rgba(245,158,11,0.2)' : isMe ? '1px solid rgba(124,58,237,0.18)' : '1px solid transparent',
                }}
              >
                <span className="text-[10px] font-black tabular-nums w-4" style={{ color: gold ? '#fbbf24' : '#3A3A58', fontFamily: 'var(--font-sport)' }}>
                  {pos + 1}
                </span>
                <span className="flex-1 text-[11px] font-bold" style={{ color: gold || isMe ? '#F0F0F5' : '#8080A0', fontFamily: 'var(--font-display)' }}>
                  {r.name}{isMe && <span style={{ color: '#A78BFA', marginLeft: 4, fontSize: 8 }}>tú</span>}
                </span>
                <span className="text-[11px] font-black tabular-nums" style={{ color: gold ? '#fbbf24' : isMe ? '#A78BFA' : '#5A5A7A', fontFamily: 'var(--font-display)' }}>
                  {hasResults ? `${r.pts} pts` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!hasResults && (
        <p className="text-[9px] mb-2" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
          Los puntos aparecerán cuando terminen los partidos.
        </p>
      )}

      <LeagueChat leagueId={league.id} />
    </div>
  )
}

function MyLeagues({ onCreate }: { onCreate: () => void }) {
  const [leagues, setLeagues] = useState<League[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [results, setResults] = useState<MatchResult[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEAGUES_KEY)
      if (raw) setLeagues(JSON.parse(raw))
    } catch { /* ignore */ }
    fetch('/api/quiniela/results')
      .then(r => r.ok ? r.json() : [])
      .then(setResults)
      .catch(() => {})
  }, [])

  if (leagues.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 gap-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)' }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="3" y="3" width="9" height="9" rx="2" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
            <rect x="16" y="3" width="9" height="9" rx="2" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
            <rect x="3" y="16" width="9" height="9" rx="2" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
            <rect x="16" y="16" width="9" height="9" rx="2" fill="#7C3AED" stroke="#7C3AED" strokeWidth="1.5" opacity="0.7" />
          </svg>
        </div>
        <div>
          <p className="font-black text-base mb-1" style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}>
            Aún no tienes ligas
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Crea una liga privada y elige tus partidos.
            <br />Invita a amigos y compite.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest transition-opacity hover:opacity-85"
          style={{
            background: 'linear-gradient(135deg,#7C3AED,#5B21B6)',
            color: '#fff', fontSize: 12,
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.09em',
            boxShadow: '0 6px 24px rgba(124,58,237,0.38)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Crear liga
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          {leagues.length} liga{leagues.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest"
          style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          + Nueva liga
        </button>
      </div>

      {leagues.map((l) => {
        const comp = COMPETITIONS.find(c => c.id === l.competitionId)
        const picksCount = Object.keys(l.picks).length
        const isExpanded = expandedId === l.id
        return (
          <div key={l.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {/* Header clickable */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : l.id)}
              className="w-full flex items-start justify-between gap-3 p-5 text-left transition-opacity hover:opacity-90"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm mb-0.5" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>{l.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                  {comp?.emoji} {comp?.name} · {l.matchIds.length} partidos
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {l.submitted ? (
                  <span className="text-[9px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)', fontFamily: 'var(--font-sport)' }}>
                    Enviada
                  </span>
                ) : (
                  <span className="text-[9px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)', fontFamily: 'var(--font-sport)' }}>
                    {picksCount}/{l.matchIds.length} picks
                  </span>
                )}
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.22s', color: '#3A3A5A', flexShrink: 0 }}
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            {/* Detalle expandido */}
            {isExpanded && (
              <div className="px-5 pb-5">
                <LeagueExpanded league={l} localResults={results} />
                <div className="flex items-center gap-2 mt-4">
                  <button
                    className="flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(124,58,237,0.1)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)' }}
                  >
                    Ver picks
                  </button>
                  <button
                    onClick={() => {
                      const text = `${window.location.origin}/quiniela?liga=${l.id}`
                      navigator.clipboard?.writeText(text).catch(() => {})
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#5A5A7A', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-sport)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M8 1h3v3M5 7l6-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Compartir
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Modal: Crear liga
// ─────────────────────────────────────────────────────────────────
type CreateStep = 'name' | 'matches' | 'done'

function CreateLeagueModal({ onClose, onCreated, apiMatches, apiJornada }: {
  onClose: () => void
  onCreated: (l: League) => void
  apiMatches: QuinielaMatch[]
  apiJornada: string
}) {
  const [step, setStep]               = useState<CreateStep>('name')
  const [name, setName]               = useState('')
  const [selectedMatches, setMatches] = useState<number[]>([])
  const [createdCode, setCreatedCode] = useState('')
  const [creating, setCreating]       = useState(false)
  const [copied, setCopied]           = useState(false)

  const toggleMatch = (i: number) =>
    setMatches((prev) => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])

  const handleCreate = async () => {
    if (selectedMatches.length === 0 || creating) return
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
                  Nombre de la liga
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setStep('matches')}
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
                onClick={() => setStep('matches')}
                className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest transition-opacity hover:opacity-85"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', fontSize: 12, fontFamily: 'var(--font-sport)', letterSpacing: '0.09em', boxShadow: '0 6px 20px rgba(124,58,237,0.35)' }}
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

// ─────────────────────────────────────────────────────────────────
// Panel de logros (badges)
// ─────────────────────────────────────────────────────────────────
function BadgesPanel({ earned }: { earned: BadgeId[] }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="section-accent" />
        <h2 className="section-label">Logros</h2>
        <span className="ml-auto text-[10px] font-black tabular-nums" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
          {earned.length}/{BADGE_DEFS.length}
        </span>
      </div>
      <div className="px-4 py-4 grid grid-cols-3 gap-2.5">
        {BADGE_DEFS.map(b => {
          const unlocked = earned.includes(b.id)
          return (
            <div
              key={b.id}
              title={b.desc}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl"
              style={{
                background: unlocked ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.02)',
                border: unlocked ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s ease',
                opacity: unlocked ? 1 : 0.38,
                filter: unlocked ? 'none' : 'grayscale(1)',
              }}
            >
              <span style={{ fontSize: 22, lineHeight: 1, filter: unlocked ? 'none' : 'grayscale(1)' }}>{b.emoji}</span>
              <span style={{ fontSize: 7.5, fontWeight: 900, fontFamily: 'var(--font-sport)', color: unlocked ? '#C4B5FD' : '#3A3A52', textAlign: 'center', lineHeight: 1.2 }}>
                {b.name}
              </span>
            </div>
          )
        })}
      </div>
      {earned.length === 0 && (
        <p className="text-[10px] text-center pb-4 -mt-1" style={{ color: '#2E2E48', fontFamily: 'var(--font-sport)' }}>
          Completa jornadas para desbloquear logros
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Wallet de monedas
// ─────────────────────────────────────────────────────────────────
function CoinWallet({ balance, txns }: { balance: number; txns: CoinTxn[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid rgba(251,191,36,0.2)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-opacity hover:opacity-90"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
          <span style={{ fontSize: 17, lineHeight: 1 }}>🪙</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#78571A', fontFamily: 'var(--font-sport)' }}>Monedas</p>
          <p className="font-black leading-none tabular-nums" style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#fbbf24', letterSpacing: '-0.02em' }}>
            {balance.toLocaleString()}
          </p>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: '#4A4A2A', flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Rewards reference */}
      {!open && (
        <div className="px-5 pb-4 flex flex-wrap gap-1.5">
          {[
            { label: 'Pick correcto', val: '+10' },
            { label: 'Capitán correcto', val: '+20' },
            { label: 'Marcador exacto', val: '+50' },
            { label: 'Pleno', val: '+100' },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)' }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: '#fbbf24', fontFamily: 'var(--font-sport)' }}>{r.val}</span>
              <span style={{ fontSize: 7.5, color: '#5A4A1A', fontFamily: 'var(--font-sport)' }}>{r.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Transaction history */}
      {open && (
        <div className="px-5 pb-4" style={{ borderTop: '1px solid rgba(251,191,36,0.1)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2 pt-3" style={{ color: '#4A3A10', fontFamily: 'var(--font-sport)' }}>
            Últimas transacciones
          </p>
          {txns.length === 0 ? (
            <p className="text-[10px]" style={{ color: '#3A3A40', fontFamily: 'var(--font-sport)' }}>
              Sin historial aún · ¡juega tu primera jornada!
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {txns.slice(0, 6).map((t, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: 8, fontWeight: 900, fontFamily: 'var(--font-sport)', color: t.amount >= 0 ? '#4ade80' : '#f87171', minWidth: 32, textAlign: 'right' }}>
                    {t.amount >= 0 ? '+' : ''}{t.amount}
                  </span>
                  <span className="flex-1 text-[9px]" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}>{t.reason}</span>
                  <span style={{ fontSize: 7.5, color: '#2A2A3A', fontFamily: 'var(--font-sport)' }}>
                    {new Date(t.ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Comodín cost info */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <span style={{ fontSize: 13 }}>⚡</span>
            <span style={{ fontSize: 9, color: '#78550A', fontFamily: 'var(--font-sport)', fontWeight: 700 }}>
              Comodín cuesta <span style={{ color: '#fbbf24' }}>25 🪙</span> · Desbloquea consenso anticipado <span style={{ color: '#fbbf24' }}>10 🪙</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Leaderboard semanal
// ─────────────────────────────────────────────────────────────────
interface LBEntry { nickname: string; score: number; total: number }

function LeaderboardPanel({ jornada, totalMatches, myScore }: { jornada: string; totalMatches: number; myScore?: number }) {
  const [board, setBoard] = useState<LBEntry[]>([])
  const [synthetic, setSynthetic] = useState(true)

  useEffect(() => {
    if (!jornada || jornada === 'Cargando…') return
    fetch(`/api/quiniela/leaderboard?jornada=${encodeURIComponent(jornada)}&limit=10`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.entries?.length) {
          setBoard(data.entries)
          setSynthetic(!!data.synthetic)
        }
      })
      .catch(() => {})
  }, [jornada])

  const myPos = myScore != null && board.length > 0
    ? board.findIndex(p => p.score <= myScore) + 1 || board.length + 1
    : null

  if (board.length === 0) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="section-accent" />
          <h2 className="section-label">Ranking jornada</h2>
        </div>
        <div className="px-5 py-4 flex flex-col gap-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="section-accent" />
        <h2 className="section-label">Ranking jornada</h2>
        {myPos != null && (
          <span className="ml-auto text-[10px] font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
            Tu pos. #{myPos}
          </span>
        )}
      </div>
      <div className="px-4 py-3 flex flex-col gap-1">
        {board.slice(0, 5).map((p, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
          const isMe = myScore != null && p.score === myScore && myPos === i + 1
          return (
            <div
              key={`${p.nickname}-${i}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
              style={{
                background: isMe ? 'rgba(124,58,237,0.12)' : i === 0 ? 'rgba(251,191,36,0.05)' : 'transparent',
                border: isMe ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
              }}
            >
              <span style={{ fontSize: 11, width: 18, textAlign: 'center', fontFamily: 'var(--font-display)', color: '#3A3A58', fontWeight: 900 }}>
                {medal ?? `${i + 1}`}
              </span>
              <span className="flex-1 text-[11px] font-black" style={{ color: isMe ? '#C4B5FD' : '#8080A0', fontFamily: 'var(--font-display)' }}>
                {isMe ? 'Tú' : p.nickname}
              </span>
              <span className="text-[11px] font-black tabular-nums" style={{ color: i === 0 ? '#fbbf24' : '#4A4A6A', fontFamily: 'var(--font-display)' }}>
                {p.score}/{p.total || totalMatches}
              </span>
            </div>
          )
        })}

        {/* Mi posición si está fuera del top 5 */}
        {myPos != null && myPos > 5 && (
          <>
            <div className="flex justify-center py-0.5">
              <span style={{ fontSize: 9, color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>···</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
              <span style={{ fontSize: 11, width: 18, textAlign: 'center', fontFamily: 'var(--font-display)', color: '#C4B5FD', fontWeight: 900 }}>{myPos}</span>
              <span className="flex-1 text-[11px] font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>Tú</span>
              <span className="text-[11px] font-black tabular-nums" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
                {myScore}/{totalMatches}
              </span>
            </div>
          </>
        )}

        <p className="text-[8px] text-center pt-1" style={{ color: '#1E1E38', fontFamily: 'var(--font-sport)' }}>
          {synthetic ? 'Datos de demostración' : `${board.length} participantes`} · {jornada}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Cómo funciona
// ─────────────────────────────────────────────────────────────────
function Rules() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4 text-left" style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
        <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)' }}>Cómo funciona</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          {[
            'Elige 1 (local), X (empate) o 2 (visitante) para cada partido.',
            'Cierra antes del comienzo del primer partido de la jornada.',
            'Acumula puntos por cada resultado acertado.',
            'Crea ligas privadas e invita a amigos para competir entre vosotros.',
            'El ranking se publica al final de cada jornada.',
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3 pt-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5" style={{ background: 'rgba(124,58,237,0.12)', color: '#9B7CF6' }}>{i + 1}</span>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{rule}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
}

function SeasonPanel({ user }: { user: User | null }) {
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
                <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                  {q.competition} · {q.season}
                </p>
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

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────
type Tab = 'official' | 'leagues' | 'season'

export default function QuinielaClient() {
  const searchParams = useSearchParams()
  const ligaParam = searchParams?.get('liga')?.toUpperCase() ?? null

  const [activeTab, setTab]       = useState<Tab>('official')
  const [saved, setSaved]         = useState<QuinielaSaved | null>(null)
  const [hydrated, setHydrated]   = useState(false)
  const [showCreate, setCreate]   = useState(false)
  const [leagueVersion, bump]     = useState(0)
  const [apiMatches, setApiMatches] = useState<QuinielaMatch[]>([])
  const [apiJornada, setApiJornada] = useState('Cargando…')
  const [ligaName, setLigaName]   = useState<string | null>(null)
  const [ligaJoined, setLigaJoined] = useState(false)
  const [history, setHistory]     = useState<{ jornada: string; correct: number; total: number }[]>([])
  const [streak, setStreak]       = useState<{ current: number; best: number }>({ current: 0, best: 0 })
  const [badges, setBadges]       = useState<BadgeId[]>([])
  const [myScore, setMyScore]     = useState<number | undefined>(undefined)
  const [coinBalance, setCoinBalance] = useState<number>(COINS_INITIAL)
  const [coinTxns, setCoinTxns]   = useState<CoinTxn[]>([])
  const [user, setUser]           = useState<User | null>(null)
  const [showAuthBanner, setShowAuthBanner] = useState(false)
  const push = usePushSubscription()

  useEffect(() => {
    fetch('/api/quiniela')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.matches?.length) {
          setApiMatches(data.matches)
          setApiJornada(data.jornada)
          try {
            const raw = localStorage.getItem(QUINIELA_PICKS_KEY)
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed?.picks && Array.isArray(parsed.picks) && parsed.jornada === data.jornada) {
                setSaved(parsed)
              } else {
                localStorage.removeItem(QUINIELA_PICKS_KEY)
              }
            }
          } catch { /* ignore */ }
        } else {
          setApiMatches([])
          setApiJornada('Sin jornada activa')
        }
        setHydrated(true)
      })
      .catch(() => { setApiMatches([]); setApiJornada('Sin jornada activa'); setHydrated(true) })
  }, [])

  // Load history + streak + badges from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ts_quiniela_history')
      if (raw) setHistory(JSON.parse(raw))
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(STREAK_KEY)
      if (raw) {
        const weeks: string[] = JSON.parse(raw)
        setStreak(computeStreak(new Set(weeks)))
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(BADGES_KEY)
      if (raw) setBadges(JSON.parse(raw))
    } catch { /* ignore */ }
    setCoinBalance(getCoins())
    try {
      const raw = localStorage.getItem(COINS_TXN_KEY)
      if (raw) setCoinTxns(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  // ── Auth: escucha sesión Supabase + migra localStorage en primer login ──
  useEffect(() => {
    const sb = createClient()
    if (!sb) return
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      const prevUser = user
      setUser(nextUser)
      // Si acaba de hacer login, migrar datos localStorage → Supabase
      if (nextUser && !prevUser) {
        try {
          const coinBal = getCoins()
          const badgeList: string[] = JSON.parse(localStorage.getItem(BADGES_KEY) ?? '[]')
          fetch('/api/quiniela/migrate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ coinBalance: coinBal, badges: badgeList }),
          }).catch(() => {})
        } catch { /* ignore */ }
        setShowAuthBanner(false)
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detect ?liga= param and load league name
  useEffect(() => {
    if (!ligaParam) return
    fetch(`/api/quiniela/leagues?id=${ligaParam}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.name) setLigaName(data.name) })
      .catch(() => {})
    // Check if already joined (saved in localStorage)
    try {
      const raw = localStorage.getItem(LEAGUES_KEY)
      if (raw) {
        const leagues: League[] = JSON.parse(raw)
        if (leagues.some(l => l.id === ligaParam)) setLigaJoined(true)
      }
    } catch { /* ignore */ }
  }, [ligaParam])

  const handleReset = useCallback(() => {
    localStorage.removeItem(QUINIELA_PICKS_KEY)
    setSaved(null)
  }, [])

  const statusOpen = apiMatches.length > 0

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">

        {/* ── BANNER: unirse a liga por link ─────────── */}
        {ligaParam && ligaName && !ligaJoined && (
          <div className="mt-6 mb-2 rounded-2xl px-5 py-4 flex items-center gap-4" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#A78BFA" strokeWidth="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#A78BFA" strokeWidth="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#A78BFA" strokeWidth="1.5" />
                <path d="M14 17.5h7M17.5 14v7" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black" style={{ color: '#D0C0FF', fontFamily: 'var(--font-display)' }}>Te invitaron a <span style={{ color: '#C4B5FD' }}>«{ligaName}»</span></p>
              <p className="text-[10px]" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>Haz tus picks y únete a la competición</p>
            </div>
            <button
              onClick={() => {
                try {
                  const raw = localStorage.getItem(LEAGUES_KEY)
                  const existing: League[] = raw ? JSON.parse(raw) : []
                  if (!existing.some(l => l.id === ligaParam)) {
                    existing.push({ id: ligaParam!, name: ligaName!, competitionId: 'mixed', matchIds: [], picks: {}, submitted: false, createdAt: new Date().toISOString() })
                    localStorage.setItem(LEAGUES_KEY, JSON.stringify(existing))
                  }
                } catch { /* ignore */ }
                setLigaJoined(true)
                setTab('official')
                bump(v => v + 1)
              }}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-opacity hover:opacity-85"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', fontFamily: 'var(--font-sport)', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}
            >
              Unirme
            </button>
          </div>
        )}
        {ligaParam && ligaJoined && (
          <div className="mt-6 mb-2 rounded-2xl px-5 py-3 flex items-center gap-3" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4ade80' }} />
            <p className="text-xs font-black" style={{ color: '#4ade80', fontFamily: 'var(--font-sport)' }}>Ya estás en la liga · haz tus picks abajo</p>
          </div>
        )}

        {/* ── HERO ─────────────────────────────────────── */}
        <div className="relative mt-6 mb-8 rounded-2xl overflow-hidden" style={{
          background: 'linear-gradient(145deg,#0E001A 0%,#08000F 60%,#060010 100%)',
          border: '1px solid rgba(124,58,237,0.22)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {/* Glows */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -left-10 w-64 h-64 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 65%)' }} />
            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #ef4444 0%, transparent 65%)' }} />
            {/* Diagonal lines texture */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
              backgroundSize: '12px 12px',
            }} />
          </div>

          <div className="relative z-10 px-6 py-7 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <span
                    className="text-[9px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(124,58,237,0.2)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.35)', fontFamily: 'var(--font-sport)' }}
                  >
                    {apiJornada}
                  </span>
                  {statusOpen && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.8)' }} />
                      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#f87171', fontFamily: 'var(--font-sport)' }}>Abierta</span>
                    </div>
                  )}
                </div>
                <h1 className="font-black leading-none mb-2" style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2.4rem,5vw,3.8rem)',
                  color: '#F8F8FF',
                  letterSpacing: '-0.03em',
                  textShadow: '0 0 40px rgba(124,58,237,0.25)',
                }}>
                  Quiniela
                </h1>
                <p className="text-sm" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>
                  Haz tus picks antes del primer partido · Acierta más que nadie
                </p>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex flex-col items-center px-5 py-3.5 rounded-2xl" style={{
                  background: saved ? 'rgba(34,197,94,0.07)' : 'rgba(124,58,237,0.1)',
                  border: saved ? '1px solid rgba(34,197,94,0.18)' : '1px solid rgba(124,58,237,0.2)',
                  transition: 'all 0.4s ease',
                }}>
                  <span className="font-black tabular-nums leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: saved ? '#4ade80' : '#C4B5FD', letterSpacing: '-0.02em' }}>
                    {saved ? '✓' : (apiMatches.length || '—')}
                  </span>
                  <span className="text-[9px] font-semibold mt-1 uppercase tracking-widest" style={{ color: saved ? '#1A5A30' : '#5A4070', fontFamily: 'var(--font-sport)' }}>
                    {saved ? 'enviada' : 'partidos'}
                  </span>
                </div>
                <div className="flex flex-col items-center px-5 py-3.5 rounded-2xl" style={{
                  background: streak.current > 0 ? 'rgba(251,146,60,0.08)' : 'rgba(245,158,11,0.07)',
                  border: streak.current > 0 ? '1px solid rgba(251,146,60,0.2)' : '1px solid rgba(245,158,11,0.15)',
                  transition: 'all 0.4s ease',
                }}>
                  <span className="font-black tabular-nums leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: streak.current > 0 ? '#fb923c' : '#fbbf24', letterSpacing: '-0.02em' }}>
                    {streak.current > 0 ? streak.current : (streak.best || '—')}
                  </span>
                  <span className="text-[9px] font-semibold mt-1 uppercase tracking-widest" style={{ color: streak.current > 0 ? '#6A3010' : '#6A5020', fontFamily: 'var(--font-sport)' }}>
                    {streak.current > 0 ? '🔥 racha' : 'mejor racha'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TABS ─────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {([
            { id: 'official', label: 'Mi Quiniela' },
            { id: 'leagues',  label: 'Mis ligas' },
            { id: 'season',   label: 'Predicciones' },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              style={{
                fontFamily: 'var(--font-sport)',
                background: activeTab === t.id ? 'rgba(124,58,237,0.18)' : 'transparent',
                color: activeTab === t.id ? '#C4B5FD' : '#4A4A6A',
                border: activeTab === t.id ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── LAYOUT ─────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Columna principal */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            {activeTab === 'official' && !hydrated && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', height: 148, animation: `pulse ${1 + i * 0.1}s ease-in-out infinite alternate` }} />
                ))}
              </div>
            )}
            {activeTab === 'official' && hydrated && (
              saved
                ? <PicksSummary
                    saved={saved}
                    matches={apiMatches}
                    onReset={handleReset}
                    onUpdateSaved={(s) => setSaved(s)}
                    onScore={(correct, total, results) => {
                      setMyScore(correct)
                      setHistory(prev => {
                        if (prev.some(h => h.jornada === saved!.jornada)) return prev
                        const next = [...prev, { jornada: saved!.jornada, correct, total }]
                        try { localStorage.setItem('ts_quiniela_history', JSON.stringify(next)) } catch { /* ignore */ }
                        // Compute new badges
                        setBadges(existing => {
                          const picksWithData = saved!.picks.map(p => ({
                            ...p,
                            odds: apiMatches.find(m => nameMatch(m.home, p.home) && nameMatch(m.away, p.away))?.odds,
                          }))
                          const newOnes = computeNewBadges(picksWithData, correct, total, streak.current, next.length, existing)
                          if (!newOnes.length) return existing
                          const merged = [...existing, ...newOnes]
                          try { localStorage.setItem(BADGES_KEY, JSON.stringify(merged)) } catch { /* ignore */ }
                          return merged
                        })
                        // Award coins — capitán requiere comparar contra el resultado REAL del partido del capitán
                        const base = correct * 10
                        let captainBonus = 0
                        if (saved!.captainIdx != null) {
                          const capPick = saved!.picks[saved!.captainIdx]
                          if (capPick) {
                            const capResult = results.find(r => nameMatch(r.home, capPick.home) && nameMatch(r.away, capPick.away))
                            if (capResult && isCorrect(capPick.pick as Pick, capResult.outcome)) {
                              captainBonus = 10 // duplica los 10 que ya dio "base" para ese pick
                            }
                          }
                        }
                        const pleno = correct === total && total > 0 ? 100 : 0
                        const earned = base + captainBonus + pleno
                        if (earned > 0) {
                          const reasons = [`${correct} picks correctos (×10)`]
                          if (captainBonus) reasons.push('Capitán acertado +10')
                          if (pleno) reasons.push('¡Pleno! +100')
                          const newBal = addCoins(earned, reasons.join(' · '))
                          setCoinBalance(newBal)
                          setCoinTxns(JSON.parse(localStorage.getItem(COINS_TXN_KEY) ?? '[]'))
                          // Sincroniza al servidor (audit + RPC add_coins) — opcional, falla silenciosamente
                          fetch('/api/quiniela/score', {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({
                              jornada: saved!.jornada,
                              picks: saved!.picks,
                              captainIdx: saved!.captainIdx,
                            }),
                          }).catch(() => { /* offline / sin sesión, OK */ })
                        }
                        return next
                      })
                    }}
                  />
                : <PicksForm matches={apiMatches} jornada={apiJornada} streakCurrent={streak.current} onSubmit={(s) => { setSaved(s); if (!user) setTimeout(() => setShowAuthBanner(true), 2000) }} />
            )}
            {/* Banner de auth — aparece 2s después de enviar picks sin sesión */}
            {showAuthBanner && !user && (
              <div
                className="rounded-2xl px-5 py-4 flex items-center gap-3"
                style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', animation: 'fadeIn 0.4s ease both' }}
              >
                <span style={{ fontSize: 22 }}>🔒</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs mb-0.5" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
                    Guarda tu progreso
                  </p>
                  <p className="text-[10px]" style={{ color: '#6A5A8A', fontFamily: 'var(--font-sport)' }}>
                    Tus picks y monedas se sincronizan en todos tus dispositivos
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => {
                      const sb = createClient()
                      if (!sb) return
                      sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/quiniela` } })
                    }}
                    className="text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider"
                    style={{ background: 'rgba(124,58,237,0.25)', color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.4)' }}
                  >
                    Entrar
                  </button>
                  <button
                    onClick={() => setShowAuthBanner(false)}
                    className="text-[9px] text-center"
                    style={{ color: '#3A3A52', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Ahora no
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'leagues' && (
              <MyLeagues key={leagueVersion} onCreate={() => setCreate(true)} />
            )}
            {activeTab === 'season' && (
              <SeasonPanel user={user} />
            )}
            {activeTab === 'official' && <Rules />}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-5">

            {/* Monedas wallet */}
            <CoinWallet balance={coinBalance} txns={coinTxns} />

            {/* División del jugador */}
            {(() => {
              const div = getDivision(history)
              return (
                <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ background: div.bg, border: `1px solid ${div.border}` }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{div.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm" style={{ color: div.color, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                      División {div.name}
                    </p>
                    <p className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
                      {history.length === 0 ? 'Completa tu primera jornada' : `${history.length} jornada${history.length !== 1 ? 's' : ''} completada${history.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Racha semanal */}
            {streak.current > 0 && (
              <div className="rounded-2xl px-5 py-4 flex items-center gap-4" style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.2)' }}>
                <span style={{ fontSize: 28, lineHeight: 1 }}>🔥</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm" style={{ color: '#fdba74', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
                    {streak.current} semana{streak.current !== 1 ? 's' : ''} seguida{streak.current !== 1 ? 's' : ''}
                  </p>
                  <p className="text-[10px]" style={{ color: '#78350f', fontFamily: 'var(--font-sport)' }}>
                    Mejor racha: {streak.best} · Sigue así
                  </p>
                </div>
              </div>
            )}

            {/* Historial de jornadas */}
            {history.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="section-accent" />
                  <h2 className="section-label">Historial</h2>
                  <span className="ml-auto text-[10px] font-black tabular-nums" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                    {Math.round(history.reduce((s, h) => s + (h.total ? h.correct / h.total : 0), 0) / history.length * 100)}% promedio
                  </span>
                </div>
                <div className="px-5 pb-4 pt-3">
                  <div className="flex items-end gap-1.5" style={{ height: 56 }}>
                    {history.slice(-8).map((h, i, arr) => {
                      const pct = h.total ? h.correct / h.total : 0
                      const heightPct = Math.max(10, Math.round(pct * 100))
                      const color = pct >= 0.65 ? '#22c55e' : pct >= 0.45 ? '#A78BFA' : '#f87171'
                      const isLast = i === arr.length - 1
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                            <div style={{ height: `${heightPct}%`, width: '100%', background: color, borderRadius: '3px 3px 0 0', opacity: isLast ? 1 : 0.3 + (i / arr.length) * 0.55 }} />
                          </div>
                          <span style={{ fontSize: 7, color: isLast ? color : '#2A2A40', fontFamily: 'var(--font-sport)', fontWeight: 900 }}>
                            {h.correct}/{h.total}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard semanal */}
            {apiMatches.length > 0 && (
              <LeaderboardPanel
                jornada={apiJornada}
                totalMatches={apiMatches.length}
                myScore={myScore}
              />
            )}

            {/* Logros */}
            <BadgesPanel earned={badges} />

            {/* Notificaciones push */}
            {push.status !== 'unsupported' && (
              <div className="rounded-2xl px-5 py-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{push.status === 'subscribed' ? '🔔' : '🔕'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black" style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}>
                    {push.status === 'subscribed' ? 'Alertas activas' : 'Avisos de cierre'}
                  </p>
                  <p className="text-[9px]" style={{ color: push.status === 'denied' ? '#f87171' : '#3A3A52', fontFamily: 'var(--font-sport)' }}>
                    {push.status === 'denied' ? 'Permisos denegados en el navegador'
                      : push.status === 'subscribed' ? 'Te avisamos antes de cada cierre'
                      : 'Activa para no perder la jornada'}
                  </p>
                </div>
                {push.status !== 'denied' && (
                  <button
                    onClick={push.status === 'subscribed' ? push.unsubscribe : push.subscribe}
                    className="flex-shrink-0 text-[10px] font-black px-3 py-1.5 rounded-xl transition-all"
                    style={{
                      background: push.status === 'subscribed' ? 'rgba(239,68,68,0.08)' : 'rgba(124,58,237,0.12)',
                      color: push.status === 'subscribed' ? '#f87171' : '#A78BFA',
                      border: push.status === 'subscribed' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(124,58,237,0.25)',
                      fontFamily: 'var(--font-sport)',
                    }}
                  >
                    {push.status === 'subscribed' ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            )}

            {/* Crear liga CTA — siempre visible */}
            <div
              className="rounded-2xl p-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg,#1A0030 0%,#0E0020 100%)',
                border: '1px solid rgba(124,58,237,0.28)',
              }}
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 blur-3xl opacity-20 pointer-events-none" style={{ background: '#7C3AED' }} />
              <div className="relative z-10">
                <p className="font-black text-sm mb-1" style={{ color: '#D0C0FF', fontFamily: 'var(--font-display)' }}>
                  Ligas privadas
                </p>
                <p className="text-xs mb-4" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>
                  Elige tus partidos, invita a amigos y compite.
                </p>
                <button
                  onClick={() => { setCreate(true); setTab('leagues') }}
                  className="w-full py-2.5 rounded-xl font-black uppercase tracking-widest transition-opacity hover:opacity-85"
                  style={{ background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', fontSize: 11, fontFamily: 'var(--font-sport)', letterSpacing: '0.08em', boxShadow: '0 4px 16px rgba(124,58,237,0.38)' }}
                >
                  + Crear nueva liga
                </button>
              </div>
            </div>

            {/* Ranking */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  <span className="section-accent" />
                  <h2 className="section-label">Ranking</h2>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', fontFamily: 'var(--font-sport)' }}>
                  Próximamente
                </span>
              </div>
              {/* Preview list skeleton */}
              <div className="px-5 pt-4 pb-2 flex flex-col gap-1">
                {[
                  { name: 'Tú', pos: 1, pts: '—', highlight: true },
                  { name: 'Carlos M.', pos: 2, pts: '—', highlight: false },
                  { name: 'Ana G.',    pos: 3, pts: '—', highlight: false },
                ].map((r) => (
                  <div
                    key={r.pos}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: r.highlight ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
                      border: r.highlight ? '1px solid rgba(124,58,237,0.18)' : '1px solid transparent',
                    }}
                  >
                    <span className="text-[10px] font-black w-4 tabular-nums flex-shrink-0" style={{ color: r.pos === 1 ? '#fbbf24' : '#2A2A3A', fontFamily: 'var(--font-display)' }}>{r.pos}</span>
                    <span className="flex-1 text-[11px] font-bold" style={{ color: r.highlight ? '#D0C0FF' : '#3A3A50', fontFamily: 'var(--font-display)' }}>{r.name}</span>
                    <span className="text-[11px] font-black tabular-nums" style={{ color: r.highlight ? '#7C3AED' : '#252535', fontFamily: 'var(--font-display)' }}>{r.pts} pts</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3">
                <p className="text-[9px] text-center" style={{ color: '#2A2A3A', fontFamily: 'var(--font-sport)' }}>
                  Se actualizará al cierre de la jornada
                </p>
              </div>
              {saved && (
                <div className="px-5 pb-4">
                  <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4ade80' }} />
                    <span className="text-[9px] font-black" style={{ color: '#4ade80', fontFamily: 'var(--font-sport)' }}>Predicción registrada</span>
                  </div>
                </div>
              )}
            </div>

            {/* Precisión histórica */}
            {history.length > 0 && (() => {
              const totalCorrect = history.reduce((a, h) => a + h.correct, 0)
              const totalPicks   = history.reduce((a, h) => a + h.total, 0)
              const pct = totalPicks ? Math.round((totalCorrect / totalPicks) * 100) : 0
              return (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="section-accent" />
                      <h2 className="section-label">Tu precisión</h2>
                    </div>
                    <span className="font-black text-base tabular-nums" style={{ color: pct >= 50 ? '#4ade80' : '#f59e0b', fontFamily: 'var(--font-display)' }}>{pct}%</span>
                  </div>
                  <div className="px-5 py-4">
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 50 ? 'linear-gradient(to right,#22c55e,#4ade80)' : 'linear-gradient(to right,#f59e0b,#fbbf24)', borderRadius: 999, transition: 'width 0.4s ease' }} />
                    </div>
                    <div className="flex flex-col gap-1">
                      {history.slice(-4).reverse().map((h, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <span className="text-[9px] font-black flex-shrink-0" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)', minWidth: 60 }}>{h.jornada}</span>
                          <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.round((h.correct/h.total)*100)}%`, background: '#7C3AED', borderRadius: 999 }} />
                          </div>
                          <span className="text-[10px] font-black tabular-nums flex-shrink-0" style={{ color: '#6060A0', fontFamily: 'var(--font-display)', minWidth: 36, textAlign: 'right' }}>{h.correct}/{h.total}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-center mt-3" style={{ color: '#252535', fontFamily: 'var(--font-sport)' }}>
                      {history.length} jornada{history.length !== 1 ? 's' : ''} · {totalCorrect} de {totalPicks} acertados
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Historial de jornadas (real) */}
            {(history.length > 0 || saved) && (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="section-accent" />
                  <h2 className="section-label">Mis jornadas</h2>
                  {history.length > 0 && (
                    <span className="ml-auto text-[9px] font-black tabular-nums" style={{ color: '#4A4A6A', fontFamily: 'var(--font-sport)' }}>
                      {history.length} jugada{history.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="px-5 py-3 flex flex-col gap-1.5">
                  {/* Current jornada */}
                  {saved && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                      <span className="text-[10px] font-semibold" style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
                        {saved.jornada} — En curso
                      </span>
                      <span className="text-[10px] font-black" style={{ color: '#7C3AED', fontFamily: 'var(--font-display)' }}>
                        {myScore != null ? `${myScore} pts` : '—'}
                      </span>
                    </div>
                  )}
                  {/* Past jornadas from history */}
                  {history.slice().reverse().slice(0, 5).map((h, i) => {
                    const pct = h.total ? h.correct / h.total : 0
                    const color = pct >= 0.65 ? '#22c55e' : pct >= 0.45 ? '#A78BFA' : '#f87171'
                    return (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid transparent' }}>
                        <span className="text-[10px] font-semibold" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
                          {h.jornada}
                        </span>
                        <span className="text-[10px] font-black tabular-nums" style={{ color, fontFamily: 'var(--font-display)' }}>
                          {h.correct}/{h.total}
                        </span>
                      </div>
                    )
                  })}
                  {history.length === 0 && !saved && (
                    <p className="text-[9px] text-center py-1" style={{ color: '#2A2A3A', fontFamily: 'var(--font-sport)' }}>
                      Aún no has jugado ninguna jornada
                    </p>
                  )}
                </div>
              </div>
            )}

            {saved && (
              <Link href="/perfil" className="flex items-center justify-between px-5 py-4 rounded-2xl transition-opacity hover:opacity-80" style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.18)', textDecoration: 'none' }}>
                <div>
                  <p className="text-xs font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>Ver tus picks</p>
                  <p className="text-[10px]" style={{ color: '#5A4070', fontFamily: 'var(--font-sport)' }}>Guardados en tu perfil</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}

          </div>
        </div>
      </main>

      {showCreate && (
        <CreateLeagueModal
          onClose={() => { setCreate(false); bump(v => v + 1) }}
          onCreated={() => { bump(v => v + 1) }}
          apiMatches={apiMatches}
          apiJornada={apiJornada}
        />
      )}

      <Footer />
      <ScrollToTop />
    </div>
  )
}
