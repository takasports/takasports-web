'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { QUINIELA_PICKS_KEY } from '@/components/QuinielaModule'
import type { QuinielaMatch, QuinielaSaved, Pick } from '@/components/QuinielaModule'
import { nameMatch } from '@/lib/quiniela'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import {
  BADGES_KEY,
  STREAK_KEY, LEAGUES_KEY,
} from './lib/constants'
import type { BadgeId, League } from './lib/types'
import {
  computeStreak, isCorrect, computeNewBadges,
  getDivision, getPlayerAlias, setPlayerAlias,
} from './lib/helpers'
import { usePushSubscription, useCoins } from './lib/hooks'
import { PicksForm } from './components/picks/PicksForm'
import { PicksSummary } from './components/picks/PicksSummary'
import { MyLeagues } from './components/leagues/MyLeagues'
import { CreateLeagueModal } from './components/leagues/CreateLeagueModal'
import { BadgesPanel } from './components/panels/BadgesPanel'
import { CoinWallet } from './components/panels/CoinWallet'
import { LeaderboardPanel } from './components/panels/LeaderboardPanel'
import { SeasonPanel } from './components/panels/SeasonPanel'
import { Rules } from './components/panels/Rules'

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
  const [joinAlias, setJoinAlias]   = useState('')
  const [history, setHistory]     = useState<{ jornada: string; correct: number; total: number }[]>([])
  const [streak, setStreak]       = useState<{ current: number; best: number }>({ current: 0, best: 0 })
  const [badges, setBadges]       = useState<BadgeId[]>([])
  const [myScore, setMyScore]     = useState<number | undefined>(undefined)
  const [user, setUser]           = useState<User | null>(null)
  const [showAuthBanner, setShowAuthBanner] = useState(false)
  const coins = useCoins(user)
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
          // Lee el balance local (legacy localStorage) y se lo manda al server
          // para que migre como una sola transacción de monedas (audit RPC).
          const raw = localStorage.getItem('ts_quiniela_coins')
          const coinBal = raw ? parseInt(raw, 10) : 0
          const badgeList: string[] = JSON.parse(localStorage.getItem(BADGES_KEY) ?? '[]')
          fetch('/api/quiniela/migrate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ coinBalance: coinBal, badges: badgeList }),
          }).then(() => coins.refresh()).catch(() => {})
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
    setJoinAlias(getPlayerAlias())
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
  // Skin "Copa 2026": se auto-activa cuando la jornada es del Mundial
  // (buildJornadaLabel antepone "Mundial · ..."). Sin marcas FIFA.
  const isMundial = apiJornada.toLowerCase().startsWith('mundial')

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">

        {/* ── BANNER: unirse a liga por link ─────────── */}
        {ligaParam && ligaName && !ligaJoined && (
          <div className="mt-6 mb-2 rounded-2xl px-5 py-4 flex flex-col gap-3.5" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <div className="flex items-center gap-4">
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
                <p className="text-[10px]" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>Elige tu nombre y únete a la competición</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                value={joinAlias}
                onChange={(e) => setJoinAlias(e.target.value.slice(0, 24))}
                placeholder="Tu nombre en la liga"
                className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(124,58,237,0.25)', color: '#E0E0F0', fontFamily: 'var(--font-display)' }}
              />
              <button
                disabled={!joinAlias.trim()}
                onClick={() => {
                  if (!joinAlias.trim()) return
                  setPlayerAlias(joinAlias)
                  try {
                    const raw = localStorage.getItem(LEAGUES_KEY)
                    const existing: League[] = raw ? JSON.parse(raw) : []
                    if (!existing.some(l => l.id === ligaParam)) {
                      existing.push({ id: ligaParam!, name: ligaName!, competitionId: 'mixed', matchIds: [], picks: {}, submitted: false, createdAt: new Date().toISOString(), nickname: joinAlias.trim() || undefined })
                      localStorage.setItem(LEAGUES_KEY, JSON.stringify(existing))
                    }
                  } catch { /* ignore */ }
                  setLigaJoined(true)
                  setTab('official')
                  bump(v => v + 1)
                }}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-opacity hover:opacity-85"
                style={{
                  background: joinAlias.trim() ? 'linear-gradient(135deg,#7C3AED,#5B21B6)' : 'rgba(255,255,255,0.04)',
                  color: joinAlias.trim() ? '#fff' : '#3A3A52',
                  fontFamily: 'var(--font-sport)',
                  boxShadow: joinAlias.trim() ? '0 4px 16px rgba(124,58,237,0.3)' : 'none',
                  cursor: joinAlias.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Unirme
              </button>
            </div>
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
                  {isMundial && (
                    <span
                      className="text-[9px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.4)', fontFamily: 'var(--font-sport)' }}
                    >
                      🏆 Copa 2026
                    </span>
                  )}
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
                  {activeTab === 'official'
                    ? (isMundial
                        ? 'Copa 2026 · Ranked del Mundial · ranking global y monedas'
                        : 'Ranked · partidos destacados de la semana · ranking global y monedas')
                    : activeTab === 'leagues'
                    ? (isMundial
                        ? 'Copa 2026 · crea tu liga del Mundial con amigos'
                        : 'Mis ligas · compite con amigos por código o enlace')
                    : 'Predicciones de torneo'}
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
            { id: 'official', label: 'Ranked' },
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
                    coins={coins}
                    onScore={async (correct, total, results) => {
                      setMyScore(correct)
                      setHistory(prev => {
                        if (prev.some(h => h.jornada === saved!.jornada)) return prev
                        const next = [...prev, { jornada: saved!.jornada, correct, total }]
                        try { localStorage.setItem('ts_quiniela_history', JSON.stringify(next)) } catch { /* ignore */ }
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
                        return next
                      })
                      // Server es la fuente única para coins. Calcula breakdown
                      // autoritativo y, si hay sesión, sube monedas vía RPC.
                      // Si no hay sesión, replicamos en localStorage con el
                      // breakdown oficial (no cálculo local).
                      try {
                        const res = await fetch('/api/quiniela/score', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({
                            jornada: saved!.jornada,
                            picks: saved!.picks,
                            captainIdx: saved!.captainIdx,
                          }),
                        })
                        if (res.ok) {
                          const json = await res.json() as { breakdown?: { totalCoins: number; hits: number; pleno: boolean } }
                          if (json.breakdown && json.breakdown.totalCoins > 0) {
                            if (user) {
                              // Server ya escribió via RPC: refresca balance/txns
                              await coins.refresh()
                            } else {
                              // Invitado: replicamos en localStorage usando breakdown autoritativo
                              const reasonParts = [`${json.breakdown.hits} aciertos`]
                              if (json.breakdown.pleno) reasonParts.push('¡PLENO!')
                              await coins.add(json.breakdown.totalCoins, `Quiniela ${saved!.jornada}: ${reasonParts.join(' · ')}`)
                            }
                          }
                        }
                      } catch { /* offline OK */ }
                      // Suprime `results` warn — lo deja disponible por si onScore se extiende
                      void results
                    }}
                  />
                : <PicksForm
                    matches={apiMatches}
                    jornada={apiJornada}
                    streakCurrent={streak.current}
                    onParticipation={(j) => { void coins.add(5, `Participación ${j}`) }}
                    onSubmit={(s) => { setSaved(s); if (!user) setTimeout(() => setShowAuthBanner(true), 2000) }}
                  />
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
            <CoinWallet balance={coins.balance} txns={coins.txns} />

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
                    {streak.current} jornada{streak.current !== 1 ? 's' : ''} seguida{streak.current !== 1 ? 's' : ''}
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
