'use client'

// Hero/banner de "La Porra" para la home.
//
// Comportamiento:
//  · Solo se renderiza si hay jornada activa Y deadline a <7 días.
//  · Si el user logueado ya jugó → muestra resumen "Tu porra está lista".
//  · Si el deadline ya pasó → no se renderiza.
//  · Si el endpoint falla → no se renderiza (degradación silenciosa).
//
// Reusa el cache de /api/quiniela/status (60s SWR HTTP + sessionStorage cliente).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { trackPorraCtaClick, type PorraUserState } from '@/lib/analytics'
import Image from 'next/image'
import type { PorraStatus, PorraMatch } from './PorraCTA'
import { usePushSubscription } from '@/app/quiniela/lib/hooks'
import { normalize as normalizeTeam } from '@/lib/quiniela'
import { usePorraStatus } from '@/lib/porra-status-client'
import { StarIcon, FireIcon } from '@/components/icons/GameIcons'

const MAX_DAYS_AHEAD = 7

function formatCountdown(deadlineIso: string): { value: string; urgent: boolean } | null {
  const ms = new Date(deadlineIso).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return null
  const m = Math.floor(ms / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d >= 1) return { value: `${d}d ${h % 24}h`, urgent: false }
  if (h >= 1) return { value: `${h}h ${m % 60}m`, urgent: h < 6 }
  return { value: `${Math.max(1, m)}m`, urgent: true }
}

// ── K: Live scoring overlay ────────────────────────────────────────
interface LiveScore {
  homeTeam: string
  awayTeam: string
  homeGoals: number | null
  awayGoals: number | null
  status: string
}

/** Calcula el outcome actual de un partido según el marcador. */
function outcomeFromScore(hg: number | null, ag: number | null): '1' | 'X' | '2' | null {
  if (hg == null || ag == null) return null
  if (hg > ag) return '1'
  if (hg < ag) return '2'
  return 'X'
}

const TERMINAL = new Set(['FT', 'FINAL', 'FINAL_PEN', 'FINAL_AET', 'POST_GAME', 'END_OF_REGULATION'])

function teamsMatch(a: string, b: string): boolean {
  const na = normalizeTeam(a), nb = normalizeTeam(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

/** Cruza un match de la jornada con el pick del user y el live score
 *  para producir el estado visual de la fila. */
function computePickStatus(
  m: PorraMatch,
  userPicks: PorraStatus['userPicks'] | undefined,
  liveScores: LiveScore[],
): PickStatus | undefined {
  const pick = userPicks?.find((p) => teamsMatch(p.home, m.home) && teamsMatch(p.away, m.away))
  if (!pick) return undefined
  // Match en live scores.
  const live = liveScores.find(
    (s) => teamsMatch(s.homeTeam, m.home) && teamsMatch(s.awayTeam, m.away),
  )
  // Sin live → todavía no empezó (NS).
  if (!live) {
    return {
      pick: pick.pick as PickStatus['pick'],
      currentOutcome: null,
      liveStatus: 'pending',
      scoreLabel: null,
    }
  }
  const currentOutcome = outcomeFromScore(live.homeGoals, live.awayGoals)
  const scoreLabel = (live.homeGoals != null && live.awayGoals != null)
    ? `${live.homeGoals}-${live.awayGoals}`
    : null
  const liveStatus = TERMINAL.has(live.status) ? 'final' : 'live'
  return {
    pick: pick.pick as PickStatus['pick'],
    currentOutcome,
    liveStatus,
    scoreLabel,
  }
}

/** Compacta: 1234 → "1.2k", 12 → "12". */
function formatParticipants(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`
  return String(n)
}

function formatKickoff(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Madrid',
    }).format(d).replace('.', '')
  } catch { return '' }
}

type PickStatus = {
  pick: '1' | 'X' | '2' | '1X' | 'X2'
  /** Resultado actual del partido según marcador live. */
  currentOutcome: '1' | 'X' | '2' | null
  /** Estado del partido (NS, LIVE, FT). */
  liveStatus: 'pending' | 'live' | 'final'
  /** Texto del marcador "2-1". */
  scoreLabel: string | null
}

function pickHits(pick: PickStatus['pick'], outcome: '1' | 'X' | '2'): boolean {
  if (pick === outcome) return true
  if (pick === '1X') return outcome === '1' || outcome === 'X'
  if (pick === 'X2') return outcome === 'X' || outcome === '2'
  return false
}

function MatchRow({ m, pickStatus }: { m: PorraMatch; pickStatus?: PickStatus }) {
  // Si el partido tiene pick y está vivo/final, calculamos chip de estado.
  let chip: { label: string; bg: string; color: string; border: string } | null = null
  if (pickStatus) {
    const hits = pickStatus.currentOutcome
      ? pickHits(pickStatus.pick, pickStatus.currentOutcome)
      : null
    if (pickStatus.liveStatus === 'final') {
      chip = hits
        ? { label: `✓ ${pickStatus.scoreLabel ?? ''}`,
            bg: 'rgba(34,197,94,0.18)', color: '#86EFAC', border: 'rgba(34,197,94,0.4)' }
        : { label: `✗ ${pickStatus.scoreLabel ?? ''}`,
            bg: 'rgba(239,68,68,0.18)', color: '#FCA5A5', border: 'rgba(239,68,68,0.4)' }
    } else if (pickStatus.liveStatus === 'live') {
      chip = hits
        ? { label: `● ${pickStatus.scoreLabel ?? 'EN JUEGO'}`,
            bg: 'rgba(34,197,94,0.16)', color: '#86EFAC', border: 'rgba(34,197,94,0.32)' }
        : hits === false
          ? { label: `● ${pickStatus.scoreLabel ?? 'EN JUEGO'}`,
              bg: 'rgba(249,115,22,0.16)', color: '#FED7AA', border: 'rgba(249,115,22,0.32)' }
          : { label: `● ${pickStatus.scoreLabel ?? 'EN JUEGO'}`,
              bg: 'rgba(255,255,255,0.08)', color: '#fff', border: 'rgba(255,255,255,0.18)' }
    }
  }

  return (
    <div
      className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {m.homeLogo
          ? <Image src={m.homeLogo} alt="" width={18} height={18} className="flex-shrink-0 object-contain" unoptimized />
          : <span className="w-[18px] h-[18px] rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />}
        <span
          className="text-[12px] font-semibold truncate"
          style={{ color: 'rgba(255,255,255,0.92)', fontFamily: 'var(--font-sport)' }}
        >
          {m.home}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, padding: '0 2px' }}>vs</span>
        <span
          className="text-[12px] font-semibold truncate"
          style={{ color: 'rgba(255,255,255,0.92)', fontFamily: 'var(--font-sport)' }}
        >
          {m.away}
        </span>
        {m.awayLogo
          ? <Image src={m.awayLogo} alt="" width={18} height={18} className="flex-shrink-0 object-contain" unoptimized />
          : <span className="w-[18px] h-[18px] rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {chip && (
          <span
            style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
              padding: '2px 7px', borderRadius: 4,
              background: chip.bg, color: chip.color,
              border: `1px solid ${chip.border}`,
              fontFamily: 'var(--font-sport)',
              animation: pickStatus?.liveStatus === 'live'
                ? 'porraLivePulse 1.6s ease-in-out infinite' : 'none',
            }}
          >
            {chip.label}
          </span>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        {m.featured && (
          <span
            title="Partido destacado · x2 en tendencia"
            style={{
              fontSize: 9, fontWeight: 900, letterSpacing: '0.06em',
              padding: '2px 6px', borderRadius: 3,
              background: 'rgba(251,191,36,0.22)', color: '#FDE68A',
              border: '1px solid rgba(251,191,36,0.4)',
              fontFamily: 'var(--font-sport)',
            }}
          >
            <StarIcon size={11} className="inline-block align-middle mr-1" />DESTACADO
          </span>
        )}
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
          padding: '2px 6px', borderRadius: 3,
          background: 'rgba(124,58,237,0.18)', color: '#C4B5FD',
        }}>
          {m.comp}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
          {formatKickoff(m.kickoff)}
        </span>
      </div>
    </div>
  )
}

export default function PorraHero() {
  // Hook compartido para status (dedupea fetch entre los surfaces).
  const status = usePorraStatus()
  const [, setTick] = useState(0)
  const [shareCopied, setShareCopied] = useState(false)
  const [liveScores, setLiveScores] = useState<LiveScore[]>([])
  const { status: pushStatus, subscribe: subscribePush } = usePushSubscription()

  // Soft-ask: pequeño paso intermedio antes del prompt nativo. Reduce
  // denials (cuando el user dice "no" al nativo, no podemos volver a
  // pedírselo en muchos meses).
  const [pushAsking, setPushAsking] = useState(false)
  const [pushDeferred, setPushDeferred] = useState(false)
  // Hydratamos el flag de deferral después del mount para evitar SSR mismatch.
  useEffect(() => {
    try {
      const v = localStorage.getItem('porra:pushAskDeferred')
      if (!v) return
      const ts = parseInt(v, 10)
      if (!Number.isFinite(ts)) return
      // Re-ofrecer pasados 7 días.
      if (Date.now() - ts < 7 * 24 * 3_600_000) setPushDeferred(true)
    } catch { /* */ }
  }, [])


  useEffect(() => {
    if (!status?.deadline) return
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [status?.deadline])

  // K: si el user tiene picks y la primera kickoff ya pasó, fetch live cada 60s.
  // Q: pausa el polling cuando la pestaña no está visible para ahorrar
  // ancho de banda y carga del endpoint. Al volver a foreground refetcheamos
  // inmediatamente para que el chip refleje lo que pasó mientras tanto.
  const hasPicksForLive = status?.hasPicked && (status?.userPicks?.length ?? 0) > 0
  const firstKickoff = status?.matches?.[0]?.kickoff
  const jornadaStarted = firstKickoff
    ? new Date(firstKickoff).getTime() <= Date.now()
    : false
  useEffect(() => {
    if (!hasPicksForLive || !jornadaStarted) return
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    function loadLive() {
      fetch('/api/events/live', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((json: { events?: LiveScore[] } | LiveScore[] | null) => {
          if (cancelled || !json) return
          const list = Array.isArray(json) ? json : (json.events ?? [])
          setLiveScores(list)
        })
        .catch(() => { /* */ })
    }

    function startPolling() {
      if (intervalId != null) return
      loadLive()
      intervalId = setInterval(loadLive, 60_000)
    }

    function stopPolling() {
      if (intervalId == null) return
      clearInterval(intervalId)
      intervalId = null
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') startPolling()
      else stopPolling()
    }

    if (document.visibilityState === 'visible') startPolling()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [hasPicksForLive, jornadaStarted])

  if (!status?.jornada || !status.deadline) return null

  const countdown = formatCountdown(status.deadline)
  if (!countdown) return null // deadline ya pasó

  const hoursAhead = (new Date(status.deadline).getTime() - Date.now()) / 3_600_000
  if (hoursAhead > MAX_DAYS_AHEAD * 24) return null // demasiado pronto

  const alreadyPlayed = status.isAuthed && status.hasPicked
  // Hero solo muestra los 3 primeros por orden cronológico.
  const matches = (status.matches ?? []).slice(0, 3)

  const userState: PorraUserState = status.isAuthed
    ? (alreadyPlayed ? 'authed_picked' : 'authed_no_picks')
    : 'guest'

  function handleHeroCtaClick() {
    trackPorraCtaClick({
      surface: 'home_hero',
      state: userState,
      jornada: status?.jornada ?? null,
    })
  }

  // Suscripción a push para recordatorio T-60min. Solo se ofrece cuando
  // tiene sentido: jornada futura, user que no ha jugado, no ya suscrito,
  // no denegado nativo, no diferido recientemente vía soft-ask.
  const offerPush =
    pushStatus === 'idle' &&
    !alreadyPlayed &&
    !pushDeferred &&
    new Date(status.deadline).getTime() > Date.now() + 60 * 60_000

  // Click en "AVÍSAME" abre el soft-ask (no dispara permiso nativo aún).
  function handleOpenPushAsk() {
    setPushAsking(true)
  }

  // Confirma → ahora sí lanza el permiso nativo.
  async function handleConfirmPush() {
    setPushAsking(false)
    await subscribePush()
    trackPorraCtaClick({
      surface: 'home_hero',
      state: userState,
      jornada: status?.jornada ?? null,
    })
  }

  // "Ahora no" → defer 7 días sin disparar el prompt nativo.
  function handleDeferPush() {
    setPushAsking(false)
    setPushDeferred(true)
    try { localStorage.setItem('porra:pushAskDeferred', String(Date.now())) }
    catch { /* */ }
  }

  // Share: navigator.share nativo en móvil + fallback a copy.
  async function handleShare() {
    const jornadaName = status?.jornada
    const text = jornadaName
      ? `Mi porra de TakaSports — ${jornadaName}. ${status?.totalMatches ?? 0} partidos, juega gratis 👇`
      : 'La porra de TakaSports — juega gratis 👇'
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/predicciones`
      : 'https://takasportsmedia.com/predicciones'
    try {
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
      if (nav.share) {
        await nav.share({ title: 'Predicciones · TakaSports', text, url })
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 1800)
      }
      trackPorraCtaClick({
        surface: 'home_hero',
        state: userState,
        jornada: status?.jornada ?? null,
      })
    } catch { /* user canceled / clipboard blocked */ }
  }

  return (
    <section
      aria-label="Predicciones — jornada activa"
      className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 mt-3 mb-4"
      style={{ animation: 'porraHeroFadeIn 320ms cubic-bezier(0.34,1.2,0.64,1) both' }}
    >
      <div
        className="relative overflow-hidden rounded-2xl p-4 sm:p-5"
        style={{
          background:
            'linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0.06) 45%, rgba(249,115,22,0.14) 100%)',
          border: '1px solid rgba(124,58,237,0.35)',
          boxShadow: '0 0 32px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Glow decorativo */}
        <div aria-hidden style={{
          position: 'absolute', top: -40, right: -40, width: 220, height: 220,
          background: 'radial-gradient(circle, rgba(249,115,22,0.22) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          {/* Bloque izquierdo: identidad + countdown */}
          <div className="flex-shrink-0 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1">
            <div className="flex items-center gap-2">
              <span aria-hidden style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: countdown.urgent ? '#EF4444' : '#F97316',
                boxShadow: `0 0 10px ${countdown.urgent ? '#EF4444' : '#F97316'}`,
                animation: 'porraHeroPulse 1.4s ease-in-out infinite',
              }} />
              <span style={{
                fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 18,
                color: '#fff', letterSpacing: '0.02em',
              }}>
                Predicciones
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                padding: '3px 7px', borderRadius: 4,
                background: 'rgba(124,58,237,0.22)', color: '#C4B5FD',
                fontFamily: 'var(--font-sport)',
              }}>
                {status.jornada.toUpperCase()}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: countdown.urgent ? '#FCA5A5' : 'rgba(255,255,255,0.7)',
                fontFamily: 'var(--font-sport)', letterSpacing: '0.02em',
              }}>
                {alreadyPlayed ? 'Cierra en' : 'Cierra en'} {countdown.value}
              </span>
            </div>
            {/* Streak (M) + participantes (L): chips de social proof / engagement.
                Solo aparecen si los datos llegan; degradan silenciosamente. */}
            {((status.streakCurrent ?? 0) >= 2 || (status.weeklyParticipants ?? 0) >= 5) && (
              <div className="flex items-center gap-2 flex-wrap">
                {(status.streakCurrent ?? 0) >= 2 && (
                  <span
                    title="Jornadas consecutivas selladas"
                    style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                      padding: '2px 7px', borderRadius: 4,
                      background: 'rgba(251,191,36,0.18)', color: '#FDE68A',
                      border: '1px solid rgba(251,191,36,0.32)',
                      fontFamily: 'var(--font-sport)',
                    }}
                  >
                    <FireIcon size={11} className="inline-block align-middle mr-1" />{status.streakCurrent} en racha
                  </span>
                )}
                {(status.weeklyParticipants ?? 0) >= 5 && (
                  <span
                    title="Jugadores que ya han sellado esta jornada"
                    style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                      color: 'rgba(255,255,255,0.55)',
                      fontFamily: 'var(--font-sport)',
                    }}
                  >
                    · {formatParticipants(status.weeklyParticipants ?? 0)} jugando
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bloque central: 3 partidos top */}
          {matches.length > 0 && (
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              {matches.map((m, i) => (
                <MatchRow
                  key={`${m.home}-${m.away}-${i}`}
                  m={m}
                  pickStatus={computePickStatus(m, status.userPicks, liveScores)}
                />
              ))}
            </div>
          )}

          {/* CTA derecho */}
          <div className="flex-shrink-0 flex sm:flex-col items-stretch gap-2 sm:min-w-[160px]">
            <Link
              href="/predicciones"
              onClick={handleHeroCtaClick}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap"
              style={{
                background: alreadyPlayed
                  ? 'rgba(34,197,94,0.18)'
                  : 'linear-gradient(135deg, #7C3AED 0%, #F97316 100%)',
                border: alreadyPlayed
                  ? '1px solid rgba(34,197,94,0.45)'
                  : '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                fontFamily: 'var(--font-sport)',
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.04em',
                textDecoration: 'none',
                boxShadow: alreadyPlayed
                  ? '0 0 14px rgba(34,197,94,0.18)'
                  : '0 6px 18px rgba(124,58,237,0.35)',
                flex: 1,
              }}
            >
              {alreadyPlayed
                ? `✓ TU PORRA · ${status.picksCount}/${status.totalMatches}`
                : status.isAuthed ? 'PONER PORRA' : 'JUGAR GRATIS'}
            </Link>
            {!alreadyPlayed && status.totalMatches > 0 && (
              <span
                className="text-center"
                style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'var(--font-sport)', letterSpacing: '0.04em',
                }}
              >
                {status.totalMatches} partidos · 1 X 2
              </span>
            )}
            {/* Botón "Avísame" — push para recordatorio T-60min. Soft-ask
                primero (J): mostramos un mini-prompt explicativo antes de
                disparar el permiso nativo. Reduce denials irreversibles. */}
            {offerPush && !pushAsking && (
              <button
                type="button"
                onClick={handleOpenPushAsk}
                aria-label="Avísame antes del cierre"
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap"
                style={{
                  background: 'rgba(124,58,237,0.14)',
                  border: '1px solid rgba(124,58,237,0.35)',
                  color: '#C4B5FD',
                  fontFamily: 'var(--font-sport)',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M6 1.5a3 3 0 00-3 3v2.25l-1 1.5h8l-1-1.5V4.5a3 3 0 00-3-3zM5 10a1 1 0 002 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                AVÍSAME
              </button>
            )}
            {pushAsking && (
              <div
                className="flex flex-col gap-2 p-3 rounded-xl"
                style={{
                  background: 'rgba(124,58,237,0.12)',
                  border: '1px solid rgba(124,58,237,0.35)',
                  animation: 'porraSoftAskIn 200ms cubic-bezier(0.34,1.4,0.64,1) both',
                }}
              >
                <p style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.85)',
                  margin: 0, lineHeight: 1.35,
                  fontFamily: 'var(--font-sport)',
                }}>
                  Te avisamos <strong>1h antes</strong> del cierre para que no te quedes fuera. Sin spam.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmPush}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: 8,
                      background: 'linear-gradient(135deg, #7C3AED 0%, #F97316 100%)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: '#fff',
                      fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
                      letterSpacing: '0.06em', cursor: 'pointer',
                    }}
                  >
                    SÍ, AVÍSAME
                  </button>
                  <button
                    type="button"
                    onClick={handleDeferPush}
                    style={{
                      padding: '6px 10px', borderRadius: 8,
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.14)',
                      color: 'rgba(255,255,255,0.55)',
                      fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 800,
                      letterSpacing: '0.06em', cursor: 'pointer',
                    }}
                  >
                    AHORA NO
                  </button>
                </div>
              </div>
            )}
            {pushStatus === 'subscribed' && !alreadyPlayed && (
              <span
                className="text-center"
                style={{
                  fontSize: 9, color: '#86EFAC',
                  fontFamily: 'var(--font-sport)', letterSpacing: '0.06em',
                  fontWeight: 700,
                }}
              >
                ✓ TE AVISAMOS ANTES DEL CIERRE
              </span>
            )}
            {/* Botón "Invitar amigos" — low-key pero presente. Aprovecha la
                semántica social de la porra (tradicionalmente se comparte en
                WhatsApp). En móvil dispara navigator.share; en desktop copia. */}
            <button
              type="button"
              onClick={handleShare}
              aria-label="Invitar amigos a Predicciones"
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap"
              style={{
                background: shareCopied
                  ? 'rgba(34,197,94,0.16)'
                  : 'rgba(255,255,255,0.06)',
                border: shareCopied
                  ? '1px solid rgba(34,197,94,0.4)'
                  : '1px solid rgba(255,255,255,0.12)',
                color: shareCopied ? '#86EFAC' : 'rgba(255,255,255,0.75)',
                fontFamily: 'var(--font-sport)',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                transition: 'background 200ms, border 200ms, color 200ms',
              }}
            >
              {shareCopied ? '✓ ENLACE COPIADO' : (
                <>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <path d="M8.5 4.5L10 3l-4-2.5L2 3l1.5 1.5M8.5 7.5L10 9l-4 2.5L2 9l1.5-1.5M6 1v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  INVITAR AMIGOS
                </>
              )}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes porraHeroPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%      { opacity: 0.55; transform: scale(0.8); }
          }
          @keyframes porraHeroFadeIn {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes porraSoftAskIn {
            from { opacity: 0; transform: translateY(-4px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes porraLivePulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.7; }
          }
        `}</style>
      </div>
    </section>
  )
}
