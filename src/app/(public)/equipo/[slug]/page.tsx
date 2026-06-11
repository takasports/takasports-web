import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import PlayerAvatar from '@/components/PlayerAvatar'
import type { TeamDetail, TeamResult, RosterPlayer } from '@/app/api/team/[slug]/route'
import { TeamTabs } from './TeamTabs'
import { StandingsTab } from './StandingsTab'
import { RosterTab } from './RosterTab'
import { ShareButton } from '@/components/ShareButton'
import BreadcrumbsNav from '@/components/BreadcrumbsNav'
import RelatedArticlesByEntity from '@/components/RelatedArticlesByEntity'
import { SITE_URL, SITE_NAME, LOGO_URL, ICON_URL } from '@/lib/constants'

export const revalidate = 300

// ── Metadata ──────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = await fetchTeamDetail(slug)
  if (!team) return { title: 'Equipo' }
  // Sin sufijo " | TakaSports": el root layout ya aplica title.template '%s | TakaSports'.
  const title = `${team.name} · ${team.leagueLabel}`
  const description = team.standingSummary
    ? `${team.name} — ${team.standingSummary}. ${team.record?.summary ?? ''} en ${team.leagueLabel}`
    : `${team.name} · ${team.leagueLabel} en TakaSports`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/equipo/${slug}` },
    openGraph: {
      title, description,
      images: [{ url: team.logo ?? `${SITE_URL}/taka-icon.png`, width: 200, height: 200 }],
      type: 'website', siteName: SITE_NAME,
    },
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────
async function fetchTeamDetail(slug: string): Promise<TeamDetail | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL
      ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
    const res = await fetch(`${base}/api/team/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// ── Helpers ────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso)
    const currentYear = new Date().getFullYear()
    const opts: Intl.DateTimeFormatOptions = d.getFullYear() !== currentYear
      ? { day: '2-digit', month: 'short', year: 'numeric' }
      : { day: '2-digit', month: 'short' }
    return d.toLocaleDateString('es-ES', opts)
  } catch { return iso }
}

const POS_ORDER: Record<string, number> = { GK: 0, G: 0, P: 0, DF: 1, D: 1, MF: 2, M: 2, FW: 3, F: 3 }
const POS_LABEL: Record<string, string> = {
  GK: 'Porteros', G: 'Porteros', P: 'Porteros',
  DF: 'Defensas', D: 'Defensas',
  MF: 'Centrocampistas', M: 'Centrocampistas',
  FW: 'Delanteros', F: 'Delanteros',
}

// ── Featured Player ────────────────────────────────────────────────────
function FeaturedPlayerCard({ player, teamColor, leagueSlug }: { player: RosterPlayer; teamColor?: string; leagueSlug: string }) {
  const accent = teamColor ? `#${teamColor}` : '#7C3AED'
  const href = player.id ? `/jugador/${leagueSlug.replaceAll('/', '_')}_${player.id}` : undefined
  const card = (
    <div
      className={`rounded-2xl p-5 mb-6 flex gap-4 items-center${href ? ' transition-all hover:bg-white/[0.06]' : ''}`}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Headshot or placeholder */}
      <div
        className="flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
        style={{ width: 72, height: 72, background: `${accent}22` }}
      >
        {player.headshot ? (
          <Image src={player.headshot} alt={player.name} width={72} height={72} unoptimized
            style={{ objectFit: 'cover', borderRadius: 'var(--radius-card)' }} />
        ) : (
          <span className="font-black text-2xl" style={{ color: accent, fontFamily: 'var(--font-display)' }}>
            {player.jersey ? `#${player.jersey}` : player.name.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: `${accent}33`, color: accent, fontFamily: 'var(--font-sport)' }}
          >
            Figura del equipo
          </span>
        </div>
        <div className="font-black text-lg text-white truncate" style={{ fontFamily: 'var(--font-display)' }}>
          {player.name}
        </div>
        <div className="text-[12px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">
          {player.posAbbr} {player.jersey ? `· #${player.jersey}` : ''}
          {player.nationality ? ` · ${player.nationality}` : ''}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-shrink-0">
        {[
          { label: 'Goles', value: player.goals },
          { label: 'Asist.', value: player.assists },
          { label: 'PJ', value: player.gamesPlayed },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className="text-xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
              {s.value}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
  return href ? <Link href={href} prefetch={false}>{card}</Link> : card
}

// ── Results Tab ────────────────────────────────────────────────────────
function ResultRow({ r, teamId }: { r: TeamResult; teamId: string }) {
  const isUpcoming = !r.result && r.status !== 'STATUS_IN_PROGRESS'
  const resultColor = r.result === 'W' ? '#22c55e' : r.result === 'L' ? '#ef4444' : r.result === 'D' ? '#f59e0b' : undefined

  return (
    <Link href={`/partido/${r.matchRef}`}>
      <div
        className="flex items-center gap-3 py-3 px-4 rounded-xl mb-1.5 transition-all hover:bg-white/5"
        style={{ background: 'rgba(255,255,255,0.025)' }}
      >
        {/* Result badge */}
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[11px] font-black"
          style={{
            background: resultColor ? `${resultColor}22` : 'rgba(255,255,255,0.06)',
            color: resultColor ?? 'var(--text-muted)',
            fontFamily: 'var(--font-sport)',
          }}
        >
          {r.result ?? (isUpcoming ? '—' : '•')}
        </div>

        {/* Date */}
        <div className="text-[11px] text-[var(--text-muted)] w-16 flex-shrink-0">
          {formatShortDate(r.date)}
        </div>

        {/* Teams + score */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {/* Home */}
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <span
              className="text-[13px] font-semibold truncate"
              style={{ color: r.homeTeam.id === teamId ? '#fff' : '#9A9AAA' }}
            >
              {r.homeTeam.abbr}
            </span>
            {r.homeTeam.logo && (
              <Image src={r.homeTeam.logo} alt={r.homeTeam.abbr} width={20} height={20} unoptimized
                style={{ objectFit: 'contain', flexShrink: 0 }} />
            )}
          </div>

          {/* Score */}
          <div
            className="flex-shrink-0 text-[14px] font-black w-14 text-center"
            style={{ fontFamily: 'var(--font-display)', color: isUpcoming ? 'var(--text-muted)' : '#fff' }}
          >
            {isUpcoming
              ? r.date ? new Date(r.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '–:––'
              : `${r.homeScore ?? '?'} · ${r.awayScore ?? '?'}`
            }
          </div>

          {/* Away */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {r.awayTeam.logo && (
              <Image src={r.awayTeam.logo} alt={r.awayTeam.abbr} width={20} height={20} unoptimized
                style={{ objectFit: 'contain', flexShrink: 0 }} />
            )}
            <span
              className="text-[13px] font-semibold truncate"
              style={{ color: r.awayTeam.id === teamId ? '#fff' : '#9A9AAA' }}
            >
              {r.awayTeam.abbr}
            </span>
          </div>
        </div>

        {/* Venue */}
        {r.venue && (
          <div className="hidden md:block text-[11px] text-[#3A3A4A] truncate max-w-[120px] flex-shrink-0">
            {r.venue}
          </div>
        )}

        {/* Arrow */}
        <span className="text-[#3A3A4A] flex-shrink-0">›</span>
      </div>
    </Link>
  )
}

function ResultsTab({ results, teamId }: { results: TeamResult[]; teamId: string }) {
  // Split past + upcoming
  const past = results.filter(r => r.result || r.status === 'STATUS_IN_PROGRESS').reverse()
  const upcoming = results.filter(r => !r.result && r.status !== 'STATUS_IN_PROGRESS')

  return (
    <div>
      {past.length > 0 && (
        <div className="mb-6">
          <div
            className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3"
            style={{ fontFamily: 'var(--font-sport)' }}
          >
            Últimos resultados
          </div>
          {past.slice(0, 15).map(r => (
            <ResultRow key={r.matchRef} r={r} teamId={teamId} />
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <div
            className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3"
            style={{ fontFamily: 'var(--font-sport)' }}
          >
            Próximos partidos
          </div>
          {upcoming.slice(0, 8).map(r => (
            <ResultRow key={r.matchRef} r={r} teamId={teamId} />
          ))}
        </div>
      )}
      {past.length === 0 && upcoming.length === 0 && (
        <div className="text-center py-10 text-[var(--text-muted)] text-sm">Sin datos de partidos</div>
      )}
    </div>
  )
}

// ── Main Team Content ──────────────────────────────────────────────────
function TeamContent({ team }: { team: TeamDetail }) {
  const accent = team.color ? `#${team.color}` : '#7C3AED'
  const past = team.results.filter(r => r.result || r.status === 'STATUS_IN_PROGRESS')
  const upcoming = team.results.filter(r => !r.result && r.status !== 'STATUS_IN_PROGRESS')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Breadcrumbs semánticos — mirror del BreadcrumbList JSON-LD */}
      <BreadcrumbsNav
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Estadísticas', href: '/estadisticas' },
          { label: team.leagueLabel, href: `/liga/${team.leagueSlug}` },
          { label: team.name },
        ]}
        className="mb-4 text-[11px] flex items-center gap-2 flex-wrap"
      />

      {/* Back + Share */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/calendario"
          className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-white transition-colors"
          style={{ fontFamily: 'var(--font-sport)' }}
        >
          ‹ Volver
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/comparar-equipos?t1=${team.leagueSlug.replaceAll('/', '_')}_${team.id}`}
            className="text-[12px] font-bold transition-opacity hover:opacity-80"
            style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
          >
            ⇄ Comparar
          </Link>
          <ShareButton title={`${team.name} · ${team.leagueLabel}`} />
        </div>
      </div>

      {/* Team Header */}
      <div
        className="rounded-2xl p-5 mb-6 flex items-center gap-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Logo */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 p-2"
          style={{ background: `${accent}18` }}
        >
          <PlayerAvatar teamLogo={team.logo} teamName={team.name} name={team.name}
            accent={accent} logoSize={64} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div
            className="text-[11px] font-black uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
          >
            {team.leagueLabel}
          </div>
          <h1
            className="text-2xl font-black text-white leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {team.name}
          </h1>
          {team.standingSummary && (
            <div className="text-[13px] text-[#9A9AAA] mt-1">{team.standingSummary}</div>
          )}
        </div>

        {/* Record pills */}
        {team.record && (
          <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
            <div
              className="text-[11px] font-black px-3 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9A9AAA', fontFamily: 'var(--font-sport)' }}
            >
              {team.record.summary}
            </div>
            <div
              className="text-[13px] font-black px-3 py-1 rounded-full"
              style={{ background: `${accent}22`, color: accent, fontFamily: 'var(--font-display)' }}
            >
              {team.record.pts} pts
            </div>
          </div>
        )}
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {(() => {
          const mainRow = team.leagueTable.find(r => r.isMain)
          const gp = team.record?.gp ?? mainRow?.gp ?? past.length
          const w = team.record?.w ?? mainRow?.w ?? past.filter(r => r.result === 'W').length
          const pts = team.record?.pts ?? mainRow?.pts
          const winPct = gp > 0 ? `${Math.round((w / gp) * 100)}%` : '—'
          const ppp = pts != null && gp > 0 ? (pts / gp).toFixed(2) : '—'
          const cells: { label: string; value: string | number }[] = [
            { label: 'Jugados', value: gp },
            { label: 'Victorias', value: w },
            { label: '% Victorias', value: winPct },
          ]
          if (mainRow) {
            cells.push(
              { label: 'GF', value: mainRow.gf },
              { label: 'GC', value: mainRow.gc },
              { label: 'DG', value: mainRow.gd > 0 ? `+${mainRow.gd}` : mainRow.gd },
            )
          }
          if (mainRow) cells.push({ label: 'Posición', value: `${mainRow.rank}º` })
          cells.push({ label: 'Pts/partido', value: ppp })
          return cells
        })().map(s => (
          <div
            key={s.label}
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <div className="text-xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
              {s.value}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent form */}
      {(() => {
        const form = team.results
          .filter(r => r.result === 'W' || r.result === 'D' || r.result === 'L')
          .slice(-5)
          .reverse()
        if (form.length === 0) return null
        return (
          <div className="flex items-center gap-3 mb-6">
            <span
              className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
              style={{ fontFamily: 'var(--font-sport)' }}
            >
              Forma
            </span>
            <div className="flex gap-1.5">
              {form.map((r, i) => {
                const color = r.result === 'W' ? '#22C55E' : r.result === 'L' ? '#EF4444' : '#EAB308'
                return (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-black"
                    style={{ background: `${color}22`, color, fontFamily: 'var(--font-sport)' }}
                  >
                    {r.result}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Featured player */}
      {team.featuredPlayer && (
        <FeaturedPlayerCard player={team.featuredPlayer} teamColor={team.color} leagueSlug={team.leagueSlug} />
      )}

      {/* Tabs */}
      <TeamTabs
        tabs={[
          { id: 'resultados', label: 'Resultados' },
          { id: 'plantilla', label: 'Plantilla' },
          { id: 'clasificacion', label: 'Clasificación' },
        ]}
      >
        <ResultsTab results={team.results} teamId={team.id} />
        <RosterTab roster={team.roster} leagueSlug={team.leagueSlug} />
        <StandingsTab table={team.leagueTable} leagueSlug={team.leagueSlug} />
      </TeamTabs>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────
export default async function EquipoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = await fetchTeamDetail(slug)
  if (!team) notFound()

  const canonicalUrl = `${SITE_URL}/equipo/${slug}`

  const teamJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.name,
    url: canonicalUrl,
    logo: team.logo ?? LOGO_URL,
    image: team.logo ?? LOGO_URL,
    sport: team.leagueSlug.includes('basketball') || team.leagueSlug.includes('nba') ? 'Basketball' : 'Soccer',
    memberOf: {
      '@type': 'SportsOrganization',
      name: team.leagueLabel,
    },
    ...(team.standingSummary ? { description: `${team.name} — ${team.standingSummary}` } : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Estadísticas', item: `${SITE_URL}/estadisticas` },
      { '@type': 'ListItem', position: 3, name: team.leagueLabel, item: `${SITE_URL}/liga/${team.leagueSlug}` },
      { '@type': 'ListItem', position: 4, name: team.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(teamJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Suspense>
          <TeamContent team={team} />
        </Suspense>
        {/* Widget de noticias relacionadas con el equipo.
            Distribuye autoridad del feed editorial al hub de la entidad. */}
        <div className="max-w-2xl mx-auto px-4 pb-10">
          <Suspense>
            <RelatedArticlesByEntity entityName={team.name} limit={6} />
          </Suspense>
        </div>
      </div>
    </>
  )
}
