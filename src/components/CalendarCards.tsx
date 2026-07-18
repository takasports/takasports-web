'use client'

// Componentes de presentación del calendario: logos, filas de partido, cabeceras de
// competición, hero en vivo, separadores. Extraído del monolito CalendarioContent.

import type { LiveScore } from './calendar-live'
import { memo, useRef, useState } from 'react'
import Link from 'next/link'
import type { SportEvent } from '@/lib/types'
import { getLiveLabel, isCombat, isRacing, isTennis } from '@/lib/competitions'
import { getBroadcastForTz, isSplitBroadcast } from '@/lib/broadcasts'
import { formatDateLabel, isoToLocalDate } from '@/lib/calendar'
import { SOURCE_TZ, convertEventTime } from '@/lib/timezone'
import { COMPETITIONS } from '@/lib/calendar-competitions'
import { accentForSport } from '@/lib/sports'
import { isLiveStatus } from '@/lib/live-events'
import { F1Icon, SportIcon, TennisIcon, TvIcon } from '@/components/icons/GameIcons'

// ─── Utilities ────────────────────────────────────────────────────────────
export function TeamLogo({ logo, photo, name, size = 24, sport, accent, abbr }: { logo?: string; photo?: string; name: string; size?: number; sport?: string; accent?: string; abbr?: string }) {
  const [err, setErr] = useState(false)
  const displayPhoto = photo && !err

  if (displayPhoto) {
    return (
      <img src={photo} alt={name} width={size} height={size} onError={() => setErr(true)}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }} />
    )
  }

  if (!logo || err) {
    // FASE 3: escudo de respaldo = CUADRADO REDONDEADO tintado con el acento del
    // deporte e iniciales en ese color (maqueta: "nunca un círculo gris vacío").
    // Si el llamador pasa `accent`, se usa ese sistema (espejo del TeamCrest de la
    // app); si no, se conserva el respaldo antiguo para otros consumidores.
    if (accent) {
      return (
        <div className="flex items-center justify-center font-black flex-shrink-0"
          style={{
            width: size, height: size,
            borderRadius: Math.round(size * 0.28),
            fontSize: size * 0.34,
            letterSpacing: 0.2,
            background: `${accent}1A`,
            color: accent,
            border: `1px solid ${accent}4D`,
          }}>
          {crestInitials(abbr, name)}
        </div>
      )
    }
    const tennis = sport ? isTennis(sport) : false
    const combat = sport ? isCombat(sport) : false
    return (
      <div className="flex items-center justify-center rounded-full font-black flex-shrink-0"
        style={{
          width: size, height: size,
          fontSize: size * 0.36,
          background: combat ? 'rgba(212,175,55,0.14)' : tennis ? 'rgba(217,119,6,0.14)' : 'rgba(255,255,255,0.06)',
          color: combat ? '#D4AF37' : tennis ? '#FBBF24' : '#7A7A8E',
          border: combat ? '1px solid rgba(212,175,55,0.25)' : tennis ? '1px solid rgba(251,191,36,0.25)' : 'none',
        }}>
        {combat || tennis ? initials(name) : name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    <img src={logo} alt={name} width={size} height={size} onError={() => setErr(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
  )
}

// Initials from a player name: "Carlos Alcaraz" → "CA", "Heliovaara / Patten" → "HP"
export function initials(name: string): string {
  const cleaned = name.replace(/\s*\/\s*/g, ' ').trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Iniciales tintadas del escudo de respaldo (hasta 3 letras, prioriza el abbr).
// Espejo de crestInitials de la app: "RM" / "FCB" / "MCI"…
export function crestInitials(abbr?: string, name?: string): string {
  const a = (abbr ?? '').trim()
  if (a) return a.slice(0, 3).toUpperCase()
  const parts = (name ?? '').replace(/\s*\/\s*/g, ' ').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase()
  return parts.map((w) => w[0]).slice(0, 3).join('').toUpperCase()
}

// Truncate-friendly short name (last word for multi-word names)
export function shortName(name: string | null | undefined, abbr?: string): string {
  if (!name) return ''
  if (abbr) return abbr
  const words = name.split(' ')
  return words.length > 1 ? words[words.length - 1] : name
}

// ─── Hero Card (live ticker) ──────────────────────────────────────────────
export interface HeroProps {
  homeTeam: string
  awayTeam: string
  homeAbbr?: string
  awayAbbr?: string
  homeLogo?: string
  awayLogo?: string
  homePhoto?: string
  awayPhoto?: string
  homeScore: number | null
  awayScore: number | null
  status: string
  elapsed: number | null
  sport: string
  comp?: string
  matchRef?: string
  broadcast?: string
  tz?: string
  flashing?: boolean
  isReminded: boolean
  onToggleReminder: () => void
}

export function LiveHeroCard(p: HeroProps) {
  // FASE 3: comp en el color POR DEPORTE (fallback rojo del ticker en vivo).
  const compColor = accentForSport(p.sport, '#FF4D2E')
  const tennis = isTennis(p.sport)
  const racing = isRacing(p.sport)
  const liveLabel = getLiveLabel(p.status, p.elapsed, {
    sport: p.sport,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
  })

  const inner = (
    <div
      className={`cal-card cal-card--live rounded-xl flex flex-col hover:brightness-110 ${p.flashing ? 'ts-flash' : ''}`}
      style={{
        ['--row-accent' as string]: '#FF4D2E',
        width: 300,
        flexShrink: 0,
        background: 'linear-gradient(145deg, rgba(255,77,46,0.10) 0%, rgba(28,20,18,0.85) 60%, rgba(15,15,22,0.9) 100%)',
        border: '1px solid rgba(255,77,46,0.25)',
      }}
    >
      {/* Halo animado */}
      <span aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,77,46,0.18) 0%, transparent 70%)', filter: 'blur(8px)' }} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="cal-live-tag flex items-center gap-1 pl-1.5 pr-2.5 py-0.5 text-[8.5px] font-black uppercase"
            style={{ background: 'rgba(255,77,46,0.18)', color: '#FF4D2E', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em' }}>
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#FF4D2E', boxShadow: '0 0 6px #FF4D2E' }} />
            EN VIVO
          </span>
          {tennis && <span style={{ color: '#d97706' }}><TennisIcon size={10} /></span>}
          <span className="text-[8.5px] font-bold uppercase tracking-wider truncate"
            style={{ color: compColor, fontFamily: 'var(--font-sport)', maxWidth: 140 }}>
            {p.comp}
          </span>
        </div>
        <span className="text-[8.5px] font-black uppercase tabular-nums px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: '#FF4D2E', background: 'rgba(255,77,46,0.10)', fontFamily: 'var(--font-display)' }}>
          {liveLabel}
        </span>
      </div>

      {/* Body: Home — Score — Away */}
      <div className="relative flex items-center px-3.5 py-3 gap-2">
        {/* Home */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <TeamLogo logo={p.homeLogo} photo={p.homePhoto} name={p.homeTeam} size={36} sport={p.sport} />
          <span className="text-[10px] font-black truncate w-full text-center" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {shortName(p.homeTeam, p.homeAbbr)}
          </span>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 px-1 gap-0.5">
          {racing ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] inline-flex items-center gap-1"
                style={{ color: '#FF4D2E', fontFamily: 'var(--font-sport)' }}>
                <F1Icon size={11} /> EN CARRERA
              </span>
              <span className="text-[11px] font-bold text-center"
                style={{ color: '#C0C0D4', fontFamily: 'var(--font-sport)', maxWidth: 80 }}>
                {p.comp}
              </span>
            </div>
          ) : (
            <>
              {tennis && (
                <span className="text-[8px] font-black uppercase tracking-[0.2em]"
                  style={{ color: '#FBBF24', fontFamily: 'var(--font-sport)' }}>
                  Sets
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className="font-black tabular-nums leading-none"
                  style={{ fontSize: 28, color: '#FF4D2E', fontFamily: 'var(--font-display)', textShadow: '0 0 12px rgba(255,77,46,0.4)' }}>
                  {p.homeScore ?? 0}
                </span>
                <span className="text-[16px] font-light leading-none" style={{ color: '#3A3A4A' }}>—</span>
                <span className="font-black tabular-nums leading-none"
                  style={{ fontSize: 28, color: '#FF4D2E', fontFamily: 'var(--font-display)', textShadow: '0 0 12px rgba(255,77,46,0.4)' }}>
                  {p.awayScore ?? 0}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Away */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <TeamLogo logo={p.awayLogo} photo={p.awayPhoto} name={p.awayTeam} size={36} sport={p.sport} />
          <span className="text-[10px] font-black truncate w-full text-center" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {shortName(p.awayTeam, p.awayAbbr)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="relative flex items-center justify-between px-3.5 pb-3 pt-1 gap-2 border-t" style={{ borderColor: 'rgba(255,77,46,0.12)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] font-semibold uppercase tracking-wider truncate" style={{ color: '#7A8A7E', fontFamily: 'var(--font-sport)' }}>
            {p.matchRef ? 'Ver detalles →' : p.sport}
          </span>
          <BroadcastChip comp={p.comp ?? ''} sport={p.sport} tz={p.tz} fallback={p.broadcast} />
        </div>
        {/* Sin campana de recordatorio: el partido YA está en vivo (M22). */}
      </div>
    </div>
  )

  return p.matchRef
    ? <Link href={`/partido/${p.matchRef}`} className="block no-underline">{inner}</Link>
    : inner
}

// ─── Favorite heart (toggles team in localStorage favorites) ──────────────
export function FavoriteHeart({ active, onClick, size = 16 }: {
  active: boolean
  onClick: () => void
  size?: number
}) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      className="flex items-center justify-center transition-all flex-shrink-0"
      style={{ width: 34, height: 34, cursor: 'pointer', background: 'transparent', border: 'none' }}
      aria-label={active ? 'Quitar de favoritos' : 'Añadir a favoritos'}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" fill={active ? '#F472B6' : 'none'}>
        <path d="M8 13.5s-5-3-5-7a3 3 0 015-2 3 3 0 015 2c0 4-5 7-5 7z"
          stroke={active ? '#F472B6' : '#5A5A6A'} strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// ─── Broadcast chip (where to watch) ──────────────────────────────────────
export function BroadcastChip({ comp, sport, tz, fallback }: {
  comp: string
  sport?: string
  tz?: string
  /** Canal de la fuente original (ESPN US) — solo si no hay dato local */
  fallback?: string
}) {
  // Primero intenta el canal del país del usuario; si no hay, usa el fallback
  const channel = getBroadcastForTz(comp, sport ?? '', tz ?? SOURCE_TZ) ?? fallback
  if (!channel) return null
  const split = isSplitBroadcast(channel)
  return (
    <span
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide"
      style={{
        background: split ? 'rgba(251,191,36,0.08)' : 'rgba(99,102,241,0.10)',
        color:      split ? '#D4A017'               : '#A5B4FC',
        border:     split ? '1px solid rgba(251,191,36,0.22)' : '1px solid rgba(99,102,241,0.20)',
        fontFamily: 'var(--font-sport)',
      }}
      title={split ? 'Los derechos de emisión están repartidos entre varios canales' : undefined}
    >
      <span className="inline-flex items-center"><TvIcon size={11} /></span>
      <span className="truncate max-w-[110px]">{channel}</span>
    </span>
  )
}

// Config de competición (página + escudo) para un grupo del feed, si existe.
// Match PRECISO (no substring) para no enlazar mal: nombre exacto de la comp
// (ligas de fútbol) o deporte exacto (NBA/F1/UFC). Así "Premier Padel" no cae
// en Premier League ni "LaLiga 2" en LaLiga.
export function compConfigForGroup(comp: string, sport?: string) {
  const cl = comp.trim().toLowerCase()
  const sl = sport?.trim().toLowerCase()
  return COMPETITIONS.find((c) =>
    (c.matchComp && c.matchComp.toLowerCase() === cl) ||
    (c.matchSport && sl && c.matchSport.toLowerCase() === sl)
  ) ?? null
}

// ─── Competition sub-header ───────────────────────────────────────────────
// Si la competición tiene página propia, la cabecera lleva su escudo oficial y
// es un enlace a /calendario/[slug] (anclaje visual + descubrimiento).
export function CompGroupHeader({ comp, accent, count, first, crest, slug, banner, pinned, onTogglePin }: {
  comp: string; accent: string; count: number; first?: boolean; crest?: string; slug?: string
  banner?: string; pinned?: boolean; onTogglePin?: () => void
}) {
  const inner = (
    <div className={`relative px-2 pb-2 ${first ? 'pt-1' : 'pt-4'}`}>
      {/* Backdrop sutil de la competición (broadcast): la foto asoma muy tenue
          por la derecha; un scrim la apaga sobre el lado del texto. Solo en las
          competiciones con banner; el resto mantiene la cabecera lisa de antes. */}
      {banner && (
        <div className="absolute left-0 right-0 rounded-lg overflow-hidden pointer-events-none" style={{ top: first ? 2 : 12, bottom: 2, zIndex: 0 }} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" aria-hidden="true" loading="lazy" decoding="async"
            className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.4, objectPosition: '85% 36%' }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, var(--bg-base) 6%, color-mix(in srgb, ${accent} 9%, rgba(10,10,18,0.82)) 46%, rgba(10,10,18,0.34) 100%)` }} />
        </div>
      )}
      <div className="relative flex items-center gap-2.5" style={{ zIndex: 1 }}>
        <span className="block flex-shrink-0 rounded-sm" style={{ width: 3, height: 14, background: accent, boxShadow: `0 0 8px ${accent}66` }} />
        {crest && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={crest} alt="" aria-hidden="true" width={16} height={16} loading="lazy" decoding="async"
            style={{ objectFit: 'contain', width: 16, height: 16, flexShrink: 0 }} />
        )}
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] truncate flex-1" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
          {comp}
        </span>
        {pinned && (
          <span className="text-[8px] font-black uppercase tracking-wider flex-shrink-0" style={{ color: accent, fontFamily: 'var(--font-sport)', opacity: 0.85 }}>
            Fijada
          </span>
        )}
        {onTogglePin && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin() }}
            aria-label={pinned ? `Dejar de fijar ${comp}` : `Fijar ${comp} arriba`}
            aria-pressed={!!pinned}
            className="flex items-center justify-center flex-shrink-0 rounded-md transition-all"
            style={{ width: 24, height: 24, cursor: 'pointer', background: pinned ? `${accent}22` : 'transparent', border: 'none' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? accent : 'none'} stroke={pinned ? accent : '#6A6A80'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <path d="M12 2.5l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 16.8 6.4 19.7l1.1-6.2L3 9.1l6.2-.9L12 2.5z" />
            </svg>
          </button>
        )}
        {slug && (
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" aria-hidden style={{ opacity: 0.95 }}>
            <path d="M4.5 2L8 6l-3.5 4" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="text-[9px] font-bold tabular-nums px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}30`, fontFamily: 'var(--font-sport)' }}>
          {count}
        </span>
      </div>
    </div>
  )
  return slug
    ? <Link href={`/calendario/${slug}`} prefetch={false} className="block no-underline transition-all hover:brightness-125" aria-label={`Ver calendario de ${comp}`}>{inner}</Link>
    : inner
}

// Cara del jugador (headshot de ESPN, redonda) o escudo (fútbol, cuadrado) que flanquea el
// marcador en la fila. Prioriza la FOTO (tenis); si falla o no hay, el escudo; si tampoco,
// NADA (la fila muestra solo el nombre — sin siglas raras). Aro tintado del acento (más si fav).
export function MatchCrest({ photo, logo, accent, fav }: { photo?: string; logo?: string; accent: string; fav?: boolean }) {
  const [photoErr, setPhotoErr] = useState(false)
  const [logoErr, setLogoErr] = useState(false)
  if (photo && !photoErr) {
    return (
      <span className="inline-flex flex-shrink-0 rounded-full" style={{ boxShadow: `0 0 0 1.5px ${fav ? accent : `color-mix(in srgb, ${accent} 55%, transparent)`}` }}>
        <img src={photo} alt="" width={26} height={26} onError={() => setPhotoErr(true)} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
      </span>
    )
  }
  if (logo && !logoErr) {
    return (
      <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 20, height: 20, borderRadius: 6, border: fav ? `1.5px solid ${accent}` : '1.5px solid transparent' }}>
        <img src={logo} alt="" width={18} height={18} onError={() => setLogoErr(true)} style={{ width: 18, height: 18, objectFit: 'contain' }} />
      </span>
    )
  }
  return null
}

// ─── Compact list row (una línea + canal) — paridad con la app compacta (§4) ──
// FASE compacto (2026-07-10): fila de UNA LÍNEA en VIDRIO, espejo EXACTO de la app.
// Equipo · hora/marcador · equipo + canal fino debajo → máxima densidad (revierte la
// tarjeta vertical de la Fase 3). Espina de acento por deporte, pastilla EN VIVO/
// Descanso/Final, velada UFC parseada (título en la ceja + "vs"), evento F1/golf a lo
// ancho. Favorito = anillo en el escudo (se gestiona en "Mis equipos", como la app).
// Recordatorio = campana mínima arriba-dcha SOLO en próximos (la web no tiene toque
// largo). Conserva onClickUFC (modal cartelera), liveScore, tz y la agrupación por liga.
export function MatchRowInner({ event, liveScore, isReminded, onToggleReminder, dateLabel, onClickUFC, flashing, homeFav, awayFav, showComp, tz }: {
  event: SportEvent
  liveScore?: LiveScore
  isReminded: boolean
  onToggleReminder: () => void
  dateLabel?: string
  onClickUFC?: (date: string) => void
  flashing?: boolean
  isFav?: boolean
  /** Favorito por-equipo (anillo del acento en el escudo). Si no llega, cae en isFav. */
  homeFav?: boolean
  awayFav?: boolean
  onToggleFav?: () => void
  formHome?: ('W'|'D'|'L')[]
  formAway?: ('W'|'D'|'L')[]
  showComp?: boolean
  showReason?: boolean
  tz?: string
}) {
  // Hora del partido (origen Madrid) convertida a la zona horaria del usuario.
  const displayTime = tz && tz !== SOURCE_TZ ? convertEventTime(event.time, tz, event.isoDate) : event.time
  const isLive = !!liveScore && isLiveStatus(liveScore.status)
  // Días pasados (timeline continuo): el marcador viaja en el propio evento.
  const pastHasScore = event.homeScore != null && event.awayScore != null
  const finishedPast = !liveScore && (event.isPast === true || pastHasScore)
  const homeScoreVal = liveScore ? liveScore.homeGoals : (event.homeScore ?? null)
  const awayScoreVal = liveScore ? liveScore.awayGoals : (event.awayScore ?? null)
  const isFinal = (!!liveScore && (liveScore.status === 'FT' || liveScore.status === 'Final' || liveScore.status === 'STATUS_FINAL') && liveScore.homeGoals !== null) || (finishedPast && pastHasScore)
  // Finalizado también para F1/UFC pasados (sin marcador, solo isPast) → "Final".
  const finished = !isLive && (isFinal || event.isPast === true)
  const hFav = homeFav ?? false
  const aFav = awayFav ?? false
  const combat = isCombat(event.sport)
  const racing = isRacing(event.sport)
  // Identidad por DEPORTE (verde fútbol, ámbar básket…); default morado #A78BFA.
  const accent = accentForSport(event.sport, '#A78BFA')

  // Marcador numérico solo en deportes con marcador (nada en F1/MMA).
  const showScore = (isLive || isFinal) && !racing && !combat
  const hg = homeScoreVal ?? 0
  const ag = awayScoreVal ?? 0
  const homeLead = showScore && hg > ag
  const awayLead = showScore && ag > hg
  const dimHome = (finished || isLive) && awayLead
  const dimAway = (finished || isLive) && homeLead

  // Estado en vivo (sport-aware): "63'", "Q3 · 5'", "Set 3", "Descanso"…
  const liveLabel = isLive && liveScore
    ? getLiveLabel(liveScore.status, liveScore.elapsed, { sport: event.sport, homeScore: liveScore.homeGoals, awayScore: liveScore.awayGoals })
    : ''
  const paused = liveLabel === 'Descanso' || liveLabel === 'Intervalo'
  // Ganador de una carrera/velada terminada (deportes sin marcador).
  const winnerNote = !isLive && (combat || racing) && event.resultNote ? event.resultNote : null

  const home = event.home ?? ''
  const away = event.away ?? ''
  const compLabel = (event.comp ?? '').trim()

  // Evento de un solo lado (F1/golf: sin rival) o velada UFC (home = "UFC 329: A vs B")
  // → se parsea a matchup + título para que se vea el "vs" Y el título.
  const noAway = !away.trim()
  const vsParse = noAway ? /^(.*?):\s*(.+?)\s+vs\.?\s+(.+)$/i.exec(home.trim()) : null
  const rawHome = vsParse ? vsParse[2].trim() : home
  const rawAway = vsParse ? vsParse[3].trim() : away
  // En tenis/pádel los nombres vienen completos (Alexander Zverev) y no caben en la
  // fila compacta con la cápsula en medio → usamos el nombre corto (apellido).
  const tennis = isTennis(event.sport)
  const dispHome = tennis ? shortName(rawHome, event.homeAbbr) : rawHome
  const dispAway = tennis ? shortName(rawAway, event.awayAbbr) : rawAway
  const parsedTitle = vsParse ? vsParse[1].trim() : undefined
  const isMatchup = !racing && !!dispAway.trim()

  const kickoff = displayTime || ''
  const centerTxt = showScore ? `${homeScoreVal ?? 0} – ${awayScoreVal ?? 0}` : (kickoff || (isMatchup ? 'VS' : ''))

  // Canal de TV localizado según la zona horaria elegida (espejo de la app).
  const channel = getBroadcastForTz(compLabel, event.sport ?? '', tz ?? SOURCE_TZ) ?? event.broadcast

  // Recordatorio solo para PRÓXIMOS con ficha y fecha futura.
  const kickoffMs = event.isoDate ? new Date(event.isoDate).getTime() : NaN
  const canRemind = !isLive && !finished && !!event.matchRef && !Number.isNaN(kickoffMs) && kickoffMs > Date.now()
  const eventDate = event.isoDate ? isoToLocalDate(event.isoDate, tz) : null

  // Ceja: título de velada UFC parseado, o competición (vista Recordatorios).
  const eyebrowText = parsedTitle || (showComp && compLabel ? compLabel : '')
  // Hueco a la derecha para no chocar con la pastilla/campana absolutas.
  // El estado ya NO va en la esquina (pasa a ceja centrada) → el marcador queda CENTRADO;
  // solo reservamos hueco a la dcha para la campana de recordatorio en próximos.
  const contentPadRight = canRemind ? 24 : 0

  // Cara del jugador (tenis) o escudo (fútbol) que flanquea el marcador. Si no hay ni
  // foto ni escudo → nada (solo el nombre); ya NO se muestran siglas raras (José Tomás).
  const crest = (logo: string | undefined, photo: string | undefined, fav: boolean) => (
    <MatchCrest photo={photo} logo={logo} accent={accent} fav={fav} />
  )

  // Cápsula de marcador (vidrio esmerilado): marcador blanco (vivo/final) o hora en el
  // acento (próximos). Es el foco central de la tarjeta — la mezcla aprobada (G2).
  const scoreCapsule = (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        minWidth: 54,
        padding: '2.5px 11px',
        borderRadius: 10,
        background: showScore ? 'rgba(0,0,0,0.34)' : `color-mix(in srgb, ${accent} 12%, rgba(0,0,0,0.3))`,
        border: `1px solid ${showScore ? 'rgba(255,255,255,0.14)' : `color-mix(in srgb, ${accent} 40%, rgba(255,255,255,0.14))`}`,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <span className="tabular-nums" style={{ fontSize: showScore ? 20 : 15, fontFamily: 'var(--font-sport)', fontWeight: 900, letterSpacing: showScore ? '0.04em' : 0, color: showScore ? '#fff' : accent, textShadow: showScore ? '0 1px 8px rgba(0,0,0,0.4)' : undefined }}>
        {centerTxt}
      </span>
    </span>
  )

  const inner = (
    <div
      className={`relative overflow-hidden hover:brightness-110 transition-[filter] duration-150 ${flashing ? 'ts-flash' : ''}`}
      style={{
        borderRadius: 15,
        padding: '11px 13px 11px 14px',
        // VIDRIO TAKA teñido por deporte: velo translúcido + tinte del acento + canto de
        // luz specular arriba + sombra que la hace FLOTAR (separa las tarjetas). En vivo = rojo.
        background: isLive
          ? 'linear-gradient(158deg, rgba(255,59,59,0.16) 0%, rgba(255,255,255,0.026) 46%, rgba(255,255,255,0.012) 100%)'
          : `linear-gradient(158deg, color-mix(in srgb, ${accent} 15%, rgba(255,255,255,0.05)) 0%, rgba(255,255,255,0.028) 46%, rgba(255,255,255,0.015) 100%)`,
        border: `1px solid ${isLive ? 'rgba(255,59,59,0.4)' : 'rgba(255,255,255,0.12)'}`,
        borderTopColor: isLive ? 'rgba(255,59,59,0.5)' : 'rgba(255,255,255,0.28)',
        borderLeft: `4px solid ${isLive ? '#FF3B3B' : accent}`,
        boxShadow: '0 10px 24px -10px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -14px 22px -16px rgba(0,0,0,0.45)',
      }}
    >
      {/* Luz refractada (blob) — el toque líquido, teñido del deporte */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ top: -40, left: -10, width: 150, height: 110, background: `radial-gradient(60% 60% at 30% 40%, ${isLive ? 'rgba(255,59,59,0.3)' : `color-mix(in srgb, ${accent} 26%, transparent)`}, transparent 70%)`, filter: 'blur(6px)', opacity: 0.7 }}
      />
      {/* Brillo specular del borde superior */}
      <div aria-hidden className="pointer-events-none absolute" style={{ top: 0, left: 0, right: 0, height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,0.07), transparent)', borderRadius: '15px 15px 0 0' }} />

      {/* Recordatorio (campana) arriba-dcha SOLO en próximos. El estado (EN VIVO/Final)
          ya NO va en la esquina: pasa a una ceja CENTRADA encima del marcador (Opción A). */}
      {canRemind ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleReminder() }}
          className="absolute z-[2] flex items-center justify-center rounded-full transition-colors"
          style={{ top: 6, right: 7, width: 22, height: 22 }}
          aria-label={isReminded ? 'Quitar recordatorio' : 'Recordar'}
          title={isReminded ? 'Quitar recordatorio' : 'Recordar'}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5A4.5 4.5 0 003.5 6v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 008 1.5z" stroke={isReminded ? accent : '#6A6A7A'} strokeWidth="1.3" fill={isReminded ? accent : 'none'} fillOpacity={isReminded ? 0.25 : 0} />
          </svg>
        </button>
      ) : null}

      <div className="relative" style={{ zIndex: 1, paddingRight: contentPadRight }}>
        {/* Ceja CENTRADA encima del marcador: estado (EN VIVO·min / DESCANSO / FINAL) +
            fecha (Recordatorios) + título de velada / competición. */}
        {(isLive || finished || eyebrowText || dateLabel) ? (
          <div className="flex items-center justify-center gap-1.5" style={{ marginBottom: 5 }}>
            {dateLabel ? (
              <span className="flex-shrink-0 rounded-full" style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '1px 6px', color: accent, background: `${accent}14`, border: `1px solid ${accent}30`, fontFamily: 'var(--font-sport)' }}>
                {dateLabel}
              </span>
            ) : null}
            {isLive && !paused ? (
              <span className="inline-flex items-center gap-1 rounded-full flex-shrink-0" style={{ padding: '2.5px 8px', background: 'rgba(255,59,59,0.2)', border: '1px solid rgba(255,59,59,0.5)', boxShadow: '0 0 10px rgba(255,59,59,0.2)' }}>
                <span className="rounded-full" style={{ width: 5, height: 5, background: '#fff', boxShadow: '0 0 6px #fff', animation: 'live-pulse 1.6s ease-out infinite' }} />
                <span className="text-[8.5px] font-black uppercase tracking-[0.05em] tabular-nums" style={{ color: '#fff', fontFamily: 'var(--font-sport)' }}>
                  {liveLabel && liveLabel !== 'EN VIVO' ? `EN VIVO · ${liveLabel}` : 'EN VIVO'}
                </span>
              </span>
            ) : paused ? (
              <span className="text-[8.5px] font-black uppercase tracking-[0.05em] rounded-full flex-shrink-0" style={{ padding: '2.5px 9px', color: '#FBBF24', background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.3)', fontFamily: 'var(--font-sport)' }}>
                {liveLabel}
              </span>
            ) : finished ? (
              <span className="text-[8.5px] font-black uppercase tracking-[0.06em] rounded-full flex-shrink-0" style={{ padding: '2.5px 9px', color: '#9A9AAE', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-sport)' }}>
                Final
              </span>
            ) : null}
            {eyebrowText ? (
              <span className="truncate" style={{ fontSize: 8.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: accent, fontFamily: 'var(--font-sport)', maxWidth: '52%' }}>
                {eyebrowText}
              </span>
            ) : null}
          </div>
        ) : null}

        {isMatchup ? (
          /* Marcador central: nombres + escudos ABRAZAN la cápsula (no se van a los lados) */
          <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto auto auto 1fr', gap: 7 }}>
            <span className="truncate text-right" style={{ fontSize: 15, fontFamily: 'var(--font-sport)', fontWeight: homeLead ? 900 : 800, color: dimHome ? '#8A8A9E' : '#EDEDF5' }}>
              {dispHome}
            </span>
            {crest(event.homeLogo, event.homePhoto, hFav)}
            {scoreCapsule}
            {crest(event.awayLogo, event.awayPhoto, aFav)}
            <span className="truncate text-left" style={{ fontSize: 15, fontFamily: 'var(--font-sport)', fontWeight: awayLead ? 900 : 800, color: dimAway ? '#8A8A9E' : '#EDEDF5' }}>
              {dispAway}
            </span>
          </div>
        ) : (
          /* Evento sin rival (F1/golf): icono + nombre a lo ancho + hora en cápsula/ganador */
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: 9, background: `color-mix(in srgb, ${accent} 20%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 38%, transparent)`, color: accent }}>
              <SportIcon sport={event.sport} size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="truncate" style={{ fontSize: 15, fontFamily: 'var(--font-sport)', fontWeight: 800, color: '#EDEDF5' }}>
                {home}
              </div>
              {winnerNote ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] leading-none flex-shrink-0" aria-hidden>{racing ? '🏁' : '🏆'}</span>
                  <span className="truncate" style={{ fontSize: 11, fontWeight: 700, color: '#8A8A9E', fontFamily: 'var(--font-sport)' }}>{winnerNote}</span>
                </div>
              ) : null}
            </div>
            {!isLive && !finished ? (
              <span className="inline-flex items-center justify-center flex-shrink-0 tabular-nums" style={{ padding: '3px 11px', borderRadius: 10, background: `color-mix(in srgb, ${accent} 12%, rgba(0,0,0,0.3))`, border: `1px solid color-mix(in srgb, ${accent} 40%, rgba(255,255,255,0.14))`, fontSize: 15, fontWeight: 900, color: accent, fontFamily: 'var(--font-sport)' }}>
                {kickoff || '—'}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Canal (sub-línea fina) */}
      {channel ? (
        <div className="relative flex items-center justify-center gap-1.5" style={{ zIndex: 1, marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.07)', color: '#61616D' }}>
          <TvIcon size={10} className="flex-shrink-0" />
          <span className="truncate" style={{ fontSize: 10, fontWeight: 600, color: '#8A8A9E', fontFamily: 'var(--font-sport)' }}>{channel}</span>
        </div>
      ) : null}
    </div>
  )

  if (combat && eventDate && onClickUFC) {
    return (
      <div onClick={() => onClickUFC(eventDate)} className="cursor-pointer">
        {inner}
      </div>
    )
  }

  if (event.matchRef)
    return <Link href={`/partido/${event.matchRef}`} className="block no-underline">{inner}</Link>

  if (event.source === 'sanity')
    return <Link href={`/evento/${event.id}`} className="block no-underline">{inner}</Link>

  return inner
}

export function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex items-center flex-1" style={{ maxWidth: 220, minWidth: 100 }}>
      <svg className="absolute left-2.5 pointer-events-none" width="11" height="11" viewBox="0 0 12 12" fill="none">
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
        <path d="M8.5 8.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4" />
      </svg>
      <input
        type="text"
        placeholder="Buscar…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-7 py-1.5 rounded-lg text-[11px] font-medium outline-none"
        style={{
          paddingRight: value ? 34 : 8,
          background: value ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.04)',
          border: value ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(255,255,255,0.06)',
          color: '#D0D0E8',
          transition: 'all 0.15s ease',
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#A0A0B8', border: 'none', cursor: 'pointer', fontSize: 11 }}
          aria-label="Limpiar búsqueda"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function formatDateSubtitle(localDate: string): string {
  if (localDate === 'unknown') return ''
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const d = new Date(localDate + 'T12:00:00Z')
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} de ${months[d.getUTCMonth()]}`
}

// Day separator — prominent header for each date in the events list.
export function DaySeparator({ dateKey, count, tone = 'upcoming', tz }: {
  dateKey: string
  count: number
  tone?: 'upcoming' | 'past'
  tz?: string
}) {
  const today = isoToLocalDate(new Date().toISOString(), tz)
  const isToday = dateKey === today
  // FASE 3: cabecera de día como la app/maqueta — barra MORADA de marca para HOY
  // (identidad), gris neutro el resto; sin brillo ni gradiente de color. Los días
  // pasados atenúan el label. Contador con texto "N partidos".
  const bar = isToday ? '#7C3AED' : '#3A3A48'
  const chipColor = isToday ? '#C4B5FD' : '#8A8A9E'
  const subtitle = formatDateSubtitle(dateKey)
  const label = formatDateLabel(dateKey, tz)

  return (
    <div className="relative pt-7 pb-4 mb-3">
      {/* Hairline superior sutil (separación de día), sin color de deporte */}
      <div className="absolute top-0 left-0 right-0" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="block flex-shrink-0 rounded-sm" style={{ width: 4, height: 20, background: bar }} />
          <div className="min-w-0">
            <h2 className="font-black leading-none uppercase tracking-[0.18em]"
              style={{ fontFamily: 'var(--font-sport)', fontSize: 14, color: tone === 'past' ? '#B8B8C8' : '#F0F0FA' }}>
              {label}
            </h2>
            {subtitle && (
              <p className="text-[10px] mt-1 first-letter:uppercase tracking-wide" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <span className="flex items-center justify-center h-[22px] px-2.5 rounded-full text-[10px] font-black tabular-nums flex-shrink-0"
          style={{ background: isToday ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.05)', color: chipColor, border: `1px solid ${isToday ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.08)'}`, fontFamily: 'var(--font-sport)' }}>
          {count} {count === 1 ? 'partido' : 'partidos'}
        </span>
      </div>
    </div>
  )
}

export function SectionHeader({ icon, label, color, count, hint }: {
  icon: React.ReactNode; label: string; color: string; count?: number; hint?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span className="inline-flex items-center" style={{ color }}>{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-[0.18em]"
        style={{ color, fontFamily: 'var(--font-sport)' }}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black"
          style={{ background: `${color}22`, color, fontFamily: 'var(--font-display)' }}>
          {count}
        </span>
      )}
      {hint && (
        <span className="text-[9px] ml-auto" style={{ color: '#7C7C8C', fontFamily: 'var(--font-sport)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}

// Horizontal scrollable strip of live hero cards
export function LiveHeroStrip({ items }: { items: React.ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return
    ref.current.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        className="cal-rail flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, i) => <div key={i}>{item}</div>)}
      </div>
      {items.length > 3 && (
        <>
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex items-center justify-center absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full transition-all hover:scale-110"
            style={{
              background: 'rgba(20,20,30,0.85)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="Anterior"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="#C0C0D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => scroll('right')}
            className="hidden md:flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full transition-all hover:scale-110"
            style={{
              background: 'rgba(20,20,30,0.85)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="Siguiente"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="#C0C0D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}


// Memoización de la fila: la lista pinta 100+ filas y el padre re-renderiza en cada
// poll de directos (30-60s) y en cada tecla del buscador. Comparamos SOLO las props
// que afectan al render (liveScore por CONTENIDO — es un objeto nuevo cada poll aunque
// no cambie el marcador) e ignoramos los callbacks, que son semánticamente estables
// (cierran sobre event/toggles estables). (FASE 7 tanda D — hallazgo [16])
export type MatchRowProps = Parameters<typeof MatchRowInner>[0]
export function matchRowPropsEqual(a: MatchRowProps, b: MatchRowProps): boolean {
  // Solo comparamos las props que AFECTAN al render compacto. isFav/showReason/
  // formHome/formAway ya no se pintan (la fila compacta no lleva forma ni motivo).
  if (
    a.event !== b.event ||
    a.isReminded !== b.isReminded ||
    a.flashing !== b.flashing ||
    a.homeFav !== b.homeFav ||
    a.awayFav !== b.awayFav ||
    a.showComp !== b.showComp ||
    a.dateLabel !== b.dateLabel ||
    a.tz !== b.tz
  ) return false
  const x = a.liveScore, y = b.liveScore
  if (!x || !y) return x === y
  return (
    x.homeGoals === y.homeGoals &&
    x.awayGoals === y.awayGoals &&
    x.status === y.status &&
    x.elapsed === y.elapsed &&
    x.clock === y.clock
  )
}
export const MatchRow = memo(MatchRowInner, matchRowPropsEqual)

// ── Past result row (compact, for resultados tab) ─────────────────────────
export function PastMatchRow({ event, isFav, onToggleFav }: {
  event: SportEvent
  isFav?: boolean
  onToggleFav?: () => void
}) {
  // FASE 3: Resultados con el mismo color POR DEPORTE que la lista principal.
  const compColor = accentForSport(event.sport, '#A78BFA')
  const hs = event.homeScore
  const as_ = event.awayScore
  const hasScore = hs !== null && hs !== undefined && as_ !== null && as_ !== undefined

  const hasVs = !!event.away
  const racing = isRacing(event.sport)
  const tennis = isTennis(event.sport)
  const combat = isCombat(event.sport)
  const inner = (
    <div
      className="relative grid items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2.5 sm:py-3 rounded-xl transition-all hover:brightness-105"
      style={{
        gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderLeftWidth: 3,
        borderLeftColor: compColor,
      }}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
        {onToggleFav && <FavoriteHeart active={!!isFav} onClick={onToggleFav} />}
      </div>

      {/* Home (or solo entity) */}
      <div className="flex items-center gap-2 min-w-0 justify-end text-right pr-1">
        <div className="min-w-0 flex flex-col items-end">
          <span className="text-[12px] sm:text-[13px] font-bold truncate max-w-full leading-snug" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {event.home}
          </span>
        </div>
        <TeamLogo logo={event.homeLogo} name={event.home} size={28} sport={event.sport} />
      </div>

      <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0 min-w-[80px] sm:min-w-[88px] px-2">
        <span className="text-[8.5px] font-black uppercase tracking-[0.18em] leading-none" style={{ color: '#7C7C8C', fontFamily: 'var(--font-sport)' }}>
          FT
        </span>
        {hasScore ? (
          <span className="flex items-center gap-2 leading-none tabular-nums font-black"
            style={{ fontSize: 20, color: '#C0C0D8', fontFamily: 'var(--font-sport)' }}>
            <span>{hs}</span>
            <span style={{ color: '#38384A', fontWeight: 400 }}>·</span>
            <span>{as_}</span>
          </span>
        ) : event.resultNote ? null : (
          <span className="text-[14px] font-bold" style={{ color: '#7C7C8C' }}>–</span>
        )}
        {/* Fase/grupo (Mundial: "Grupo A", "Octavos"…) */}
        {event.stage && (
          <span className="text-[8px] font-bold uppercase tracking-[0.14em] leading-none truncate max-w-[88px]"
            style={{ color: '#7C7C8C', fontFamily: 'var(--font-sport)' }}>
            {event.stage}
          </span>
        )}
      </div>

      {hasVs ? (
        <div className="flex items-center gap-2 min-w-0 pl-1 pr-9 sm:pr-1">
          <TeamLogo logo={event.awayLogo} name={event.away!} size={28} sport={event.sport} />
          <span className="text-[12px] sm:text-[13px] font-bold truncate leading-snug" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
            {event.away}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-w-0 pl-1 pr-9 sm:pr-1 opacity-60">
          <span className="inline-flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 28, height: 28, background: `${compColor}14`, border: `1px solid ${compColor}28`, color: compColor }}>
            {racing ? <F1Icon size={14} /> : tennis ? <TennisIcon size={14} /> : <SportIcon sport={event.sport} size={14} />}
          </span>
          <div className="min-w-0">
            {event.resultNote ? (
              <>
                <span className="text-[8.5px] font-black uppercase tracking-[0.14em] block"
                  style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                  Ganador
                </span>
                <span className="text-[12px] font-bold truncate block leading-snug"
                  style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                  🏆 {event.resultNote}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] truncate block"
                  style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                  {racing ? 'Carrera' : tennis ? 'Individual' : combat ? 'Cartelera' : 'Evento'}
                </span>
                {event.comp && (
                  <span className="text-[9px] truncate block mt-0.5"
                    style={{ color: compColor, fontFamily: 'var(--font-sport)' }}>
                    {event.comp}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (event.matchRef)
    return <Link href={`/partido/${event.matchRef}`} className="block no-underline">{inner}</Link>
  return inner
}
