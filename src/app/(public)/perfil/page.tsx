'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import AuthModal from '@/components/AuthModal'
import type { SportEvent } from '@/lib/types'
import { QUINIELA_PICKS_KEY } from '@/components/QuinielaModule'
import type { QuinielaSaved } from '@/components/QuinielaModule'
import type { ReadItem } from '@/app/article/[id]/ReadTracker'
import { RECENTLY_READ_KEY } from '@/app/article/[id]/ReadTracker'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { timeAgo } from '@/lib/timeAgo'
import TimezoneSelector from '@/components/TimezoneSelector'
import ScrollToTop from '@/components/ScrollToTop'
import { getStoredTZ, setStoredTZ, getTZOption, getTZOffset, TZ_CHANGE_EVENT } from '@/lib/timezone'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { SportIcon, FireIcon, FootballIcon, StadiumIcon, TargetIcon, TrophyIcon, ClipboardIcon, LightbulbIcon, SearchIcon } from '@/components/icons/GameIcons'
import MyGamesActivity from '@/components/games/MyGamesActivity'
import { getBadge } from '@/lib/badges'
import type { BadgeDef } from '@/lib/badges'
import { BadgeIcon, hasBadgeIcon } from '@/components/icons/badges/BadgeIcon'
import { UserPlacaCard } from '@/components/placa/UserPlacaCard'
import { SportPickPanel } from '@/components/placa/SportPickPanel'
import TakaPoint from '@/components/TakaPoint'
import ExportDataSection from '@/components/ExportDataSection'
import DeleteAccountSection from '@/components/DeleteAccountSection'
import { usePoints, useStreak } from '@/hooks/useGameState'

const REMINDERS_KEY = 'ts_reminders'
const REMINDERS_DATA_KEY = 'ts_reminders_data'
const PROFILE_NAME_KEY = 'ts_profile_name'

const PICK_LABEL: Record<string, string> = { '1': 'Local', X: 'Empate', '2': 'Visitante' }
const PICK_COLOR: Record<string, string> = { '1': '#22c55e', X: '#f59e0b', '2': '#ef4444' }

// ── Section header ─────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="section-accent" />
      <h2 className="section-label">{title}</h2>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────
function EmptyState({ icon, text, cta, href }: { icon: React.ReactNode; text: string; cta: string; href: string }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.14)' }}
      >
        {icon}
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{text}</p>
      <Link
        href={href}
        className="text-xs font-semibold transition-opacity hover:opacity-70"
        style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}
      >
        {cta} →
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
export default function PerfilPage() {
  const [reminderIds, setReminderIds] = useState<string[]>([])
  const [reminderData, setReminderData] = useState<Record<string, SportEvent>>({})
  const [quinielaSaved, setQuinielaSaved] = useState<QuinielaSaved | null>(null)
  const [name, setName] = useState('Mi Perfil')
  const [seguimientoTab, setSeguimientoTab] = useState<'deportes' | 'ligas' | 'clubs'>('deportes')
  const [recentlyRead, setRecentlyRead] = useState<ReadItem[]>([])
  const [tz, setTz] = useState<string>('Europe/Madrid')
  const [user, setUser] = useState<User | null>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [badges, setBadges] = useState<BadgeDef[]>([])
  const [linkingGoogle, setLinkingGoogle] = useState(false)

  // Ranked points & streak (server-side, only loaded when session exists)
  const { points } = usePoints()
  const { streak } = useStreak()

  // Level / XP data from /api/quiniela/me
  const [meData, setMeData] = useState<{
    level: number; levelName: string; levelColor: string
    progress: number; xp: number; xpToNext: number; nextLevel: number | null
    badges: { id: string; unlockedAt: string | null }[]
  } | null>(null)

  // Ranked prediction stats
  const [rankedStats, setRankedStats] = useState<{
    total: number; correct: number; accuracy: number
    bySport: Record<string, { total: number; correct: number }>
  } | null>(null)

  // AC — Marcador exacto stats (Predicciones de jornada)
  const [exactStats, setExactStats] = useState<{
    totalAttempts: number
    totalHits: number
    hitRate: number
    jornadasPlayed: number
    bestJornadaCount: number
    bestJornada: string | null
  } | null>(null)

  // Game stats
  const [quizStats, setQuizStats] = useState<{ streak: number; bestStreak: number; bestScore: number; totalCorrect: number; totalPlayed: number; lastPlayedDate: string } | null>(null)
  const [gridStats, setGridStats] = useState<{ dayKey: string; solved: number; finished: boolean } | null>(null)
  const [miOnceStats, setMiOnceStats] = useState<{ weekKey: string; filled: number } | null>(null)
  const [sopaStats, setSopaStats] = useState<{ gamesCompleted: number; bestSeconds: number | null } | null>(null)
  const nameRef = useRef<HTMLSpanElement>(null)

  // ── Aviso de error de login (el callback redirige aquí con ?auth_error) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth_error')) {
      setAuthError(true)
      // Limpiamos la URL para que el aviso no reaparezca al recargar.
      const url = new URL(window.location.href)
      url.searchParams.delete('auth_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // ── Supabase session ───────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // When user signs in, set display name and fetch badges
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    if (!supabase) return

    // Fetch display_name from profiles (covers email+password users who have email prefix)
    supabase.from('profiles').select('display_name').eq('id', user.id).single()
      .then(({ data }) => {
        const dbName = data?.display_name as string | undefined
        const providerName = (user.user_metadata?.full_name ?? user.user_metadata?.name) as string | undefined
        const resolved = providerName ?? dbName
        if (resolved) {
          setName(resolved)
          if (nameRef.current) nameRef.current.textContent = resolved
        }
      })

    // Fetch badges
    supabase.from('quiniela_badges').select('badge_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return
        const defs = data.map(r => getBadge(r.badge_id as string)).filter((b): b is BadgeDef => b !== null)
        setBadges(defs)
      })
  }, [user])

  // ── Level / XP data ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    fetch('/api/quiniela/me')
      .then(r => r.ok ? r.json() : null)
      .then((d: { level?: number; levelName?: string; levelColor?: string; progress?: number; xp?: number; xpToNext?: number; nextLevel?: number | null; badges?: { id: string; unlockedAt: string | null }[] } | null) => {
        if (!d || d.level == null) return
        setMeData({
          level:     d.level,
          levelName: d.levelName  ?? '',
          levelColor: d.levelColor ?? '#A78BFA',
          progress:  d.progress   ?? 0,
          xp:        d.xp         ?? 0,
          xpToNext:  d.xpToNext   ?? 0,
          nextLevel: d.nextLevel  ?? null,
          badges:    d.badges     ?? [],
        })
      })
      .catch(() => { /* ignore */ })
  }, [user])

  // ── Ranked stats ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    fetch('/api/ranked/me/stats')
      .then(r => r.ok ? r.json() : null)
      .then((d: { total?: number; correct?: number; accuracy?: number; bySport?: Record<string, { total: number; correct: number }> } | null) => {
        if (!d || d.total == null) return
        setRankedStats({
          total:    d.total    ?? 0,
          correct:  d.correct  ?? 0,
          accuracy: d.accuracy ?? 0,
          bySport:  d.bySport  ?? {},
        })
      })
      .catch(() => { /* ignore */ })
  }, [user])

  // ── AC — Marcador exacto stats (track-record histórico) ─────────
  useEffect(() => {
    if (!user) return
    fetch('/api/quiniela/me/exact-stats')
      .then(r => r.ok ? r.json() : null)
      .then((d: {
        totalAttempts?: number; totalHits?: number; hitRate?: number
        jornadasPlayed?: number; bestJornadaCount?: number; bestJornada?: string | null
      } | null) => {
        if (!d) return
        // Solo guardamos si el user ha jugado al menos una vez con exact.
        if ((d.totalAttempts ?? 0) <= 0) return
        setExactStats({
          totalAttempts:    d.totalAttempts    ?? 0,
          totalHits:        d.totalHits        ?? 0,
          hitRate:          d.hitRate          ?? 0,
          jornadasPlayed:   d.jornadasPlayed   ?? 0,
          bestJornadaCount: d.bestJornadaCount ?? 0,
          bestJornada:      d.bestJornada      ?? null,
        })
      })
      .catch(() => { /* ignore */ })
  }, [user])

  // ── localStorage ───────────────────────────────────────────────
  useEffect(() => {
    const loadReminders = () => {
      try {
        const r = JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? '[]')
        setReminderIds(Array.isArray(r) ? r : [])
        const d = JSON.parse(localStorage.getItem(REMINDERS_DATA_KEY) ?? '{}')
        setReminderData(d && typeof d === 'object' ? d : {})
      } catch { /* ignore */ }
    }

    loadReminders()
    window.addEventListener('storage', loadReminders)
    window.addEventListener('ts-reminders-change', loadReminders)

    try {
      const raw = localStorage.getItem(QUINIELA_PICKS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.picks && Array.isArray(parsed.picks)) setQuinielaSaved(parsed)
      }
    } catch { /* ignore */ }
    const savedName = localStorage.getItem(PROFILE_NAME_KEY)
    if (savedName) setName(savedName)
    try {
      const reads: ReadItem[] = JSON.parse(localStorage.getItem(RECENTLY_READ_KEY) ?? '[]')
      setRecentlyRead(Array.isArray(reads) ? reads : [])
    } catch { /* ignore */ }
    setTz(getStoredTZ())
    const syncTz = () => setTz(getStoredTZ())
    window.addEventListener(TZ_CHANGE_EVENT, syncTz)
    window.addEventListener('storage', syncTz)

    // Load game stats
    try {
      const raw = localStorage.getItem('ts_crackquiz_state')
      if (raw) {
        const s = JSON.parse(raw)
        setQuizStats({ streak: s.streak ?? 0, bestStreak: s.bestStreak ?? s.streak ?? 0, bestScore: s.bestScore ?? 0, totalCorrect: s.totalCorrect ?? 0, totalPlayed: s.totalPlayed ?? 0, lastPlayedDate: s.lastPlayedDate ?? '' })
      }
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem('ts_takagrid_state')
      if (raw) {
        const s = JSON.parse(raw)
        const solved = s.grid ? s.grid.flat().filter((c: { playerId: string | null }) => c.playerId !== null).length : 0
        setGridStats({ dayKey: s.dayKey ?? '', solved, finished: s.finished ?? false })
      }
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem('ts_mionce_state')
      if (raw) {
        const s = JSON.parse(raw)
        const filled = s.slots ? Object.values(s.slots).filter(Boolean).length : 0
        setMiOnceStats({ weekKey: s.weekKey ?? '', filled })
      }
    } catch { /* ignore */ }

    try {
      const raw = localStorage.getItem('ts_sopa_cracks_state')
      if (raw) {
        const allPuzzles = JSON.parse(raw) as Record<string, { found: string[]; bestSeconds: number | null }>
        const completed = Object.values(allPuzzles).filter(p => p.found && p.found.length > 0).length
        const bestSec = Object.values(allPuzzles).reduce((best: number | null, p) => {
          if (!p.bestSeconds) return best
          return best === null ? p.bestSeconds : Math.min(best, p.bestSeconds)
        }, null)
        setSopaStats({ gamesCompleted: completed, bestSeconds: bestSec })
      }
    } catch { /* ignore */ }

    return () => {
      window.removeEventListener('storage', loadReminders)
      window.removeEventListener('ts-reminders-change', loadReminders)
      window.removeEventListener(TZ_CHANGE_EVENT, syncTz)
      window.removeEventListener('storage', syncTz)
    }
  }, [])

  // Eventos guardados desde el snapshot que el calendario escribe al recordar.
  // Se ignoran los ids sin snapshot (recordatorios antiguos aún no resincronizados).
  const savedEvents = reminderIds
    .map((id) => reminderData[id])
    .filter((e): e is SportEvent => Boolean(e))

  // Datos para el bloque de seguimiento
  const savedSports = [...new Set(savedEvents.map((e) => e.sport))]
  const savedLeagues = [...new Set(savedEvents.map((e) => e.comp))]
  const savedClubs = [...new Set(savedEvents.flatMap((e) => [e.home, ...(e.away ? [e.away] : [])]))]

  const removeReminder = (id: string) => {
    const updated = reminderIds.filter((r) => r !== id)
    setReminderIds(updated)
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(updated))
    try {
      const data = JSON.parse(localStorage.getItem(REMINDERS_DATA_KEY) ?? '{}')
      delete data[id]
      localStorage.setItem(REMINDERS_DATA_KEY, JSON.stringify(data))
      setReminderData(data)
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('ts-reminders-change'))
  }

  const handleTzChange = (newTz: string) => {
    setTz(newTz)
    setStoredTZ(newTz)
  }

  const tzOpt = getTZOption(tz)
  const tzOffset = getTZOffset(tz)

  const handleNameBlur = () => {
    const val = nameRef.current?.textContent?.trim() || 'Mi Perfil'
    setName(val)
    localStorage.setItem(PROFILE_NAME_KEY, val)
    if (nameRef.current) nameRef.current.textContent = val
    if (user) {
      createClient()?.from('profiles').update({ display_name: val }).eq('id', user.id)
    }
  }

  const handleSignOut = async () => {
    await createClient()?.auth.signOut()
    setUser(null)
  }

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true)
    const supabase = createClient()
    if (!supabase) { setLinkingGoogle(false); return }
    const { error } = await supabase.auth.linkIdentity({ provider: 'google' })
    if (error) setLinkingGoogle(false)
    // On success Supabase redirects to Google OAuth — no need to reset state
  }

  const hasGoogleIdentity = user?.identities?.some(id => id.provider === 'google') ?? false

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'TS'

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">

        {/* Aviso de error de inicio de sesión — descartable */}
        {authError && (
          <div
            className="mt-6 rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
            role="alert"
          >
            <span style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 5v3.5M8 10.5v.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <p className="flex-1 text-xs" style={{ color: '#fca5a5', fontFamily: 'var(--font-sport)', lineHeight: 1.5 }}>
              No se pudo iniciar sesión. El enlace puede haber caducado o el proceso se interrumpió. Inténtalo de nuevo.
            </p>
            <button
              onClick={() => setAuthError(false)}
              aria-label="Descartar aviso"
              style={{ color: '#f87171', flexShrink: 0, cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* ── PLACA PERSONAL ───────────────────────────────
            Placa identitaria del user. Solo visible con sesión.
            Render REAL — consume /api/cosmetics/me + /api/quiniela/me
            y muestra el equipment del user con cosmetics desbloqueados. */}
        {user && (
          <div className="pt-8 pb-2">
            <UserPlacaCard
              user={user}
              displayName={name}
              avatarUrl={avatarUrl}
            />
          </div>
        )}

        {/* Sport picker — desbloquea avatar_frame del deporte favorito.
            Aparece junto a la placa para dar identidad visual inmediata
            antes de tener badges. */}
        {user && (
          <div className="max-w-[420px] mx-auto pt-2 pb-6">
            <SportPickPanel />
          </div>
        )}

        {/* ── HERO CABECERA ─────────────────────────────── */}
        <div className="relative pt-10 pb-10">
          {/* Glow ambiental */}
          <div
            className="absolute -top-8 -left-8 w-72 h-48 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 30% 40%, rgba(124,58,237,0.13) 0%, transparent 70%)',
              filter: 'blur(12px)',
            }}
          />

          <div className="relative flex items-start gap-3 sm:gap-5">
            {/* Avatar */}
            <div
              className="flex-shrink-0 select-none flex items-center justify-center rounded-2xl overflow-hidden"
              style={{
                width: 80, height: 80,
                background: 'linear-gradient(135deg,#7C3AED 0%,#4F46E5 100%)',
                boxShadow: '0 12px 36px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
                fontSize: 24,
                fontWeight: 900,
                color: '#fff',
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em',
              }}
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={name}
                  width={80} height={80}
                  className="object-cover w-full h-full"
                  referrerPolicy="no-referrer"
                />
              ) : initials}
            </div>

            {/* Info */}
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              {/* Nombre editable */}
              <div className="group flex items-center gap-2">
                <span
                  ref={nameRef}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={handleNameBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nameRef.current?.blur() } }}
                  className="font-black leading-none outline-none cursor-text rounded-lg px-1.5 -mx-1.5 py-0.5 transition-colors hover:bg-white/[0.04] focus:bg-white/[0.04]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                    color: '#F8F8FF',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {name}
                </span>
                <svg
                  width="11" height="11" viewBox="0 0 14 14" fill="none"
                  className="opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0 pointer-events-none"
                  aria-hidden
                >
                  <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="#C4B5FD" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Stats en línea */}
              <div className="flex items-center flex-wrap gap-y-1">
                {[
                  { value: recentlyRead.length || null, label: 'leídos' },
                  { value: reminderIds.length || null, label: 'recordatorios' },
                  { value: quinielaSaved ? quinielaSaved.picks.length : null, label: 'picks' },
                  { value: savedSports.length || null, label: 'deportes' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center">
                    {i > 0 && (
                      <span className="mx-2.5 text-xs select-none" style={{ color: 'var(--text-faint)' }}>·</span>
                    )}
                    <span>
                      <span
                        className="font-black text-sm"
                        style={{ color: s.value ? '#C4B5FD' : '#3A3A4A', fontFamily: 'var(--font-display)' }}
                      >
                        {s.value ?? '—'}
                      </span>
                      {' '}
                      <span
                        className="text-[11px]"
                        style={{ color: s.value ? 'var(--text-muted)' : 'var(--text-faint)', fontFamily: 'var(--font-sport)' }}
                      >
                        {s.label}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Puntos Taka + Racha — solo si hay sesión y datos */}
              {(points !== null || (streak && streak.current_streak > 0)) && (
                <div className="flex items-center gap-3 flex-wrap">
                  {points !== null && (
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                      style={{
                        background: 'rgba(167,139,250,0.08)',
                        border: '1px solid rgba(167,139,250,0.2)',
                      }}
                    >
                      <TakaPoint size={13} />
                      <span
                        className="text-[12px] font-black"
                        style={{ fontFamily: 'var(--font-display)', color: '#A78BFA', letterSpacing: '-0.01em' }}
                      >
                        {points.toLocaleString('es-ES')}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: 'rgba(167,139,250,0.6)', fontFamily: 'var(--font-sport)' }}
                      >
                        pts Taka
                      </span>
                    </div>
                  )}
                  {streak && streak.current_streak > 0 && (() => {
                    // RT4 — Próximo hito de racha. Los hitos viven en
                    // /api/games/streak.ts: 3d=+5, 7d=+10, 14d=+20, 30d=+50.
                    const MILESTONES = [
                      { days: 3,  bonus: 5  },
                      { days: 7,  bonus: 10 },
                      { days: 14, bonus: 20 },
                      { days: 30, bonus: 50 },
                    ]
                    const next = MILESTONES.find(m => m.days > streak.current_streak)
                    return (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                        style={{
                          background: 'rgba(249,115,22,0.08)',
                          border: '1px solid rgba(249,115,22,0.2)',
                        }}
                      >
                        <span style={{ display: 'inline-flex', color: '#F97316' }}><FireIcon size={12} /></span>
                        <span
                          className="text-[12px] font-black"
                          style={{ fontFamily: 'var(--font-display)', color: '#F97316', letterSpacing: '-0.01em' }}
                        >
                          {streak.current_streak}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: 'rgba(249,115,22,0.6)', fontFamily: 'var(--font-sport)' }}
                        >
                          {streak.current_streak === 1 ? 'día' : 'días'}
                        </span>
                        {next && (
                          <>
                            <span style={{
                              color: 'rgba(255,255,255,0.18)',
                              fontFamily: 'var(--font-sport)', fontSize: 9, margin: '0 1px',
                            }}>·</span>
                            <span
                              className="text-[9px]"
                              style={{ color: 'rgba(249,115,22,0.7)', fontFamily: 'var(--font-sport)', fontWeight: 700 }}
                              title={`Cuando llegues a ${next.days} días seguidos te llevarás +${next.bonus} pts`}
                            >
                              +{next.bonus} pts a los {next.days}d
                            </span>
                          </>
                        )}
                        {!next && (
                          <span
                            className="text-[9px]"
                            style={{ color: 'rgba(249,115,22,0.7)', fontFamily: 'var(--font-sport)', fontWeight: 700 }}
                          >
                            ¡máximo!
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Nivel / XP */}
              {meData && (
                <div
                  className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl mt-1"
                  style={{ background: 'rgba(167,139,250,0.06)', border: `1px solid ${meData.levelColor}30` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[13px] font-black"
                      style={{ color: meData.levelColor, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
                    >
                      L{meData.level} · {meData.levelName}
                    </span>
                    <span className="text-[10px]" style={{ color: 'rgba(167,139,250,0.5)', fontFamily: 'var(--font-sport)' }}>
                      {meData.badges.filter(b => b.unlockedAt).length} de {meData.badges.length} badges
                    </span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', height: 5, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, meData.progress * 100)}%`,
                        background: meData.levelColor,
                        borderRadius: 'var(--radius-md)',
                        boxShadow: `0 0 6px ${meData.levelColor}80`,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <span className="text-[10px]" style={{ color: 'rgba(167,139,250,0.5)', fontFamily: 'var(--font-sport)' }}>
                    {meData.nextLevel
                      ? `${meData.xp.toLocaleString('es-ES')} XP · faltan ${meData.xpToNext.toLocaleString('es-ES')} para el siguiente`
                      : `${meData.xp.toLocaleString('es-ES')} XP · Nivel máximo`}
                  </span>
                </div>
              )}

              {/* AC — Marcador exacto (Predicciones) */}
              {exactStats && exactStats.totalAttempts > 0 && (
                <div
                  className="flex flex-col gap-2 px-3 py-2.5 rounded-xl mt-1"
                  style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.22)' }}
                >
                  <span
                    className="text-[10px] font-black"
                    style={{ color: '#A78BFA', fontFamily: 'var(--font-display)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  >
                    <TargetIcon size={11} className="inline-block align-middle mr-1" />Marcadores Exactos
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(167,139,250,0.10)', color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
                      title="Marcadores exactos clavados"
                    >
                      {exactStats.totalHits}/{exactStats.totalAttempts} clavados
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-md"
                      style={{ background: 'rgba(167,139,250,0.10)', color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
                    >
                      {(exactStats.hitRate * 100).toFixed(0)}% precisión
                    </span>
                    {exactStats.jornadasPlayed > 0 && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(167,139,250,0.10)', color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
                      >
                        {exactStats.jornadasPlayed} jornada{exactStats.jornadasPlayed === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {exactStats.bestJornadaCount >= 2 && exactStats.bestJornada && (
                    <span
                      className="text-[10px]"
                      style={{ color: 'rgba(196,181,253,0.65)', fontFamily: 'var(--font-sport)' }}
                    >
                      <TrophyIcon size={11} className="inline-block align-middle mr-1" />Mejor jornada: {exactStats.bestJornadaCount} exactos en {exactStats.bestJornada}
                    </span>
                  )}
                </div>
              )}

              {/* Predicciones Ranked */}
              {rankedStats && rankedStats.total > 0 && (
                <div
                  className="flex flex-col gap-2 px-3 py-2.5 rounded-xl mt-1"
                  style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)' }}
                >
                  <span className="text-[10px] font-black" style={{ color: '#4ADE80', fontFamily: 'var(--font-display)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Predicciones Ranked
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ADE80', fontFamily: 'var(--font-sport)' }}>
                      {rankedStats.total} predicciones
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ADE80', fontFamily: 'var(--font-sport)' }}>
                      {rankedStats.correct} aciertos
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ADE80', fontFamily: 'var(--font-sport)' }}>
                      {rankedStats.accuracy.toFixed(0)}% precisión
                    </span>
                  </div>
                  {Object.entries(rankedStats.bySport).filter(([, s]) => s.total > 0).map(([sport, s]) => (
                    <span key={sport} className="text-[10px]" style={{ color: 'rgba(74,222,128,0.5)', fontFamily: 'var(--font-sport)' }}>
                      {sport}: {s.correct}/{s.total}
                    </span>
                  ))}
                </div>
              )}

              {/* Zona horaria — solo indicador, el selector completo está en Preferencias */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M6 3v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span className="text-[10px]" style={{ color: '#3A3A54', fontFamily: 'var(--font-sport)' }}>
                  {tzOpt.flag} {tzOpt.city} · {tzOffset}
                </span>
              </div>

              {/* Auth row */}
              {user ? (
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', fontFamily: 'var(--font-sport)' }}>
                    ✓ Sincronizado
                  </span>
                  {!hasGoogleIdentity && (
                    <button
                      onClick={handleLinkGoogle}
                      disabled={linkingGoogle}
                      className="text-[10px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
                      style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {linkingGoogle ? 'Conectando…' : 'Conectar Google →'}
                    </button>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="text-[11px] font-semibold transition-all hover:brightness-110 active:scale-[0.97] inline-flex items-center gap-1.5"
                    style={{
                      color: '#f87171',
                      fontFamily: 'var(--font-sport)',
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      cursor: 'pointer',
                      padding: '4px 10px',
                      borderRadius: 999,
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M7 3V2a1 1 0 00-1-1H2a1 1 0 00-1 1v8a1 1 0 001 1h4a1 1 0 001-1V9M5 6h6m0 0L9 4m2 2L9 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold transition-opacity hover:opacity-70"
                  style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 10V9a3 3 0 013-3h2a3 3 0 013 3v1M6 6a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Iniciar sesión para sincronizar
                </button>
              )}
            </div>
          </div>
        </div>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

        {/* ── GRID PRINCIPAL ───────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── COLUMNA IZQUIERDA ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-10">

            {/* ── MIS JUEGOS ── */}
            {(quizStats || gridStats || miOnceStats || sopaStats) && (
              <section>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <SectionHeader title="Mis juegos" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href="/perfil/album"
                      className="text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-80 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(252,211,77,0.10)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.25)', fontFamily: 'var(--font-sport)' }}
                    >
                      <ClipboardIcon size={12} />Tu álbum →
                    </Link>
                    <Link
                      href="/perfil/onces"
                      className="text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-80 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                      style={{ background: 'rgba(147,197,253,0.10)', color: '#93C5FD', border: '1px solid rgba(147,197,253,0.25)', fontFamily: 'var(--font-sport)' }}
                    >
                      <FootballIcon size={12} />Tus onces →
                    </Link>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                  {/* CrackQuiz */}
                  {quizStats && (
                    <Link href="/crackquiz" className="rounded-2xl p-4 flex flex-col gap-2 transition-all hover:translate-y-[-2px]"
                      style={{ background: 'var(--bg-card)', border: '1px solid rgba(252,211,77,0.18)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-lg" style={{ color: '#FCD34D', display: 'inline-flex' }}><LightbulbIcon size={20} /></span>
                        {quizStats.streak > 1 && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'rgba(251,146,60,0.12)', color: '#FB923C', border: '1px solid rgba(251,146,60,0.25)', fontFamily: 'var(--font-sport)' }}>
                            <FireIcon size={10} /> {quizStats.streak}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-black" style={{ color: '#FCD34D', fontFamily: 'var(--font-display)' }}>CrackQuiz</p>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Mejor: <strong style={{ color: '#FCD34D' }}>{quizStats.bestScore} pts</strong></p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Racha máx: <strong style={{ color: '#FB923C' }}>{quizStats.bestStreak} días</strong></p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{quizStats.totalCorrect} aciertos totales</p>
                      </div>
                    </Link>
                  )}

                  {/* TakaGrid */}
                  {gridStats && (
                    <Link href="/takagrid" className="rounded-2xl p-4 flex flex-col gap-2 transition-all hover:translate-y-[-2px]"
                      style={{ background: 'var(--bg-card)', border: '1px solid rgba(253,186,116,0.18)' }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: '#FDBA74' }}><FootballIcon size={20} /></span>
                        {gridStats.finished && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(253,186,116,0.12)', color: '#FDBA74', border: '1px solid rgba(253,186,116,0.25)', fontFamily: 'var(--font-sport)' }}>
                            {gridStats.solved}/9 hoy
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-black" style={{ color: '#FDBA74', fontFamily: 'var(--font-display)' }}>TakaGrid</p>
                      <div className="flex flex-col gap-0.5">
                        {gridStats.finished ? (
                          <>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Hoy: <strong style={{ color: '#FDBA74' }}>{gridStats.solved}/9 celdas</strong></p>
                            <p className="text-[10px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>Nuevo puzzle mañana</p>
                          </>
                        ) : (
                          <p className="text-[10px]" style={{ color: '#4ade80' }}>Puzzle de hoy pendiente →</p>
                        )}
                      </div>
                    </Link>
                  )}

                  {/* Mi Once */}
                  {miOnceStats && (
                    <Link href="/mionce" className="rounded-2xl p-4 flex flex-col gap-2 transition-all hover:translate-y-[-2px]"
                      style={{ background: 'var(--bg-card)', border: '1px solid rgba(147,197,253,0.18)' }}>
                      <div className="flex items-center justify-between">
                        <span style={{ color: '#93C5FD' }}><StadiumIcon size={20} /></span>
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(147,197,253,0.12)', color: '#93C5FD', border: '1px solid rgba(147,197,253,0.25)', fontFamily: 'var(--font-sport)' }}>
                          {miOnceStats.filled}/11
                        </span>
                      </div>
                      <p className="text-[11px] font-black" style={{ color: '#93C5FD', fontFamily: 'var(--font-display)' }}>Mi Once</p>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{miOnceStats.filled === 11 ? '✓ Once completo' : `${miOnceStats.filled} jugadores elegidos`}</p>
                        <p className="text-[10px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>Semana {miOnceStats.weekKey}</p>
                      </div>
                    </Link>
                  )}

                  {/* Sopa de Cracks */}
                  {sopaStats && (
                    <Link href="/sopa-cracks" className="rounded-2xl p-4 flex flex-col gap-2 transition-all hover:translate-y-[-2px]"
                      style={{ background: 'var(--bg-card)', border: '1px solid rgba(110,231,183,0.18)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-lg" style={{ color: '#6EE7B7', display: 'inline-flex' }}><SearchIcon size={20} /></span>
                      </div>
                      <p className="text-[11px] font-black" style={{ color: '#6EE7B7', fontFamily: 'var(--font-display)' }}>Sopa de Cracks</p>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sopaStats.gamesCompleted} puzzles jugados</p>
                        {sopaStats.bestSeconds && (
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Mejor: <strong style={{ color: '#6EE7B7' }}>{Math.floor(sopaStats.bestSeconds / 60)}:{String(sopaStats.bestSeconds % 60).padStart(2, '0')}</strong></p>
                        )}
                      </div>
                    </Link>
                  )}

                </div>
              </section>
            )}

            {/* ACTIVIDAD RECIENTE */}
            <section>
              <SectionHeader title="Actividad reciente" />
              {recentlyRead.length === 0 ? (
                <EmptyState
                  icon={
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" stroke="#7C3AED" strokeWidth="1.2" opacity="0.6" />
                      <path d="M8 5v3.5l2.5 1.5" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
                    </svg>
                  }
                  text="Los artículos que leas aparecerán aquí."
                  cta="Ir a noticias"
                  href="/noticias"
                />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recentlyRead.slice(0, 6).map((item) => {
                    const { accent } = getSportStyle(item.sport, item.category)
                    const label = getSportLabel(item.sport, item.category)
                    return (
                      <Link
                        key={item.slug}
                        href={`/noticias/${item.slug}`}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:brightness-110"
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderLeft: `3px solid ${accent}`,
                          textDecoration: 'none',
                        }}
                      >
                        {item.imageUrl && (
                          <div
                            className="flex-shrink-0 rounded-lg overflow-hidden"
                            style={{ width: 52, height: 36, background: 'rgba(255,255,255,0.04)' }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {label && (
                            <span
                              className="text-[9px] font-black uppercase tracking-widest block mb-0.5"
                              style={{ color: accent, fontFamily: 'var(--font-sport)' }}
                            >
                              {label}
                            </span>
                          )}
                          <p
                            className="text-xs font-semibold leading-snug line-clamp-1"
                            style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}
                          >
                            {item.title}
                          </p>
                        </div>
                        {item.publishedAt && (
                          <span
                            className="text-[10px] flex-shrink-0 ml-2"
                            style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-sport)' }}
                          >
                            {timeAgo(item.publishedAt)}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>

            {/* RECORDATORIOS */}
            <section>
              <SectionHeader title="Recordatorios" />
              {savedEvents.length === 0 ? (
                <EmptyState
                  icon={
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1.5A4.5 4.5 0 003.5 6v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 008 1.5z" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
                      <path d="M6.5 10.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
                    </svg>
                  }
                  text={reminderIds.length > 0
                    ? 'Abre el calendario para sincronizar tus recordatorios.'
                    : 'No tienes ningún recordatorio activado.'}
                  cta="Ver calendario"
                  href="/calendario"
                />
              ) : (
                <div className="flex flex-col gap-1.5">
                  {savedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl group/item"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${event.accent}`,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: event.accent, fontFamily: 'var(--font-sport)' }}>
                            {event.sport}
                          </span>
                          <span style={{ color: '#2A2A3A' }}>·</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{event.comp}</span>
                        </div>
                        <p className="text-sm font-semibold truncate" style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}>
                          {event.home}{event.away ? ` vs ${event.away}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <div className="text-right">
                          <p className="text-xs font-black" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                            {event.time}
                          </p>
                          <p className="text-[10px]" style={{ color: event.accent }}>{event.date}</p>
                        </div>
                        <button
                          onClick={() => removeReminder(event.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"
                          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.13)', color: '#ef4444', cursor: 'pointer' }}
                          title="Quitar recordatorio"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* PICKS DE QUINIELA */}
            <section>
              <SectionHeader title={quinielaSaved ? `Mis picks · ${quinielaSaved.jornada}` : 'Mis picks de quiniela'} />
              {!quinielaSaved ? (
                <Link
                  href="/quiniela"
                  className="flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:brightness-110"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                  }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                    Esta semana aún no has predicho
                  </span>
                  <span className="text-xs font-semibold" style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}>
                    Hacer picks →
                  </span>
                </Link>
              ) : (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  {quinielaSaved.picks.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3"
                      style={{ borderBottom: i < quinielaSaved.picks.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <span className="text-xs font-semibold" style={{ color: '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
                        {p.home} <span style={{ color: 'var(--text-faint)' }}>vs</span> {p.away}
                      </span>
                      <span
                        className="text-[10px] font-black px-2.5 py-1 rounded-lg ml-4 flex-shrink-0"
                        style={{
                          background: `${PICK_COLOR[p.pick]}18`,
                          color: PICK_COLOR[p.pick],
                          border: `1px solid ${PICK_COLOR[p.pick]}30`,
                          fontFamily: 'var(--font-sport)',
                        }}
                      >
                        {p.pick} · {PICK_LABEL[p.pick]}
                      </span>
                    </div>
                  ))}
                  <div
                    className="px-4 py-2.5 flex items-center justify-between"
                    style={{ background: 'rgba(124,58,237,0.04)', borderTop: '1px solid rgba(124,58,237,0.1)' }}
                  >
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {quinielaSaved.picks.length} predicciones enviadas
                    </span>
                    <Link
                      href="/quiniela"
                      className="text-[10px] font-semibold transition-opacity hover:opacity-70"
                      style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}
                    >
                      Ver quiniela →
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── COLUMNA DERECHA ── */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-10">

            {/* SEGUIMIENTO: Deportes / Ligas / Clubs */}
            <section>
              <SectionHeader title="Seguimiento" />
              {/* Sub-tabs */}
              <div className="flex items-center gap-0 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                {(['deportes', 'ligas', 'clubs'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSeguimientoTab(tab)}
                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all"
                    style={{
                      fontFamily: 'var(--font-sport)',
                      color: seguimientoTab === tab ? '#C4B5FD' : 'var(--text-muted)',
                      background: 'none',
                      border: 'none',
                      borderBottom: seguimientoTab === tab ? '2px solid #7C3AED' : '2px solid transparent',
                      marginBottom: -1,
                      cursor: 'pointer',
                      letterSpacing: '0.07em',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Deportes */}
              {seguimientoTab === 'deportes' && (
                savedSports.length === 0 ? (
                  <p className="text-xs px-1" style={{ color: 'var(--text-faint)' }}>
                    Activa recordatorios en el calendario para ver tus deportes aquí.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {savedSports.map((sport) => {
                      const count = savedEvents.filter((e) => e.sport === sport).length
                      return (
                        <div
                          key={sport}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                        >
                          <span className="flex-shrink-0" style={{ color: '#9B7CF6' }}><SportIcon sport={sport} size={18} /></span>
                          <span className="flex-1 text-xs font-semibold" style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}>
                            {sport}
                          </span>
                          <span className="text-[10px] font-black" style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}>
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              )}

              {/* Ligas */}
              {seguimientoTab === 'ligas' && (
                savedLeagues.length === 0 ? (
                  <p className="text-xs px-1" style={{ color: 'var(--text-faint)' }}>
                    Sin competiciones en tus recordatorios.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {savedLeagues.map((liga) => {
                      const count = savedEvents.filter((e) => e.comp === liga).length
                      return (
                        <div
                          key={liga}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                        >
                          <span className="text-[10px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#7C3AED', display: 'inline-block' }} />
                          <span className="flex-1 text-xs font-semibold truncate" style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}>
                            {liga}
                          </span>
                          <span className="text-[10px] font-black flex-shrink-0" style={{ color: '#9B7CF6', fontFamily: 'var(--font-sport)' }}>
                            {count}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              )}

              {/* Clubs */}
              {seguimientoTab === 'clubs' && (
                savedClubs.length === 0 ? (
                  <p className="text-xs px-1" style={{ color: 'var(--text-faint)' }}>
                    Sin equipos en tus recordatorios.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {savedClubs.map((club) => (
                      <div
                        key={club}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[9px] font-black"
                          style={{ background: 'rgba(124,58,237,0.15)', color: '#9B7CF6', fontFamily: 'var(--font-display)' }}
                        >
                          {club[0]}
                        </div>
                        <span className="flex-1 text-xs font-semibold truncate" style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}>
                          {club}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </section>

            {/* LOGROS / BADGES */}
            {badges.length > 0 && (
              <section>
                <div className="flex items-center justify-between">
                  <SectionHeader title="Logros" />
                  <Link
                    href="/badges"
                    className="text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-100"
                    style={{
                      color: '#A78BFA',
                      fontFamily: 'var(--font-sport)',
                      opacity: 0.8,
                      textDecoration: 'none',
                    }}
                  >
                    Ver galería →
                  </Link>
                </div>
                <div className="flex flex-col gap-1.5">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: badge.bg, border: `1px solid ${badge.color}28` }}
                    >
                      <span
                        className="flex-shrink-0 flex items-center justify-center"
                        style={{ width: 22, height: 22, color: badge.color }}
                      >
                        {hasBadgeIcon(badge.id)
                          ? <BadgeIcon id={badge.id} size={20} strokeWidth={1.7} />
                          : <span style={{ fontSize: 18 }}>{badge.emoji}</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black leading-none mb-0.5" style={{ color: badge.color, fontFamily: 'var(--font-display)' }}>
                          {badge.name}
                        </p>
                        <p className="text-[9px] line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                          {badge.description}
                        </p>
                      </div>
                      <span
                        className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${badge.color}18`, color: badge.color, fontFamily: 'var(--font-sport)' }}
                      >
                        {badge.rarity}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* Si no tiene badges aún, mostrar CTA hacia la galería */}
            {badges.length === 0 && (
              <section>
                <SectionHeader title="Logros" />
                <Link
                  href="/badges"
                  className="block rounded-xl px-4 py-3 transition-opacity hover:opacity-90"
                  style={{
                    background: 'rgba(124,58,237,0.06)',
                    border: '1px solid rgba(124,58,237,0.2)',
                    textDecoration: 'none',
                  }}
                >
                  <p className="text-[11px] font-black" style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
                    Explora la colección de badges →
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                    Juega y desbloquea logros. Empieza por la quiniela o los juegos diarios.
                  </p>
                </Link>
              </section>
            )}

            {/* PREFERENCIAS */}
            <section>
              <SectionHeader title="Preferencias" />
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3.5"
                >
                  <div>
                    <p
                      className="text-[11px] font-semibold mb-0.5"
                      style={{ color: '#C0C0D4', fontFamily: 'var(--font-sport)' }}
                    >
                      Zona horaria
                    </p>
                    <p
                      className="text-[9px]"
                      style={{ color: '#3A3A50', fontFamily: 'var(--font-sport)' }}
                    >
                      {tzOpt.flag} {tzOpt.city} · {tzOffset}
                    </p>
                  </div>
                  <TimezoneSelector value={tz} onChange={handleTzChange} />
                </div>
                <div
                  className="px-4 py-2.5 flex items-center gap-1.5"
                  style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="#3A3A50" strokeWidth="1.2" />
                    <path d="M6 4v2.5l1.5 1" stroke="#3A3A50" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <span className="text-[9px]" style={{ color: '#2E2E40', fontFamily: 'var(--font-sport)' }}>
                    Los horarios del calendario se ajustan a tu zona
                  </span>
                </div>
              </div>
            </section>

            {/* ACCESOS RÁPIDOS — minimalista */}
            <section>
              <SectionHeader title="Ir a" />
              <div className="flex flex-col gap-0" style={{ borderTop: '1px solid var(--border)' }}>
                {[
                  { label: 'Calendario', href: '/calendario' },
                  { label: 'Noticias', href: '/noticias' },
                  { label: 'Quiniela', href: '/quiniela' },
                  { label: 'Juegos', href: '/juegos' },
                ].map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between py-2.5 transition-opacity hover:opacity-60"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <span className="text-xs font-semibold" style={{ color: '#9090A4', fontFamily: 'var(--font-sport)' }}>
                      {label}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="#3A3A5A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                ))}
              </div>
            </section>

            {/* Tu actividad en TakaSports (datos Supabase, failsafe si no hay) */}
            <MyGamesActivity />

            {/* Cerrar sesión — al final del perfil para que sea fácil de encontrar */}
            {user && (
              <section className="mt-8 mb-4 flex justify-center">
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{
                    color: '#f87171',
                    fontFamily: 'var(--font-sport)',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    cursor: 'pointer',
                    padding: '12px 24px',
                    borderRadius: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M8 3.5V2.5a1 1 0 00-1-1H2.5a1 1 0 00-1 1v9a1 1 0 001 1H7a1 1 0 001-1v-1M5.5 7h7m0 0L10.5 5m2 2L10.5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Cerrar sesión
                </button>
              </section>
            )}

            {/* Tus datos — exportar (RGPD art. 20) + Zona de peligro — borrado (art. 17) */}
            {user && <ExportDataSection />}
            {user && <DeleteAccountSection />}

          </div>
        </div>

      </div>

      <ScrollToTop />
    </div>
  )
}
