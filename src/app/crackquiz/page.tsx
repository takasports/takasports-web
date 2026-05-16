'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { getDailyQuestions, todayKey, type QuizQuestion } from '@/lib/crackquiz-questions'
import { trackGameStart, trackGameComplete } from '@/lib/analytics'
import { TrophyIcon, FireIcon, ClapIcon, FlexIcon } from '@/components/icons/GameIcons'
import { recordPlay, currentDayISO, type GamePlay } from '@/lib/games-store'
import { trackGameEvent } from '@/lib/games-telemetry'
import ShareResultButton from '@/components/games/ShareResultButton'
import PostGameResultModal from '@/components/games/PostGameResultModal'

// ── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = 'ts_crackquiz_state'
const QUESTION_TIME = 20        // seconds per question
const QUESTIONS_PER_ROUND = 10  // questions per daily round
const BASE_PTS = 10             // base points per correct answer
const TIME_BONUS_MAX = 5        // max bonus points for fast answer

// ── Types ────────────────────────────────────────────────────────

interface StoredState {
  lastPlayedDate: string
  streak: number
  bestStreak: number
  bestScore: number
  totalCorrect: number
  totalPlayed: number
  history: Array<{ date: string; score: number; correct: number }>
}

type GamePhase = 'idle' | 'playing' | 'result'

// ── Score helpers ─────────────────────────────────────────────────

function scoreForAnswer(secondsLeft: number, correct: boolean): number {
  if (!correct) return 0
  const bonus = Math.round((secondsLeft / QUESTION_TIME) * TIME_BONUS_MAX)
  return BASE_PTS + bonus
}

// ── Icons ─────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 9l2.5 2.5 4-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconTime() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5l1.75 3.55 3.9.57-2.82 2.75.67 3.88L8 10.35l-3.5 1.9.67-3.88L2.35 5.62l3.9-.57L8 1.5z" fill="currentColor" />
    </svg>
  )
}

function IconFire() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 14c-3.3 0-6-2.7-6-6 0-2.4 1.4-4.5 3.5-5.5-.2.8-.2 1.7.3 2.5C6.5 3.5 7.5 2 8 1c.5 1 1.5 2.5 2.5 4 .5-.8.5-1.7.3-2.5C12.8 3.5 14 5.6 14 8c0 3.3-2.7 6-6 6z" fill="currentColor" />
    </svg>
  )
}

// ── Timer ring ────────────────────────────────────────────────────

function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const pct = seconds / total
  const r = 22
  const circ = 2 * Math.PI * r
  const dash = circ * pct

  const color = pct > 0.5 ? '#FCD34D' : pct > 0.25 ? '#F59E0B' : '#EF4444'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 60, height: 60 }}>
      <svg width="60" height="60" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="30" cy="30" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.15s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="relative font-mono font-bold text-lg" style={{ color }}>{seconds}</span>
    </div>
  )
}

// ── Streak display ────────────────────────────────────────────────

function StreakBadge({ streak }: { streak: number }) {
  if (streak < 2) return null
  return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: 'rgba(252,211,77,0.1)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.2)' }}>
      <IconFire />
      <span>{streak} racha</span>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: 'rgba(255,255,255,0.06)' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${(current / total) * 100}%`,
          background: 'linear-gradient(90deg, #FCD34D, #F59E0B)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  )
}

// ── History calendar ──────────────────────────────────────────────

function HistoryCalendar({ history }: { history: Array<{ date: string; score: number; correct: number }> }) {
  if (history.length === 0) return null

  // Build a map of date → entry
  const byDate: Record<string, { score: number; correct: number }> = {}
  history.forEach(h => { byDate[h.date] = h })

  // Show last 28 days (4 weeks)
  const days: { date: string; label: string }[] = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 1).toUpperCase()
    days.push({ date: key, label })
  }

  return (
    <div className="mt-6">
      <p className="text-[10px] font-black uppercase tracking-widest mb-3 text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
        Últimos 28 días
      </p>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {/* Weekday labels */}
        {['L','M','X','J','V','S','D'].map(d => (
          <div key={d} className="text-center text-[8px] font-black pb-1" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{d}</div>
        ))}
        {/* Pad start — figure out which weekday the first day falls on */}
        {(() => {
          const firstDow = (new Date(days[0].date + 'T12:00:00Z').getUTCDay() + 6) % 7 // Mon=0
          return Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)
        })()}
        {days.map(({ date }) => {
          const entry = byDate[date]
          const pct = entry ? entry.correct / QUESTIONS_PER_ROUND : -1
          const bg = pct < 0 ? 'rgba(255,255,255,0.04)'
            : pct >= 0.8 ? 'rgba(110,231,183,0.55)'
            : pct >= 0.5 ? 'rgba(252,211,77,0.50)'
            : 'rgba(248,113,113,0.45)'
          const title = entry ? `${entry.correct}/${QUESTIONS_PER_ROUND} correctas` : ''
          return (
            <div
              key={date}
              title={title}
              className="rounded-md aspect-square"
              style={{ background: bg, border: pct >= 0 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.04)' }}
            />
          )
        })}
      </div>
      <div className="flex items-center justify-center gap-3 mt-2">
        {[['rgba(110,231,183,0.55)', '≥8/10'], ['rgba(252,211,77,0.5)', '5–7/10'], ['rgba(248,113,113,0.45)', '≤4/10'], ['rgba(255,255,255,0.04)', 'Sin jugar']].map(([bg, label]) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: bg as string }} />
            <span className="text-[8px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Idle screen ───────────────────────────────────────────────────

function IdleScreen({
  stored,
  onStart,
  alreadyPlayed,
}: {
  stored: StoredState | null
  onStart: () => void
  alreadyPlayed: boolean
}) {
  // streak at risk: has active streak but hasn't played today
  const streakAtRisk = !alreadyPlayed && !!stored && stored.streak > 1

  return (
    <div className="max-w-lg mx-auto text-center py-12 px-4">
      <div className="mb-4 flex justify-center" style={{ color: '#FCD34D' }} aria-label="trofeo">
        <TrophyIcon size={64} />
      </div>
      <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: '#FCD34D' }}>
        CrackQuiz
      </h2>
      <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
        {QUESTIONS_PER_ROUND} preguntas · {QUESTION_TIME}s por pregunta · nueva ronda cada día
      </p>

      {stored && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatBox label="Mejor score" value={stored.bestScore} accent="#FCD34D" />
          <StatBox label="Racha" value={stored.streak} suffixIcon={<FireIcon size={14} />} accent="#F59E0B" />
          <StatBox label="Récord racha" value={stored.bestStreak ?? stored.streak} suffix="días" accent="#FB923C" />
          <StatBox label="Aciertos" value={stored.totalCorrect} accent="#86EFAC" />
        </div>
      )}

      {/* Streak at risk warning */}
      {streakAtRisk && (
        <div className="rounded-2xl p-4 mb-6 flex items-center gap-3 text-left"
          style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)' }}>
          <span className="flex-shrink-0" style={{ color: '#FB923C' }}><FireIcon size={28} /></span>
          <div>
            <p className="text-sm font-bold" style={{ color: '#FB923C' }}>¡Racha en riesgo!</p>
            <p className="text-xs" style={{ color: 'rgba(251,146,60,0.7)' }}>
              Llevas {stored!.streak} días seguidos. Juega hoy para no perder la racha.
            </p>
          </div>
        </div>
      )}

      {alreadyPlayed ? (
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Ya jugaste hoy ✓</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Vuelve mañana para la próxima ronda</p>
          {stored?.history[0] && (
            <p className="mt-3 text-sm font-semibold" style={{ color: '#FCD34D' }}>
              Puntuación de hoy: {stored.history[0].score} pts ({stored.history[0].correct}/{QUESTIONS_PER_ROUND} correctas)
            </p>
          )}
          {stored && stored.streak > 1 && (
            <p className="mt-1 text-xs flex items-center justify-center gap-1.5" style={{ color: '#F59E0B' }}><FireIcon size={14} /> Racha activa: {stored.streak} días</p>
          )}
        </div>
      ) : (
        <button
          onClick={onStart}
          className="w-full py-4 rounded-2xl font-bold text-lg transition-all hover:opacity-90 active:scale-[0.99]"
          style={{
            background: 'linear-gradient(135deg, #FCD34D, #F59E0B)',
            color: '#09090F',
          }}
        >
          ¡Empezar!
        </button>
      )}

      {stored && <HistoryCalendar history={stored.history} />}
    </div>
  )
}

function StatBox({ label, value, suffix, suffixIcon, accent }: { label: string; value: number; suffix?: string; suffixIcon?: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xl font-bold inline-flex items-center gap-1" style={{ color: accent }}>
        {value}{suffixIcon ? <span className="inline-flex items-center">{suffixIcon}</span> : suffix ? ` ${suffix}` : ''}
      </p>
    </div>
  )
}

// ── Result screen ─────────────────────────────────────────────────

function ResultScreen({
  score,
  correct,
  answers,
  questions,
  stored,
  onHome,
}: {
  score: number
  correct: number
  answers: Array<{ selected: number; correct: number; points: number }>
  questions: QuizQuestion[]
  stored: StoredState | null
  onHome: () => void
}) {
  const pct = correct / QUESTIONS_PER_ROUND
  const isNewBest = stored ? score > stored.bestScore : true

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mb-3 flex justify-center" aria-label="resultado" style={{ color: pct >= 0.8 ? '#FB923C' : pct >= 0.5 ? '#FCD34D' : '#86EFAC' }}>
          {pct >= 0.8 ? <FireIcon size={52} /> : pct >= 0.5 ? <ClapIcon size={52} /> : <FlexIcon size={52} />}
        </div>
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: '#FCD34D' }}>
          {pct >= 0.8 ? '¡Crack total!' : pct >= 0.5 ? '¡Buen juego!' : '¡Sigue practicando!'}
        </h2>
        <p style={{ color: 'var(--text-muted)' }}>{correct} de {QUESTIONS_PER_ROUND} correctas</p>
      </div>

      {/* Score */}
      <div className="rounded-2xl p-6 text-center mb-6" style={{ background: 'rgba(252,211,77,0.07)', border: '1px solid rgba(252,211,77,0.15)' }}>
        <p className="text-5xl font-black mb-1" style={{ color: '#FCD34D', fontFamily: 'var(--font-display)' }}>{score}</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>puntos</p>
        {isNewBest && <p className="mt-2 text-xs font-semibold" style={{ color: '#86EFAC' }}>✦ Nuevo récord personal</p>}
        {stored && stored.streak > 1 && (
          <p className="mt-1 text-xs flex items-center justify-center gap-1.5" style={{ color: '#FCD34D' }}><FireIcon size={14} /> Racha de {stored.streak} días</p>
        )}
      </div>

      {/* Answer review */}
      <div className="space-y-2 mb-8">
        {questions.map((q, i) => {
          const ans = answers[i]
          const wasCorrect = ans?.selected === q.correctIndex
          return (
            <div
              key={q.id}
              className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{
                background: wasCorrect ? 'rgba(110,231,183,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${wasCorrect ? 'rgba(110,231,183,0.15)' : 'rgba(239,68,68,0.15)'}`,
              }}
            >
              <div className="mt-0.5 shrink-0" style={{ color: wasCorrect ? '#6EE7B7' : '#F87171' }}>
                {wasCorrect ? <IconCheck /> : <IconClose />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug mb-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{q.question}</p>
                {!wasCorrect && (
                  <p className="text-xs" style={{ color: '#6EE7B7' }}>
                    ✓ {q.options[q.correctIndex]}
                  </p>
                )}
              </div>
              {wasCorrect && ans.points > 0 && (
                <span className="text-xs font-semibold shrink-0" style={{ color: '#FCD34D' }}>+{ans.points}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Compartir resultado */}
      <div className="mb-3">
        <ShareResultButton
          accent="#FCD34D"
          fullWidth
          play={{
            game_id:     'crackquiz',
            period:      currentDayISO(),
            score,
            payload:     { correct, total: QUESTIONS_PER_ROUND, streak: stored?.streak ?? 0 },
            duration_ms: null,
          } as GamePlay}
        />
      </div>

      <button
        onClick={onHome}
        className="w-full py-3.5 rounded-2xl font-semibold transition-opacity hover:opacity-80"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
      >
        Volver al inicio
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────

export default function CrackQuizPage() {
  const [hydrated, setHydrated] = useState(false)
  const [stored, setStored] = useState<StoredState | null>(null)
  const [phase, setPhase] = useState<GamePhase>('idle')

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_TIME)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [answers, setAnswers] = useState<Array<{ selected: number; correct: number; points: number }>>([])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Hydrate from localStorage ──────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setStored(JSON.parse(raw) as StoredState)
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  const saveStored = useCallback((next: StoredState) => {
    setStored(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  // ── Timer ──────────────────────────────────────────────────────
  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    setSecondsLeft(QUESTION_TIME)
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearTimer()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [clearTimer])

  // Auto-reveal on timeout
  useEffect(() => {
    if (phase !== 'playing' || revealed) return
    if (secondsLeft === 0) {
      handleReveal(-1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase, revealed])

  // ── Start game ─────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    trackGameStart('crackquiz')
    trackGameEvent({ gameId: 'crackquiz', event: 'started', period: currentDayISO() })
    const qs = getDailyQuestions(QUESTIONS_PER_ROUND)
    setQuestions(qs)
    setCurrentIndex(0)
    setScore(0)
    setCurrentStreak(0)
    setAnswers([])
    setSelectedOption(null)
    setRevealed(false)
    setPhase('playing')
    startTimer()
  }, [startTimer])

  // ── Answer selection ───────────────────────────────────────────
  const handleReveal = useCallback((optionIndex: number) => {
    if (revealed) return
    clearTimer()
    setSelectedOption(optionIndex)
    setRevealed(true)

    const q = questions[currentIndex]
    const isCorrect = optionIndex === q.correctIndex
    const pts = scoreForAnswer(secondsLeft, isCorrect)

    setAnswers(prev => [...prev, { selected: optionIndex, correct: q.correctIndex, points: pts }])
    setScore(prev => prev + pts)
    setCurrentStreak(prev => isCorrect ? prev + 1 : 0)

    revealTimeoutRef.current = setTimeout(() => {
      const nextIdx = currentIndex + 1
      if (nextIdx >= QUESTIONS_PER_ROUND) {
        setPhase('result')
      } else {
        setCurrentIndex(nextIdx)
        setSelectedOption(null)
        setRevealed(false)
        startTimer()
      }
    }, 1400)
  }, [revealed, clearTimer, questions, currentIndex, secondsLeft, startTimer])

  // ── End of game — persist results ──────────────────────────────
  useEffect(() => {
    if (phase !== 'result') return
    const today = todayKey()
    const correct = answers.filter((a, i) => questions[i] && a.selected === questions[i].correctIndex).length
    const prevBest = stored?.bestScore ?? 0
    const prevStreak = stored?.streak ?? 0
    const prevTotal = stored?.totalCorrect ?? 0
    const prevPlayed = stored?.totalPlayed ?? 0

    const wasYesterday = stored?.lastPlayedDate
      ? new Date(today).getTime() - new Date(stored.lastPlayedDate).getTime() === 86400000
      : false
    const newStreak = wasYesterday ? prevStreak + 1 : 1
    const prevBestStreak = stored?.bestStreak ?? prevStreak

    const next: StoredState = {
      lastPlayedDate: today,
      streak: newStreak,
      bestStreak: Math.max(prevBestStreak, newStreak),
      bestScore: Math.max(prevBest, score),
      totalCorrect: prevTotal + correct,
      totalPlayed: prevPlayed + QUESTIONS_PER_ROUND,
      history: [{ date: today, score, correct }, ...(stored?.history ?? []).slice(0, 29)],
    }
    trackGameComplete({ game: 'crackquiz', score, correct, total: QUESTIONS_PER_ROUND })
    saveStored(next)

    // Sync con backend unificado (games-store). No bloqueante.
    const period = currentDayISO()
    void recordPlay({
      gameId:  'crackquiz',
      period,
      score,
      payload: { correct, total: QUESTIONS_PER_ROUND, streak: newStreak },
    })
    trackGameEvent({ gameId: 'crackquiz', event: 'completed', period, meta: { score, correct, total: QUESTIONS_PER_ROUND } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Cleanup timers on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimer()
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current)
    }
  }, [clearTimer])

  // ── Derived state ──────────────────────────────────────────────
  const today = todayKey()
  const alreadyPlayed = !!stored?.lastPlayedDate && stored.lastPlayedDate === today

  if (!hydrated) return null

  const q = questions[currentIndex]

  return (
    <>
      <Header />
      <LiveStrip />
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24" style={{ paddingTop: 40 }}>
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/juegos" className="text-sm transition-colors hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
              Juegos
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span className="text-sm font-semibold" style={{ color: '#FCD34D' }}>CrackQuiz</span>
          </div>
          <h1 className="text-3xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.9)' }}>
            CrackQuiz
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Trivia deportiva diaria · {QUESTIONS_PER_ROUND} preguntas · hasta 150 pts
          </p>
        </div>

        {/* Game area */}
        {phase === 'idle' && (
          <IdleScreen stored={stored} onStart={handleStart} alreadyPlayed={alreadyPlayed} />
        )}

        {phase === 'playing' && q && (
          <div className="max-w-2xl mx-auto">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {currentIndex + 1} / {QUESTIONS_PER_ROUND}
                </span>
                <StreakBadge streak={currentStreak} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#FCD34D' }}>
                  <IconStar />
                  <span>{score}</span>
                </div>
                <TimerRing seconds={secondsLeft} total={QUESTION_TIME} />
              </div>
            </div>

            {/* Progress */}
            <ProgressBar current={currentIndex + (revealed ? 1 : 0)} total={QUESTIONS_PER_ROUND} />

            {/* Question card */}
            <div className="rounded-2xl p-6 my-6" style={{ background: 'rgba(252,211,77,0.05)', border: '1px solid rgba(252,211,77,0.1)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(252,211,77,0.1)', color: '#FCD34D' }}>
                  {q.category}
                </span>
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <IconTime />
                  <span>{QUESTION_TIME}s</span>
                </div>
              </div>
              <p className="text-lg font-semibold leading-snug" style={{ color: 'rgba(255,255,255,0.92)' }}>
                {q.question}
              </p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 gap-3">
              {q.options.map((opt, i) => {
                let bg = 'rgba(255,255,255,0.04)'
                let border = '1px solid rgba(255,255,255,0.08)'
                let textColor = 'rgba(255,255,255,0.8)'
                let cursor = 'pointer'

                if (revealed) {
                  cursor = 'default'
                  if (i === q.correctIndex) {
                    bg = 'rgba(110,231,183,0.1)'
                    border = '1px solid rgba(110,231,183,0.3)'
                    textColor = '#6EE7B7'
                  } else if (i === selectedOption) {
                    bg = 'rgba(239,68,68,0.1)'
                    border = '1px solid rgba(239,68,68,0.3)'
                    textColor = '#F87171'
                  } else {
                    textColor = 'rgba(255,255,255,0.3)'
                  }
                }

                return (
                  <button
                    key={i}
                    disabled={revealed}
                    onClick={() => handleReveal(i)}
                    className="text-left px-5 py-4 rounded-xl font-medium transition-all"
                    style={{ background: bg, border, color: textColor, cursor }}
                  >
                    <span className="inline-flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'rgba(255,255,255,0.08)' }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {phase === 'result' && (
          <>
            <ResultScreen
              score={score}
              correct={answers.filter((a, i) => questions[i] && a.selected === questions[i].correctIndex).length}
              answers={answers}
              questions={questions}
              stored={stored}
              onHome={() => setPhase('idle')}
            />
            <PostGameResultModal
              gameId="crackquiz"
              period={currentDayISO()}
              accent="#FCD34D"
              onClose={() => { /* el modal solo se abre una vez por periodo */ }}
              play={{
                game_id:     'crackquiz',
                period:      currentDayISO(),
                score,
                payload:     {
                  correct: answers.filter((a, i) => questions[i] && a.selected === questions[i].correctIndex).length,
                  total:   QUESTIONS_PER_ROUND,
                  streak:  stored?.streak ?? 0,
                },
                duration_ms: null,
              } as GamePlay}
            />
          </>
        )}
      </main>
      <Footer />
      <ScrollToTop />
    </>
  )
}
