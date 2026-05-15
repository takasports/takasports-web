'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { QUINIELA_PICKS_KEY, QUINIELA_MATCHES, MATCH_STATUS } from '@/components/QuinielaModule'
import {
  IconQuiniela,
  IconCrackQuiz,
  IconMiOnce,
  IconSopaCracks,
  IconTakaGrid,
  IconStrikerRush,
  PreviewTakaGrid,
  PreviewCrackQuiz,
  PreviewMiOnce,
  PreviewSopaCracks,
} from '@/components/games/GameVisuals'
import StreakChip from '@/components/games/StreakChip'
import GameStatusBadge from '@/components/games/GameStatusBadge'
import LeaderboardTabs from '@/components/games/LeaderboardTabs'
import { getGamePeriod } from '@/lib/games-periods'
import type { GameId } from '@/lib/games-store'

// (iconos y previews movidos a src/components/games/GameVisuals.tsx)


// ── Datos ─────────────────────────────────────────────────────

type GameStatus = 'active' | 'live' | 'coming'
type Difficulty = 1 | 2 | 3

interface Game {
  id: string
  name: string
  tagline: string
  description: string
  accent: string
  accentDim: string
  status: GameStatus
  href?: string
  icon: React.ReactNode
  preview?: React.ReactNode
  format: string        // Semanal · Diario · Infinito
  category: string      // Predicción · Trivia · Fantasy · etc.
  difficulty: Difficulty
  timeEst: string       // "~2 min" · "~5 min"
  pts: number           // puntos máximos por sesión
}

const GAMES: Game[] = [
  {
    id: 'quiniela',
    name: 'Quiniela',
    tagline: 'Predice. Acumula. Domina.',
    description: 'Elige el resultado de cada partido de la jornada y compite en el ranking semanal con todos los usuarios.',
    accent: '#A78BFA',
    accentDim: '#7C3AED',
    status: 'active',
    href: '/quiniela',
    icon: <IconQuiniela />,
    format: 'Semanal',
    category: 'Predicción',
    difficulty: 2,
    timeEst: '~2 min',
    pts: 100,
  },
  {
    id: 'crackquiz',
    name: 'CrackQuiz',
    tagline: 'Demuestra que sabes.',
    description: 'Trivia de fútbol y deporte general. Rondas cronometradas, racha de aciertos y ranking en tiempo real.',
    accent: '#FCD34D',
    accentDim: '#D97706',
    status: 'live',
    href: '/crackquiz',
    icon: <IconCrackQuiz />,
    preview: <PreviewCrackQuiz accent="#FCD34D" accentDim="#D97706" />,
    format: 'Diario',
    category: 'Trivia',
    difficulty: 2,
    timeEst: '~3 min',
    pts: 150,
  },
  {
    id: 'mionce',
    name: 'Mi Once',
    tagline: 'Tu equipo, tus reglas.',
    description: 'Alinea tu once ideal en una formación táctica real. Reto semanal con leyendas y jugadores actuales.',
    accent: '#93C5FD',
    accentDim: '#2563EB',
    status: 'live',
    href: '/mionce',
    icon: <IconMiOnce />,
    preview: <PreviewMiOnce accent="#93C5FD" accentDim="#2563EB" />,
    format: 'Semanal',
    category: 'Fantasy',
    difficulty: 3,
    timeEst: '~5 min',
    pts: 200,
  },
  {
    id: 'sopacracks',
    name: 'Sopa de Cracks',
    tagline: 'Encuéntralos todos.',
    description: 'Sopa de letras con nombres de futbolistas históricos y actuales. Nuevos puzzles cada semana.',
    accent: '#6EE7B7',
    accentDim: '#059669',
    status: 'live',
    href: '/sopa-cracks',
    icon: <IconSopaCracks />,
    preview: <PreviewSopaCracks accent="#6EE7B7" accentDim="#059669" />,
    format: 'Semanal',
    category: 'Puzzle',
    difficulty: 1,
    timeEst: '~4 min',
    pts: 80,
  },
  {
    id: 'takagrid',
    name: 'TakaGrid',
    tagline: 'Conecta jugador con club.',
    description: 'Grid 3×3: cruza clubs con categorías y encuentra al jugador que encaja en cada celda. Un intento por celda.',
    accent: '#FDBA74',
    accentDim: '#EA580C',
    status: 'live',
    href: '/takagrid',
    icon: <IconTakaGrid />,
    preview: <PreviewTakaGrid accent="#FDBA74" accentDim="#EA580C" />,
    format: 'Diario',
    category: 'Grid',
    difficulty: 3,
    timeEst: '~3 min',
    pts: 120,
  },
  {
    id: 'strikerrush',
    name: 'Striker Rush',
    tagline: 'Corre. Dribbla. Marca.',
    description: 'Runner infinito con leyendas del fútbol. Esquiva rivales, recoge balones y anota. ¿Cuánto aguantas?',
    accent: '#FCA5A5',
    accentDim: '#DC2626',
    status: 'coming',
    icon: <IconStrikerRush />,
    format: 'Infinito',
    category: 'Arcade',
    difficulty: 2,
    timeEst: 'Sin límite',
    pts: 500,
  },
]

// ── Componentes de badges ────────────────────────────────────

function DifficultyDots({ level }: { level: Difficulty }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: i <= level ? '#9090B0' : 'rgba(255,255,255,0.08)' }}
        />
      ))}
    </div>
  )
}

function Badge({ label, color = 'rgba(255,255,255,0.06)', textColor = '#5A5A7A' }: { label: string; color?: string; textColor?: string }) {
  return (
    <span
      className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: color, color: textColor, border: `1px solid rgba(255,255,255,0.07)`, fontFamily: 'var(--font-sport)' }}
    >
      {label}
    </span>
  )
}

// ── Card activo hero ──────────────────────────────────────────

function ActiveGameCard({ game, voted, matches }: { game: Game; voted: boolean; matches: typeof QUINIELA_MATCHES }) {
  const previewMatches = matches.slice(0, 3)
  const isOpen = MATCH_STATUS === 'open'

  return (
    <Link
      href={game.href!}
      className="group relative rounded-2xl overflow-hidden flex flex-col lg:flex-row items-stretch transition-transform hover:scale-[1.005]"
      style={{
        background: 'linear-gradient(135deg,#1E1040 0%,#130D32 55%,#0F0A20 100%)',
        border: `1px solid ${game.accentDim}50`,
        minHeight: 220,
      }}
    >
      {/* Glows */}
      <div className="absolute -top-20 -left-20 w-72 h-72 blur-3xl opacity-[0.18] pointer-events-none" style={{ background: game.accentDim }} />
      <div className="absolute -bottom-12 -right-12 w-56 h-56 blur-3xl opacity-[0.08] pointer-events-none" style={{ background: game.accent }} />

      {/* Left — main content */}
      <div className="relative z-10 flex flex-col justify-between p-6 lg:p-8 flex-1 gap-6">
        {/* Status + icon + name */}
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${game.accentDim}28`, color: game.accent, border: `1px solid ${game.accentDim}30` }}
          >
            <IconQuiniela size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1.5">
              <span
                className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)', fontFamily: 'var(--font-sport)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Disponible ahora
              </span>
              <Badge label={game.format} />
              <Badge label={game.category} />
            </div>
            <h2
              className="font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem,2.5vw,2.2rem)', color: '#F0F0FF', letterSpacing: '-0.02em' }}
            >
              {game.name}
            </h2>
            <p className="text-[11px] mt-1" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>
              {game.tagline}
            </p>
          </div>

          {voted && (
            <span
              className="flex-shrink-0 text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)', fontFamily: 'var(--font-sport)' }}
            >
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Picks enviados
            </span>
          )}
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#5A4878" strokeWidth="1.2" /><path d="M7 4v3l2 1.5" stroke="#5A4878" strokeWidth="1.2" strokeLinecap="round" /></svg>
            <span className="text-[10px]" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>{game.timeEst}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1.5l1.5 3.2 3.5.5-2.5 2.4.6 3.4L7 9.3 3.9 11l.6-3.4L2 5.2l3.5-.5L7 1.5z" stroke="#5A4878" strokeWidth="1.1" /></svg>
            <span className="text-[10px]" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>Hasta {game.pts} pts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]" style={{ color: '#5A4878', fontFamily: 'var(--font-sport)' }}>Dificultad</span>
            <DifficultyDots level={game.difficulty} />
          </div>
          <div className="w-px h-3 bg-white opacity-[0.06]" />
          <span className="text-[10px]" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)' }}>
            Jornada 38 · LaLiga EA Sports
          </span>
        </div>

        {/* CTA */}
        <div>
          <span
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all group-hover:gap-3"
            style={{
              background: `linear-gradient(135deg,${game.accentDim},#5B21B6)`,
              color: '#fff',
              fontFamily: 'var(--font-sport)',
              letterSpacing: '0.04em',
              boxShadow: `0 4px 20px ${game.accentDim}40`,
            }}
          >
            {voted ? 'Ver mis predicciones' : 'Hacer predicción'}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </div>

      {/* Right — match preview panel */}
      <div
        className="relative z-10 lg:w-72 flex flex-col justify-center p-5 lg:p-6"
        style={{ borderLeft: '1px solid rgba(124,58,237,0.12)' }}
      >
        <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: '#3A3A5A', fontFamily: 'var(--font-sport)' }}>
          Partidos de la jornada
        </p>
        <div className="flex flex-col gap-2">
          {previewMatches.map((m, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="flex-1 text-right text-[10px] font-black truncate" style={{ color: '#9090B8', fontFamily: 'var(--font-display)' }}>
                {m.home}
              </span>
              <span
                className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(124,58,237,0.12)', color: '#3A2860', fontFamily: 'var(--font-sport)' }}
              >
                VS
              </span>
              <span className="flex-1 text-[10px] font-black truncate" style={{ color: '#9090B8', fontFamily: 'var(--font-display)' }}>
                {m.away}
              </span>
            </div>
          ))}
          {matches.length > 3 && (
            <p className="text-center text-[9px] mt-0.5" style={{ color: '#2A2A42', fontFamily: 'var(--font-sport)' }}>
              +{matches.length - 3} partidos más
            </p>
          )}
        </div>

        {isOpen && (
          <div className="mt-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <span className="text-[9px]" style={{ color: '#2A6040', fontFamily: 'var(--font-sport)' }}>
              Predicciones abiertas
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Card disponible (live, no hero) ───────────────────────────

function LiveGameCard({ game }: { game: Game }) {
  return (
    <Link
      href={game.href!}
      className="group rounded-2xl overflow-hidden relative flex flex-col transition-all hover:translate-y-[-2px]"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${game.accentDim}40`,
      }}
    >
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${game.accentDim}, ${game.accent})` }} />
      <div className="absolute top-0 right-0 w-36 h-36 blur-3xl opacity-[0.10] pointer-events-none" style={{ background: game.accent }} />

      {/* Mini preview visual */}
      {game.preview && (
        <div className="relative z-10 pt-3 px-3">
          {game.preview}
        </div>
      )}

      <div className="relative z-10 p-5 pt-2 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${game.accentDim}24`, color: game.accent, border: `1px solid ${game.accentDim}40` }}
          >
            {game.icon}
          </div>
          <div className="flex flex-col items-end gap-1">
            <GameStatusBadge gameId={game.id as GameId} period={getGamePeriod(game.id as GameId)} variant="live" />
            <span
              className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#3A3A5A', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
            >
              {game.category}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1">
          <h3
            className="font-black leading-tight"
            style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5', fontSize: 17, letterSpacing: '-0.01em' }}
          >
            {game.name}
          </h3>
          <p
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: game.accent, fontFamily: 'var(--font-sport)', opacity: 0.85 }}
          >
            {game.tagline}
          </p>
          <p className="text-[11px] leading-relaxed mt-1" style={{ color: 'var(--text-muted)' }}>
            {game.description}
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <DifficultyDots level={game.difficulty} />
          <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{game.timeEst}</span>
          <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>·</span>
          <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{game.format}</span>
          <span className="ml-auto text-[9px] font-black" style={{ color: `${game.accent}A0`, fontFamily: 'var(--font-sport)' }}>
            {game.pts} pts
          </span>
        </div>

        <span
          className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition-all group-hover:gap-3 inline-flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(135deg,${game.accentDim},${game.accentDim}D0)`,
            color: '#F0FFF4',
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.06em',
            boxShadow: `0 4px 18px ${game.accentDim}40`,
          }}
        >
          Jugar ahora
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="#F0FFF4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
    </Link>
  )
}

// ── Card próximamente ─────────────────────────────────────────

const NOTIFY_KEY = 'ts_game_notify'

function ComingGameCard({ game }: { game: Game }) {
  const [notified, setNotified] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(NOTIFY_KEY) ?? '[]')
      setNotified(saved.includes(game.id))
    } catch { /* ignore */ }
    setHydrated(true)
  }, [game.id])

  const handleNotify = () => {
    if (notified) return
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(NOTIFY_KEY) ?? '[]')
      localStorage.setItem(NOTIFY_KEY, JSON.stringify([...saved, game.id]))
    } catch { /* ignore */ }
    setNotified(true)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2500)
  }

  return (
    <div
      className="rounded-2xl overflow-hidden relative flex flex-col transition-all hover:translate-y-[-2px]"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Top accent bar */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${game.accentDim}, ${game.accent})` }} />

      {/* Glow */}
      <div className="absolute top-0 right-0 w-36 h-36 blur-3xl opacity-[0.06] pointer-events-none" style={{ background: game.accent }} />

      <div className="relative z-10 p-5 flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${game.accentDim}18`, color: game.accent, border: `1px solid ${game.accentDim}22` }}
          >
            {game.icon}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: `${game.accentDim}14`, color: game.accent, border: `1px solid ${game.accentDim}22`, fontFamily: 'var(--font-sport)' }}
            >
              Próximamente
            </span>
            <span
              className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#3A3A5A', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
            >
              {game.category}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-1 flex-1">
          <h3
            className="font-black leading-tight"
            style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5', fontSize: 17, letterSpacing: '-0.01em' }}
          >
            {game.name}
          </h3>
          <p
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: game.accent, fontFamily: 'var(--font-sport)', opacity: 0.75 }}
          >
            {game.tagline}
          </p>
          <p className="text-[11px] leading-relaxed mt-1" style={{ color: 'var(--text-muted)' }}>
            {game.description}
          </p>
        </div>

        {/* Meta strip */}
        <div className="flex items-center gap-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-1">
            <DifficultyDots level={game.difficulty} />
          </div>
          <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{game.timeEst}</span>
          <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>·</span>
          <span className="text-[9px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{game.format}</span>
          <span className="ml-auto text-[9px] font-black" style={{ color: `${game.accent}80`, fontFamily: 'var(--font-sport)' }}>
            {game.pts} pts
          </span>
        </div>

        {/* CTA */}
        {hydrated && (
          <button
            onClick={handleNotify}
            disabled={notified}
            className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            style={{
              background: notified ? 'rgba(34,197,94,0.07)' : `${game.accentDim}12`,
              color: notified ? '#4ade80' : game.accent,
              border: notified ? '1px solid rgba(34,197,94,0.18)' : `1px solid ${game.accentDim}20`,
              fontFamily: 'var(--font-sport)',
              letterSpacing: '0.06em',
              cursor: notified ? 'default' : 'pointer',
            }}
          >
            {justSaved ? '✓ ¡Apuntado!' : notified ? 'Te avisaremos' : 'Notificarme →'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function JuegosPage() {
  const [voted, setVoted] = useState(false)
  const [quinielaMatches, setQuinielaMatches] = useState(QUINIELA_MATCHES)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(QUINIELA_PICKS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.picks && Array.isArray(parsed.picks)) setVoted(true)
      }
    } catch { /* ignore */ }

    fetch('/api/quiniela')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.matches?.length) setQuinielaMatches(data.matches) })
      .catch(() => { /* use fallback */ })
  }, [])

  const activeGame = GAMES.find(g => g.status === 'active')!
  const liveGames = GAMES.filter(g => g.status === 'live')
  const comingGames = GAMES.filter(g => g.status === 'coming')

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">

        {/* ── HERO ────────────────────────────────────────── */}
        <div className="relative pt-10 pb-8">
          <div
            className="absolute -top-8 left-0 w-96 h-48 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 20% 40%, rgba(124,58,237,0.1) 0%, transparent 70%)',
              filter: 'blur(16px)',
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="section-accent" />
              <span className="section-label">Zona de juegos</span>
            </div>
            <h1
              className="font-black leading-none mb-3"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                color: '#F8F8FF',
                letterSpacing: '-0.02em',
              }}
            >
              Pon a prueba<br />tu instinto deportivo.
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 460 }}>
              Predicciones, trivia, fantasy y arcade. Compite cada semana y sube en el ranking.
            </p>
            <div className="mt-4">
              <StreakChip />
            </div>
          </div>
        </div>

        {/* ── JUEGO ACTIVO ─────────────────────────────────── */}
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: '#4ade80', fontFamily: 'var(--font-sport)' }}
            >
              En vivo ahora
            </span>
          </div>
          <ActiveGameCard game={activeGame} voted={voted} matches={quinielaMatches} />
        </section>

        {/* ── DISPONIBLES ─────────────────────────────────── */}
        {liveGames.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="section-accent" />
                <h2 className="section-label">Disponibles</h2>
                <span
                  className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)', fontFamily: 'var(--font-sport)' }}
                >
                  {liveGames.length} {liveGames.length === 1 ? 'juego' : 'juegos'}
                </span>
              </div>
              <p className="text-[10px] hidden sm:block" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
                Listos para jugar
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveGames.map(game => (
                <LiveGameCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        )}

        {/* ── RANKINGS ──────────────────────────────────────── */}
        <LeaderboardTabs />

        {/* ── PRÓXIMOS JUEGOS ──────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="section-accent" />
              <h2 className="section-label">En desarrollo</h2>
              <span
                className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#3A3A5A', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
              >
                {comingGames.length} juegos
              </span>
            </div>
            <p className="text-[10px] hidden sm:block" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
              Actívate para recibir acceso anticipado
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comingGames.map(game => (
              <ComingGameCard key={game.id} game={game} />
            ))}
          </div>
        </section>

      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
