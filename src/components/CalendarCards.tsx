'use client'

// Componentes de presentación del calendario: logos, filas de partido, cabeceras de
// competición, hero en vivo, separadores. Extraído del monolito CalendarioContent.

import type { LiveScore } from './calendar-live'
import { memo, useRef, useState } from 'react'
import Link from 'next/link'
import type { SportEvent, TeamStanding } from '@/lib/types'
import type { FormResult } from '@/lib/past-events'
import { matchStakes, standingLabel } from '@/lib/match-stakes'
import { canonicalPlayerSlug, canonicalTeamSlug } from '@/lib/entity-slug'
import { rowChannel } from '@/lib/comp-group-channel'
import { getLiveLabel, isCombat, isRacing, isTennis } from '@/lib/competitions'
import { getBroadcastForTz, isSplitBroadcast } from '@/lib/broadcasts'
import { formatDateLabel, isoToLocalDate } from '@/lib/calendar'
import { useMounted } from '@/hooks/useMounted'
import { SOURCE_TZ, convertEventTime } from '@/lib/timezone'
import { compConfigForGroup, shortCompName } from '@/lib/calendar-competitions'
import { accentForSport } from '@/lib/sports'
import { isLiveStatus } from '@/lib/live-events'
import { F1Icon, SportIcon, TennisIcon, TvIcon } from '@/components/icons/GameIcons'
import { smallImage } from '@/lib/image-url'

// ─── Utilities ────────────────────────────────────────────────────────────
export function TeamLogo({ logo, photo, name, size = 24, sport, accent, abbr }: { logo?: string; photo?: string; name: string; size?: number; sport?: string; accent?: string; abbr?: string }) {
  const [err, setErr] = useState(false)
  const displayPhoto = photo && !err

  if (displayPhoto) {
    return (
      <img src={smallImage(photo, size * 2)} alt={name} width={size} height={size} loading="lazy" decoding="async" onError={() => setErr(true)}
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
            fontSize: Math.max(11, Math.round(size * 0.34)),
            letterSpacing: 0.2,
            background: `${accent}1A`,
            color: accent,
            border: `1px solid ${accent}4D`,
          }}>
          {size < 28 ? crestInitials(abbr, name).slice(0, 1) : crestInitials(abbr, name)}
        </div>
      )
    }
    const tennis = sport ? isTennis(sport) : false
    const combat = sport ? isCombat(sport) : false
    return (
      <div className="flex items-center justify-center rounded-full font-black flex-shrink-0"
        style={{
          width: size, height: size,
          fontSize: Math.max(11, Math.round(size * 0.36)),
          background: combat ? 'rgba(212,175,55,0.14)' : tennis ? 'rgba(217,119,6,0.14)' : 'rgba(255,255,255,0.06)',
          color: combat ? '#D4AF37' : tennis ? '#FBBF24' : '#7A7A8E',
          border: combat ? '1px solid rgba(212,175,55,0.25)' : tennis ? '1px solid rgba(251,191,36,0.25)' : 'none',
        }}>
        {size < 28 ? name.slice(0, 1).toUpperCase() : combat || tennis ? initials(name) : name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    <img src={smallImage(logo, size * 2)} alt={name} width={size} height={size} loading="lazy" decoding="async" onError={() => setErr(true)}
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
  // Fila a ancho completo, la misma del resto del calendario (V-19): antes era
  // una tarjeta de 300 px sola con dos tercios de ancho vacío. El rojo queda
  // para el estado en directo; la competición, en el color del deporte.
  const compColor = accentForSport(p.sport, '#FF4D2E')
  const tennis = isTennis(p.sport)
  const racing = isRacing(p.sport)
  const liveLabel = getLiveLabel(p.status, p.elapsed, {
    sport: p.sport,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
  })

  const inner = (
    <div className={`relative flex items-center gap-3 hover:bg-white/[0.03] transition-colors ${p.flashing ? 'ts-flash' : ''}`} style={{ minHeight: 60, padding: '10px 14px' }}>
      {racing ? (
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 56, color: 'var(--color-live)' }}><F1Icon size={20} /></span>
      ) : (
        <span className="flex-shrink-0 tabular-nums whitespace-nowrap" style={{ width: 56, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, lineHeight: 1, color: 'var(--text-primary)' }}>
          {p.homeScore ?? 0} – {p.awayScore ?? 0}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[7px] min-w-0" style={{ fontFamily: 'var(--font-sport)', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
          {racing ? (
            <span className="truncate">{p.comp || p.homeTeam}</span>
          ) : (
            <>
              <TeamLogo logo={p.homeLogo} photo={p.homePhoto} name={p.homeTeam} size={22} sport={p.sport} accent={compColor} abbr={p.homeAbbr} />
              <span className="truncate">{shortName(p.homeTeam, p.homeAbbr)}</span>
              <span className="flex-shrink-0" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>–</span>
              <TeamLogo logo={p.awayLogo} photo={p.awayPhoto} name={p.awayTeam} size={22} sport={p.sport} accent={compColor} abbr={p.awayAbbr} />
              <span className="truncate">{shortName(p.awayTeam, p.awayAbbr)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0 whitespace-nowrap overflow-hidden" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
          <span className="inline-flex items-center gap-1 font-bold" style={{ color: 'var(--color-live)' }}>
            <span className="rounded-full" style={{ width: 6, height: 6, background: 'var(--color-live)', animation: 'live-pulse 1.6s ease-out infinite' }} />
            {racing ? `En carrera${liveLabel ? ` · ${liveLabel}` : ''}` : liveLabel && liveLabel !== 'EN VIVO' ? `En vivo · ${liveLabel}` : 'En vivo'}
          </span>
          {p.comp ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate font-bold uppercase" style={{ color: compColor, letterSpacing: '0.06em', fontSize: 11 }}>
                {tennis ? 'Tenis · ' : ''}{p.comp}
              </span>
            </>
          ) : null}
          <BroadcastChip comp={p.comp ?? ''} sport={p.sport} tz={p.tz} fallback={p.broadcast} />
        </div>
      </div>
      {p.matchRef ? (
        <span className="hidden sm:inline flex-shrink-0 text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', fontFamily: 'var(--font-sport)' }}>
          Ficha →
        </span>
      ) : null}
    </div>
  )

  return p.matchRef
    ? <Link href={`/partido/${p.matchRef}`} prefetch={false} className="block no-underline">{inner}</Link>
    : inner
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
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide"
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

// Config de competición (página + escudo) para un grupo del feed: vive en
// lib/calendar-competitions para que la use también la página de día (servidor).
export { compConfigForGroup }

// ─── Competition sub-header ───────────────────────────────────────────────
// Si la competición tiene página propia, la cabecera lleva su escudo oficial y
// es un enlace a /calendario/[slug] (anclaje visual + descubrimiento).
export function CompGroupHeader({ comp, accent, count, first, slug, pinned, onTogglePin, channel, collapsed, onToggleCollapse }: {
  comp: string; accent: string; count: number; first?: boolean; crest?: string; slug?: string
  banner?: string; pinned?: boolean; onTogglePin?: () => void
  /** Canal común a TODA la liga: se anuncia aquí una vez y las filas no lo repiten. */
  channel?: string | null
  /** La liga está plegada: sus partidos no se pintan (el contador sí). */
  collapsed?: boolean
  /** Pliega/despliega la liga en TODO el timeline. */
  onToggleCollapse?: () => void
}) {
  // Cabecera de competición como en /calendario/dia (maqueta 3 de noviembre):
  // el nombre en el color del deporte y «Calendario →» a la derecha si la liga
  // tiene página. Sin foto de fondo ni espina: el color del deporte vive aquí
  // y en ningún otro sitio de la tarjeta. Fijar y plegar se conservan.
  //
  // El enlace abraza SOLO el nombre (un <button> dentro de un <a> no es HTML
  // válido, y sin hidratar los botones navegaban en vez de hacer lo suyo).
  const nombre = (
    <span className="text-[12px] font-bold uppercase tracking-[0.12em] truncate" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
      {comp}
    </span>
  )
  return (
    <div className={`flex items-center gap-2.5 px-0.5 pb-2 ${first ? 'pt-1' : 'pt-4'}`}>
      {slug ? (
        <Link href={`/calendario/${slug}`} prefetch={false} className="flex items-center gap-2 min-w-0 flex-1 no-underline transition-all hover:brightness-125" aria-label={`Ver calendario de ${comp}`}>
          {nombre}
        </Link>
      ) : (
        <span className="flex items-center gap-2 min-w-0 flex-1">{nombre}</span>
      )}
      {channel && (
        <span className="flex items-center gap-1 flex-shrink-0" style={{ maxWidth: '40%' }}>
          <TvIcon size={11} />
          <span className="text-[11px] font-bold uppercase tracking-[0.05em] truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {channel}
          </span>
        </span>
      )}
      {pinned && (
        <span className="text-[11px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: accent, fontFamily: 'var(--font-sport)', opacity: 0.85 }}>
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
      {onToggleCollapse && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleCollapse() }}
          aria-label={collapsed ? `Desplegar ${comp}` : `Plegar ${comp}`}
          aria-expanded={!collapsed}
          className="flex items-center justify-center flex-shrink-0 rounded-md transition-all"
          style={{ width: 24, height: 24, cursor: 'pointer', background: 'transparent', border: 'none' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 140ms ease' }}>
            <path d="M5 9l7 7 7-7" stroke={collapsed ? accent : '#6A6A80'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {slug ? (
        <Link href={`/calendario/${slug}`} prefetch={false} className="flex-shrink-0 no-underline text-[11px] font-bold uppercase tracking-[0.08em] transition-colors hover:text-[#C4B5FD]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          Calendario →
        </Link>
      ) : (
        <span className="text-[11px] font-bold tabular-nums flex-shrink-0" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          {count}
        </span>
      )}
    </div>
  )
}

// Forma reciente (últimos 5): barritas W/D/L bajo el nombre del equipo. El dato más
// reciente va PRIMERO en el array (fetchRecentFormByTeams) y se pinta primero (el más
// cercano al presente pegado al escudo no; simplemente izquierda→derecha = reciente→viejo).
// Verde=victoria, gris=empate, rojo apagado=derrota. Fase 1 del rediseño del calendario:
// este dato se calculaba en el SSR desde 2026-07 y no se pintaba en ninguna parte.
// Altura de las dos sublíneas bajo el nombre. Se reservan en AMBOS lados en
// cuanto uno de los dos tiene contenido: la fila alinea al centro cada columna,
// así que con el puesto (o la forma) en un solo lado los dos nombres quedaban a
// distinta altura. Espejo del mismo arreglo en la app.
const FORM_H = 6.5
const STANDING_H = 14

export function FormBars({ form, align, reserve }: { form?: FormResult[]; align: 'left' | 'right'; reserve?: boolean }) {
  if (!form || form.length === 0) return reserve ? <span className="block" style={{ height: FORM_H }} /> : null
  const color = (r: FormResult) => r === 'W' ? '#34D399' : r === 'D' ? '#6B7280' : 'rgba(255,77,46,0.75)'
  const title = form.slice(0, 5).map(r => r === 'W' ? 'G' : r === 'D' ? 'E' : 'P').join('-')
  return (
    <span
      className={`flex items-center gap-[2.5px] mt-[3px] ${align === 'right' ? 'justify-end' : 'justify-start'}`}
      // `role="img"`: sin rol, un <span> NO admite aria-label y el lector de
      // pantalla se come la forma reciente (axe: aria-prohibited-attr, 17 veces
      // en /calendario). Con el rol, las cinco rayitas se anuncian como una sola
      // imagen con su texto: «Forma reciente: V-V-D-V-D».
      role="img"
      aria-label={`Forma reciente: ${title}`}
      title={`Últimos ${Math.min(form.length, 5)}: ${title}`}
    >
      {form.slice(0, 5).map((r, i) => (
        <span key={i} className="block rounded-[2px]" style={{ width: 11, height: 3.5, background: color(r) }} />
      ))}
    </span>
  )
}

// Nombre del equipo/jugador como enlace a su ficha, por encima del enlace
// estirado de la tarjeta (z-3). Sin destino devuelve el texto tal cual: un
// nombre sin id no tiene ficha a la que ir.
export function TeamNameLink({ href, name, align, children }: {
  href: string | null
  name: string
  align: 'left' | 'right'
  children: React.ReactNode
}) {
  if (!href) return <>{children}</>
  return (
    <Link
      href={href}
      prefetch={false}
      className={`pointer-events-auto relative z-[3] block no-underline hover:underline ${align === 'right' ? 'text-right' : 'text-left'}`}
      // 24 px de alto mínimo: el enlace medía 23 y se quedaba a UN píxel del
      // objetivo táctil que pide WCAG 2.2 (target-size, AA). Como el texto ya
      // ocupa 23, esto crece un píxel y no se nota. [04/09/2026]
      style={{ textUnderlineOffset: 3, textDecorationColor: 'rgba(255,255,255,0.35)', minHeight: 24 }}
      aria-label={`Ficha de ${name}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  )
}

// Set a set de un partido de tenis ("6-4 7-5 *3-2"): cada set en su cápsula y
// el que se está jugando resaltado con el acento. Sin esto un tenis en directo
// solo decía "1 - 0" (sets ganados), que es el dato menos informativo de los tres
// que ESPN manda en la misma respuesta.
export function TennisSetLine({ setsStr, accent }: { setsStr: string; accent: string }) {
  const sets = setsStr.split(' ').filter(Boolean)
  if (sets.length === 0) return null
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Sets: ${setsStr.replace(/\*/g, '')}`}>
      {sets.map((set, i) => {
        const activo = set.startsWith('*')
        const txt = activo ? set.slice(1) : set
        return (
          <span
            key={i}
            className="tabular-nums rounded"
            style={{
              fontSize: 11, fontWeight: activo ? 900 : 700, padding: '1px 5px',
              fontFamily: 'var(--font-sport)',
              color: activo ? accent : '#9A9AAE',
              background: activo ? `color-mix(in srgb, ${accent} 14%, transparent)` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${activo ? `color-mix(in srgb, ${accent} 34%, transparent)` : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {txt}
          </span>
        )
      })}
    </span>
  )
}

// Puesto y puntos bajo el nombre ("4º · 38 pts"). Solo en ligas con tabla; el
// dato lo adjunta fetchEspnEvents al evento, así que no cuesta ninguna llamada
// extra aquí. Sin clasificación no pinta nada (no deja hueco).
export function StandingLine({ standing, align, reserve }: { standing?: TeamStanding; align: 'left' | 'right'; reserve?: boolean }) {
  const label = standingLabel(standing)
  if (!label) return reserve ? <span className="block" style={{ height: STANDING_H }} /> : null
  return (
    <span
      className={`block truncate tabular-nums ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ fontSize: 11, lineHeight: '12px', height: STANDING_H - 2, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', marginTop: 2 }}
    >
      {label}
    </span>
  )
}

// Cara del jugador (headshot de ESPN, redonda) o escudo (fútbol, cuadrado) que flanquea el
// marcador en la fila. Prioriza la FOTO (tenis); si falla o no hay, el escudo; si tampoco,
// el hueco se queda VACÍO (la fila muestra solo el nombre — sin siglas raras). Aro tintado
// del acento (más si fav).
//
// El hueco mide SIEMPRE lo mismo: antes eran 26 px (foto), 20 px (escudo) o nada
// (el componente devolvía `null` y la columna del grid desaparecía con su gap),
// así que la cápsula del marcador caía en una x distinta según la fila. Espejo
// del mismo arreglo en la app.
const CREST_SLOT = 26

export function MatchCrest({ photo, logo, accent, fav }: { photo?: string; logo?: string; accent: string; fav?: boolean }) {
  const [photoErr, setPhotoErr] = useState(false)
  const [logoErr, setLogoErr] = useState(false)
  const inner = photo && !photoErr ? (
    <span className="inline-flex flex-shrink-0 rounded-full" style={{ boxShadow: `0 0 0 1.5px ${fav ? accent : `color-mix(in srgb, ${accent} 55%, transparent)`}` }}>
      <img src={smallImage(photo, 52)} alt="" width={26} height={26} loading="lazy" decoding="async" onError={() => setPhotoErr(true)} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
    </span>
  ) : logo && !logoErr ? (
    <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 20, height: 20, borderRadius: 6, border: fav ? `1.5px solid ${accent}` : '1.5px solid transparent' }}>
      <img src={smallImage(logo, 36)} alt="" width={18} height={18} loading="lazy" decoding="async" onError={() => setLogoErr(true)} style={{ width: 18, height: 18, objectFit: 'contain' }} />
    </span>
  ) : null
  return (
    <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: CREST_SLOT, height: CREST_SLOT }}>
      {inner}
    </span>
  )
}

// ─── Compact list row (una línea + canal) — paridad con la app compacta (§4) ──
// FASE compacto (2026-07-10): fila de UNA LÍNEA en VIDRIO, espejo EXACTO de la app.
// Equipo · hora/marcador · equipo + canal fino debajo → máxima densidad (revierte la
// tarjeta vertical de la Fase 3). Espina de acento por deporte, pastilla EN VIVO/
// Descanso/Final, velada UFC parseada (título en la ceja + "vs"), evento F1/golf a lo
// ancho. Favorito = anillo en el escudo (se gestiona en "Mis equipos", como la app).
// Recordatorio = campana mínima arriba-dcha SOLO en próximos (la web no tiene toque
// largo). Conserva onClickUFC (modal cartelera), liveScore, tz y la agrupación por liga.
export function MatchRowInner({ event, liveScore, isReminded, onToggleReminder, dateLabel, onClickUFC, flashing, homeFav, awayFav, formHome, formAway, canPredict, onPredict, showComp, tz, groupChannel }: {
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
  /** Este partido ENTRA en la jornada abierta de la quiniela → chip Pronosticar.
   *  Solo unos 10 de todo el feed, así que no ensucia la lista. */
  canPredict?: boolean
  onPredict?: () => void
  showComp?: boolean
  showReason?: boolean
  tz?: string
  /** Canal que la cabecera de su liga ya anuncia: la fila no lo repite. */
  groupChannel?: string | null
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
  // El canal solo se pinta aquí si NO es el que su liga ya anuncia en la cabecera
  // del grupo. Medido el 21/08: 16 de 22 filas del día repetían el mismo.
  // En la lista PLANA (Destacados) la fila ya gasta su ceja en la competición;
  // repetir además el canal en todas las filas del día es el ruido que la
  // cabecera de grupo evitaba. Sigue en la ficha del partido. Espejo de la app.
  const channel = showComp
    ? undefined
    : rowChannel(
        getBroadcastForTz(compLabel, event.sport ?? '', tz ?? SOURCE_TZ) ?? event.broadcast,
        groupChannel ?? null,
      )

  // Recordatorio solo para PRÓXIMOS con ficha y fecha futura.
  //
  // La campana se pinta TRAS MONTAR: "¿ya ha empezado?" se decide con el reloj
  // del navegador y el botón está o no está, así que sobre un HTML cacheado
  // (revalidate 5m) un partido que arranque en ese hueco sale con campana en el
  // servidor y sin ella en el cliente. Eso rompe la hidratación (React #418) y
  // repinta TODO el calendario. Además es un control que sin JS no hace nada,
  // así que no se pierde nada por no mandarlo en el HTML.
  const montado = useMounted()
  const kickoffMs = event.isoDate ? new Date(event.isoDate).getTime() : NaN
  const canRemind = montado && !isLive && !finished && !!event.matchRef && !Number.isNaN(kickoffMs) && kickoffMs > Date.now()
  const eventDate = event.isoDate ? isoToLocalDate(event.isoDate, tz) : null

  // Ceja: título de velada UFC parseado, o competición (vista Recordatorios).
  const eyebrowText = parsedTitle || (showComp && compLabel ? compLabel : '')
  // Motivo del partido según la tabla. En partidos YA JUGADOS no aporta (la
  // clasificación que traemos es la de HOY, no la de aquel día) → solo en
  // próximos y en directo.
  const stakes = finished ? null : matchStakes(event.homeStanding, event.awayStanding)
  // El historial solo tiene sentido ANTES de jugarse (después manda el marcador).
  const h2hNote = finished || isLive ? null : event.h2hNote
  // Simetría de la fila: el hueco del escudo y el de cada sublínea se reservan a
  // los DOS lados en cuanto uno de ellos tiene contenido. Si NINGUNO de los dos
  // trae imagen (tenis, veladas de UFC) no se reserva nada y la fila se queda
  // compacta. Espejo del mismo arreglo en la app.
  const hasCrests = !!(event.homeLogo || event.homePhoto || event.awayLogo || event.awayPhoto)
  const showStanding = !finished && !!(standingLabel(event.homeStanding) || standingLabel(event.awayStanding))
  const showForm = (formHome?.length ?? 0) > 0 || (formAway?.length ?? 0) > 0
  // Destino del NOMBRE de cada lado: su ficha. Sin id no hay slug posible → el
  // nombre queda como texto, que es mejor que un enlace roto.
  //
  // En tenis manda el ATLETA. Esto estuvo anotado como imposible («el scoreboard
  // no trae athlete.id y `sport_entities` no tiene ni un tenista → 404»), y las
  // dos mitades caducaron el 21/08/2026: la siembra de los cuadros ATP/WTA metió
  // 261 jugadores, y los 16 del feed traen su id de ESPN. Comprobado contra
  // producción: /jugador/iga-swiatek-3730 responde con su ficha.
  //
  // UFC sigue sin enlazar, y no por lo mismo: el feed trae VELADAS enteras
  // («UFC Fight Night: Hernandez»), sin dos luchadores que enlazar.
  const sideHref = (teamId?: string, athleteId?: string, name?: string): string | null => {
    if (!name) return null
    if (athleteId) return `/jugador/${canonicalPlayerSlug(name, athleteId)}`
    return teamId ? `/equipo/${canonicalTeamSlug(name, teamId)}` : null
  }
  const homeHref = sideHref(event.homeTeamId, event.homeAthleteId, rawHome)
  const awayHref = sideHref(event.awayTeamId, event.awayAthleteId, rawAway)

  // Destino de la tarjeta: ficha del partido, o del evento si viene de Sanity.
  const cardHref = event.matchRef
    ? `/partido/${event.matchRef}`
    : event.source === 'sanity'
      ? `/evento/${event.id}`
      : null

  // Tenis: set a set. Del directo mientras se juega (trae el set activo marcado)
  // y, cuando acaba y desaparece de /api/events/live, del propio evento (fijado
  // desde los linescores del scoreboard). En un partido por empezar, nada.
  const tennisSets = tennis && (isLive || finished)
    ? (liveScore?.setsStr || event.setsStr || '')
    : ''

  // Pronosticar: solo mientras el partido no haya arrancado (la quiniela cierra).
  const showPredict = !!canPredict && !isLive && !finished && !!onPredict
  // Hueco para no chocar con la campana de la esquina. Va a los DOS lados a
  // propósito: reservándolo solo a la derecha, el contenido de las filas con
  // campana quedaba 24 px más estrecho y su cápsula de marcador caía 12 px a la
  // izquierda de la del resto. Medido el 27/08/2026 sobre 825 filas: dos grupos
  // limpios a 151,99 y 164,00 px. Simétrico, la cápsula no se mueve nunca —
  // pierde nombre por los bordes, que es donde no se nota. Espejo de la app.
  // 12 y no 24: la campana ocupa hasta 24 px del borde y la tarjeta ya pone 13
  // de padding, así que con 12 más se despeja. Los 24 venían de cuando el estado
  // iba en esa esquina; con el doble ya no hacía falta, y como ahora la reserva
  // es simétrica, cada píxel de más se lo come el nombre por los dos lados.
  const contentPad = canRemind ? 12 : 0

  // Cara del jugador (tenis) o escudo (fútbol) que flanquea el marcador. Si no hay ni
  // foto ni escudo → nada (solo el nombre); ya NO se muestran siglas raras (José Tomás).
  const crest = (logo: string | undefined, photo: string | undefined, fav: boolean) => (
    <MatchCrest photo={photo} logo={logo} accent={accent} fav={fav} />
  )

  // ── Fila del sistema único (maqueta 3 de noviembre, V-17) ──────────────────
  // La misma fila que /calendario/dia: a la izquierda la hora en el verde de
  // marca (o el marcador en blanco si ya se jugó), en medio escudos y nombres
  // con una línea de contexto debajo, a la derecha la campana. Sin vidrio, sin
  // borde de color ni cápsula: el color del deporte vive solo en el rótulo de
  // la competición. Los nombres largos pasan a sus siglas en móvil en vez de
  // cortarse con «…».
  const abreviable = (nombre: string, abbr?: string): React.ReactNode =>
    nombre.length > 18 && abbr ? (
      <>
        <span className="sm:hidden">{abbr}</span>
        <span className="hidden sm:inline">{nombre}</span>
      </>
    ) : nombre

  const izquierda = showScore
    ? `${hg} – ${ag}`
    : isLive || finished
      ? null
      : (kickoff || (isMatchup ? '—' : ''))
  const stH = finished ? null : standingLabel(event.homeStanding)
  const stA = finished ? null : standingLabel(event.awayStanding)

  const contexto: React.ReactNode[] = []
  if (isLive) {
    contexto.push(
      <span key="live" className="inline-flex items-center gap-1 font-bold" style={{ color: 'var(--color-live)' }}>
        {!paused && <span className="rounded-full" style={{ width: 6, height: 6, background: 'var(--color-live)', animation: 'live-pulse 1.6s ease-out infinite' }} />}
        {paused ? liveLabel : liveLabel && liveLabel !== 'EN VIVO' ? `En vivo · ${liveLabel}` : 'En vivo'}
      </span>,
    )
  } else if (finished) {
    contexto.push(<span key="fin">{event.finishNote ?? 'Final'}</span>)
  }
  if (dateLabel) contexto.push(<span key="fecha">{dateLabel}</span>)
  if (eyebrowText) {
    contexto.push(
      <span key="comp" className="font-bold uppercase" style={{ color: accent, letterSpacing: '0.06em', fontSize: 11 }}>{eyebrowText}</span>,
    )
  }
  if (event.stage) contexto.push(<span key="fase">{event.stage}</span>)
  if (!isLive && !finished && event.venue) contexto.push(<span key="sede">{event.venue}</span>)
  if (channel) contexto.push(<span key="tv">{channel}</span>)
  if (stH && stA) contexto.push(<span key="tabla" className="tabular-nums">{stH} · {stA}</span>)
  if (stakes) contexto.push(<span key="motivo" style={{ color: stakes.tone === 'alta' ? '#FCD34D' : '#C9A96A' }}>{stakes.tone === 'alta' ? '★ ' : ''}{stakes.label}</span>)
  if (h2hNote) contexto.push(<span key="h2h">{h2hNote}</span>)
  if (winnerNote) contexto.push(<span key="ganador">{racing ? '🏁 ' : '🏆 '}{winnerNote}</span>)
  if (tennisSets) contexto.push(<TennisSetLine key="sets" setsStr={tennisSets} accent={accent} />)

  const inner = (
    <div
      className={`relative flex items-center gap-3 hover:bg-white/[0.03] transition-colors ${flashing ? 'ts-flash' : ''}`}
      style={{ minHeight: 60, padding: '10px 14px' }}
    >
      {/* Enlace de la FILA a la ficha del partido, en capa (patrón "stretched
          link"): los nombres, la campana y el chip van por encima (z-3). */}
      {cardHref ? (
        <Link
          href={cardHref}
          prefetch={false}
          className="absolute inset-0 z-[1]"
          aria-label={`Ficha del partido: ${home}${away ? ` contra ${away}` : ''}`}
        />
      ) : null}

      {racing ? (
        <span className="flex items-center justify-center flex-shrink-0" style={{ width: 56, color: accent }}>
          <SportIcon sport={event.sport} size={20} />
        </span>
      ) : izquierda ? (
        <span
          className="flex-shrink-0 tabular-nums whitespace-nowrap"
          style={{ width: 56, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: showScore ? 16 : 18, lineHeight: 1, color: showScore ? 'var(--text-primary)' : 'var(--green)' }}
        >
          {izquierda}
        </span>
      ) : (
        <span className="flex-shrink-0" style={{ width: 56 }} />
      )}

      <div className="relative flex-1 min-w-0 pointer-events-none" style={{ zIndex: 2 }}>
        <div className="flex items-center gap-[7px] min-w-0" style={{ fontFamily: 'var(--font-sport)', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
          {isMatchup ? (
            <>
              {hasCrests ? crest(event.homeLogo, event.homePhoto, hFav) : null}
              <span className="min-w-0 truncate">
                <TeamNameLink href={homeHref} name={rawHome} align="left">
                  <span className="truncate" style={{ fontWeight: homeLead ? 700 : 600, color: dimHome ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {abreviable(dispHome, event.homeAbbr)}
                  </span>
                </TeamNameLink>
              </span>
              <span className="flex-shrink-0" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>–</span>
              {hasCrests ? crest(event.awayLogo, event.awayPhoto, aFav) : null}
              <span className="min-w-0 truncate">
                <TeamNameLink href={awayHref} name={rawAway} align="left">
                  <span className="truncate" style={{ fontWeight: awayLead ? 700 : 600, color: dimAway ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {abreviable(dispAway, event.awayAbbr)}
                  </span>
                </TeamNameLink>
              </span>
            </>
          ) : (
            <span className="truncate">{home}</span>
          )}
        </div>
        {contexto.length > 0 ? (
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden whitespace-nowrap" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {contexto.map((nodo, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 min-w-0">
                {i > 0 ? <span aria-hidden>·</span> : null}
                <span className="truncate inline-flex items-center gap-1">{nodo}</span>
              </span>
            ))}
          </div>
        ) : null}
        {showForm ? (
          <div className="flex items-center gap-3" style={{ marginTop: 2 }}>
            <FormBars form={formHome} align="left" />
            <FormBars form={formAway} align="left" />
          </div>
        ) : null}
      </div>

      {canRemind ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleReminder() }}
          className="relative z-[3] flex items-center justify-center rounded-full flex-shrink-0 transition-colors hover:bg-white/[0.06]"
          style={{ width: 32, height: 32, color: isReminded ? accent : 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          aria-label={isReminded ? 'Quitar recordatorio' : 'Recordar'}
          title={isReminded ? 'Quitar recordatorio' : 'Recordar'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isReminded ? 'currentColor' : 'none'} fillOpacity={isReminded ? 0.25 : 0} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 004 0" />
          </svg>
        </button>
      ) : showPredict ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPredict?.() }}
          className="relative z-[3] ts-chip flex-shrink-0"
          style={{ height: 30, padding: '0 10px', fontSize: 11, color: '#C4B5FD', background: 'rgba(124,58,237,0.16)', borderColor: 'rgba(124,58,237,0.4)' }}
          aria-label={`Pronosticar ${home}${away ? ` contra ${away}` : ''} en la quiniela`}
        >
          Pronosticar
        </button>
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
        className="w-full pl-7 rounded-full text-[13px] font-medium outline-none"
        style={{
          height: 36,
          paddingRight: value ? 34 : 10,
          background: 'var(--bg-surface)',
          border: value ? '1px solid rgba(124,58,237,0.4)' : '1px solid var(--border)',
          color: 'var(--text-primary)',
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
export function DaySeparator({ dateKey, count, curated = false, liveCount = 0, mineCount = 0, tone = 'upcoming', tz, collapsed, onToggleCollapse, hoy }: {
  dateKey: string
  count: number
  /** El día llega plegado: se ve su cabecera y su resumen, no sus partidos. */
  collapsed?: boolean
  onToggleCollapse?: () => void
  /** El día viene CURADO (modo Destacados): el contador dice "N destacados", no
   *  "N partidos". Decía "8 partidos" en un sábado que tuvo 96 y parecía que
   *  ese día apenas se jugó. [José Tomás, 26/08/2026] */
  curated?: boolean
  /** Partidos EN VIVO dentro del día (píldora roja en el resumen). */
  liveCount?: number
  /** Partidos con un equipo favorito del usuario ("N tuyos"). */
  mineCount?: number
  tone?: 'upcoming' | 'past'
  tz?: string
  /** Día de hoy (YYYY-MM-DD en `tz`) SELLADO POR EL SERVIDOR. Sin él, servidor
   *  y navegador miran relojes distintos sobre un HTML cacheado y la cabecera
   *  sale "Hoy" en uno y "Vie 4 Sep" en el otro → fallo de hidratación (#418). */
  hoy?: string
}) {
  const today = hoy ?? isoToLocalDate(new Date().toISOString(), tz)
  const isToday = dateKey === today
  // FASE 3: cabecera de día como la app/maqueta — barra MORADA de marca para HOY
  // (identidad), gris neutro el resto; sin brillo ni gradiente de color. Los días
  // pasados atenúan el label. Contador con texto "N partidos".
  const subtitle = formatDateSubtitle(dateKey)
  const label = formatDateLabel(dateKey, tz, today)

  // Cabecera de día como la maqueta 3 de noviembre: «HOY» en Barlow Condensed,
  // la fecha larga al lado y el recuento en una píldora. Sin barra de color.
  return (
    <div className="relative pt-6 pb-3 mb-1">
      <div className="absolute top-0 left-0 right-0" style={{ height: 1, background: 'var(--border)' }} />
      <div className="flex items-baseline gap-2.5 min-w-0">
        <Link href={`/calendario/dia/${dateKey}`} prefetch={false} className="no-underline hover:brightness-125 flex-shrink-0">
          <h2 className="font-extrabold leading-none uppercase" style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.04em', color: tone === 'past' ? '#B8B8C8' : isToday ? 'var(--text-primary)' : '#F0F0FA' }}>
            {label}
          </h2>
        </Link>
        {subtitle && (
          <p className="text-[13px] truncate" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
        <span className="ml-auto inline-flex items-center justify-center gap-1 flex-shrink-0 rounded-full text-[11px] font-bold uppercase tabular-nums"
          style={{ height: 22, padding: '0 9px', letterSpacing: '0.06em', background: 'var(--bg-surface)', border: '1px solid var(--border-2)', color: isToday ? '#C4B5FD' : 'var(--text-primary)', fontFamily: 'var(--font-sport)' }}>
          {count} {curated ? (count === 1 ? 'destacado' : 'destacados') : count === 1 ? 'partido' : 'partidos'}
          {liveCount > 0 && <span style={{ color: '#FF6349' }}>· {liveCount} en vivo</span>}
          {mineCount > 0 && <span style={{ color: '#6EE7B7' }}>· {mineCount} {mineCount === 1 ? 'tuyo' : 'tuyos'}</span>}
        </span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Desplegar ${label}` : `Plegar ${label}`}
            className="flex-shrink-0 flex items-center justify-center rounded-full transition-colors hover:bg-white/[0.06] self-center"
            style={{ width: 32, height: 32, color: collapsed ? '#C4B5FD' : '#5A5A6E', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 180ms' }}>
              <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// Día PLEGADO en Destacados: una fila de ~56 px en vez de la cabecera grande.
// Izquierda, la fecha y cuántos partidos trae; derecha, su partido estrella y la
// hora, que es lo que decide si merece la pena abrirlo. Tocar en cualquier parte
// lo despliega (y entonces vuelve la cabecera normal, con su chevron para
// plegar). Solo se pinta tras hidratar, como todo el plegado: el HTML del
// servidor sigue trayendo los días abiertos.
export function DayCompactRow({ dateKey, count, curated = false, liveCount = 0, mineCount = 0, star, tz, hoy, onExpand }: {
  dateKey: string
  count: number
  curated?: boolean
  liveCount?: number
  mineCount?: number
  /** El partido que encabeza el día (el primero de la curación de Destacados). */
  star?: SportEvent
  tz?: string
  /** Día de hoy SELLADO POR EL SERVIDOR (ver DaySeparator). */
  hoy: string
  onExpand: () => void
}) {
  const isToday = dateKey === hoy
  const past = dateKey < hoy
  const label = formatDateLabel(dateKey, tz, hoy)
  const accent = star ? accentForSport(star.sport, '#A78BFA') : '#A78BFA'
  const hasScore = star?.homeScore != null && star?.awayScore != null
  const clock = !star
    ? ''
    : hasScore
      ? `${star.homeScore}-${star.awayScore}`
      : star.timeTbd
        ? '—'
        : (tz && tz !== SOURCE_TZ ? convertEventTime(star.time, tz, star.isoDate) : star.time) || '—'
  const comp = star ? shortCompName(star.comp, star.sport) : ''
  const noun = curated ? (count === 1 ? 'destacado' : 'destacados') : count === 1 ? 'partido' : 'partidos'

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-expanded={false}
      aria-label={`Desplegar ${label}: ${count} ${noun}`}
      className="cal-press w-full flex items-center gap-3 px-3.5 mb-1.5 rounded-2xl text-left transition-colors hover:bg-white/[0.05]"
      style={{
        height: 56,
        background: 'var(--bg-card)',
        border: `1px solid ${isToday ? 'rgba(124,58,237,0.35)' : 'var(--border)'}`,
        cursor: 'pointer',
      }}
    >
      <span className="flex flex-col flex-shrink-0 min-w-0" style={{ width: 92 }}>
        <span
          className="font-black uppercase leading-none tracking-[0.12em] truncate"
          style={{ fontFamily: 'var(--font-sport)', fontSize: 13, color: past ? '#B8B8C8' : '#F0F0FA' }}
        >
          {label}
        </span>
        <span className="mt-1 text-[11px] font-bold tabular-nums leading-none truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          {count} {noun}
          {liveCount > 0 && <span style={{ color: '#FF6349' }}> · {liveCount} en vivo</span>}
          {mineCount > 0 && liveCount === 0 && <span style={{ color: '#6EE7B7' }}> · {mineCount} {mineCount === 1 ? 'tuyo' : 'tuyos'}</span>}
        </span>
      </span>
      <span className="self-stretch my-2.5 flex-shrink-0" style={{ width: 1, background: 'rgba(255,255,255,0.07)' }} aria-hidden />
      {star ? (
        <span className="flex flex-col min-w-0 flex-1">
          <span className="truncate text-[13px] font-semibold leading-tight" style={{ color: '#E8E8F4' }}>
            {star.away ? `${star.home} – ${star.away}` : star.home}
          </span>
          {comp && (
            <span className="truncate text-[11px] font-bold uppercase tracking-wider leading-tight mt-0.5" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
              {comp}
            </span>
          )}
        </span>
      ) : (
        <span className="flex-1" />
      )}
      {clock && (
        <span className="flex-shrink-0 text-[14px] font-bold tabular-nums" style={{ color: hasScore ? 'var(--text-primary)' : 'var(--green)', fontFamily: 'var(--font-display)' }}>
          {clock}
        </span>
      )}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="flex-shrink-0" style={{ color: '#5A5A6E', transform: 'rotate(-90deg)' }}>
        <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export function SectionHeader({ icon, label, color, count, hint }: {
  icon: React.ReactNode; label: string; color: string; count?: number; hint?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span className="inline-flex items-center" style={{ color }}>{icon}</span>
      <span className="text-[12px] font-bold uppercase tracking-[0.12em]"
        style={{ color, fontFamily: 'var(--font-sport)' }}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-bold"
          style={{ background: `${color}22`, color, fontFamily: 'var(--font-display)' }}>
          {count}
        </span>
      )}
      {hint && (
        <span className="text-[11px] ml-auto" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}

// Los directos huérfanos, en una lista a ancho completo (antes, un carrusel de
// tarjetas de 300 px con flechas). Misma tarjeta-lista que el resto del día.
export function LiveHeroStrip({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="ts-lista">
      {items.map((item, i) => <div key={i}>{item}</div>)}
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
  // Solo comparamos las props que AFECTAN al render compacto. isFav/showReason
  // no se pintan. formHome/formAway SÍ se pintan (barritas de forma, Fase 1 del
  // rediseño); comparación por referencia — recentForms se construye una vez en
  // el SSR y sus arrays son estables entre renders.
  if (
    a.event !== b.event ||
    a.isReminded !== b.isReminded ||
    a.flashing !== b.flashing ||
    a.homeFav !== b.homeFav ||
    a.awayFav !== b.awayFav ||
    a.formHome !== b.formHome ||
    a.formAway !== b.formAway ||
    a.canPredict !== b.canPredict ||
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

