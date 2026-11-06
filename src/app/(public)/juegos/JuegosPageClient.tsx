'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ScrollToTop from '@/components/ScrollToTop'
import { SmartphoneIcon } from '@/components/icons/GameIcons'
import NewsletterSection from '@/components/NewsletterSection'
import {
  IconQuiniela,
  IconCrackQuiz,
  IconMiOnce,
  IconSopaCracks,
  IconTakaGrid,
  IconStrikerRush,
  IconWrestlingFantasy,
  IconUFCPrediction,
  PreviewTakaGrid,
  PreviewCrackQuiz,
  PreviewMiOnce,
  PreviewSopaCracks,
} from '@/components/games/GameVisuals'
import MissionsCard from '@/components/games/MissionsCard'
import GamesStatusBar from '@/components/games/GamesStatusBar'
import LeaderboardTabs from '@/components/games/LeaderboardTabs'
import { formatCountdown, getGamePeriod } from '@/lib/games-periods'
import { useMounted } from '@/hooks/useMounted'
import { useGamesOverview, type GameCardState } from '@/hooks/useGamesOverview'
import type { GameId } from '@/lib/games-store'
import JugarTabs from '@/components/JugarTabs'
import SectionHeader from '@/components/ui/SectionHeader'

// (iconos y previews movidos a src/components/games/GameVisuals.tsx)


// ── Datos ─────────────────────────────────────────────────────

// 'archived' = ya se jugó y se puede consultar, pero no es una promesa de futuro.
// Sin él, el Mundial 2026 —terminado el 19/07/2026— vivía en el cubo 'coming'
// y la ficha decía «PRÓX · FINALIZADO» con un botón para avisar de su estreno.
type GameStatus = 'active' | 'live' | 'coming' | 'archived'
type Difficulty = 1 | 2 | 3

/** Links externos para juegos que viven fuera de Taka (ej. Wrestling Fantasy) */
interface ExternalLinks {
  web: string
  appStore?: string  // iOS App Store URL
  playStore?: string // Google Play URL
}

interface Game {
  id: string
  name: string
  tagline: string
  description: string
  accent: string
  accentDim: string
  status: GameStatus
  href?: string
  /** Si está presente, el juego es externo: en desktop abre la web, en móvil muestra sheet */
  externalLinks?: ExternalLinks
  icon: React.ReactNode
  preview?: React.ReactNode
  format: string        // Semanal · Diario · Infinito
  category: string      // Predicción · Trivia · Fantasy · etc.
  difficulty: Difficulty
  timeEst: string       // "~2 min" · "~5 min"
  pts: number           // puntos máximos por sesión
  releaseTarget?: string // Solo coming — etiqueta de fecha estimada ("Q3 2026", "Verano 2026")
  heroNote?: string      // Solo featured — línea bajo el título del banner destacado
  ctaLabel?: string      // Solo featured — texto del botón principal del banner
}

function IconMundial({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const GAMES: Game[] = [
  {
    // Carta destacada del hub. Era el Mundial —que acabó el 19-jul-2026— con
    // el rótulo "Predicciones abiertas" y el botón "Jugar el Mundial": el
    // escaparate de /juegos llevaba semanas empujando a un cuadro cerrado.
    id: 'mundial',
    name: 'La Jornada',
    tagline: 'Los partidos que importan de cada día.',
    description: 'Cada día publicamos los partidos destacados. Acierta la tendencia, clava el marcador y llévate el Partido del Día, que puntúa doble.',
    accent: '#4ADE80',
    accentDim: '#16A34A',
    status: 'active',
    href: '/predicciones',
    icon: <IconQuiniela />,
    heroNote: 'Nueva Jornada cada día · Predicciones abiertas',
    ctaLabel: 'Jugar La Jornada',
    format: 'Diario',
    category: 'Predicciones',
    difficulty: 2,
    timeEst: '~1 min',
    pts: 300,
  },
  {
    id: 'ranked-ufc',
    name: 'Ranked UFC',
    tagline: 'Predice cada combate del cartel.',
    description: 'Elige al ganador de cada pelea de la velada. El estelar puntúa doble y acertar el método suma extra.',
    accent: '#F87171',
    accentDim: '#B91C1C',
    status: 'live',
    href: '/predicciones',
    icon: <IconQuiniela />,
    format: 'Por velada',
    category: 'Predicciones',
    difficulty: 2,
    timeEst: '~2 min',
    pts: 100,
  },
  {
    id: 'mundial-archivo',
    name: 'Mundial 2026',
    tagline: 'El torneo terminó.',
    description: 'Consulta el cuadro completo, tus picks y el ranking final del Mundial 2026.',
    accent: '#FBBF24',
    accentDim: '#B45309',
    status: 'archived',
    href: '/mundial',
    icon: <IconMundial />,
    format: 'Archivo',
    category: 'Predicciones',
    difficulty: 2,
    timeEst: '~2 min',
    pts: 200,
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
    // Sin `releaseTarget`: la tarjeta cae a «Próximamente», que no caduca. Estuvo
    // meses prometiendo «Q3 2026» y ese trimestre acaba el 30/09/2026.
    pts: 500,
  },
  {
    id: 'wrestlingfantasy',
    name: 'Wrestling Fantasy',
    tagline: 'El fantasy del wrestling. Ya disponible.',
    description: 'Haz el draft de tus luchadores favoritos y compite cada semana. App independiente con comunidad propia.',
    accent: '#FF3131',
    accentDim: '#D2272F',
    status: 'live',
    externalLinks: {
      web:      'https://www.wrestlingfantasy.app',
      appStore: 'https://apps.apple.com/es/app/wrestling-fantasy/id6761522844',
    },
    icon: <IconWrestlingFantasy />,
    format: 'Semanal',
    category: 'Fantasy',
    difficulty: 2,
    timeEst: '~5 min',
    pts: 300,
  },
  // ELIMINADO 03/09/2026: 'ufcranked' anunciaba como «PRÓX · Q3 2026» el mismo
  // producto que 'ranked-ufc' ya sirve como 'live'. Dos tarjetas casi homónimas
  // («Ranked UFC» y «UFC Ranked») con estados contradictorios en la misma página.
]

// Aporte REAL a la Liga Taka por minijuego (game-points.ts: diarios 1→5,
// semanales 2→12). El `pts` de cada juego es la puntuación de la PARTIDA
// (arcade), NO puntos de Liga Taka — no mezclar las dos escalas en la UI.
const LIGA_TAKA_MAX: Record<string, number> = { crackquiz: 5, takagrid: 5, mionce: 12, sopacracks: 12 }

/** Juegos con periodo y estado propio: son los que cuentan para "N/M jugados"
 *  y los que muestran "hecho / cierra en X" en su tarjeta. */
const TRACKED_GAMES: readonly GameId[] = ['crackquiz', 'takagrid', 'sopacracks', 'mionce']

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

function Badge({ label, color = 'rgba(255,255,255,0.06)', textColor = '#7878A2' }: { label: string; color?: string; textColor?: string }) {
  return (
    <span
      className="text-[11px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: color, color: textColor, border: `1px solid rgba(255,255,255,0.07)`, fontFamily: 'var(--font-sport)' }}
    >
      {label}
    </span>
  )
}

// ── Tarjeta de juego (una sola, neutra) ───────────────────────
// Maqueta 3 de noviembre (V-31): cada juego traía su color saturado como borde
// completo, previsualización y botón a color, y /juegos parecía un portal de
// minijuegos. Ahora todas las tarjetas son iguales —fondo --bg-card, borde
// fino, radio 16— y el color de cada juego vive en UN sitio: el icono. El
// botón es el morado de marca, «Jugar». La Jornada es la primera tarjeta, no
// un banner aparte, y el estado del juego (hecho / cierra en) va en su línea.

function LiveGameCard({ game, state }: { game: Game; state?: GameCardState }) {
  // La cuenta atrás sale del reloj DEL NAVEGADOR y esta página es ESTÁTICA de
  // build (sin revalidación): el "2d 6h" del HTML es el de cuando se compiló y
  // no coincide nunca con el de quien la abre. Por eso se pinta tras montar
  // —mismo patrón que RetoDelDia—: si no, React tira la página y la repinta
  // entera (#418) en CADA carga.
  const montado = useMounted()
  const period = getGamePeriod(game.id as GameId)
  const played = state?.played ?? false
  const countdown = montado && period.nextResetMs > 0 ? formatCountdown(period.nextResetMs) : null
  const puntos = LIGA_TAKA_MAX[game.id] ? `hasta ${LIGA_TAKA_MAX[game.id]} pts` : `hasta ${game.pts} pts`
  const meta = [game.timeEst, puntos, game.format.toLowerCase()].join(' · ')

  return (
    <Link
      href={game.href!}
      className="group flex items-center gap-3.5 rounded-2xl p-3.5 no-underline transition-colors hover:bg-white/[0.03]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0 rounded-[14px]"
        style={{ width: 48, height: 48, background: `color-mix(in srgb, ${game.accent} 14%, var(--bg-surface))`, color: game.accent }}
      >
        {game.icon}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="leading-none" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)' }}>
          {game.name}
        </h3>
        <p className="text-[14px] mt-[3px] line-clamp-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.3 }}>{game.tagline}</p>
        <p className="text-[12px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
          {played ? (
            <span style={{ color: '#86EFAC' }}>Hecho{state?.score != null ? ` · ${state.score}` : ''} · </span>
          ) : countdown ? (
            <span>cierra en {countdown} · </span>
          ) : null}
          {meta}
        </p>
      </div>
      <span
        className="inline-flex items-center justify-center flex-shrink-0 rounded-xl text-[13px] font-bold uppercase tracking-[0.04em] transition-opacity group-hover:opacity-90"
        style={{
          height: 36, padding: '0 16px', fontFamily: 'var(--font-sport)',
          background: played ? 'var(--bg-surface)' : 'var(--purple)',
          color: played ? 'var(--text-secondary)' : '#fff',
          border: played ? '1px solid var(--border-2)' : '1px solid var(--purple)',
        }}
      >
        {played ? 'Ver' : 'Jugar'}
      </span>
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
              className="text-[11px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full"
              style={{ background: `${game.accentDim}14`, color: game.accent, border: `1px solid ${game.accentDim}22`, fontFamily: 'var(--font-sport)' }}
            >
              {game.releaseTarget ? `Próx · ${game.releaseTarget}` : 'Próximamente'}
            </span>
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#9090A2', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
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
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
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
          <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{game.timeEst}</span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>·</span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{game.format}</span>
          <span className="ml-auto text-[11px] font-bold" style={{ color: `${game.accent}B3`, fontFamily: 'var(--font-sport)' }}>
            {LIGA_TAKA_MAX[game.id] ?? game.pts} pts
          </span>
        </div>

        {/* CTA */}
        {hydrated && (
          <button
            onClick={handleNotify}
            disabled={notified}
            className="w-full py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-[0.06em] transition-all"
            style={{
              background: notified ? 'rgba(34,197,94,0.07)' : `${game.accentDim}12`,
              color: notified ? '#4ade80' : game.accent,
              border: notified ? '1px solid rgba(34,197,94,0.18)' : `1px solid ${game.accentDim}20`,
              fontFamily: 'var(--font-sport)',
              letterSpacing: '0.06em',
              cursor: notified ? 'default' : 'pointer',
            }}
          >
            {justSaved ? '✓ ¡Anotado!' : notified ? '✓ Anotado' : 'Me interesa →'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Partner app banner (Wrestling Fantasy, etc.) ─────────────
// Banner horizontal full-width con la identidad visual real de la app.
// El contraste de color con el ecosistema Taka comunica por sí solo
// que es un producto independiente, sin necesidad de etiquetas.

const WF_LOGO_URL = 'https://www.wrestlingfantasy.app/assets/assets/images/logo-white.92ba9cfc247518e00d04cd962c0434ce.png'

function ExternalGameCard({ game }: { game: Game }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const links = game.externalLinks!
  const accent = game.accent    // '#FF3131'
  const dim    = game.accentDim // '#D2272F'

  const openSheet = () => setSheetOpen(true)

  return (
    <>
      {/* ── Banner desktop/tablet ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >


        {/* Main content */}
        <div className="relative z-10 p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:gap-6 sm:items-center">

          {/* ── Logo real + domain ── */}
          <div className="flex-shrink-0 flex sm:flex-col items-center gap-4 sm:gap-2.5">
            {/* Contenedor circular con su rojo exacto, como en su web */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(145deg, ${accent}DD, ${dim})`,
                boxShadow: `0 0 32px ${accent}30, 0 4px 16px ${dim}40`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={WF_LOGO_URL}
                alt="Wrestling Fantasy"
                width={36}
                height={36}
                style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
              />
            </div>
            <span
              className="text-[11px] font-bold"
              style={{ color: `${accent}65`, fontFamily: 'var(--font-sport)', letterSpacing: '0.04em' }}
            >
              wrestlingfantasy.app
            </span>
          </div>

          {/* ── Info ── */}
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-black leading-tight"
                style={{ fontFamily: 'var(--font-display)', color: '#FFF5F5', fontSize: 19, letterSpacing: '-0.01em' }}
              >
                {game.name}
              </h3>
              <span
                className="text-[11px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full"
                style={{ background: `${accent}18`, color: accent, border: `1px solid ${dim}45`, fontFamily: 'var(--font-sport)' }}
              >
                {game.category}
              </span>
            </div>
            <p
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: `${dim}CC`, fontFamily: 'var(--font-sport)' }}
            >
              {game.tagline}
            </p>
            <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {game.description}
            </p>
            {/* Meta row */}
            <div className="flex items-center gap-2.5 mt-1">
              <DifficultyDots level={game.difficulty} />
              <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{game.timeEst}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>·</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{game.format}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>·</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>WWE · AEW · Triple AAA</span>
            </div>
          </div>

          {/* ── CTAs ── */}
          <div className="flex-shrink-0 flex flex-row sm:flex-col gap-2.5 sm:min-w-[170px]">
            {/* Primary: web */}
            <a
              href={links.web}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-[11px] font-bold uppercase tracking-[0.08em] transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${dim}, ${accent})`,
                color: '#fff',
                fontFamily: 'var(--font-sport)',
                boxShadow: `0 4px 22px ${dim}55`,
                letterSpacing: '0.05em',
              }}
            >
              Ir a la web
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 8.5L8.5 1.5M8.5 1.5H4M8.5 1.5v4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            {/* Secondary: App Store (mobile shows sheet, desktop links direct) */}
            {links.appStore && (
              <button
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-[11px] font-bold uppercase tracking-[0.08em] transition-all hover:opacity-80 sm:hidden"
                style={{
                  background: `${accent}10`,
                  border: `1px solid ${accent}32`,
                  color: accent,
                  fontFamily: 'var(--font-sport)',
                  letterSpacing: '0.04em',
                }}
                onClick={openSheet}
              >
                <SmartphoneIcon size={12} />App Store
              </button>
            )}
            {links.appStore && (
              <a
                href={links.appStore}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-[11px] font-bold uppercase tracking-[0.08em] transition-all hover:opacity-80"
                style={{
                  background: `${accent}10`,
                  border: `1px solid ${accent}32`,
                  color: accent,
                  fontFamily: 'var(--font-sport)',
                  letterSpacing: '0.04em',
                }}
              >
                <SmartphoneIcon size={12} />App Store
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom sheet (móvil) ── */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.70)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl overflow-hidden safe-bottom"
            style={{ background: 'var(--bg-card)', border: `1px solid ${dim}40` }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
            </div>

            {/* Header */}
            <div className="px-6 pt-3 pb-4" style={{ borderBottom: `1px solid ${dim}20` }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${dim}28`, color: accent, border: `1px solid ${dim}40` }}
                >
                  {game.icon}
                </div>
                <div>
                  <p className="font-black text-sm" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                    {game.name}
                  </p>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    ¿Cómo quieres acceder?
                  </p>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="p-4 flex flex-col gap-3">
              <a
                href={links.web}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: `${dim}18`, border: `1px solid ${dim}40` }}
                onClick={() => setSheetOpen(false)}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${dim}30`, color: accent }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M8 1.5C6 4 5 6 5 8s1 4 3 6.5M8 1.5C10 4 11 6 11 8s-1 4-3 6.5M1.5 8h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>Abrir en web</p>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>wrestlingfantasy.app</p>
                </div>
                <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 8.5L8.5 1.5M8.5 1.5H4M8.5 1.5v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }} />
                </svg>
              </a>

              {links.appStore && (
                <a
                  href={links.appStore}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-opacity hover:opacity-80"
                  style={{ background: `linear-gradient(135deg, ${dim}28, ${accent}18)`, border: `1px solid ${accent}50` }}
                  onClick={() => setSheetOpen(false)}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${dim}40`, color: accent }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M11.5 8.5c0-2 1.5-3 1.5-3s-1-1.5-2.5-1.5c-1 0-2 .8-2.5.8-.5 0-1.5-.8-2.5-.8C3.5 4 2 5.5 2 7.5c0 3 2.5 6.5 4 6.5.7 0 1.3-.5 2-.5.7 0 1.2.5 2 .5 1.3 0 3.5-3 3.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 2c.5-.5 1-1.5.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black" style={{ color: accent, fontFamily: 'var(--font-display)' }}>Descargar en App Store</p>
                    <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>iPhone · iPad · Gratis</p>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 8.5L8.5 1.5M8.5 1.5H4M8.5 1.5v4.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}

              <button
                onClick={() => setSheetOpen(false)}
                className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest mt-1"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#5A5A7A', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
              >
                Cancelar
              </button>
            </div>

            {/* safe area bottom — mínimo 8px adicionales sobre safe-bottom */}
            <div style={{ height: 8 }} />
          </div>
        </div>
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function JuegosPageClient() {
  const [quinielaJornada, setQuinielaJornada] = useState<string | undefined>(undefined)

  useEffect(() => {
    // Etiqueta de la Fecha en curso, para los periodos del ranking. Antes leía
    // /api/quiniela, que sigue sirviendo la jornada del stack retirado: una
    // etiqueta que ya no corresponde a nada jugable.
    fetch('/api/ranked/football/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (typeof data?.jornada === 'string') setQuinielaJornada(data.jornada)
      })
      .catch(() => { /* use fallback */ })
  }, [])

  const mundialGame  = GAMES.find(g => g.id === 'mundial')!
  // Todo lo jugable, en una sola rejilla: predicciones y minijuegos juntos.
  // Antes iban en dos secciones y los minijuegos salían ADEMÁS como fichas en
  // "Tu día Taka", así que el mismo juego aparecía dos veces en la página.
  const jugables     = GAMES.filter(g => g.status === 'live' && !g.externalLinks && g.id !== 'mundial')
  const partnerGames = GAMES.filter(g => !!g.externalLinks)
  const comingGames  = GAMES.filter(g => g.status === 'coming')
  const archivedGames = GAMES.filter(g => g.status === 'archived')

  // Estado del usuario: UNA lectura para la barra y para todas las tarjetas.
  const overview = useGamesOverview(TRACKED_GAMES)
  const nextGame = overview.pending
    .map(id => GAMES.find(g => g.id === id))
    .find((g): g is Game => !!g?.href)

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', position: 'relative' }}>

      {/* Fondo plano (V-18, maqueta 3 de noviembre): sin foto de marca detrás de los controles. */}

      {/* Las dos mitades de "Jugar", para poder volver a la Jornada sin pasar
          por el cajón ☰. */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <JugarTabs activo="juegos" />
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24" style={{ position: 'relative', zIndex: 1 }}>

        {/* ── HERO ────────────────────────────────────────────
            Compacto a propósito: el titular ocupaba media pantalla y empujaba
            todos los juegos por debajo del pliegue. Un hub de juegos tiene que
            enseñar juegos. */}
        <div className="pt-4 pb-4">
          <h1
            className="font-extrabold leading-none"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 3.5vw, 44px)', color: '#F8F8FF', letterSpacing: '-0.01em' }}
          >
            Juegos
          </h1>
          <p className="text-[14px] mt-1.5" style={{ color: 'var(--text-secondary)', maxWidth: 520 }}>
            Pon a prueba tu instinto deportivo. Compite cada semana y sube en el ranking.
          </p>
        </div>

        {/* ── ESTADO DEL JUGADOR (una sola barra) ───────────── */}
        <div className="mb-6">
          <GamesStatusBar overview={overview} nextHref={nextGame?.href} nextLabel={nextGame?.name} />
        </div>

        {/* ── JUEGA HOY ────────────────────────────────────────
            Todo lo jugable en un solo sitio y con su estado dentro de la
            tarjeta. Antes estaba partido en tres bloques ("Tu día Taka",
            "Predicciones" y "Minijuegos") y los cuatro minijuegos salían dos
            veces en la misma página. */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader>Juega hoy</SectionHeader>
            <p className="text-[12px] hidden sm:block" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              Todo suma a tu Liga Taka
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <LiveGameCard game={mundialGame} />
            {jugables.map(game => (
              <LiveGameCard key={game.id} game={game} state={overview.byGame[game.id]} />
            ))}
          </div>
        </section>

        {/* ── MISIONES DEL DÍA ─────────────────────────────── */}
        <section className="mb-10">
          <MissionsCard />
        </section>

        {/* ── RANKINGS ──────────────────────────────────────── */}
        <LeaderboardTabs quinielaJornada={quinielaJornada} />

        {/* ── LIGA TAKA ────────────────────────────────────────
            Enlace en una línea. Ocupaba una tarjeta enorme explicando lo que el
            propio ranking de arriba ya enseña. */}
        <Link
          href="/liga-taka"
          className="group flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-10 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <span className="text-lg leading-none flex-shrink-0" aria-hidden>⚡</span>
          <p className="text-[13px] flex-1 min-w-0" style={{ color: 'var(--text-secondary)' }}>
            <strong style={{ color: '#F0F0F5' }}>Liga Taka</strong> — juegos, predicciones, misiones y
            racha en una sola clasificación general.
          </p>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.08em] flex-shrink-0 whitespace-nowrap"
            style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
          >
            Ver →
          </span>
        </Link>

        {/* ── MÁS ──────────────────────────────────────────────
            Lo secundario, al final y sin competir con lo jugable: la app amiga
            y lo que está por venir. */}
        {(partnerGames.length > 0 || comingGames.length > 0) && (
          <section>
            <SectionHeader action={<>
              {comingGames.length > 0 && (
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
                >
                  {comingGames.length} en camino
                </span>
              )}
</>}>Más adelante</SectionHeader>

            {partnerGames.map(game => (
              <div key={game.id} className="mb-4">
                <ExternalGameCard game={game} />
              </div>
            ))}

            {comingGames.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {comingGames.map(game => (
                  <ComingGameCard key={game.id} game={game} />
                ))}
              </div>
            )}
          </section>
        )}

      </div>

      <NewsletterSection source="juegos" />
      <ScrollToTop />
    </div>
  )
}
