import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { TeamDetail, TeamResult, RosterPlayer } from '@/app/api/team/[slug]/route'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import { TeamTabs } from './TeamTabs'
import { StandingsTab } from './StandingsTab'
import { SITE_URL, SITE_NAME, LOGO_URL, ICON_URL } from '@/lib/constants'

export const revalidate = 300

// ── Metadata ──────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = await fetchTeamDetail(slug)
  if (!team) return { title: 'Equipo | TakaSports' }
  const title = `${team.name} · ${team.leagueLabel} | TakaSports`
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
function FeaturedPlayerCard({ player, teamColor }: { player: RosterPlayer; teamColor?: string }) {
  const accent = teamColor ? `#${teamColor}` : '#7C3AED'
  return (
    <div
      className="rounded-2xl p-5 mb-6 flex gap-4 items-center"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Headshot or placeholder */}
      <div
        className="flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
        style={{ width: 72, height: 72, background: `${accent}22` }}
      >
        {player.headshot ? (
          <Image src={player.headshot} alt={player.name} width={72} height={72} unoptimized
            style={{ objectFit: 'cover', borderRadius: 12 }} />
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
        <div className="text-[12px] text-[#5A5A6A] uppercase tracking-wide mt-0.5">
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
            <div className="text-[10px] text-[#5A5A6A] uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
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
            color: resultColor ?? '#5A5A6A',
            fontFamily: 'var(--font-sport)',
          }}
        >
          {r.result ?? (isUpcoming ? '—' : '•')}
        </div>

        {/* Date */}
        <div className="text-[11px] text-[#5A5A6A] w-16 flex-shrink-0">
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
            style={{ fontFamily: 'var(--font-display)', color: isUpcoming ? '#5A5A6A' : '#fff' }}
          >
            {isUpcoming
              ? r.date ? new Date(r.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '–:––'
              : `${r.homeScore ?? '?'} – ${r.awayScore ?? '?'}`
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
            className="text-[10px] font-black uppercase tracking-widest text-[#5A5A6A] mb-3"
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
            className="text-[10px] font-black uppercase tracking-widest text-[#5A5A6A] mb-3"
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
        <div className="text-center py-10 text-[#5A5A6A] text-sm">Sin datos de partidos</div>
      )}
    </div>
  )
}

// ── Roster Tab ─────────────────────────────────────────────────────────
function PlayerRow({ player }: { player: RosterPlayer }) {
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-4 rounded-xl mb-1 hover:bg-white/5 transition-all"
      style={{ background: 'rgba(255,255,255,0.025)' }}
    >
      {/* Jersey number as avatar */}
      <div
        className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.25)' }}
      >
        {player.headshot ? (
          <Image src={player.headshot} alt={player.name} width={32} height={32} unoptimized
            style={{ objectFit: 'cover', borderRadius: '50%' }} />
        ) : (
          <span className="text-[11px] font-black text-[#C4B5FD]" style={{ fontFamily: 'var(--font-sport)' }}>
            {player.jersey ?? player.name.charAt(0)}
          </span>
        )}
      </div>

      {/* Spacer where jersey number used to be */}
      <div className="w-0 flex-shrink-0" />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-white truncate">{player.name}</div>
        {player.nationality && (
          <div className="text-[11px] text-[#5A5A6A]">{player.nationality}</div>
        )}
      </div>

      {/* Age */}
      {player.age && (
        <div className="hidden sm:block text-[11px] text-[#5A5A6A] w-8 text-right flex-shrink-0">
          {player.age}a
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-3 flex-shrink-0">
        {player.posAbbr !== 'GK' && player.posAbbr !== 'G' && player.posAbbr !== 'P' ? (
          <>
            <div className="text-center w-8">
              <div className="text-[13px] font-black text-white">{player.goals}</div>
              <div className="text-[9px] text-[#5A5A6A] uppercase">Gol</div>
            </div>
            <div className="text-center w-8">
              <div className="text-[13px] font-black text-white">{player.assists}</div>
              <div className="text-[9px] text-[#5A5A6A] uppercase">Ast</div>
            </div>
          </>
        ) : (
          <div className="text-center w-16">
            <div className="text-[11px] text-[#5A5A6A]">Portero</div>
          </div>
        )}
        <div className="text-center w-8">
          <div className="text-[13px] font-black text-white">{player.gamesPlayed}</div>
          <div className="text-[9px] text-[#5A5A6A] uppercase">PJ</div>
        </div>
      </div>
    </div>
  )
}

function RosterTab({ roster }: { roster: RosterPlayer[] }) {
  // Group by position
  const groups: Record<string, RosterPlayer[]> = {}
  for (const p of roster) {
    const abbr = p.posAbbr
    const order = POS_ORDER[abbr] ?? 9
    const key = `${order}:${POS_LABEL[abbr] ?? p.position}`
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }
  const sortedGroups = Object.entries(groups).sort((a, b) => {
    const ao = parseInt(a[0]); const bo = parseInt(b[0])
    return ao - bo
  })

  if (roster.length === 0) {
    return <div className="text-center py-10 text-[#5A5A6A] text-sm">Sin datos de plantilla</div>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-2 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="w-8 flex-shrink-0" />
        <div className="w-6 flex-shrink-0" />
        <div className="flex-1 text-[10px] uppercase tracking-widest text-[#3A3A4A]">Jugador</div>
        <div className="hidden sm:block w-8 text-right text-[10px] uppercase tracking-widest text-[#3A3A4A] flex-shrink-0">Edad</div>
        <div className="flex gap-3 flex-shrink-0">
          <div className="w-8 text-center text-[10px] uppercase tracking-widest text-[#3A3A4A]">Gol</div>
          <div className="w-8 text-center text-[10px] uppercase tracking-widest text-[#3A3A4A]">Ast</div>
          <div className="w-8 text-center text-[10px] uppercase tracking-widest text-[#3A3A4A]">PJ</div>
        </div>
      </div>
      {sortedGroups.map(([key, players]) => {
        const label = key.split(':').slice(1).join(':')
        return (
          <div key={key} className="mb-5">
            <div
              className="text-[10px] font-black uppercase tracking-widest text-[#5A5A6A] px-4 py-2"
              style={{ fontFamily: 'var(--font-sport)' }}
            >
              {label}
            </div>
            {players
              .sort((a, b) => Number(a.jersey ?? 99) - Number(b.jersey ?? 99))
              .map(p => <PlayerRow key={p.id} player={p} />)
            }
          </div>
        )
      })}
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
      {/* Back */}
      <Link
        href="/calendario"
        className="flex items-center gap-1.5 text-[12px] text-[#5A5A6A] hover:text-white transition-colors mb-6"
        style={{ fontFamily: 'var(--font-sport)' }}
      >
        ‹ Volver
      </Link>

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
          {team.logo && (
            <Image src={team.logo} alt={team.name} width={64} height={64} unoptimized
              style={{ objectFit: 'contain' }} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div
            className="text-[11px] font-black uppercase tracking-widest mb-1"
            style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Jugados', value: team.record?.gp ?? past.length },
          { label: 'Victorias', value: team.record?.w ?? past.filter(r => r.result === 'W').length },
          upcoming.length > 0
            ? { label: 'Próximos', value: upcoming.length }
            : { label: 'Puntos', value: team.record?.pts ?? '—' },
        ].map(s => (
          <div
            key={s.label}
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <div className="text-xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
              {s.value}
            </div>
            <div className="text-[10px] text-[#5A5A6A] uppercase tracking-wide mt-0.5">{s.label}</div>
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
              className="text-[10px] font-black uppercase tracking-widest text-[#5A5A6A]"
              style={{ fontFamily: 'var(--font-sport)' }}
            >
              Forma
            </span>
            <div className="flex gap-1.5">
              {form.map((r, i) => {
                const color = r.result === 'W' ? '#22c55e' : r.result === 'L' ? '#ef4444' : '#f59e0b'
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
        <FeaturedPlayerCard player={team.featuredPlayer} teamColor={team.color} />
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
        <RosterTab roster={team.roster} />
        <StandingsTab table={team.leagueTable} leagueSlug={team.leagueSlug} />
      </TeamTabs>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────
export default async function EquipoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const team = await fetchTeamDetail(slug)

  return (
    <>
      <LiveStrip />
      <Header />
      <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Suspense>
          {team ? (
            <TeamContent team={team} />
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-20 text-center text-[#5A5A6A]">
              No se encontró información del equipo.
            </div>
          )}
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
