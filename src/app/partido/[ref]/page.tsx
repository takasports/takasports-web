import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type {
  MatchDetail, MatchStat, ScoringEvent, BasketballLeader, MmaFighter,
  RacingResult, GolfLeader, LineupPlayer, TeamLineup, CommentaryEntry,
} from '@/app/api/match/[ref]/route'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import { MatchTabs } from './MatchTabs'
import { LeagueTableBlock } from './LeagueTable'
import { LiveRefresh } from './LiveRefresh'
import { StickyScoreBar } from './StickyScoreBar'
import { ShareButton } from '@/components/ShareButton'
import { AddToCalendarButton } from '@/components/AddToCalendarButton'
import MatchNews from '@/components/MatchNews'
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'
import { isSplitBroadcast } from '@/lib/broadcasts'
import { GoalIcon, YellowCardIcon, RedCardIcon } from '@/components/icons/GameIcons'
import { fetchH2H, fetchRecentFormByTeams, type H2HResult, type FormResult } from '@/lib/past-events'

// Cache 2 min en ISR. Partidos en vivo se refrescan a 30s vía LiveRefresh
// (router.refresh client-side), partidos finalizados aprovechan el cache.
// Reduce 4× los renders SSR para bots crawleando partidos viejos.
export const revalidate = 120

// ── Metadata ───────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  const match    = await fetchMatchDetail(ref)
  // Nota: el título NO debe llevar "| TakaSports" — la plantilla del layout raíz
  // (title.template '%s | TakaSports') ya lo añade. Incluirlo aquí lo duplicaba.
  if (!match) return { title: 'Partido' }

  let title = ''
  let description = ''

  if (match.homeTeam && match.awayTeam) {
    const score = match.homeScore != null && match.awayScore != null
      ? ` ${match.homeScore}–${match.awayScore}`
      : ''
    title = `${match.homeTeam}${score} ${match.awayTeam} · ${match.leagueLabel}`
    description = `${match.statusLabel} · ${match.homeTeam} vs ${match.awayTeam}${match.venue ? ` en ${match.venue}` : ''}`
  } else if (match.mma?.fighters?.length) {
    const [a, b] = match.mma.fighters
    title = `${a?.name ?? '?'} vs ${b?.name ?? '?'} · UFC`
    description = `${match.mma.weightClass ?? 'UFC'} · ${match.statusLabel}`
  } else {
    title = match.leagueLabel
    description = match.statusLabel
  }

  // No fijamos openGraph.images ni twitter.images aquí: dejamos que el archivo
  // opengraph-image.tsx (1200×630, tarjeta grande con escudos+marcador) los
  // genere. Antes se pisaba con el logo de ESPN a 200×200 → preview borroso en
  // redes pese a declarar summary_large_image.
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/partido/${ref}` },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'TakaSports',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: '@takasportsx',
    },
  }
}

const LIVE_STATUSES = new Set([
  'STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_FIRST_HALF', 'STATUS_SECOND_HALF',
  'STATUS_END_PERIOD', 'STATUS_OVERTIME', 'STATUS_SHOOTOUT',
])
const isLive = (s: string) => LIVE_STATUSES.has(s)

// Estados terminales según ESPN. Incluye variantes que aparecieron en
// producción y que antes caían al limbo: ni "en vivo" ni "finalizado"
// (p.ej. STATUS_FINAL_PEN tras la final UCL PSG-Arsenal). Cualquier estado
// nuevo de la familia FINAL/POST debería añadirse aquí.
const FINISHED_STATUSES = new Set([
  'STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FINAL_PEN', 'STATUS_FINAL_AET',
  'STATUS_POST_GAME', 'STATUS_END_OF_REGULATION',
  'STATUS_CANCELED', 'STATUS_POSTPONED', 'STATUS_ABANDONED',
  'STATUS_FORFEIT', 'STATUS_WALKOVER', 'STATUS_SUSPENDED', 'STATUS_RETIRED',
])
const isFinished = (s: string) => FINISHED_STATUSES.has(s)

// ── Server fetch ───────────────────────────────────────────────────
async function fetchMatchDetail(ref: string): Promise<MatchDetail | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL
      ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
    const res  = await fetch(`${base}/api/match/${ref}`, { next: { revalidate: 15 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Shared primitives ──────────────────────────────────────────────
function TeamLogo({ logo, name, size = 56 }: { logo?: string; name: string; size?: number }) {
  if (logo) {
    return (
      <Image src={logo} alt={name} width={size} height={size} unoptimized
        style={{ width: size, height: size, objectFit: 'contain' }} />
    )
  }
  return (
    <div className="flex items-center justify-center rounded-2xl font-black text-xl"
      style={{
        width: size, height: size,
        background: 'radial-gradient(circle at 50% 32%, rgba(124,58,237,0.18), rgba(255,255,255,0.035))',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#A7A7C0',
        letterSpacing: '0.02em',
      }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function Pill({ children, color = '#A78BFA', bg, border }: { children: React.ReactNode; color?: string; bg?: string; border?: string }) {
  return (
    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
      style={{
        background: bg ?? `${color}1f`,
        color,
        border: border ?? `1px solid ${color}40`,
        fontFamily: 'var(--font-sport)',
      }}>
      {children}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 mb-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-4"
        style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

// Ilustraciones monolínea ligeras (inline SVG, ~0 peso) para los estados vacíos.
// Dan contexto visual sin coste ni red. Tinte muy tenue para no competir con el
// contenido real cuando llega.
type EmptyKind = 'lineup' | 'stats' | 'h2h' | 'events' | 'table'
function EmptyGlyph({ kind, size = 40 }: { kind?: EmptyKind; size?: number }) {
  const p = {
    width: size, height: size, viewBox: '0 0 48 48', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }
  switch (kind) {
    case 'lineup':
      return (<svg {...p}><rect x="6" y="9" width="36" height="30" rx="3" /><path d="M24 9v30" /><circle cx="24" cy="24" r="5" /><path d="M6 17h5v14H6M42 17h-5v14h5" /></svg>)
    case 'stats':
      return (<svg {...p}><path d="M6 41h36" /><path d="M12 41V25M22 41V11M32 41V19" /></svg>)
    case 'h2h':
      return (<svg {...p}><circle cx="17" cy="24" r="8.5" /><circle cx="31" cy="24" r="8.5" /></svg>)
    case 'table':
      return (<svg {...p}><rect x="8" y="11" width="32" height="26" rx="2.5" /><path d="M8 20h32M8 28.5h32M17 11v26" /></svg>)
    case 'events':
    default:
      return (<svg {...p}><circle cx="24" cy="24" r="15" /><path d="M24 15v9l6 4" /></svg>)
  }
}

function EmptyState({ message, kind }: { message: string; kind?: EmptyKind }) {
  return (
    <div className="text-center py-12 rounded-xl flex flex-col items-center gap-3"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
      <span style={{ color: '#3A3A48' }} aria-hidden><EmptyGlyph kind={kind} /></span>
      <p className="text-[12px] font-semibold max-w-xs" style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
        {message}
      </p>
    </div>
  )
}

// ── Scoreboard hero ────────────────────────────────────────────────
function TeamScoreboard({ match }: { match: MatchDetail }) {
  const live = isLive(match.status)
  const hasScore = match.homeScore != null && match.awayScore != null
  return (
    <div className="rounded-2xl p-6 mb-5"
      style={{
        background: live
          ? 'linear-gradient(135deg, rgba(239,68,68,0.07) 0%, rgba(9,9,15,0.85) 60%)'
          : 'rgba(255,255,255,0.025)',
        border: live ? '1px solid rgba(239,68,68,0.22)' : '1px solid rgba(255,255,255,0.06)',
      }}>
      <div className="flex items-center justify-between gap-4">
        {/* Home team */}
        {match.homeTeamId ? (
          <Link href={`/equipo/${match.leagueSlug.replace('/', '_')}_${match.homeTeamId}`}
            className="flex flex-col items-center gap-2 flex-1 hover:opacity-80 transition-opacity">
            <TeamLogo logo={match.homeLogo} name={match.homeTeam ?? '—'} size={68} />
            <p className="text-center font-bold text-sm leading-tight"
              style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
              {match.homeAbbr ?? match.homeTeam}
            </p>
          </Link>
        ) : (
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamLogo logo={match.homeLogo} name={match.homeTeam ?? '—'} size={68} />
            <p className="text-center font-bold text-sm leading-tight"
              style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
              {match.homeAbbr ?? match.homeTeam}
            </p>
          </div>
        )}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {live && (
            <span className="flex items-center gap-1.5 leading-none">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444', animation: 'live-pulse 1.6s ease-out infinite' }} />
              <span className="text-[10px] font-black uppercase tracking-[0.14em] tabular-nums" style={{ color: '#EF4444', fontFamily: 'var(--font-sport)' }}>
                {match.statusLabel}
              </span>
            </span>
          )}
          {hasScore ? (
            <p className="font-black tabular-nums flex items-center gap-3 leading-none"
              style={{ color: '#F0F0FA', fontFamily: 'var(--font-headline)', fontSize: 'clamp(38px, 9vw, 56px)' }}>
              <span>{match.homeScore}</span>
              <span style={{ color: '#38384A', fontWeight: 400 }}>·</span>
              <span>{match.awayScore}</span>
            </p>
          ) : (
            <p className="font-black uppercase tracking-[0.12em]"
              style={{ color: '#38384A', fontFamily: 'var(--font-headline)', fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 1 }}>
              vs
            </p>
          )}
          {!live && (
            <span className="text-[10px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded"
              style={{
                color: '#7A7A8E',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontFamily: 'var(--font-sport)',
              }}>
              {match.statusLabel}
            </span>
          )}
        </div>
        {/* Away team */}
        {match.awayTeamId ? (
          <Link href={`/equipo/${match.leagueSlug.replace('/', '_')}_${match.awayTeamId}`}
            className="flex flex-col items-center gap-2 flex-1 hover:opacity-80 transition-opacity">
            <TeamLogo logo={match.awayLogo} name={match.awayTeam ?? '—'} size={68} />
            <p className="text-center font-bold text-sm leading-tight"
              style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
              {match.awayAbbr ?? match.awayTeam}
            </p>
          </Link>
        ) : (
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamLogo logo={match.awayLogo} name={match.awayTeam ?? '—'} size={68} />
            <p className="text-center font-bold text-sm leading-tight"
              style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
              {match.awayAbbr ?? match.awayTeam}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ match }: { match: MatchDetail }) {
  if (!match.venue && !match.broadcast) return null
  return (
    <div className="flex flex-wrap gap-3 mb-5">
      {match.venue && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1C4.34 1 3 2.34 3 4c0 2.5 3 7 3 7s3-4.5 3-7c0-1.66-1.34-3-3-3z" stroke="#5A5A6A" strokeWidth="1.2" />
            <circle cx="6" cy="4" r="1" fill="#5A5A6A" />
          </svg>
          <span className="text-[10px]" style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>{match.venue}</span>
        </div>
      )}
      {match.broadcast && (() => {
        const split = isSplitBroadcast(match.broadcast)
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{
              background: split ? 'rgba(251,191,36,0.07)' : 'rgba(99,102,241,0.08)',
              border: split ? '1px solid rgba(251,191,36,0.22)' : '1px solid rgba(99,102,241,0.20)',
            }}
            title={split ? 'Los derechos están repartidos entre varios canales — consulta LaLiga.com para el canal exacto' : undefined}>
            <span className="text-[10px]">📺</span>
            <span className="text-[10px] font-bold"
              style={{ color: split ? '#D4A017' : '#A5B4FC', fontFamily: 'var(--font-sport)' }}>
              {match.broadcast}
            </span>
            {split && (
              <span className="text-[9px]" style={{ color: '#A07C10', fontFamily: 'var(--font-sport)' }}>
                ⚠
              </span>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ── Stats bar ──────────────────────────────────────────────────────
function StatBar({ stat }: { stat: MatchStat }) {
  const hNum = parseFloat(stat.home.replace('%', '').replace(',', '.'))
  const aNum = parseFloat(stat.away.replace('%', '').replace(',', '.'))
  const total = hNum + aNum
  const homePct = total > 0 ? (hNum / total) * 100 : 50
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px]" style={{ fontFamily: 'var(--font-sport)' }}>
        <span className="font-black" style={{ color: '#E0E0F0' }}>{stat.home}</span>
        <span className="font-semibold uppercase tracking-widest text-[9px]" style={{ color: '#5A5A6A' }}>{stat.label}</span>
        <span className="font-black" style={{ color: '#E0E0F0' }}>{stat.away}</span>
      </div>
      {!isNaN(homePct) && (
        <div className="flex rounded-full overflow-hidden h-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ width: `${homePct}%`, background: '#7C3AED', transition: 'width 0.8s ease' }} />
          <div style={{ flex: 1, background: '#F59E0B' }} />
        </div>
      )}
    </div>
  )
}

// ── Soccer blocks ──────────────────────────────────────────────────
// Nombre de jugador → enlace a su ficha /jugador cuando conocemos su id ESPN.
// Hereda color/tipografía del contenedor; sin id, texto plano. El slug sigue el
// mismo formato que la alineación: '<sport>_<league>_<athleteId>'.
function PlayerName({ name, playerId, leagueSlug, className }: {
  name: string
  playerId?: string
  leagueSlug?: string
  className?: string
}) {
  if (playerId && leagueSlug) {
    return (
      <Link
        href={`/jugador/${leagueSlug.replace('/', '_')}_${playerId}`}
        className={`hover:underline ${className ?? ''}`}
        style={{ color: 'inherit', textDecoration: 'none' }}
      >
        {name}
      </Link>
    )
  }
  return <>{name}</>
}

function ScoringTimeline({ events, homeTeam, awayTeam, leagueSlug }: { events: ScoringEvent[]; homeTeam: string; awayTeam: string; leagueSlug?: string }) {
  if (events.length === 0) return null

  const iconFor = (type: string) => {
    if (type === 'yellow') return <YellowCardIcon size={14} />
    if (type === 'red')    return <RedCardIcon size={14} />
    if (type === 'goal' || type === 'penalty')
      return <span style={{ color: '#86EFAC', display: 'inline-flex' }}><GoalIcon size={14} /></span>
    if (type === 'own-goal')
      return <span style={{ color: '#FCA5A5', display: 'inline-flex' }}><GoalIcon size={14} /></span>
    return <span>•</span>
  }

  const typeLabel = (type: string): string | null => {
    if (type === 'penalty') return 'Penalti'
    if (type === 'own-goal') return 'En propia'
    if (type === 'yellow') return 'Amarilla'
    if (type === 'red') return 'Roja'
    return null
  }

  const accentFor = (type: string) =>
    type === 'goal' || type === 'penalty' ? '#86EFAC'
    : type === 'own-goal' ? '#FCA5A5'
    : type === 'yellow' ? '#FBBF24'
    : type === 'red' ? '#EF4444'
    : '#7A7A8E'

  return (
    <div className="relative">
      {/* Center rail */}
      <div
        aria-hidden
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ width: 1, background: 'linear-gradient(180deg, transparent 0%, rgba(124,58,237,0.18) 8%, rgba(124,58,237,0.18) 92%, transparent 100%)' }}
      />
      <div className="flex flex-col gap-3">
        {events.map((ev, i) => {
          const isHome = ev.team === 'home'
          const accent = accentFor(ev.type)
          const sub = typeLabel(ev.type)
          return (
            <div key={i} className="relative grid items-center gap-2"
              style={{ gridTemplateColumns: '1fr 44px 1fr' }}>
              {/* Home side */}
              <div className={`flex items-center gap-2 ${isHome ? 'justify-end text-right pr-1' : 'opacity-0 pointer-events-none'}`}>
                {isHome && (
                  <>
                    <div className="min-w-0 flex flex-col items-end">
                      <span className="text-[12px] font-bold leading-tight truncate"
                        style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                        <PlayerName name={ev.player ?? homeTeam} playerId={ev.playerId} leagueSlug={leagueSlug} />
                      </span>
                      {sub && (
                        <span className="text-[9px] uppercase tracking-wider mt-0.5"
                          style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                          {sub}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center justify-center flex-shrink-0"
                      style={{ width: 22, height: 22, borderRadius: 999, background: `${accent}1a`, border: `1px solid ${accent}33` }}>
                      {iconFor(ev.type)}
                    </span>
                  </>
                )}
              </div>

              {/* Minute pill (center rail) */}
              <div className="flex justify-center">
                <span
                  className="inline-flex items-center justify-center px-2 py-0.5 rounded-full tabular-nums text-[10px] font-black"
                  style={{
                    minWidth: 36,
                    color: '#C4B5FD',
                    background: 'var(--bg-base)',
                    border: '1px solid rgba(124,58,237,0.35)',
                    fontFamily: 'var(--font-sport)',
                  }}>
                  {ev.clock ?? '—'}
                </span>
              </div>

              {/* Away side */}
              <div className={`flex items-center gap-2 ${!isHome ? 'pl-1' : 'opacity-0 pointer-events-none'}`}>
                {!isHome && (
                  <>
                    <span className="inline-flex items-center justify-center flex-shrink-0"
                      style={{ width: 22, height: 22, borderRadius: 999, background: `${accent}1a`, border: `1px solid ${accent}33` }}>
                      {iconFor(ev.type)}
                    </span>
                    <div className="min-w-0 flex flex-col">
                      <span className="text-[12px] font-bold leading-tight truncate"
                        style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                        <PlayerName name={ev.player ?? awayTeam} playerId={ev.playerId} leagueSlug={leagueSlug} />
                      </span>
                      {sub && (
                        <span className="text-[9px] uppercase tracking-wider mt-0.5"
                          style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                          {sub}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Minuto a minuto (commentary) ───────────────────────────────────
function CommentaryFeed({ entries, homeTeam, awayTeam }: {
  entries: CommentaryEntry[]; homeTeam?: string; awayTeam?: string
}) {
  if (!entries.length) return null

  const colorFor = (e: CommentaryEntry): string => {
    if (e.type === 'goal' || e.type === 'penalty-goal' || e.type === 'penalty') return '#86EFAC'
    if (e.type === 'own-goal') return '#FCA5A5'
    if (e.type === 'yellow-card') return '#FBBF24'
    if (e.type === 'red-card' || e.type === 'yellow-red-card') return '#EF4444'
    if (e.type === 'substitution') return '#34D399'
    if (e.type === 'var') return '#C4B5FD'
    return e.team === 'home' ? '#A78BFA' : e.team === 'away' ? '#F59E0B' : '#5A5A6A'
  }

  const iconFor = (e: CommentaryEntry, accent: string) => {
    if (e.type === 'goal' || e.type === 'penalty-goal' || e.type === 'penalty')
      return <span style={{ color: '#86EFAC', display: 'inline-flex' }}><GoalIcon size={13} /></span>
    if (e.type === 'own-goal')
      return <span style={{ color: '#FCA5A5', display: 'inline-flex' }}><GoalIcon size={13} /></span>
    if (e.type === 'yellow-card') return <YellowCardIcon size={12} />
    if (e.type === 'red-card' || e.type === 'yellow-red-card') return <RedCardIcon size={12} />
    if (e.type === 'substitution')
      return (
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M3 4h6l-2-2M11 10H5l2 2" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    return <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
  }

  return (
    <Section title="Minuto a minuto">
      <ol className="relative flex flex-col">
        {/* Rail vertical */}
        <span aria-hidden className="absolute top-1 bottom-1 pointer-events-none"
          style={{ left: 51, width: 1, background: 'linear-gradient(180deg, transparent, rgba(124,58,237,0.18) 6%, rgba(124,58,237,0.18) 94%, transparent)' }} />
        {entries.map((e, i) => {
          const accent = colorFor(e)
          // Marcadores sin equipo (Descanso, 2ª parte, Final) → fila centrada.
          if (!e.team) {
            return (
              <li key={i} className="flex justify-center py-2.5">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] px-3 py-1 rounded-full"
                  style={{ color: '#8A8AA0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-sport)' }}>
                  {[e.minute, e.label].filter(Boolean).join('  ·  ')}
                </span>
              </li>
            )
          }
          return (
            <li key={i} className="relative grid items-center gap-2 py-1.5"
              style={{ gridTemplateColumns: '40px 24px 1fr' }}>
              <span className="text-right tabular-nums text-[10px] font-black"
                style={{ color: e.key ? '#C4B5FD' : '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
                {e.minute ?? ''}
              </span>
              <span className="inline-flex items-center justify-center flex-shrink-0 z-10"
                style={{ width: 22, height: 22, borderRadius: 999, background: e.key ? `${accent}1a` : 'var(--bg-base)', border: `1px solid ${accent}${e.key ? '40' : '26'}` }}>
                {iconFor(e, accent)}
              </span>
              <div className="min-w-0">
                <span className={e.key ? 'text-[12px] font-black' : 'text-[11px] font-semibold'}
                  style={{ color: e.key ? '#E8E8F4' : '#9A9AB0', fontFamily: 'var(--font-sport)' }}>
                  {e.label}
                </span>
                {e.player && (
                  <span className="text-[11px]" style={{ color: e.key ? '#C0C0D4' : '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                    {' · '}{e.player}
                  </span>
                )}
                {e.assist && (
                  <span className="text-[10px]" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
                    {' '}(asist. {e.assist})
                  </span>
                )}
                <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full align-middle"
                  style={{ background: e.team === 'home' ? '#A78BFA' : '#F59E0B', opacity: 0.7 }}
                  title={e.team === 'home' ? homeTeam : awayTeam} />
              </div>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}

// ── Basketball blocks ──────────────────────────────────────────────
function QuarterTable({ home, away, homeAbbr, awayAbbr }: {
  home: (number | null)[]; away: (number | null)[]; homeAbbr: string; awayAbbr: string
}) {
  const len = Math.max(home.length, away.length)
  if (len === 0) return null
  const labels = Array.from({ length: len }, (_, i) => i < 4 ? `Q${i + 1}` : `OT${i - 3}`)
  const sum = (arr: (number | null)[]) => arr.reduce<number>((a, v) => a + (v ?? 0), 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]" style={{ fontFamily: 'var(--font-sport)' }}>
        <thead>
          <tr style={{ color: '#5A5A6A' }}>
            <th className="text-left font-semibold pb-2">EQUIPO</th>
            {labels.map(l => <th key={l} className="font-semibold pb-2 px-1 tabular-nums" style={{ width: 32 }}>{l}</th>)}
            <th className="font-black pb-2 px-1 tabular-nums" style={{ color: '#E0E0F0' }}>T</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ color: '#D0D0E8' }}>
            <td className="font-black py-1" style={{ color: '#A78BFA' }}>{homeAbbr}</td>
            {Array.from({ length: len }).map((_, i) => <td key={i} className="text-center tabular-nums">{home[i] ?? '—'}</td>)}
            <td className="text-center font-black tabular-nums" style={{ color: '#F0F0F8' }}>{sum(home) || '—'}</td>
          </tr>
          <tr style={{ color: '#D0D0E8' }}>
            <td className="font-black py-1" style={{ color: '#F59E0B' }}>{awayAbbr}</td>
            {Array.from({ length: len }).map((_, i) => <td key={i} className="text-center tabular-nums">{away[i] ?? '—'}</td>)}
            <td className="text-center font-black tabular-nums" style={{ color: '#F0F0F8' }}>{sum(away) || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function LeaderCard({ leader, leagueSlug }: { leader: BasketballLeader; leagueSlug?: string }) {
  const accent = leader.team === 'home' ? '#A78BFA' : '#F59E0B'
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
      {leader.headshot
        ? <Image src={leader.headshot} alt={leader.player} width={36} height={36} unoptimized className="rounded-full" style={{ objectFit: 'cover', background: '#1A1A28' }} />
        : <div className="w-9 h-9 rounded-full" style={{ background: '#1A1A28' }} />
      }
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
          <PlayerName name={leader.player} playerId={leader.playerId} leagueSlug={leagueSlug} />
        </p>
        <p className="text-[9px] uppercase tracking-widest" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>{leader.category}</p>
      </div>
      <div className="text-right">
        <p className="font-black tabular-nums" style={{ color: accent, fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1 }}>{leader.value}</p>
        {leader.summary && (
          <p className="text-[9px]" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>{leader.summary}</p>
        )}
      </div>
    </div>
  )
}

// ── Tennis block ───────────────────────────────────────────────────
function TennisBlock({ match }: { match: MatchDetail }) {
  if (!match.tennis) return null
  const t = match.tennis
  const setCount = Math.max(t.sets.home.length, t.sets.away.length)
  return (
    <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {t.round && (
        <p className="text-[10px] font-black uppercase tracking-widest text-center mb-3"
          style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
          {t.round}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {(['home', 'away'] as const).map(side => {
          const player = side === 'home' ? t.homePlayer : t.awayPlayer
          const sets   = side === 'home' ? t.sets.home  : t.sets.away
          return (
            <div key={side} className="flex items-center justify-between gap-3">
              <span className="font-black text-sm" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
                {player ?? '—'}
              </span>
              <div className="flex gap-2">
                {Array.from({ length: setCount }).map((_, i) => (
                  <span key={i} className="w-7 h-7 flex items-center justify-center rounded-md font-black tabular-nums text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      color: side === 'home' ? '#A78BFA' : '#F59E0B',
                      fontFamily: 'var(--font-display)',
                    }}>
                    {sets[i] ?? '—'}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-center mt-4 uppercase tracking-widest font-black"
        style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
        {match.statusLabel}
      </p>
    </div>
  )
}

// ── MMA block ──────────────────────────────────────────────────────
function FighterCard({ fighter, side }: { fighter: MmaFighter; side: 'home' | 'away' }) {
  const accent = fighter.winner ? '#4ade80' : '#5A5A6A'
  return (
    <div className={`flex flex-col ${side === 'away' ? 'items-end text-right' : 'items-start text-left'} gap-2 flex-1`}>
      {fighter.headshot
        ? <Image src={fighter.headshot} alt={fighter.name} width={72} height={72} unoptimized className="rounded-full"
            style={{ objectFit: 'cover', background: '#1A1A28', border: fighter.winner ? '2px solid #4ade80' : '2px solid rgba(255,255,255,0.06)' }} />
        : <div className="w-[72px] h-[72px] rounded-full" style={{ background: '#1A1A28' }} />
      }
      <p className="font-black text-sm leading-tight" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
        {fighter.name}
      </p>
      {fighter.flag && <p className="text-[10px]" style={{ color: '#6A6A7A' }}>{fighter.flag}</p>}
      {fighter.record && <p className="text-[10px] tabular-nums" style={{ color: '#8A8AA0' }}>{fighter.record}</p>}
      {fighter.winner && (
        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
          style={{ background: 'rgba(74,222,128,0.12)', color: accent, border: '1px solid rgba(74,222,128,0.3)', fontFamily: 'var(--font-sport)' }}>
          Ganador
        </span>
      )}
    </div>
  )
}

function MmaBlock({ match }: { match: MatchDetail }) {
  if (!match.mma) return null
  const m = match.mma
  const [a, b] = m.fighters
  return (
    <>
      <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {(m.weightClass || m.cardName) && (
          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
            {m.weightClass && <Pill color="#f87171">{m.weightClass}</Pill>}
            {m.cardName && (
              <span className="text-[10px] uppercase tracking-widest" style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>
                {m.cardName}
              </span>
            )}
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          {a ? <FighterCard fighter={a} side="home" /> : <div className="flex-1" />}
          <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0 pt-6">
            <span className="font-black" style={{ color: '#3A3A5A', fontFamily: 'var(--font-display)', fontSize: 22 }}>vs</span>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ color: '#5A5A6A', background: 'rgba(255,255,255,0.04)', fontFamily: 'var(--font-sport)' }}>
              {match.statusLabel}
            </span>
          </div>
          {b ? <FighterCard fighter={b} side="away" /> : <div className="flex-1" />}
        </div>
      </div>
      <Section title="Detalles del combate">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>Rounds</p>
            <p className="text-sm font-black" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
              {m.rounds ? `${m.rounds} programados` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>Final</p>
            <p className="text-sm font-black" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
              {m.endRound ? `R${m.endRound}${m.endTime ? ` · ${m.endTime}` : ''}` : '—'}
            </p>
          </div>
        </div>
        {m.note && (
          <p className="text-[11px] mt-3" style={{ color: '#8A8AA0', fontFamily: 'var(--font-sport)' }}>{m.note}</p>
        )}
      </Section>
    </>
  )
}

// ── Racing block ───────────────────────────────────────────────────
function RacingBlock({ match }: { match: MatchDetail }) {
  if (!match.racing) return null
  const r = match.racing
  return (
    <>
      <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {r.circuit && (
          <p className="text-[10px] font-black uppercase tracking-widest text-center mb-2"
            style={{ color: '#9CA3AF', fontFamily: 'var(--font-sport)' }}>
            {r.circuit}
          </p>
        )}
        <p className="text-center font-black"
          style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', fontSize: 22 }}>
          {match.statusLabel}
        </p>
      </div>
      {r.results.length > 0 && (
        <Section title="Top 10">
          <div className="flex flex-col gap-1.5">
            {r.results.map((row: RacingResult, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-md"
                style={{ background: i < 3 ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
                <span className="w-6 text-center font-black tabular-nums"
                  style={{ color: i === 0 ? '#FCD34D' : i === 1 ? '#D1D5DB' : i === 2 ? '#D97706' : '#6A6A7A', fontFamily: 'var(--font-display)' }}>
                  {row.pos}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>{row.driver}</p>
                  {row.team && <p className="text-[10px] truncate" style={{ color: '#6A6A7A', fontFamily: 'var(--font-sport)' }}>{row.team}</p>}
                </div>
                {row.time && (
                  <span className="text-[11px] font-black tabular-nums" style={{ color: '#9CA3AF', fontFamily: 'var(--font-display)' }}>{row.time}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

// ── Golf block ─────────────────────────────────────────────────────
function GolfBlock({ match }: { match: MatchDetail }) {
  if (!match.golf) return null
  const g = match.golf
  return (
    <>
      <div className="rounded-2xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-center font-black"
          style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', fontSize: 22 }}>
          {match.statusLabel}
        </p>
        {g.round && (
          <p className="text-[10px] text-center mt-2 uppercase tracking-widest"
            style={{ color: '#9CA3AF', fontFamily: 'var(--font-sport)' }}>{g.round}</p>
        )}
      </div>
      {g.leaderboard.length > 0 && (
        <Section title="Clasificación">
          <div className="flex flex-col gap-1.5">
            {g.leaderboard.map((row: GolfLeader, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-md">
                <span className="w-8 text-center font-black tabular-nums"
                  style={{ color: '#9CA3AF', fontFamily: 'var(--font-display)' }}>
                  {row.pos}
                </span>
                <p className="flex-1 text-[12px] font-black truncate"
                  style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>{row.player}</p>
                <span className="text-[11px] font-black tabular-nums"
                  style={{ color: '#A78BFA', fontFamily: 'var(--font-display)' }}>{row.score}</span>
                {row.today && (
                  <span className="text-[10px] tabular-nums" style={{ color: '#6A6A7A' }}>{row.today}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

// ── Lineup field ───────────────────────────────────────────────────
function getFormationPositions(formation: string | undefined, side: 'home' | 'away'): [number, number][] {
  const raw   = (formation ?? '4-4-2').split('-').map(Number).filter(n => n > 0 && n <= 6)
  const lines = raw.length > 0 ? raw : [4, 4, 2]
  const positions: [number, number][] = []

  // GK — cada equipo pegado a su portería
  positions.push([50, side === 'home' ? 93 : 7])

  for (let li = 0; li < lines.length; li++) {
    const count = lines[li]
    const ratio = lines.length > 1 ? li / (lines.length - 1) : 0
    // Cada equipo se queda en SU mitad; los delanteros se encuentran cerca del
    // centro sin invadir la mitad rival (evita que se mezclen las dos plantillas).
    const y = side === 'home'
      ? 80 - ratio * 25   // home: defensas 80% → delanteros 55%
      : 20 + ratio * 25   // away: defensas 20% → delanteros 45%
    for (let i = 0; i < count; i++) {
      const x = (i + 1) * 100 / (count + 1)
      positions.push([x, y])
    }
  }
  return positions
}

function playerDisplayName(p: LineupPlayer): string {
  const base = p.shortName ?? p.name
  const parts = base.trim().split(' ')
  return parts.length > 1 ? parts[parts.length - 1] : base
}

function lineupHref(leagueSlug: string | undefined, p: LineupPlayer): string | undefined {
  return leagueSlug && p.id ? `/jugador/${leagueSlug.replace('/', '_')}_${p.id}` : undefined
}

interface PlayerMarks { goals: number; yellow: boolean; red: boolean }

function normName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Cruce tolerante entre el nombre del evento (goleador / amonestado) y el de la
// alineación: igualdad, inclusión, o coincidencia del último apellido.
function playerMatches(eventPlayer: string, lineupName: string): boolean {
  const a = normName(eventPlayer), b = normName(lineupName)
  if (!a || !b) return false
  if (a === b || a.includes(b) || b.includes(a)) return true
  const aLast = a.split(' ').pop() ?? '', bLast = b.split(' ').pop() ?? ''
  return aLast.length > 2 && aLast === bLast
}

function marksFor(events: ScoringEvent[], p: LineupPlayer): PlayerMarks {
  let goals = 0, yellow = false, red = false
  for (const e of events) {
    if (!e.player) continue
    const hit = playerMatches(e.player, p.name) || (!!p.shortName && playerMatches(e.player, p.shortName))
    if (!hit) continue
    if (e.type === 'goal' || e.type === 'penalty') goals++
    else if (e.type === 'yellow') yellow = true
    else if (e.type === 'red') red = true
  }
  return { goals, yellow, red }
}

function CardBadge({ color }: { color: string }) {
  return (
    <span style={{
      display: 'block', width: 6, height: 8, borderRadius: 1,
      background: color, boxShadow: '0 1px 2px rgba(0,0,0,0.55)',
    }} />
  )
}

function PlayerDot({ player, x, y, side, leagueSlug, marks }: {
  player: LineupPlayer
  x: number
  y: number
  side: 'home' | 'away'
  leagueSlug?: string
  marks?: PlayerMarks
}) {
  const color  = side === 'home' ? '#A78BFA' : '#F59E0B'
  const label  = playerDisplayName(player)
  const jersey = player.jersey ?? label.slice(0, 2).toUpperCase()
  const href   = lineupHref(leagueSlug, player)
  const goals  = marks?.goals ?? 0
  const hasBadge = goals > 0 || !!marks?.yellow || !!marks?.red

  const dot = (
    <div
      className={`absolute flex flex-col items-center${href ? '' : ' pointer-events-none'}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
      }}
    >
      <div className="relative" style={{ flexShrink: 0 }}>
        <div
          className="flex items-center justify-center rounded-full font-black text-[10px] tabular-nums"
          style={{
            width: 26,
            height: 26,
            background: color,
            color: '#0A0A12',
            border: '2px solid rgba(255,255,255,0.28)',
            boxShadow: `0 2px 8px ${color}66`,
          }}
        >
          {jersey}
        </div>
        {hasBadge && (
          <div className="absolute flex flex-col items-end gap-[1px]" style={{ top: -5, right: -6, zIndex: 3 }}>
            {goals > 0 && (
              <span className="flex items-center" style={{ lineHeight: 1, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))' }}>
                <span style={{ fontSize: 10 }}>⚽</span>
                {goals > 1 && <b style={{ fontSize: 8, color: '#fff', marginLeft: 1, textShadow: '0 1px 2px #000' }}>{goals}</b>}
              </span>
            )}
            {marks?.red ? <CardBadge color="#EF4444" /> : marks?.yellow ? <CardBadge color="#FBBF24" /> : null}
          </div>
        )}
      </div>
      <span
        className="mt-0.5 text-center font-bold leading-tight"
        style={{
          fontSize: 8,
          color: 'rgba(255,255,255,0.92)',
          textShadow: '0 1px 4px rgba(0,0,0,0.95)',
          maxWidth: 44,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label.length > 8 ? label.slice(0, 8) + '.' : label}
      </span>
    </div>
  )
  return href
    ? <Link href={href} prefetch={false} className="contents">{dot}</Link>
    : dot
}

function FieldMarkings() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 200 300"
      preserveAspectRatio="none"
      fill="none"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="1"
    >
      {/* Outer border */}
      <rect x="3" y="3" width="194" height="294" />
      {/* Center line */}
      <line x1="3" y1="150" x2="197" y2="150" />
      {/* Center circle (approx, will be elliptical) */}
      <ellipse cx="100" cy="150" rx="30" ry="20" />
      <circle cx="100" cy="150" r="2" fill="rgba(255,255,255,0.18)" stroke="none" />
      {/* Home penalty area (bottom) */}
      <rect x="40" y="228" width="120" height="63" />
      {/* Home 6-yard box */}
      <rect x="72" y="268" width="56" height="23" />
      {/* Away penalty area (top) */}
      <rect x="40" y="9" width="120" height="63" />
      {/* Away 6-yard box */}
      <rect x="72" y="9" width="56" height="23" />
      {/* Home penalty spot */}
      <circle cx="100" cy="246" r="1.5" fill="rgba(255,255,255,0.18)" stroke="none" />
      {/* Away penalty spot */}
      <circle cx="100" cy="54" r="1.5" fill="rgba(255,255,255,0.18)" stroke="none" />
      {/* Home goal */}
      <rect x="82" y="294" width="36" height="6" strokeWidth="1.5" />
      {/* Away goal */}
      <rect x="82" y="0" width="36" height="6" strokeWidth="1.5" />
    </svg>
  )
}

function BenchSection({ home, away, homeTeam, awayTeam, leagueSlug }: {
  home: TeamLineup
  away: TeamLineup
  homeTeam?: string
  awayTeam?: string
  leagueSlug?: string
}) {
  if (!home.bench.length && !away.bench.length) return null
  return (
    <div className="mt-4 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3">
      {[
        { lineup: away, label: awayTeam ?? 'Visitante', color: '#F59E0B' },
        { lineup: home, label: homeTeam ?? 'Local',     color: '#A78BFA' },
      ].map(({ lineup, label, color }) => (
        <div key={label} className="rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2"
            style={{ color, fontFamily: 'var(--font-sport)' }}>
            {label} — Banquillo
          </p>
          <div className="flex flex-col gap-1">
            {lineup.bench.map((p, i) => {
              const href = lineupHref(leagueSlug, p)
              const nameEl = (
                <span className={`text-[10px] font-semibold truncate${href ? ' hover:underline' : ''}`} style={{ color: '#C0C0D4', fontFamily: 'var(--font-sport)' }}>
                  {playerDisplayName(p)}
                </span>
              )
              return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-[9px] font-black tabular-nums text-right flex-shrink-0"
                  style={{ color: '#5A5A6A' }}>
                  {p.jersey ?? '—'}
                </span>
                {href ? <Link href={href} prefetch={false}>{nameEl}</Link> : nameEl}
                {p.posAbbr && (
                  <span className="text-[8px] ml-auto flex-shrink-0 px-1 py-0.5 rounded"
                    style={{ background: `${color}18`, color, fontFamily: 'var(--font-sport)' }}>
                    {p.posAbbr}
                  </span>
                )}
              </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function LineupField({ lineups, homeTeam, awayTeam, leagueSlug, scoring }: {
  lineups: NonNullable<MatchDetail['lineups']>
  homeTeam?: string
  awayTeam?: string
  leagueSlug?: string
  scoring?: ScoringEvent[]
}) {
  const homePositions = getFormationPositions(lineups.home.formation, 'home')
  const awayPositions = getFormationPositions(lineups.away.formation, 'away')
  const homeScoring = (scoring ?? []).filter(e => e.team === 'home')
  const awayScoring = (scoring ?? []).filter(e => e.team === 'away')

  return (
    <div>
      {/* Formation header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: '#F59E0B', fontFamily: 'var(--font-sport)' }}>
            {awayTeam ?? 'Visitante'}
          </span>
          <span className="text-[14px] font-black tabular-nums" style={{ color: '#F59E0B', fontFamily: 'var(--font-display)' }}>
            {lineups.away.formation ?? '—'}
          </span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
          Formaciones
        </span>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
            {homeTeam ?? 'Local'}
          </span>
          <span className="text-[14px] font-black tabular-nums" style={{ color: '#A78BFA', fontFamily: 'var(--font-display)' }}>
            {lineups.home.formation ?? '—'}
          </span>
        </div>
      </div>

      {/* Field */}
      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{
          aspectRatio: '2/3',
          background: 'linear-gradient(180deg, #1b4a1b 0%, #1e5a1e 48%, #1b5018 52%, #1b4a1b 100%)',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* Grass stripes */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="absolute w-full pointer-events-none"
            style={{
              top: `${i * 10}%`,
              height: '10%',
              background: i % 2 === 0 ? 'rgba(0,0,0,0.07)' : 'transparent',
            }}
          />
        ))}

        <FieldMarkings />

        {/* Away players (top) */}
        {lineups.away.starters.map((player, i) => {
          const [x, y] = awayPositions[i] ?? [50, 20]
          return <PlayerDot key={`away-${i}`} player={player} x={x} y={y} side="away" leagueSlug={leagueSlug} marks={marksFor(awayScoring, player)} />
        })}

        {/* Home players (bottom) */}
        {lineups.home.starters.map((player, i) => {
          const [x, y] = homePositions[i] ?? [50, 80]
          return <PlayerDot key={`home-${i}`} player={player} x={x} y={y} side="home" leagueSlug={leagueSlug} marks={marksFor(homeScoring, player)} />
        })}
      </div>

      {/* Bench */}
      <BenchSection
        home={lineups.home}
        away={lineups.away}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        leagueSlug={leagueSlug}
      />
    </div>
  )
}

// ── Head-to-head block ─────────────────────────────────────────────
// ── Forma reciente (últimos resultados de cada equipo) ──────────────
function FormPips({ form }: { form: FormResult[] }) {
  // Llegan más-reciente-primero; mostramos antiguo→reciente (último a la derecha).
  const ordered = [...form].reverse()
  return (
    <div className="flex items-center gap-1">
      {ordered.map((r, i) => {
        const c = r === 'W' ? '#86EFAC' : r === 'L' ? '#FCA5A5' : '#FBBF24'
        const label = r === 'W' ? 'Victoria' : r === 'L' ? 'Derrota' : 'Empate'
        return (
          <span
            key={i}
            title={label}
            aria-label={label}
            className="inline-flex items-center justify-center font-black text-[9px]"
            style={{ width: 16, height: 16, borderRadius: 4, background: `${c}22`, color: c, border: `1px solid ${c}40`, fontFamily: 'var(--font-sport)' }}
          >
            {r}
          </span>
        )
      })}
    </div>
  )
}

function FormGuide({ homeTeam, awayTeam, forms }: { homeTeam?: string; awayTeam?: string; forms: Record<string, FormResult[]> }) {
  const hf = (homeTeam && forms[homeTeam]) || []
  const af = (awayTeam && forms[awayTeam]) || []
  if (hf.length === 0 && af.length === 0) return null
  return (
    <Section title="Forma reciente">
      <div className="flex flex-col gap-2.5">
        {hf.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-bold truncate" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>{homeTeam}</span>
            <FormPips form={hf} />
          </div>
        )}
        {af.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-bold truncate" style={{ color: '#F59E0B', fontFamily: 'var(--font-sport)' }}>{awayTeam}</span>
            <FormPips form={af} />
          </div>
        )}
      </div>
      <p className="text-[10px] mt-3" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
        Últimos resultados · más reciente a la derecha
      </p>
    </Section>
  )
}

function H2HBlock({ h2h, homeTeam, awayTeam }: { h2h: H2HResult; homeTeam: string; awayTeam: string }) {
  if (h2h.matches.length === 0) {
    return <EmptyState message="Sin enfrentamientos previos registrados" kind="h2h" />
  }

  const total = h2h.wins + h2h.draws + h2h.losses || 1
  const pctH = (h2h.wins / total) * 100
  const pctD = (h2h.draws / total) * 100
  const pctA = (h2h.losses / total) * 100

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
  }

  return (
    <>
      <Section title={`Balance · últimos ${h2h.matches.length}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex flex-col items-start">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
              {homeTeam}
            </span>
            <span className="text-[28px] font-black tabular-nums leading-none"
              style={{ color: '#A78BFA', fontFamily: 'var(--font-headline)' }}>
              {h2h.wins}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
              Empates
            </span>
            <span className="text-[28px] font-black tabular-nums leading-none"
              style={{ color: '#9090A4', fontFamily: 'var(--font-headline)' }}>
              {h2h.draws}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: '#F59E0B', fontFamily: 'var(--font-sport)' }}>
              {awayTeam}
            </span>
            <span className="text-[28px] font-black tabular-nums leading-none"
              style={{ color: '#F59E0B', fontFamily: 'var(--font-headline)' }}>
              {h2h.losses}
            </span>
          </div>
        </div>
        <div className="flex rounded-full overflow-hidden h-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ width: `${pctH}%`, background: '#A78BFA' }} />
          <div style={{ width: `${pctD}%`, background: '#5A5A6A' }} />
          <div style={{ width: `${pctA}%`, background: '#F59E0B' }} />
        </div>
      </Section>

      <Section title="Histórico">
        <div className="flex flex-col gap-1.5">
          {h2h.matches.map(m => {
            const aIsHome = m.home === homeTeam
            const left = aIsHome ? m.homeScore : m.awayScore
            const right = aIsHome ? m.awayScore : m.homeScore
            let result: 'W' | 'D' | 'L' | '?' = '?'
            if (left != null && right != null) {
              result = left > right ? 'W' : left < right ? 'L' : 'D'
            }
            const resultColor = result === 'W' ? '#86EFAC' : result === 'L' ? '#FCA5A5' : result === 'D' ? '#FBBF24' : '#5A5A6A'
            const row = (
              <div className="grid items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:brightness-110"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  gridTemplateColumns: 'auto minmax(0,1fr) auto minmax(0,1fr) auto',
                }}>
                <span className="text-[9px] font-bold tabular-nums uppercase tracking-wider"
                  style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', minWidth: 50 }}>
                  {formatDate(m.isoDate)}
                </span>
                <span className="text-[12px] font-bold truncate text-right pr-1"
                  style={{ color: aIsHome ? '#E8E8F4' : '#9090A4', fontFamily: 'var(--font-sport)' }}>
                  {m.homeAbbr ?? m.home}
                </span>
                <span className="flex items-center gap-1.5 tabular-nums font-black px-2"
                  style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)', fontSize: 14 }}>
                  <span>{m.homeScore ?? '-'}</span>
                  <span style={{ color: '#38384A', fontWeight: 400 }}>·</span>
                  <span>{m.awayScore ?? '-'}</span>
                </span>
                <span className="text-[12px] font-bold truncate pl-1"
                  style={{ color: !aIsHome ? '#E8E8F4' : '#9090A4', fontFamily: 'var(--font-sport)' }}>
                  {m.awayAbbr ?? m.away}
                </span>
                <span className="inline-flex items-center justify-center font-black tabular-nums text-[10px]"
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: `${resultColor}22`,
                    color: resultColor,
                    border: `1px solid ${resultColor}40`,
                    fontFamily: 'var(--font-sport)',
                  }}>
                  {result}
                </span>
              </div>
            )
            return m.matchRef ? (
              <Link key={m.id} href={`/partido/${m.matchRef}`} className="block no-underline">{row}</Link>
            ) : (
              <div key={m.id}>{row}</div>
            )
          })}
        </div>
        <p className="text-[10px] mt-3 text-center" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
          W = victoria local · L = victoria visitante · D = empate
        </p>
      </Section>
    </>
  )
}

// ── Main match content ─────────────────────────────────────────────
function MatchContent({ match, h2h, forms }: { match: MatchDetail; h2h: H2HResult | null; forms: Record<string, FormResult[]> }) {
  const live       = isLive(match.status)
  const isSoccer   = match.sport === 'soccer'
  const isBasket   = match.sport === 'basketball'
  const usesTabs   = isSoccer || isBasket

  const hasLineups = !!(match.lineups?.home.starters.length || match.lineups?.away.starters.length)
  const hasSoccerStats    = isSoccer && (match.soccer?.stats.length ?? 0) > 0
  const hasBasketStats    = isBasket && (match.basketball?.stats.length ?? 0) > 0
  const hasSoccerScoring  = isSoccer && (match.soccer?.scoring.length ?? 0) > 0
  const hasCommentary     = isSoccer && (match.soccer?.commentary?.length ?? 0) > 0
  const hasStats   = hasSoccerStats || hasBasketStats
  const hasTable   = (match.leagueTable?.length ?? 0) > 0
  const hasH2H     = (h2h?.matches.length ?? 0) > 0

  const shareTitle = match.homeTeam && match.awayTeam
    ? `${match.homeTeam} vs ${match.awayTeam} · ${match.leagueLabel}`
    : match.leagueLabel

  // Solo ofrece "Añadir a calendario" si el partido aún no ha terminado
  // y conocemos la fecha exacta de inicio.
  const finishedStatus = isFinished(match.status)
  const showAddToCalendar = !!match.startDate && !finishedStatus

  const backLink = (
    <div className="pt-4 pb-3 flex items-center justify-between">
      <Link
        href="/calendario"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-125"
        style={{
          color: '#8080A0',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          textDecoration: 'none',
          fontFamily: 'var(--font-sport)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M7.5 2L3 6l4.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Calendario
      </Link>
      <div className="flex items-center gap-2">
        {showAddToCalendar && (
          <AddToCalendarButton
            title={shareTitle}
            isoDate={match.startDate!}
            location={match.venue}
            description={`${match.leagueLabel}${match.broadcast ? ` · ${match.broadcast}` : ''}`}
            uid={`${match.id}@takasportsmedia.com`}
          />
        )}
        <ShareButton title={shareTitle} />
      </div>
    </div>
  )

  const leaguePills = (
    <div className="flex items-center gap-2 mb-5 flex-wrap">
      <Pill color="#C4B5FD">{match.leagueLabel}</Pill>
      {live && (
        <span
          className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.28)', fontFamily: 'var(--font-sport)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EF4444', animation: 'live-pulse 1.6s ease-out infinite' }} />
          En Vivo
        </span>
      )}
    </div>
  )

  // Non-tabbed sports (tennis, mma, racing, golf)
  if (!usesTabs) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <LiveRefresh isLive={live} startDate={match.startDate} />
        {backLink}
        {leaguePills}
        <InfoRow match={match} />
        {match.sport === 'tennis'     && <TennisBlock  match={match} />}
        {match.sport === 'mma'        && <MmaBlock     match={match} />}
        {match.sport === 'racing'     && <RacingBlock  match={match} />}
        {match.sport === 'golf'       && <GolfBlock    match={match} />}
        <MatchNews homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
      </div>
    )
  }

  const tabs = [
    { id: 'resumen',      label: 'Resumen',         available: true },
    { id: 'minuto',       label: 'Minuto a minuto', available: hasCommentary },
    { id: 'alineacion',   label: 'Alineación',      available: hasLineups },
    { id: 'estadisticas', label: 'Estadísticas',    available: hasStats },
    { id: 'h2h',          label: 'H2H',             available: hasH2H },
    { id: 'clasificacion',label: 'Clasificación',   available: hasTable },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <LiveRefresh isLive={live} startDate={match.startDate} />
      {backLink}
      {leaguePills}
      <div data-match-hero>
        <TeamScoreboard match={match} />
      </div>
      <InfoRow match={match} />

      <FormGuide homeTeam={match.homeTeam} awayTeam={match.awayTeam} forms={forms} />

      <MatchTabs
        tabs={tabs}
        topSlot={
          <StickyScoreBar
            homeLogo={match.homeLogo}
            awayLogo={match.awayLogo}
            homeAbbr={match.homeAbbr ?? match.homeTeam}
            awayAbbr={match.awayAbbr ?? match.awayTeam}
            homeScore={match.homeScore}
            awayScore={match.awayScore}
            statusLabel={match.statusLabel}
            live={live}
            hasScore={match.homeScore != null && match.awayScore != null}
          />
        }
      >
        {/* ── Tab 0: Resumen ───────────────────────────── */}
        <div>
          {hasSoccerScoring && (
            <Section title="Eventos del partido">
              <ScoringTimeline
                events={match.soccer!.scoring}
                homeTeam={match.homeTeam ?? ''}
                awayTeam={match.awayTeam ?? ''}
                leagueSlug={match.leagueSlug}
              />
            </Section>
          )}
          {isBasket && match.basketball && (
            <>
              {(match.basketball.quarters.home.some(v => v != null) || match.basketball.quarters.away.some(v => v != null)) && (
                <Section title="Marcador por cuartos">
                  <QuarterTable
                    home={match.basketball.quarters.home}
                    away={match.basketball.quarters.away}
                    homeAbbr={match.homeAbbr ?? match.homeTeam ?? '—'}
                    awayAbbr={match.awayAbbr ?? match.awayTeam ?? '—'}
                  />
                </Section>
              )}
              {match.basketball.leaders.length > 0 && (
                <Section title="Líderes del partido">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {match.basketball.leaders.map((l, i) => <LeaderCard key={i} leader={l} leagueSlug={match.leagueSlug} />)}
                  </div>
                </Section>
              )}
            </>
          )}
          {!hasSoccerScoring && !isBasket && (
            <EmptyState message="Sin eventos registrados aún" kind="events" />
          )}
        </div>

        {/* ── Tab 1: Minuto a minuto ───────────────────── */}
        <div>
          {hasCommentary ? (
            <CommentaryFeed
              entries={match.soccer!.commentary!}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
            />
          ) : (
            <EmptyState message="El minuto a minuto aparecerá cuando arranque el partido." kind="events" />
          )}
        </div>

        {/* ── Tab 2: Alineación ────────────────────────── */}
        <div>
          {hasLineups ? (
            <LineupField
              lineups={match.lineups!}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              leagueSlug={match.leagueSlug}
              scoring={match.soccer?.scoring}
            />
          ) : (
            <EmptyState message={
              !finishedStatus && !live
                ? 'Las alineaciones se publican habitualmente ~1 h antes del inicio. Vuelve a abrir el partido cerca del comienzo.'
                : 'Alineaciones no disponibles para este partido.'
            } kind="lineup" />
          )}
        </div>

        {/* ── Tab 3: Estadísticas ──────────────────────── */}
        <div>
          {hasSoccerStats && (
            <Section title="Estadísticas del partido">
              <div className="flex items-center justify-between text-[10px] font-black mb-4" style={{ fontFamily: 'var(--font-sport)' }}>
                <span style={{ color: '#A78BFA' }}>{match.homeAbbr ?? match.homeTeam}</span>
                <span style={{ color: '#F59E0B' }}>{match.awayAbbr ?? match.awayTeam}</span>
              </div>
              <div className="flex flex-col gap-3">
                {match.soccer!.stats.map((s, i) => <StatBar key={i} stat={s} />)}
              </div>
            </Section>
          )}
          {hasBasketStats && (
            <Section title="Estadísticas de equipo">
              <div className="flex items-center justify-between text-[10px] font-black mb-4" style={{ fontFamily: 'var(--font-sport)' }}>
                <span style={{ color: '#A78BFA' }}>{match.homeAbbr ?? match.homeTeam}</span>
                <span style={{ color: '#F59E0B' }}>{match.awayAbbr ?? match.awayTeam}</span>
              </div>
              <div className="flex flex-col gap-3">
                {match.basketball!.stats.map((s, i) => <StatBar key={i} stat={s} />)}
              </div>
            </Section>
          )}
          {!hasStats && <EmptyState message={
            live
              ? 'Las estadísticas aparecerán a medida que avance el partido.'
              : 'Estadísticas no disponibles para este partido.'
          } kind="stats" />}
        </div>

        {/* ── Tab 4: H2H ───────────────────────────────── */}
        <div>
          {hasH2H && match.homeTeam && match.awayTeam ? (
            <H2HBlock h2h={h2h!} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
          ) : (
            <EmptyState message="Sin enfrentamientos previos registrados" kind="h2h" />
          )}
        </div>

        {/* ── Tab 5: Clasificación ─────────────────────── */}
        <div>
          {hasTable ? (
            <LeagueTableBlock rows={match.leagueTable!} leagueLabel={match.leagueLabel} leagueSlug={match.leagueSlug} />
          ) : (
            <EmptyState message="Clasificación no disponible" kind="table" />
          )}
        </div>
      </MatchTabs>
      <MatchNews homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
    </div>
  )
}

// ── Not found ──────────────────────────────────────────────────────
// ── Page ───────────────────────────────────────────────────────────
export default async function MatchPage({
  params,
}: {
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  const match   = await fetchMatchDetail(ref)
  if (!match) notFound()

  // H2H: last meetings between the two teams (soccer team sports only). Pulled
  // from our own past_events cache so it's free and fast. If Supabase isn't
  // configured the function returns null and the tab is hidden.
  // Para deportes de equipo (fútbol/básket) traemos H2H (últimos 10) + forma
  // reciente (últimos 5 de cada equipo) en paralelo desde nuestra caché propia
  // past_events. Si Supabase no está configurado, h2h=null y forms={} → la UI
  // degrada (oculta tab H2H / no muestra forma). Coste 0.
  const teamPair = (match.sport === 'soccer' || match.sport === 'basketball') && match.homeTeam && match.awayTeam
    ? { home: match.homeTeam, away: match.awayTeam }
    : null
  const [h2h, forms] = await Promise.all([
    teamPair
      ? fetchH2H(teamPair.home, teamPair.away, { limit: 10, excludeId: match.id })
      : Promise.resolve(null),
    teamPair
      ? fetchRecentFormByTeams([teamPair.home, teamPair.away], 5).then((m) => m ?? {})
      : Promise.resolve({} as Record<string, FormResult[]>),
  ])

  const STATUS_MAP: Record<string, string> = {
    STATUS_FINAL: 'https://schema.org/EventCompleted',
    STATUS_FULL_TIME: 'https://schema.org/EventCompleted',
    STATUS_FINAL_PEN: 'https://schema.org/EventCompleted',
    STATUS_FINAL_AET: 'https://schema.org/EventCompleted',
    STATUS_POST_GAME: 'https://schema.org/EventCompleted',
    STATUS_END_OF_REGULATION: 'https://schema.org/EventCompleted',
    STATUS_FORFEIT: 'https://schema.org/EventCompleted',
    STATUS_WALKOVER: 'https://schema.org/EventCompleted',
    STATUS_RETIRED: 'https://schema.org/EventCompleted',
    STATUS_IN_PROGRESS: 'https://schema.org/EventScheduled',
    STATUS_HALFTIME: 'https://schema.org/EventScheduled',
    STATUS_FIRST_HALF: 'https://schema.org/EventScheduled',
    STATUS_SECOND_HALF: 'https://schema.org/EventScheduled',
    STATUS_END_PERIOD: 'https://schema.org/EventScheduled',
    STATUS_OVERTIME: 'https://schema.org/EventScheduled',
    STATUS_SHOOTOUT: 'https://schema.org/EventScheduled',
    STATUS_CANCELED: 'https://schema.org/EventCancelled',
    STATUS_ABANDONED: 'https://schema.org/EventCancelled',
    STATUS_POSTPONED: 'https://schema.org/EventPostponed',
    STATUS_SUSPENDED: 'https://schema.org/EventPostponed',
    STATUS_DELAYED: 'https://schema.org/EventPostponed',
    STATUS_RAIN_DELAY: 'https://schema.org/EventPostponed',
  }

  const sportsEventId = `${SITE_URL}/partido/${ref}#event`
  const sportsEventJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': sportsEventId,
    name: match.homeTeam && match.awayTeam
      ? `${match.homeTeam} vs ${match.awayTeam}`
      : match.leagueLabel,
    description: match.homeTeam && match.awayTeam
      ? `${match.statusLabel} · ${match.homeTeam} vs ${match.awayTeam}${match.venue ? ` en ${match.venue}` : ''}`
      : match.statusLabel,
    url: `${SITE_URL}/partido/${ref}`,
    inLanguage: 'es-ES',
    isAccessibleForFree: true,
    ...(match.startDate ? { startDate: match.startDate } : {}),
    eventStatus: STATUS_MAP[match.status] ?? 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: { '@type': 'SportsOrganization', name: match.leagueLabel },
    location: {
      '@type': 'Place',
      name: match.venue ?? `${match.leagueLabel} — sede por confirmar`,
    },
    ...(match.homeTeam && match.awayTeam && {
      competitor: [
        {
          '@type': 'SportsTeam',
          name: match.homeTeam,
          ...(match.homeLogo && { image: match.homeLogo }),
        },
        {
          '@type': 'SportsTeam',
          name: match.awayTeam,
          ...(match.awayLogo && { image: match.awayLogo }),
        },
      ],
    }),
    ...(match.homeScore != null && match.awayScore != null && {
      homeTeam: { '@type': 'SportsTeam', name: match.homeTeam, score: match.homeScore },
      awayTeam: { '@type': 'SportsTeam', name: match.awayTeam, score: match.awayScore },
    }),
    isPartOf: { '@id': `${SITE_URL}/#website` },
  }

  // LiveBlogPosting: cuando el partido está en directo Y tiene scoring events.
  // Permite que Google muestre el carrusel "En directo" en Top Stories y aparezca
  // como cobertura live en Discover. Solo soccer por ahora (donde tenemos events
  // estructurados). El @id del SportsEvent se referencia como `about`.
  const isLive = match.status === 'STATUS_IN_PROGRESS'
    || match.status === 'STATUS_HALFTIME'
    || match.status === 'STATUS_FIRST_HALF'
    || match.status === 'STATUS_SECOND_HALF'
    || match.status === 'STATUS_END_PERIOD'
    || match.status === 'STATUS_OVERTIME'
    || match.status === 'STATUS_SHOOTOUT'
  const soccerEvents = match.soccer?.scoring ?? []
  const liveBlogJsonLd = isLive && soccerEvents.length > 0 && match.startDate
    ? {
        '@context': 'https://schema.org',
        '@type': 'LiveBlogPosting',
        headline: `Sigue en vivo: ${match.homeTeam} vs ${match.awayTeam}`,
        description: `Cobertura en directo de ${match.homeTeam} vs ${match.awayTeam} — ${match.leagueLabel}. ${match.statusLabel}.`,
        coverageStartTime: match.startDate,
        coverageEndTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
        url: `${SITE_URL}/partido/${ref}`,
        inLanguage: 'es-ES',
        about: { '@id': sportsEventId },
        author: { '@id': `${SITE_URL}/autor/redaccion#author` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        liveBlogUpdate: soccerEvents.slice(-20).map((ev, i) => {
          const typeLabel = ev.type === 'goal' ? 'Gol'
            : ev.type === 'penalty' ? 'Penalti'
            : ev.type === 'own-goal' ? 'Gol en propia'
            : ev.type === 'yellow' ? 'Tarjeta amarilla'
            : ev.type === 'red' ? 'Tarjeta roja'
            : ev.type
          const team = ev.team === 'home' ? match.homeTeam : match.awayTeam
          const headline = ev.player
            ? `${typeLabel} de ${ev.player} (${team})${ev.clock ? ` · ${ev.clock}` : ''}`
            : `${typeLabel} para ${team}${ev.clock ? ` · ${ev.clock}` : ''}`
          return {
            '@type': 'BlogPosting',
            headline,
            articleBody: headline,
            // Sin timestamp real per-evento (ESPN no nos lo da exacto): usamos start + offset
            datePublished: match.startDate,
            position: i + 1,
          }
        }),
      }
    : null

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: match.leagueLabel, item: `${SITE_URL}/calendario` },
      { '@type': 'ListItem', position: 3, name: sportsEventJsonLd.name as string, item: `${SITE_URL}/partido/${ref}` },
    ],
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }} className="flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }} />
      {liveBlogJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(liveBlogJsonLd) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Header />
      <LiveStrip />
      <main className="flex-1">
        <Suspense>
          <MatchContent match={match} h2h={h2h} forms={forms} />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
