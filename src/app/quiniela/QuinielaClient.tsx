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
import { MatchCard } from './components/match/MatchCard'
import { ConsensusBar } from './components/match/ConsensusBar'
import { ResultToast } from './components/match/ResultToast'
import { PicksForm } from './components/picks/PicksForm'
import { PicksSummary } from './components/picks/PicksSummary'
import { OnboardingSheet } from './components/picks/OnboardingSheet'
import { StickyBetslip } from './components/picks/StickyBetslip'
import { StreakHero } from './components/picks/StreakHero'
import { QuickPickIA } from './components/picks/QuickPickIA'
import { RevealCeremony } from './components/picks/RevealCeremony'
import { MyLeagues } from './components/leagues/MyLeagues'
import { CreateLeagueModal } from './components/leagues/CreateLeagueModal'

// ─────────────────────────────────────────────────────────────────
// Formulario — picks de la quiniela oficial
// ─────────────────────────────────────────────────────────────────



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
