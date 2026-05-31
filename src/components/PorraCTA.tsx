'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { trackPorraCtaClick, type PorraUserState } from '@/lib/analytics'
import { RANKED_FUTBOL_ENABLED } from '@/lib/feature-flags'

export interface PorraMatch {
  home: string
  away: string
  comp: string
  kickoff: string
  homeLogo?: string
  awayLogo?: string
  odds?: { home: number; draw: number; away: number }
  /** Partido destacado de la jornada — habilita el bonus goleador. */
  featured?: boolean
}

export interface PorraSettlement {
  jornada: string
  totalWon: number
  correctCount: number
  totalPicks: number
  settledAt: string | null
  /** true si el user acertó el partido featured y recibió el bonus x2 (T). */
  featuredHit?: boolean
}

export interface PorraStatus {
  jornada: string | null
  deadline: string | null
  totalMatches: number
  matches?: PorraMatch[]
  isAuthed: boolean
  hasPicked: boolean
  picksCount: number
  lastSettled?: PorraSettlement | null
  /** Streak: jornadas consecutivas selladas por este user (0 si nunca o roto). */
  streakCurrent?: number
  /** Total de users distintos que sellaron picks en la jornada activa. */
  weeklyParticipants?: number
  /** Picks del user para la jornada activa (cliente cruza con live scores). */
  userPicks?: Array<{ home: string; away: string; pick: string }>
  /** Promedio de aciertos de tus ligas privadas en la última jornada (P). */
  friendsAvgHits?: number | null
  /** Nº de amigos comparados (no se renderiza si <2 para evitar muestras pobres). */
  friendsCount?: number
  /** Mejor ranking del user en sus ligas privadas para la última jornada (R). */
  bestLeagueRank?: {
    leagueId: string
    leagueName: string
    rank: number
    total: number
    myPoints: number
  } | null
}

interface BadgeState {
  /** Texto principal corto del pill ("La Porra"). */
  label: string
  /** Texto del badge a la derecha (ej. "JUEGA", "TE FALTA", "6/10"). */
  badge: string
  /** Color del badge — verde si ya hecho, naranja si urgente, neutro si idle. */
  badgeTone: 'idle' | 'urgent' | 'done' | 'critical'
  /** Velocidad del pulse del dot. null = sin pulse. */
  pulseSpeed: number | null
  /** Color del dot. */
  dotColor: string
}

const STORAGE_KEY = 'porra:status:v1'
const TTL_MS = 60_000 // 1 min en cliente

interface CachedStatus { data: PorraStatus; ts: number }

function readCache(): PorraStatus | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedStatus
    if (Date.now() - parsed.ts > TTL_MS) return null
    return parsed.data
  } catch { return null }
}

function writeCache(data: PorraStatus) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ data, ts: Date.now() })) }
  catch { /* quota / SSR */ }
}

/** Formatea "2d 4h", "3h 20m", "12m" según cuánto falta. */
function formatRemaining(deadlineIso: string): string | null {
  const ms = new Date(deadlineIso).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return null
  const m = Math.floor(ms / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d}D ${h % 24}H`
  if (h >= 1) return `${h}H ${m % 60}M`
  return `${Math.max(1, m)}M`
}

/**
 * Estado fijo cuando Ranked Fútbol está pausado: reorienta el CTA al Mundial,
 * que es el único producto de predicciones activo. Sin fetch, sin cache.
 * Para revertir: poner RANKED_FUTBOL_ENABLED=true en feature-flags.ts.
 */
function deriveStateMundial(): BadgeState {
  return {
    label: 'Predicciones',
    badge: 'MUNDIAL',
    badgeTone: 'urgent',
    pulseSpeed: 1.6,
    dotColor: '#FBBF24',
  }
}

function deriveState(s: PorraStatus | null): BadgeState {
  // Sin datos → guest neutro.
  if (!s || !s.jornada) {
    return {
      label: 'Predicciones',
      badge: 'JUEGA',
      badgeTone: 'idle',
      pulseSpeed: 1.8,
      dotColor: '#F97316',
    }
  }

  // Logueado + ya jugó → estado "hecho", calmado.
  if (s.isAuthed && s.hasPicked) {
    return {
      label: 'Predicciones',
      badge: `${s.picksCount}/${s.totalMatches} ✓`,
      badgeTone: 'done',
      pulseSpeed: null,
      dotColor: '#22C55E',
    }
  }

  // Tiempo restante para decidir urgencia.
  const remaining = s.deadline ? formatRemaining(s.deadline) : null
  const hoursLeft = s.deadline
    ? (new Date(s.deadline).getTime() - Date.now()) / 3_600_000
    : Infinity

  // Logueado sin jugar → "TE FALTA" con urgencia escalada.
  if (s.isAuthed && !s.hasPicked) {
    if (hoursLeft <= 24) {
      return {
        label: 'Predicciones',
        badge: remaining ? `CIERRA ${remaining}` : 'TE FALTA',
        badgeTone: 'critical',
        pulseSpeed: 0.9,
        dotColor: '#EF4444',
      }
    }
    return {
      label: 'Predicciones',
      badge: 'TE FALTA',
      badgeTone: 'urgent',
      pulseSpeed: 1.2,
      dotColor: '#F97316',
    }
  }

  // Guest con jornada activa → mostrar deadline si <48h.
  if (hoursLeft <= 48 && remaining) {
    return {
      label: 'Predicciones',
      badge: `CIERRA ${remaining}`,
      badgeTone: 'urgent',
      pulseSpeed: 1.2,
      dotColor: '#F97316',
    }
  }

  return {
    label: 'Predicciones',
    badge: 'JUEGA GRATIS',
    badgeTone: 'idle',
    pulseSpeed: 1.8,
    dotColor: '#F97316',
  }
}

function badgeStyle(tone: BadgeState['badgeTone']): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: '0.08em',
    padding: '2px 5px',
    borderRadius: 4,
    marginLeft: 2,
    whiteSpace: 'nowrap',
  }
  switch (tone) {
    case 'done':
      return { ...base, background: 'rgba(34,197,94,0.28)', color: '#BBF7D0' }
    case 'urgent':
      return { ...base, background: 'rgba(249,115,22,0.32)', color: '#FED7AA' }
    case 'critical':
      return { ...base, background: 'rgba(239,68,68,0.36)', color: '#FECACA' }
    case 'idle':
    default:
      return { ...base, background: 'rgba(255,255,255,0.18)', color: '#fff' }
  }
}

interface Props {
  href: string
  active: boolean
  /** "desktop" = pill compacto en nav; "mobile" = card ancho en drawer. */
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export default function PorraCTA({ href, active, variant, onNavigate }: Props) {
  // IMPORTANT: status arranca null en SSR y en hidratación inicial para evitar
  // mismatch React. La lectura de sessionStorage y el fetch viven en useEffect.
  const [status, setStatus] = useState<PorraStatus | null>(null)

  useEffect(() => {
    // Mientras Ranked Fútbol esté pausado: no consultar el status de la
    // quiniela (mostraría una jornada de fútbol que el user no puede jugar).
    // El componente cae en deriveStateMundial() abajo.
    if (!RANKED_FUTBOL_ENABLED) return
    let cancelled = false
    const cached = readCache()
    if (cached) {
      setStatus(cached)
      return
    }
    fetch('/api/quiniela/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PorraStatus | null) => {
        if (cancelled || !data) return
        setStatus(data)
        writeCache(data)
      })
      .catch(() => { /* silencioso — fallback al estado guest */ })
    return () => { cancelled = true }
  }, [])

  // Re-render cada 60s para que el contador "CIERRA 2H 14M" baje.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!status?.deadline) return
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [status?.deadline])

  const state = RANKED_FUTBOL_ENABLED ? deriveState(status) : deriveStateMundial()

  // Estado del user para analytics.
  const userState: PorraUserState | undefined = status
    ? status.isAuthed
      ? (status.hasPicked ? 'authed_picked' : 'authed_no_picks')
      : 'guest'
    : undefined

  function handleClick() {
    trackPorraCtaClick({
      surface: variant === 'mobile' ? 'mobile_drawer' : 'header_pill',
      state: userState,
      jornada: status?.jornada ?? null,
    })
    if (onNavigate) onNavigate()
  }

  if (variant === 'mobile') {
    return (
      <Link
        href={href}
        onClick={handleClick}
        aria-current={active ? 'page' : undefined}
        className="flex items-center justify-between px-3 py-3 rounded-xl mb-1.5"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(249,115,22,0.18) 100%)',
          border: '1px solid rgba(124,58,237,0.5)',
          boxShadow: '0 0 16px rgba(124,58,237,0.18)',
          color: '#fff',
          fontFamily: 'var(--font-sport)',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.02em',
          textDecoration: 'none',
        }}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden style={{
            width: 7, height: 7, borderRadius: '50%',
            background: state.dotColor,
            boxShadow: `0 0 8px ${state.dotColor}`,
            display: 'inline-block',
            animation: state.pulseSpeed
              ? `porraPulse ${state.pulseSpeed}s ease-in-out infinite`
              : 'none',
          }} />
          {state.label}
        </span>
        <span style={{ ...badgeStyle(state.badgeTone), fontSize: 10, padding: '3px 7px', borderRadius: 5 }}>
          {state.badge}
        </span>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      className="porra-cta relative inline-flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-full whitespace-nowrap"
      style={{
        fontFamily: 'var(--font-sport)',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.04em',
        color: '#fff',
        textDecoration: 'none',
        background: active
          ? 'linear-gradient(135deg, #7C3AED 0%, #F97316 100%)'
          : 'linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(249,115,22,0.18) 100%)',
        border: active
          ? '1px solid rgba(255,255,255,0.18)'
          : '1px solid rgba(124,58,237,0.45)',
        boxShadow: active
          ? '0 0 0 3px rgba(124,58,237,0.18), 0 6px 18px rgba(124,58,237,0.35)'
          : '0 0 14px rgba(124,58,237,0.18)',
        transition: 'background 200ms, box-shadow 200ms, transform 160ms',
      }}
    >
      <span aria-hidden style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        background: state.dotColor,
        boxShadow: `0 0 8px ${state.dotColor}`,
        animation: state.pulseSpeed
          ? `porraPulse ${state.pulseSpeed}s ease-in-out infinite`
          : 'none',
      }} />
      {state.label}
      <span style={badgeStyle(state.badgeTone)}>{state.badge}</span>
      <style>{`
        @keyframes porraPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.85); }
        }
        .porra-cta:hover { transform: translateY(-1px); }
      `}</style>
    </Link>
  )
}
