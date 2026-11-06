import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { imagenPequenaGratis } from '@/lib/espn-image'
import PlayerAvatar from '@/components/PlayerAvatar'
import type { TeamDetail, TeamResult, RosterPlayer } from '@/app/api/team/[slug]/route'
import { TeamTabs } from './TeamTabs'
import { StandingsTab } from './StandingsTab'
import { RosterTab } from './RosterTab'
import { RosterCredits } from './RosterCredits'
import { ShareButton } from '@/components/ShareButton'
import FichaLayout from '@/components/FichaLayout'
import RelatedArticlesByEntity from '@/components/RelatedArticlesByEntity'
import { SITE_URL, SITE_NAME, LOGO_URL, ICON_URL } from '@/lib/constants'
import { canonicalTeamSlug } from '@/lib/team-slug'
import { canonicalPlayerSlug } from '@/lib/player-slug'
import { letraForma } from '@/lib/forma'

// Solo estas 5 ligas tienen página /liga/[id]. team.leagueSlug llega como
// "soccer/esp.1" (con el deporte delante), así que enlazar a /liga/${leagueSlug}
// daba /liga/soccer/esp.1 → 404 en ~198 fichas. Quitamos el prefijo y, si la liga
// no tiene página propia (NBA, etc.), enlazamos a /estadisticas para no romper.
const LIGA_PAGES = new Set(['esp.1', 'eng.1', 'ita.1', 'ger.1', 'fra.1'])
function leagueHref(leagueSlug: string): string {
  const bareId = leagueSlug.replace(/^[^/]+\//, '') // "soccer/esp.1" → "esp.1"
  return LIGA_PAGES.has(bareId) ? `/liga/${bareId}` : '/estadisticas'
}

export const revalidate = 300

// ── Metadata ──────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = await fetchTeamDetail(slug)
  // Equipo inexistente: noindex + self-canonical (ver nota en /jugador). Evita el
  // soft-404 con canonical-al-home.
  if (!team) return {
    title: 'Equipo no encontrado',
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}/equipo/${slug}` },
  }
  // Sin sufijo " | TakaSports": el root layout ya aplica title.template '%s | TakaSports'.
  const title = `${team.name} · ${team.leagueLabel}`
  const description = team.standingSummary
    ? `${team.name} — ${team.standingSummary}. ${team.record?.summary ?? ''} en ${team.leagueLabel}`
    : `${team.name} · ${team.leagueLabel} en TakaSports`
  // Canonical al slug con nombre, no al que pidió el visitante: si entra por el formato
  // histórico o por la URL de competición europea (soccer_uefa.champions_86), el canonical
  // apunta igualmente a la única forma buena. Consolida los duplicados existentes.
  const canonical = `${SITE_URL}/equipo/${canonicalTeamSlug(team.name, team.id)}`
  const ogImageUrl = team.logo ?? `${SITE_URL}/taka-icon.png`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title, description,
      url: canonical,
      images: [{ url: ogImageUrl, width: 200, height: 200 }],
      type: 'website', siteName: SITE_NAME,
    },
    // Sin `twitter` propio, X mostraba el default genérico del home. Se reflejan
    // título/descripción del equipo; card 'summary' (cuadrada) porque el escudo
    // es 200×200 y encaja limpio. (Fix A3 SEO)
    twitter: { card: 'summary', title, description, images: [ogImageUrl] },
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
function FeaturedPlayerCard({ player, teamColor, leagueSlug, teamLogo }: { player: RosterPlayer; teamColor?: string; leagueSlug: string; teamLogo?: string }) {
  const accent = teamColor ? `#${teamColor}` : '#7C3AED'
  const href = player.id ? `/jugador/${canonicalPlayerSlug(player.name, player.id)}` : undefined
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
          <Image src={imagenPequenaGratis(player.headshot, 72)!} alt={player.name} width={72} height={72} unoptimized
            style={{ objectFit: 'cover', borderRadius: 'var(--radius-card)' }} />
        ) : teamLogo ? (
          // Sin foto: el escudo del club con el dorsal encima, nunca un
          // recuadro con «#11» (V-29).
          <span className="relative inline-flex items-center justify-center" style={{ width: 72, height: 72 }}>
            <Image src={imagenPequenaGratis(teamLogo, 56)!} alt="" width={48} height={48} unoptimized style={{ objectFit: 'contain', opacity: 0.9 }} />
            {player.jersey ? (
              <span
                className="absolute bottom-1 right-1 inline-flex items-center justify-center rounded-md text-[11px] font-black tabular-nums"
                style={{ minWidth: 22, height: 20, padding: '0 5px', background: accent, color: '#0A0A12', fontFamily: 'var(--font-display)' }}
              >
                {player.jersey}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="font-black text-2xl" style={{ color: accent, fontFamily: 'var(--font-display)' }}>
            {player.name.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[11px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full"
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
        {(leagueSlug.startsWith('basketball') ? [] : [
          { label: 'Goles', value: player.goals },
          { label: 'Asist.', value: player.assists },
          { label: 'PJ', value: player.gamesPlayed },
        ]).map(s => (
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
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)' }}
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
          {letraForma(r.result) || (isUpcoming ? '—' : '•')}
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
              <Image src={imagenPequenaGratis(r.homeTeam.logo, 20)!} alt={r.homeTeam.abbr} width={20} height={20} unoptimized
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
              <Image src={imagenPequenaGratis(r.awayTeam.logo, 20)!} alt={r.awayTeam.abbr} width={20} height={20} unoptimized
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

// La respuesta puede venir en cualquier orden según el deporte y la caché: la
// forma de un equipo de fútbol llegó a ser la de agosto. [06/11/2026]
function porFechaDesc(results: TeamResult[]): TeamResult[] {
  return [...results].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

function ResultsTab({ results, proximos, teamId }: { results: TeamResult[]; proximos: TeamResult[]; teamId: string }) {
  // Split past + upcoming
  const past = porFechaDesc(results.filter(r => r.result || r.status === 'STATUS_IN_PROGRESS'))
  const upcoming = proximos

  return (
    <div>
      {upcoming.length > 0 && (
        <div className="mb-6">
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
      {past.length === 0 && upcoming.length === 0 && (
        <div className="text-center py-10 text-[var(--text-muted)] text-sm">Sin datos de partidos</div>
      )}
    </div>
  )
}

// ── Main Team Content ──────────────────────────────────────────────────
function TeamContent({ team, lateral }: { team: TeamDetail; lateral?: React.ReactNode }) {
  const accent = team.color ? `#${team.color}` : '#7C3AED'
  const esBaloncesto = team.leagueSlug.startsWith('basketball')
  const past = team.results.filter(r => r.result || r.status === 'STATUS_IN_PROGRESS')
  const upcoming = team.results.filter(r => !r.result && r.status !== 'STATUS_IN_PROGRESS')

  return (
    <FichaLayout
      miga={[
        { label: 'Inicio', href: '/' },
        { label: 'Estadísticas', href: '/estadisticas' },
        { label: team.leagueLabel, href: leagueHref(team.leagueSlug) },
        { label: team.name },
      ]}
      acciones={(
        <>
          <Link
            prefetch={false}
            href={`/comparar-equipos?t1=${team.leagueSlug.replaceAll('/', '_')}_${team.id}`}
            className="text-[12px] font-bold transition-opacity hover:opacity-80"
            style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
          >
            ⇄ Comparar
          </Link>
          <ShareButton title={`${team.name} · ${team.leagueLabel}`} />
        </>
      )}
      lateral={lateral}
    >
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
            {!esBaloncesto && <div
              className="text-[13px] font-black px-3 py-1 rounded-full"
              // El texto en blanco y el color del club solo en el fondo: con
              // acentos oscuros (el granate del Barça) los puntos no se leían.
              style={{ background: `${accent}22`, color: '#F4F4FA', fontFamily: 'var(--font-display)' }}
            >
              {team.record.pts} pts
            </div>}
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
          // En la NBA no hay puntos de clasificación ni goles: la plantilla de fútbol
          // daba «-2 pts» y «-0,33 pts/partido».
          if (esBaloncesto) {
            cells.push({ label: 'Derrotas', value: team.record?.l ?? mainRow?.l ?? '—' })
            if (mainRow) cells.push({ label: 'Posición', value: `${mainRow.rank}º` })
            return cells
          }
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
            <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent form */}
      {(() => {
        const form = porFechaDesc(team.results.filter(r => r.result === 'W' || r.result === 'D' || r.result === 'L'))
          .slice(0, 5)
        if (form.length === 0) return null
        return (
          <div className="flex items-center gap-3 mb-6">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]"
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
                    {letraForma(r.result)}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Featured player */}
      {team.featuredPlayer && (
        <FeaturedPlayerCard player={team.featuredPlayer} teamColor={team.color} leagueSlug={team.leagueSlug} teamLogo={team.logo} />
      )}

      {/* Tabs */}
      <TeamTabs
        tabs={[
          { id: 'resultados', label: 'Resultados' },
          { id: 'plantilla', label: 'Plantilla' },
          { id: 'clasificacion', label: 'Clasificación' },
        ]}
      >
        <ResultsTab results={team.results} proximos={team.upcoming ?? []} teamId={team.id} />
        <RosterTab roster={team.roster} leagueSlug={team.leagueSlug} />
        <StandingsTab table={team.leagueTable} />
      </TeamTabs>
      {/* Créditos CC de las fotos de la plantilla — última línea de la ficha a
          propósito (no ensucia la información; ver RosterCredits para el porqué legal). */}
      <div className="pt-8">
        <RosterCredits roster={team.roster} />
      </div>
    </FichaLayout>
  )
}

// ── Page ───────────────────────────────────────────────────────────────
export default async function EquipoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = await fetchTeamDetail(slug)
  if (!team) notFound()

  // Una ficha, una URL canónica. Ver la nota en la migración de /jugador: no se
  // redirige (Next degrada el 308 a meta-refresh en rutas ISR con streaming); se
  // consolida por canonical, y los enlaces internos y el sitemap ya apuntan aquí.
  const canonicalUrl = `${SITE_URL}/equipo/${canonicalTeamSlug(team.name, team.id)}`

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
      { '@type': 'ListItem', position: 3, name: team.leagueLabel, item: `${SITE_URL}${leagueHref(team.leagueSlug)}` },
      { '@type': 'ListItem', position: 4, name: team.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(teamJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Suspense>
          <TeamContent
            team={team}
            // Noticias del equipo en la columna lateral (el mismo contenedor
            // de dos columnas que la ficha de jugador). Distribuye autoridad
            // del feed editorial al hub de la entidad.
            lateral={(
              <Suspense>
                <RelatedArticlesByEntity entityName={team.name} limit={6} />
              </Suspense>
            )}
          />
        </Suspense>
      </div>
    </>
  )
}
