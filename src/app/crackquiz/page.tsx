'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import GameLayout from '@/components/games/GameLayout'
import { getDailyQuestions, getPracticeQuestions, listCategories, todayKey, type QuizQuestion, type QuizCategory, type QuizSport } from '@/lib/crackquiz-questions'
import { trackGameStart, trackGameComplete } from '@/lib/analytics'
import { TrophyIcon, FireIcon, ClapIcon, FlexIcon, BoltIcon, DiceIcon } from '@/components/icons/GameIcons'
import { ensureAudio, sfx, SOUND_KEY, getSoundPref, winFanfare, fireConfetti } from '@/lib/game-feedback'
import { recordPlay, currentDayISO, type GamePlay } from '@/lib/games-store'
import { madridDayISO } from '@/lib/taka-time'
import { trackGameEvent } from '@/lib/games-telemetry'
import { addXp, xpForCrackquiz } from '@/lib/meta-progression'
import { reportPlay } from '@/lib/missions'
import ShareResultButton from '@/components/games/ShareResultButton'
import PostGameResultModal from '@/components/games/PostGameResultModal'

// ── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = 'ts_crackquiz_state'
const QUESTION_TIME = 20        // seconds per question
const QUESTIONS_PER_ROUND = 10  // questions per daily round
const BASE_PTS = 10             // base points per correct answer
const TIME_BONUS_MAX = 5        // max bonus points for fast answer
const STREAK_BONUS_MAX = 5      // max bonus points for consecutive correct answers
const TIMER_WARN_AT = 5         // seconds at which the timer enters warning state

// ── Types ────────────────────────────────────────────────────────

interface StoredState {
  lastPlayedDate: string
  streak: number
  bestStreak: number
  bestScore: number
  totalCorrect: number
  totalPlayed: number
  history: Array<HistoryEntry>
}

interface HistoryEntry {
  date: string
  score: number
  correct: number
  cats?: Array<{ category: string; correct: number; total: number }>
}

type GamePhase = 'idle' | 'playing' | 'result'

// ── Score helpers ─────────────────────────────────────────────────

interface ScoreBreakdown {
  total: number
  base: number
  time: number
  streak: number
}

// streakBefore = consecutive correct answers BEFORE this one
function scoreForAnswer(secondsLeft: number, correct: boolean, streakBefore: number): ScoreBreakdown {
  if (!correct) return { total: 0, base: 0, time: 0, streak: 0 }
  const base = BASE_PTS
  const time = Math.round((secondsLeft / QUESTION_TIME) * TIME_BONUS_MAX)
  // Nth consecutive correct (N = streakBefore + 1): +1 from the 2nd, capped
  const streak = Math.min(streakBefore, STREAK_BONUS_MAX)
  return { total: base + time + streak, base, time, streak }
}

// Calendar-day difference between two YYYY-MM-DD keys (toKey - fromKey)
function dayDiff(fromKey: string, toKey: string): number {
  const a = new Date(fromKey.slice(0, 10) + 'T12:00:00Z').getTime()
  const b = new Date(toKey.slice(0, 10) + 'T12:00:00Z').getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY
  return Math.round((b - a) / 86400000)
}

// ── Sound & haptic (client-only, no assets) ───────────────────────

// Motor de audio/háptica + confeti/fanfarria → src/lib/game-feedback.ts
// (compartido con el resto de minijuegos). SOUND_KEY es ahora la key común.

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
  const warning = seconds > 0 && seconds <= TIMER_WARN_AT

  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: 60,
        height: 60,
        animation: warning ? 'cq-timer-pulse 1s ease-in-out infinite' : undefined,
      }}
      aria-label={`${seconds} segundos restantes`}
    >
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
  const bonus = Math.min(streak - 1, STREAK_BONUS_MAX)
  return (
    <div
      key={streak}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        background: 'rgba(252,211,77,0.1)',
        color: '#FCD34D',
        border: '1px solid rgba(252,211,77,0.2)',
        animation: 'cq-combo-pop 0.4s ease-out',
      }}
    >
      <IconFire />
      <span>x{streak}</span>
      {bonus > 0 && <span style={{ color: '#FB923C' }}>· +{bonus}</span>}
    </div>
  )
}

// Floating "+pts" indicator shown briefly after a correct answer
function ScorePop({ breakdown, streak }: { breakdown: ScoreBreakdown; streak: number }) {
  if (breakdown.total <= 0) return null
  return (
    <div
      key={`${streak}-${breakdown.total}`}
      className="absolute left-1/2 -translate-x-1/2 -top-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black pointer-events-none z-10"
      style={{
        background: 'rgba(252,211,77,0.16)',
        color: '#FCD34D',
        border: '1px solid rgba(252,211,77,0.3)',
        animation: 'cq-score-float 1.2s ease-out forwards',
      }}
    >
      <span>+{breakdown.total}</span>
      {breakdown.streak > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: '#FB923C' }}>
          <IconFire />combo
        </span>
      )}
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

function HistoryCalendar({ history }: { history: Array<HistoryEntry> }) {
  const [selected, setSelected] = useState<string | null>(null)
  if (history.length === 0) return null

  // Build a map of date → entry
  const byDate: Record<string, HistoryEntry> = {}
  history.forEach(h => { byDate[h.date] = h })
  const detail = selected ? byDate[selected] : null

  // Show last 28 days (4 weeks)
  const days: { date: string; label: string }[] = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = madridDayISO(d)
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
          const title = entry ? `${entry.correct}/${QUESTIONS_PER_ROUND} correctas` : 'Sin jugar'
          const isSel = selected === date
          return (
            <button
              key={date}
              type="button"
              title={title}
              disabled={!entry}
              onClick={() => setSelected(isSel ? null : date)}
              className="rounded-md aspect-square transition-transform"
              style={{
                background: bg,
                border: isSel
                  ? '1px solid rgba(252,211,77,0.7)'
                  : pct >= 0 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.04)',
                cursor: entry ? 'pointer' : 'default',
                transform: isSel ? 'scale(1.12)' : undefined,
                outline: 'none',
              }}
              aria-label={`${date}: ${title}`}
            />
          )
        })}
      </div>

      {detail && (
        <div
          className="mt-4 rounded-xl p-4 text-left"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', animation: 'cq-combo-pop 0.3s ease-out' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold" style={{ color: '#FCD34D' }}>
              {new Date(selected! + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Cerrar detalle"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {detail.score} pts
            </span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {detail.correct}/{QUESTIONS_PER_ROUND} correctas
            </span>
          </div>
          {detail.cats && detail.cats.length > 0 ? (
            <div className="space-y-1.5">
              {detail.cats.map(c => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{c.category}</span>
                  <span
                    className="font-semibold"
                    style={{ color: c.correct === c.total ? '#6EE7B7' : c.correct === 0 ? '#F87171' : '#FCD34D' }}
                  >
                    {c.correct}/{c.total}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Sin desglose por categoría para esta ronda
            </p>
          )}
        </div>
      )}
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

function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={on ? 'Desactivar sonido' : 'Activar sonido'}
      title={on ? 'Sonido activado' : 'Sonido desactivado'}
      className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
      style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: on ? '#FCD34D' : 'rgba(255,255,255,0.35)' }}
    >
      {on ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 6v4h2.5L9 13V3L5.5 6H3z" fill="currentColor" />
          <path d="M11 5.5a3 3 0 010 5M12.5 4a5.5 5.5 0 010 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 6v4h2.5L9 13V3L5.5 6H3z" fill="currentColor" />
          <path d="M11 6l3 4M14 6l-3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

const CATEGORY_LABEL: Record<string, string> = {
  champions:   'Champions',
  clubes:      'Clubes',
  historia:    'Historia',
  jugadores:   'Jugadores',
  mundiales:   'Mundiales',
  records:     'Récords',
  reglas:      'Reglas',
  selecciones: 'Selecciones',
}

const SPORT_LABEL: Record<QuizSport, string> = {
  football:   'Fútbol',
  basketball: 'Baloncesto',
  tennis:     'Tenis',
  motor:      'Motor',
  mma:        'UFC/MMA',
  golf:       'Golf',
  cycling:    'Ciclismo',
  general:    'Multideporte',
}

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'Fácil', 2: 'Media', 3: 'Difícil' }

// Indicador de dificultad (3 puntos). Usa el campo `difficulty` de la pregunta.
function DifficultyMeter({ level }: { level: number }) {
  const label = DIFFICULTY_LABEL[level] ?? 'desconocida'
  return (
    <span className="inline-flex items-center gap-1" title={`Dificultad: ${label}`} aria-label={`Dificultad: ${label}`}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className="rounded-full"
          style={{ width: 6, height: 6, background: i <= level ? '#FCD34D' : 'rgba(255,255,255,0.18)' }}
          aria-hidden
        />
      ))}
    </span>
  )
}

function IdleScreen({
  stored,
  onStart,
  onPractice,
  alreadyPlayed,
  soundOn,
  onToggleSound,
}: {
  stored: StoredState | null
  onStart: () => void
  onPractice: (category?: QuizCategory) => void
  alreadyPlayed: boolean
  soundOn: boolean
  onToggleSound: () => void
}) {
  const [practiceCategory, setPracticeCategory] = useState<QuizCategory | ''>('')
  const categories = listCategories()
  // streak at risk: has active streak but hasn't played today
  const streakAtRisk = !alreadyPlayed && !!stored && stored.streak > 1

  return (
    <div className="max-w-lg mx-auto text-center py-12 px-4 relative">
      <div className="absolute right-4 top-4">
        <SoundToggle on={soundOn} onToggle={onToggleSound} />
      </div>
      <div className="mb-4 flex justify-center" style={{ color: '#FCD34D' }} aria-label="trofeo">
        <TrophyIcon size={64} />
      </div>
      <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: '#FCD34D' }}>
        CrackQuiz
      </h2>
      <p className="mb-3" style={{ color: 'var(--text-muted)' }}>
        {QUESTIONS_PER_ROUND} preguntas · {QUESTION_TIME}s por pregunta · nueva ronda cada día
      </p>
      <p className="mb-8 text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{ background: 'rgba(252,211,77,0.08)', color: '#F59E0B', border: '1px solid rgba(252,211,77,0.18)' }}>
        <FireIcon size={13} /> Encadena aciertos: cada acierto seguido suma puntos extra (hasta +{STREAK_BONUS_MAX})
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
              Llevas {stored!.streak} días seguidos. Tienes 1 día de margen, pero juega hoy para no arriesgarla.
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
          <div className="mt-5 flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-left" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              Categoría
            </label>
            <select
              value={practiceCategory}
              onChange={e => setPracticeCategory(e.target.value as QuizCategory | '')}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold outline-none cursor-pointer"
              style={{
                background: 'rgba(0,0,0,0.3)',
                color: '#F0F0F5',
                border: '1px solid rgba(255,255,255,0.08)',
                fontFamily: 'var(--font-display)',
              }}
              aria-label="Categoría para la ronda de práctica"
            >
              <option value="">Mezcla — todas las categorías</option>
              {categories.map(c => (
                <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>
              ))}
            </select>
            <button
              onClick={() => onPractice(practiceCategory || undefined)}
              className="w-full py-3 rounded-xl font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(252,211,77,0.1)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.25)' }}
            >
              Practicar otra ronda
            </button>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No cuenta para el ranking ni la racha
          </p>
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
  maxCombo,
  practice,
  awardedPoints,
  onHome,
}: {
  score: number
  correct: number
  answers: Array<{ selected: number; correct: number; points: number }>
  questions: QuizQuestion[]
  stored: StoredState | null
  maxCombo: number
  practice: boolean
  awardedPoints: number | null
  onHome: () => void
}) {
  const pct = correct / QUESTIONS_PER_ROUND
  const isNewBest = !practice && (stored ? score > stored.bestScore : true)

  // Heatmap social: % comunidad que acertó cada pregunta del día.
  // Se carga una vez al montar el ResultScreen; falla en silencio si no
  // hay datos agregados (modo dev sin service role, día sin plays todavía).
  const [heatmap, setHeatmap] = useState<{ byQuestion: Record<string, { plays: number; correct: number }>; totalPlays: number } | null>(null)
  useEffect(() => {
    if (practice) return
    let cancelled = false
    const period = currentDayISO()
    fetch(`/api/games/crackquiz/heatmap?period=${period}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!cancelled && j && j.byQuestion) setHeatmap({ byQuestion: j.byQuestion, totalPlays: j.totalPlays ?? 0 }) })
      .catch(() => { /* failsafe */ })
    return () => { cancelled = true }
  }, [practice])

  // Celebración de victoria (≥60% aciertos): confeti visual siempre + fanfarria
  // si el sonido está activado. Una sola vez al montar el resultado.
  useEffect(() => {
    if (pct < 0.6) return
    fireConfetti()
    if (getSoundPref()) { ensureAudio(); winFanfare() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Per-category breakdown → strongest / weakest
  const catMap: Record<string, { correct: number; total: number }> = {}
  questions.forEach((qq, i) => {
    const a = answers[i]
    const cat = qq.category || 'General'
    if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 }
    catMap[cat].total += 1
    if (a && a.selected === qq.correctIndex) catMap[cat].correct += 1
  })
  const catRows = Object.entries(catMap).map(([category, v]) => ({ category, ...v, ratio: v.correct / v.total }))
  const sorted = [...catRows].sort((a, b) => b.ratio - a.ratio)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const showCatInsight = catRows.length >= 2 && best && worst && best.category !== worst.category

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      {practice && (
        <div className="rounded-xl px-4 py-2.5 mb-5 text-center text-xs font-semibold"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
          Ronda de práctica · no cuenta para el ranking ni la racha
        </div>
      )}
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
        {!practice && stored && stored.streak > 1 && (
          <p className="mt-1 text-xs flex items-center justify-center gap-1.5" style={{ color: '#FCD34D' }}><FireIcon size={14} /> Racha de {stored.streak} días</p>
        )}
        {maxCombo >= 2 && (
          <p className="mt-1 text-xs flex items-center justify-center gap-1.5" style={{ color: '#FB923C' }}>
            <FireIcon size={14} /> Mejor combo: {maxCombo} seguidas
          </p>
        )}
      </div>

      {/* Toast de puntos acreditadas — solo en ronda real con auth y server OK */}
      {!practice && awardedPoints !== null && awardedPoints > 0 && (
        <div
          className="rounded-2xl px-5 py-4 mb-6 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(252,211,77,0.12), rgba(251,146,60,0.08))',
            border: '1px solid rgba(252,211,77,0.3)',
            animation: 'cq-combo-pop 0.45s ease-out',
          }}
          role="status"
          aria-live="polite"
        >
          <span style={{ display: 'inline-flex', lineHeight: 1, color: '#FCD34D' }}><BoltIcon size={28} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black" style={{ color: '#FCD34D', fontFamily: 'var(--font-display)' }}>
              +{awardedPoints} puntos a la Liga Taka
            </p>
            <p className="text-[10px]" style={{ color: 'rgba(252,211,77,0.6)', fontFamily: 'var(--font-sport)' }}>
              Suman en tu ranking general de TakaSports
            </p>
          </div>
        </div>
      )}

      {/* Category insight */}
      {showCatInsight && (
        <div className="rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.15)' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#6EE7B7' }}>Más fuerte</p>
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{best.category}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{best.correct}/{best.total}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#F87171' }}>A mejorar</p>
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{worst.category}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{worst.correct}/{worst.total}</p>
          </div>
        </div>
      )}

      {/* Answer review */}
      <div className="space-y-2 mb-8">
        {questions.map((q, i) => {
          const ans = answers[i]
          const wasCorrect = ans?.selected === q.correctIndex
          const hm = heatmap?.byQuestion?.[q.id]
          const socialPct = hm && hm.plays > 0 ? Math.round((hm.correct / hm.plays) * 100) : null
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
                {socialPct !== null && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-full"
                        style={{
                          width: `${socialPct}%`,
                          background: socialPct >= 70 ? '#6EE7B7' : socialPct >= 40 ? '#FCD34D' : '#F87171',
                        }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums font-bold whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {socialPct}% acertó
                    </span>
                  </div>
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
            payload:     { correct, total: QUESTIONS_PER_ROUND, streak: practice ? 0 : (stored?.streak ?? 0), combo: maxCombo },
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
  const [maxCombo, setMaxCombo] = useState(0)
  const [lastBreakdown, setLastBreakdown] = useState<ScoreBreakdown | null>(null)
  const [answers, setAnswers] = useState<Array<{ selected: number; correct: number; points: number; streakBonus: number }>>([])
  const [soundOn, setSoundOn] = useState(false)
  const [showIntro, setShowIntro] = useState(false)
  const [practice, setPractice] = useState(false)
  // Doble o nada en la pregunta 10. null hasta llegar a Q10; 'pending'
  // mientras se muestra el diálogo; 'accepted' / 'declined' tras decidir.
  const [donChoice, setDonChoice] = useState<'pending' | 'accepted' | 'declined' | null>(null)
  // Pregunta destacada del día (de actualidad). Si la API la devuelve, se
  // inyecta como primera pregunta de la ronda diaria. El badge se pinta a
  // partir de su id.
  const [featuredQ, setFeaturedQ] = useState<QuizQuestion | null>(null)
  const [featuredId, setFeaturedId] = useState<string | null>(null)
  // Puntos acreditadas al Ranked tras la partida (server-autoritativo).
  // null = aún no respondió el server; 0 = sin puntos (ya estaba acreditado
  // hoy, no hay sesión, o cap alcanzado); >0 = mostrar toast en ResultScreen.
  const [awardedPoints, setAwardedPoints] = useState<number | null>(null)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const introTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const practiceRef = useRef(false)
  const soundRef = useRef(false)

  // ── Hydrate from localStorage ──────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setStored(JSON.parse(raw) as StoredState)
    } catch { /* ignore */ }
    try {
      const s = localStorage.getItem(SOUND_KEY)
      const on = s === null ? true : s === '1'
      setSoundOn(on)
      soundRef.current = on
    } catch { /* ignore */ }
    setHydrated(true)

    // Prefetch de la pregunta destacada del día (silencioso si no hay)
    fetch(`/api/crackquiz/featured?day=${currentDayISO()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const fq = j?.question
        if (
          fq && typeof fq.id === 'string' && typeof fq.question === 'string'
          && Array.isArray(fq.options) && fq.options.length === 4
          && typeof fq.correctIndex === 'number'
        ) {
          setFeaturedQ(fq as QuizQuestion)
        }
      })
      .catch(() => { /* failsafe */ })
  }, [])

  const toggleSound = useCallback(() => {
    setSoundOn(prev => {
      const next = !prev
      soundRef.current = next
      try { localStorage.setItem(SOUND_KEY, next ? '1' : '0') } catch { /* ignore */ }
      if (next) { ensureAudio(); sfx.correct() }
      return next
    })
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

  // Show a brief category intro, then start the question timer
  const startQuestion = useCallback(() => {
    if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current)
    setShowIntro(true)
    setSecondsLeft(QUESTION_TIME)
    introTimeoutRef.current = setTimeout(() => {
      setShowIntro(false)
      startTimer()
    }, 900)
  }, [startTimer])

  // Timer warning ticks (last seconds)
  useEffect(() => {
    if (phase !== 'playing' || revealed || showIntro) return
    if (secondsLeft > 0 && secondsLeft <= TIMER_WARN_AT && soundRef.current) {
      ensureAudio()
      sfx.tick()
    }
  }, [secondsLeft, phase, revealed, showIntro])

  // Auto-reveal on timeout
  useEffect(() => {
    if (phase !== 'playing' || revealed || showIntro) return
    if (secondsLeft === 0) {
      handleReveal(-1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase, revealed, showIntro])

  // ── Start game ─────────────────────────────────────────────────
  const handleStart = useCallback((isPractice = false, category?: QuizCategory) => {
    if (soundRef.current) ensureAudio()
    practiceRef.current = isPractice
    setPractice(isPractice)
    trackGameStart('crackquiz')
    trackGameEvent({ gameId: 'crackquiz', event: 'started', period: currentDayISO(), meta: { practice: isPractice, category: category ?? null } })
    let qs = isPractice
      ? getPracticeQuestions(QUESTIONS_PER_ROUND, category)
      : getDailyQuestions(QUESTIONS_PER_ROUND)
    let fid: string | null = null
    if (!isPractice && featuredQ) {
      // Inyectamos la destacada como Q1, evitando duplicado si ya estaba.
      const rest = qs.filter(x => x.id !== featuredQ.id)
      qs = [featuredQ, ...rest].slice(0, QUESTIONS_PER_ROUND)
      fid = featuredQ.id
    }
    setQuestions(qs)
    setFeaturedId(fid)
    setCurrentIndex(0)
    setScore(0)
    setCurrentStreak(0)
    setMaxCombo(0)
    setAnswers([])
    setSelectedOption(null)
    setRevealed(false)
    setLastBreakdown(null)
    setDonChoice(null)
    setAwardedPoints(null)
    setPhase('playing')
    startQuestion()
  }, [startQuestion, featuredQ])

  // Combo embolsado: suma de bonus de racha de todas las respuestas previas.
  // Es lo que se apuesta en el doble o nada de la pregunta final.
  const comboBank = useMemo(
    () => answers.reduce((acc, a) => acc + (a.streakBonus ?? 0), 0),
    [answers],
  )

  const advanceToNext = useCallback(() => {
    const nextIdx = currentIndex + 1
    if (nextIdx >= QUESTIONS_PER_ROUND) {
      setPhase('result')
    } else {
      setCurrentIndex(nextIdx)
      setSelectedOption(null)
      setRevealed(false)
      setLastBreakdown(null)
      startQuestion()
    }
  }, [currentIndex, startQuestion])

  const handleDonChoice = useCallback((choice: 'accepted' | 'declined') => {
    setDonChoice(choice)
    // Pequeño respiro visual antes de pasar a Q10
    setTimeout(() => advanceToNext(), 250)
  }, [advanceToNext])

  // ── Answer selection ───────────────────────────────────────────
  const handleReveal = useCallback((optionIndex: number) => {
    if (revealed) return
    clearTimer()
    setSelectedOption(optionIndex)
    setRevealed(true)

    const q = questions[currentIndex]
    const isCorrect = optionIndex === q.correctIndex
    const baseBreakdown = scoreForAnswer(secondsLeft, isCorrect, currentStreak)

    // Doble o nada: en la pregunta final, si aceptó la apuesta, sumamos
    // un extra equivalente al combo banco (si acierta) o lo restamos (si falla).
    const isFinal = currentIndex === QUESTIONS_PER_ROUND - 1
    const donDelta = isFinal && donChoice === 'accepted'
      ? (isCorrect ? comboBank : -comboBank)
      : 0
    const breakdown: ScoreBreakdown = { ...baseBreakdown, total: baseBreakdown.total + donDelta }

    setAnswers(prev => [
      ...prev,
      { selected: optionIndex, correct: q.correctIndex, points: breakdown.total, streakBonus: baseBreakdown.streak },
    ])
    setScore(prev => Math.max(0, prev + breakdown.total))
    setCurrentStreak(prev => {
      const next = isCorrect ? prev + 1 : 0
      if (isCorrect) setMaxCombo(m => Math.max(m, next))
      return next
    })
    setLastBreakdown(isCorrect ? breakdown : null)

    if (soundRef.current) {
      ensureAudio()
      ;(isCorrect ? sfx.correct : sfx.wrong)()
    }

    revealTimeoutRef.current = setTimeout(() => {
      const nextIdx = currentIndex + 1
      // Si vamos a entrar en Q10 y hay combo bancado por apostar, paramos
      // para preguntar el doble o nada. El usuario decide y avanza desde el diálogo.
      const projectedBank = comboBank + (isCorrect ? baseBreakdown.streak : 0)
      if (nextIdx === QUESTIONS_PER_ROUND - 1 && donChoice === null && projectedBank > 0) {
        setDonChoice('pending')
        return
      }
      advanceToNext()
    }, 1400)
  }, [revealed, clearTimer, questions, currentIndex, secondsLeft, currentStreak, comboBank, donChoice, advanceToNext])

  // ── End of game — persist results ──────────────────────────────
  useEffect(() => {
    if (phase !== 'result') return
    const today = todayKey()
    const correct = answers.filter((a, i) => questions[i] && a.selected === questions[i].correctIndex).length

    // Practice rounds never touch streak, history, leaderboard or stats
    if (practiceRef.current) {
      trackGameComplete({ game: 'crackquiz', score, correct, total: QUESTIONS_PER_ROUND })
      trackGameEvent({ gameId: 'crackquiz', event: 'completed', period: currentDayISO(), meta: { score, correct, total: QUESTIONS_PER_ROUND, practice: true } })
      return
    }

    const prevBest = stored?.bestScore ?? 0
    const prevStreak = stored?.streak ?? 0
    const prevTotal = stored?.totalCorrect ?? 0
    const prevPlayed = stored?.totalPlayed ?? 0

    // Calendar-day aware streak with a one-day grace window:
    //  gap 1  → consecutive day, streak grows
    //  gap 2  → missed exactly one day, streak survives (not incremented)
    //  gap ≥3 → streak resets
    const gap = stored?.lastPlayedDate ? dayDiff(stored.lastPlayedDate, today) : null
    let newStreak: number
    if (gap === null) newStreak = 1
    else if (gap <= 0) newStreak = Math.max(prevStreak, 1)
    else if (gap === 1) newStreak = prevStreak + 1
    else if (gap === 2) newStreak = Math.max(prevStreak, 1)
    else newStreak = 1
    const prevBestStreak = stored?.bestStreak ?? prevStreak

    // Per-category breakdown for the interactive history
    const catMap: Record<string, { correct: number; total: number }> = {}
    questions.forEach((qq, i) => {
      const a = answers[i]
      const cat = qq.category || 'General'
      if (!catMap[cat]) catMap[cat] = { correct: 0, total: 0 }
      catMap[cat].total += 1
      if (a && a.selected === qq.correctIndex) catMap[cat].correct += 1
    })
    const cats = Object.entries(catMap).map(([category, v]) => ({ category, correct: v.correct, total: v.total }))

    const next: StoredState = {
      lastPlayedDate: today,
      streak: newStreak,
      bestStreak: Math.max(prevBestStreak, newStreak),
      bestScore: Math.max(prevBest, score),
      totalCorrect: prevTotal + correct,
      totalPlayed: prevPlayed + QUESTIONS_PER_ROUND,
      history: [{ date: today, score, correct, cats }, ...(stored?.history ?? []).slice(0, 29)],
    }
    trackGameComplete({ game: 'crackquiz', score, correct, total: QUESTIONS_PER_ROUND })
    saveStored(next)

    // Sync con backend unificado (games-store). No bloqueante.
    const period = currentDayISO()
    // Compact per-question outcome for the social heatmap. Enviamos la opción
    // ELEGIDA (`selected`, 0–3, o -1 si no respondió): el servidor recalcula el
    // acierto contra la respuesta oficial e ignora el `correct` del cliente.
    const answersForPayload = questions.map((qq, i) => ({
      qId: qq.id,
      selected: answers[i] ? answers[i].selected : -1,
      correct: answers[i] ? answers[i].selected === qq.correctIndex : false,
    }))
    recordPlay({
      gameId:  'crackquiz',
      period,
      score,
      payload: { correct, total: QUESTIONS_PER_ROUND, streak: newStreak, combo: maxCombo, answers: answersForPayload },
    }).then(r => { if (r.awarded > 0) setAwardedPoints(r.awarded) })
      .catch(() => { /* no toast — el resto del flujo no se afecta */ })
    addXp('crackquiz', xpForCrackquiz(correct))
    reportPlay('crackquiz', { score })
    trackGameEvent({ gameId: 'crackquiz', event: 'completed', period, meta: { score, correct, total: QUESTIONS_PER_ROUND, combo: maxCombo } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Cleanup timers on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimer()
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current)
      if (introTimeoutRef.current) clearTimeout(introTimeoutRef.current)
    }
  }, [clearTimer])

  // ── Derived state ──────────────────────────────────────────────
  const today = todayKey()
  const alreadyPlayed = !!stored?.lastPlayedDate && stored.lastPlayedDate === today

  if (!hydrated) return null

  const q = questions[currentIndex]

  return (
    <>
      <style>{`
        @keyframes cq-timer-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @keyframes cq-combo-pop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes cq-score-float {
          0% { transform: translate(-50%, 6px) scale(0.8); opacity: 0; }
          20% { transform: translate(-50%, -4px) scale(1.1); opacity: 1; }
          80% { transform: translate(-50%, -10px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -22px) scale(0.95); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="cq-timer-pulse"], [style*="cq-combo-pop"], [style*="cq-score-float"] { animation: none !important; }
        }
      `}</style>
      <GameLayout accent="#FCD34D" accentDim="#F59E0B" mainStyle={{ paddingTop: 40 }}>
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
            Trivia deportiva diaria · {QUESTIONS_PER_ROUND} preguntas · combo de racha
          </p>
        </div>

        {/* Game area */}
        {phase === 'idle' && (
          <IdleScreen
            stored={stored}
            onStart={() => handleStart(false)}
            onPractice={(cat) => handleStart(true, cat)}
            alreadyPlayed={alreadyPlayed}
            soundOn={soundOn}
            onToggleSound={toggleSound}
          />
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
                {practice && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    Práctica
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <SoundToggle on={soundOn} onToggle={toggleSound} />
                <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#FCD34D' }}>
                  <IconStar />
                  <span>{score}</span>
                </div>
                <TimerRing seconds={secondsLeft} total={QUESTION_TIME} />
              </div>
            </div>

            {/* Progress */}
            <ProgressBar current={currentIndex + (revealed ? 1 : 0)} total={QUESTIONS_PER_ROUND} />

            {/* Doble o nada — overlay antes de la pregunta final */}
            {donChoice === 'pending' ? (
              <div
                className="rounded-2xl p-6 my-6 text-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(252,211,77,0.12), rgba(251,146,60,0.08))',
                  border: '1px solid rgba(252,211,77,0.35)',
                  animation: 'cq-combo-pop 0.4s ease-out',
                }}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2 inline-flex items-center justify-center gap-1.5" style={{ color: '#FB923C' }}>
                  <FireIcon size={14} /> Doble o nada
                </p>
                <p className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-display)', color: '#FCD34D' }}>
                  Te quedas con tu combo o lo apuestas
                </p>
                <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Llevas <span className="font-black" style={{ color: '#FCD34D' }}>+{comboBank} pts</span> de combo bancado.
                  Si aciertas la última pregunta los <span className="font-black">duplicas</span>; si fallas los <span className="font-black" style={{ color: '#F87171' }}>pierdes</span>.
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                  <button
                    onClick={() => handleDonChoice('declined')}
                    className="py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Me quedo el combo
                  </button>
                  <button
                    onClick={() => handleDonChoice('accepted')}
                    className="py-3 rounded-xl text-sm font-black transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-1.5"
                    style={{
                      background: 'linear-gradient(135deg, #FCD34D, #FB923C)',
                      color: '#09090F',
                      boxShadow: '0 6px 20px rgba(251,146,60,0.35)',
                    }}
                  >
                    <DiceIcon size={14} className="inline-block align-middle mr-1" />Apostar +{comboBank}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Question card / category intro (oculto durante el diálogo de doble o nada) */}
            {donChoice !== 'pending' && (
              showIntro ? (
                <div
                  key={`intro-${currentIndex}`}
                  className="rounded-2xl p-10 my-6 text-center"
                  style={{ background: 'rgba(252,211,77,0.07)', border: '1px solid rgba(252,211,77,0.15)', animation: 'cq-combo-pop 0.4s ease-out' }}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-muted)' }}>
                    Categoría
                  </p>
                  <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: '#FCD34D' }}>
                    {CATEGORY_LABEL[q.category] ?? q.category}
                  </p>
                  {q.sport && SPORT_LABEL[q.sport] && (
                    <p className="text-xs mt-2 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      {SPORT_LABEL[q.sport]}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl p-6 my-6" style={{ background: 'rgba(252,211,77,0.05)', border: '1px solid rgba(252,211,77,0.1)' }}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(252,211,77,0.1)', color: '#FCD34D' }}>
                      {CATEGORY_LABEL[q.category] ?? q.category}
                    </span>
                    {q.sport && SPORT_LABEL[q.sport] && (
                      <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {SPORT_LABEL[q.sport]}
                      </span>
                    )}
                    {q.difficulty ? <DifficultyMeter level={q.difficulty} /> : null}
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <IconTime />
                      <span>{QUESTION_TIME}s</span>
                    </div>
                    {donChoice === 'accepted' && currentIndex === QUESTIONS_PER_ROUND - 1 && (
                      <span
                        className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                        style={{ background: 'rgba(251,146,60,0.18)', color: '#FB923C', border: '1px solid rgba(251,146,60,0.4)' }}
                      >
                        <DiceIcon size={11} />Apostando +{comboBank}
                      </span>
                    )}
                    {featuredId && q.id === featuredId && (
                      <span
                        className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                        style={{ background: 'rgba(248,113,113,0.15)', color: '#FCA5A5', border: '1px solid rgba(248,113,113,0.35)' }}
                        title="Pregunta de actualidad seleccionada por la redacción"
                      >
                        <FireIcon size={11} />Actualidad
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-semibold leading-snug" style={{ color: 'rgba(255,255,255,0.92)' }}>
                    {q.question}
                  </p>
                </div>
              )
            )}

            {/* Options */}
            <div
              className="relative grid grid-cols-1 gap-3"
              style={{
                visibility: showIntro || donChoice === 'pending' ? 'hidden' : 'visible',
                display: donChoice === 'pending' ? 'none' : 'grid',
              }}
            >
              {revealed && lastBreakdown && <ScorePop breakdown={lastBreakdown} streak={currentStreak} />}
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

                // Feedback NO cromático (a11y): ✓/✗ + aria-label, no solo color.
                const isCorrect = revealed && i === q.correctIndex
                const isWrongPick = revealed && selectedOption === i && i !== q.correctIndex

                return (
                  <button
                    key={i}
                    disabled={revealed || showIntro}
                    onClick={() => handleReveal(i)}
                    aria-label={isCorrect ? `Respuesta correcta: ${opt}` : isWrongPick ? `Tu respuesta, incorrecta: ${opt}` : undefined}
                    className="text-left px-5 py-4 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    style={{ background: bg, border, color: textColor, cursor }}
                  >
                    <span className="inline-flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'rgba(255,255,255,0.08)' }} aria-hidden>
                        {isCorrect ? '✓' : isWrongPick ? '✗' : String.fromCharCode(65 + i)}
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
              maxCombo={maxCombo}
              practice={practice}
              awardedPoints={awardedPoints}
              onHome={() => { setAwardedPoints(null); setPhase('idle') }}
            />
            {!practice && (
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
                    combo:   maxCombo,
                  },
                  duration_ms: null,
                } as GamePlay}
              />
            )}
          </>
        )}
      </GameLayout>
    </>
  )
}
