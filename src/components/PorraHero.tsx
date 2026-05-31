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

const STORAGE_KEY = 'porra:status:v1'
const TTL_MS = 60_000
const MAX_DAYS_AHEAD = 7

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

function MatchRow({ m }: { m: PorraMatch }) {
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
      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
        {m.featured && (
          <span
            title="Partido destacado · Bonus goleador"
            style={{
              fontSize: 9, fontWeight: 900, letterSpacing: '0.06em',
              padding: '2px 6px', borderRadius: 3,
              background: 'rgba(251,191,36,0.22)', color: '#FDE68A',
              border: '1px solid rgba(251,191,36,0.4)',
              fontFamily: 'var(--font-sport)',
            }}
          >
            ⭐ DESTACADO
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
  // Arranca null en SSR/hidratación inicial. Carga real en useEffect para
  // evitar hydration mismatch (Date.now y sessionStorage solo en cliente).
  const [status, setStatus] = useState<PorraStatus | null>(null)
  const [, setTick] = useState(0)
  const [shareCopied, setShareCopied] = useState(false)
  const { status: pushStatus, subscribe: subscribePush } = usePushSubscription()

  useEffect(() => {
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
      .catch(() => { /* silencioso */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!status?.deadline) return
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [status?.deadline])

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
  // permiso no denegado. Para no entrenarles a ignorar prompts.
  const offerPush =
    pushStatus === 'idle' &&
    !alreadyPlayed &&
    new Date(status.deadline).getTime() > Date.now() + 60 * 60_000

  async function handleSubscribePush() {
    await subscribePush()
    trackPorraCtaClick({
      surface: 'home_hero',
      state: userState,
      jornada: status?.jornada ?? null,
    })
  }

  // Share: navigator.share nativo en móvil + fallback a copy.
  async function handleShare() {
    const jornadaName = status?.jornada
    const text = jornadaName
      ? `La Porra de TakaSports — ${jornadaName}. ${status?.totalMatches ?? 0} partidos, juega gratis 👇`
      : 'La Porra de TakaSports — juega gratis 👇'
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/predicciones`
      : 'https://takasportsmedia.com/predicciones'
    try {
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
      if (nav.share) {
        await nav.share({ title: 'La Porra · TakaSports', text, url })
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
      aria-label="La Porra — jornada activa"
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
                La Porra
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
          </div>

          {/* Bloque central: 3 partidos top */}
          {matches.length > 0 && (
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              {matches.map((m, i) => (
                <MatchRow key={`${m.home}-${m.away}-${i}`} m={m} />
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
            {/* Botón "Avísame" — push para recordatorio T-60min. Solo cuando
                tiene sentido (idle + no jugado + deadline >1h). Una vez
                suscrito, desaparece. Si denegó permiso, también desaparece. */}
            {offerPush && (
              <button
                type="button"
                onClick={handleSubscribePush}
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
              aria-label="Invitar amigos a La Porra"
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
        `}</style>
      </div>
    </section>
  )
}
