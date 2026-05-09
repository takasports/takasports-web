'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { QUINIELA_PICKS_KEY, QUINIELA_MATCHES, MATCH_STATUS } from '@/components/QuinielaModule'

// ── Iconos ────────────────────────────────────────────────────

function IconQuiniela({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="3" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="18" y="3" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="18" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="18" y="18" width="11" height="11" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function IconCrackQuiz({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 13c0-2.2 1.8-4 4-4s4 1.8 4 4c0 1.7-1 3.1-2.5 3.8-.5.2-.9.7-.9 1.3v1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.5" cy="23.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

function IconMiOnce({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="3" width="26" height="26" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <line x1="16" y1="3" x2="16" y2="29" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="10" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="24" cy="10" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="8" cy="22" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="24" cy="22" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="16" cy="6" r="2" fill="currentColor" />
      <circle cx="16" cy="26" r="2" fill="currentColor" />
    </svg>
  )
}

function IconSopaCracks({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="3" width="26" height="26" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <rect x="6" y="6" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="11.5" y="6" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.25" />
      <rect x="17" y="6" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="22.5" y="6" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.4" />
      <rect x="6" y="11.5" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.3" />
      <rect x="11.5" y="11.5" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="17" y="11.5" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.5" />
      <rect x="22.5" y="11.5" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="6" y="17" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="11.5" y="17" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.4" />
      <rect x="17" y="17" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.25" />
      <rect x="22.5" y="17" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="6" y="22.5" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.4" />
      <rect x="11.5" y="22.5" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="17" y="22.5" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="22.5" y="22.5" width="4" height="4" rx="0.8" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

function IconTakaGrid({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12.5" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="22" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="12.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12.5" y="12.5" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="22" y="12.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="22" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12.5" y="22" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="22" y="22" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" />
      <circle cx="25.5" cy="25.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconStrikerRush({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="6" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 9v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 13l-4 4M16 13l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 17l-2 6M20 17l2 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="22" cy="23" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 28v-6h6v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 10l3 0M25 13l3 1M26 16l3-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

// ── Mini previews ─────────────────────────────────────────────

function PreviewTakaGrid({ accent, accentDim }: { accent: string; accentDim: string }) {
  const labels = ['Real Madrid', 'Liverpool', 'Arsenal', '', 'España 🇪🇸', 'Brasil 🇧🇷', 'Delantero ⚽']
  const filled = [[false, true, false], [true, false, false], [false, false, true]]
  return (
    <div className="w-full px-1 pb-1">
      <div className="rounded-xl overflow-hidden p-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
        {/* Col headers */}
        <div className="grid grid-cols-4 gap-1 mb-1">
          <div />
          {['🇪🇸', '🇧🇷', '⚽'].map((e, i) => (
            <div key={i} className="rounded-md flex items-center justify-center text-[9px]" style={{ height: 20, background: `${accentDim}28`, color: accent, fontSize: 10 }}>{e}</div>
          ))}
        </div>
        {/* Rows */}
        {[['⚪', '🔴', '🔴']].concat([['🔵', '🔴', '⚪'], ['🔴', '⚫', '🔴']]).map((rowEmojis, r) => (
          <div key={r} className="grid grid-cols-4 gap-1 mb-1">
            <div className="rounded-md flex items-center justify-center text-[9px]" style={{ height: 20, background: 'rgba(255,255,255,0.04)', fontSize: 9 }}>{rowEmojis[r] ?? '⚪'}</div>
            {[0, 1, 2].map(c => (
              <div
                key={c}
                className="rounded-md flex items-center justify-center"
                style={{
                  height: 20,
                  background: filled[r][c] ? `${accentDim}60` : 'rgba(255,255,255,0.03)',
                  border: filled[r][c] ? `1px solid ${accent}60` : '1px dashed rgba(255,255,255,0.08)',
                }}
              >
                {filled[r][c] && <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewCrackQuiz({ accent, accentDim }: { accent: string; accentDim: string }) {
  const opts = ['5', '6', '7 ✓', '8']
  return (
    <div className="w-full px-1 pb-1">
      <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <p className="text-[9px] font-bold mb-2 leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>¿Cuántos mundiales tiene Brasil?</p>
        <div className="grid grid-cols-2 gap-1">
          {opts.map((o, i) => (
            <div
              key={i}
              className="rounded-lg px-2 py-1 text-[8px] font-bold text-center"
              style={{
                background: o.includes('✓') ? `${accentDim}50` : 'rgba(255,255,255,0.04)',
                color: o.includes('✓') ? accent : 'rgba(255,255,255,0.25)',
                border: o.includes('✓') ? `1px solid ${accent}50` : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {o}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PreviewMiOnce({ accent, accentDim }: { accent: string; accentDim: string }) {
  const players: [number, number][] = [[50,8],[20,25],[40,25],[60,25],[80,25],[30,48],[50,44],[70,48],[20,72],[50,78],[80,72]]
  const filled = [0,1,3,4,6,8,9,10]
  return (
    <div className="w-full px-1 pb-1">
      <div className="rounded-xl relative overflow-hidden" style={{ background: '#0d4a1e', height: 72 }}>
        {/* Pitch lines */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="0" y="0" width="100" height="100" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
          <ellipse cx="50" cy="50" rx="15" ry="10" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
        </svg>
        {/* Players */}
        {players.map(([x, y], i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              bottom: `${y}%`,
              transform: 'translate(-50%,-50%)',
              width: 7, height: 7,
              background: filled.includes(i) ? accent : 'rgba(255,255,255,0.12)',
              boxShadow: filled.includes(i) ? `0 0 4px ${accent}80` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function PreviewSopaCracks({ accent, accentDim }: { accent: string; accentDim: string }) {
  const grid = 'MESSIABCRONALDOXZIDANEKRQWERTY'.split('')
  const highlighted = [0,1,2,3,4, 10,11,12,13,14,15, 16,17,18,19,20]
  return (
    <div className="w-full px-1 pb-1">
      <div className="rounded-xl p-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
          {grid.slice(0, 30).map((l, i) => (
            <div
              key={i}
              className="flex items-center justify-center rounded-sm text-[6px] font-black"
              style={{
                height: 14,
                background: highlighted.includes(i) ? `${accentDim}55` : 'rgba(255,255,255,0.03)',
                color: highlighted.includes(i) ? accent : 'rgba(255,255,255,0.2)',
                border: highlighted.includes(i) ? `1px solid ${accent}40` : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
            <span
              className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1.5"
              style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)', fontFamily: 'var(--font-sport)' }}
            >
              <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse inline-block" />
              Disponible
            </span>
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
