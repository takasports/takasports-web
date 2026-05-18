import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { PlayerDetail } from '@/app/api/jugador/[slug]/route'
import type { TeamResult } from '@/app/api/team/[slug]/route'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import { ShareButton } from '@/components/ShareButton'
import { SITE_URL, SITE_NAME } from '@/lib/constants'

export const revalidate = 1800

// ── Metadata ──────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const player = await fetchPlayer(slug)
  if (!player) return { title: 'Jugador | TakaSports' }
  const title = `${player.name} · ${player.leagueLabel} | TakaSports`
  const description = `${player.name}${player.position ? ` · ${player.position}` : ''}${
    player.team ? ` · ${player.team.name}` : ''
  } — estadísticas de la temporada en ${player.leagueLabel}`
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/jugador/${slug}` },
    openGraph: {
      title, description,
      images: [{ url: player.team?.logo ?? `${SITE_URL}/taka-icon.png`, width: 200, height: 200 }],
      type: 'profile', siteName: SITE_NAME,
    },
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────
async function fetchPlayer(slug: string): Promise<PlayerDetail | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL
      ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
    const res = await fetch(`${base}/api/jugador/${slug}`, { next: { revalidate: 1800 } })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
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

// ── Match row (player's club) ─────────────────────────────────────────
function MatchRow({ r, teamId }: { r: TeamResult; teamId: string }) {
  const resultColor = r.result === 'W' ? '#22c55e' : r.result === 'L' ? '#ef4444' : r.result === 'D' ? '#f59e0b' : undefined
  return (
    <Link href={`/partido/${r.matchRef}`}>
      <div
        className="flex items-center gap-3 py-3 px-4 rounded-xl mb-1.5 transition-all hover:bg-white/5"
        style={{ background: 'rgba(255,255,255,0.025)' }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[11px] font-black"
          style={{
            background: resultColor ? `${resultColor}22` : 'rgba(255,255,255,0.06)',
            color: resultColor ?? '#5A5A6A',
            fontFamily: 'var(--font-sport)',
          }}
        >
          {r.result ?? '•'}
        </div>
        <div className="text-[11px] text-[#5A5A6A] w-16 flex-shrink-0">{formatShortDate(r.date)}</div>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <span className="text-[13px] font-semibold truncate"
              style={{ color: r.homeTeam.id === teamId ? '#fff' : '#9A9AAA' }}>
              {r.homeTeam.abbr}
            </span>
            {r.homeTeam.logo && (
              <Image src={r.homeTeam.logo} alt={r.homeTeam.abbr} width={20} height={20} unoptimized
                style={{ objectFit: 'contain', flexShrink: 0 }} />
            )}
          </div>
          <div className="flex-shrink-0 text-[14px] font-black w-14 text-center"
            style={{ fontFamily: 'var(--font-display)', color: '#fff' }}>
            {`${r.homeScore ?? '?'} · ${r.awayScore ?? '?'}`}
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {r.awayTeam.logo && (
              <Image src={r.awayTeam.logo} alt={r.awayTeam.abbr} width={20} height={20} unoptimized
                style={{ objectFit: 'contain', flexShrink: 0 }} />
            )}
            <span className="text-[13px] font-semibold truncate"
              style={{ color: r.awayTeam.id === teamId ? '#fff' : '#9A9AAA' }}>
              {r.awayTeam.abbr}
            </span>
          </div>
        </div>
        <span className="text-[#3A3A4A] flex-shrink-0">›</span>
      </div>
    </Link>
  )
}

// ── Content ───────────────────────────────────────────────────────────
function PlayerContent({ player }: { player: PlayerDetail }) {
  const accent = '#7C3AED'
  const bio: string[] = []
  if (player.position) bio.push(player.position)
  if (player.jersey) bio.push(`#${player.jersey}`)
  if (player.age != null) bio.push(`${player.age} años`)
  if (player.nationality) bio.push(player.nationality)
  if (player.height) bio.push(player.height)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back + Share */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/estadisticas?sport=futbol"
          className="flex items-center gap-1.5 text-[12px] text-[#5A5A6A] hover:text-white transition-colors"
          style={{ fontFamily: 'var(--font-sport)' }}
        >
          ‹ Volver a estadísticas
        </Link>
        <ShareButton title={`${player.name} · ${player.leagueLabel}`} />
      </div>

      {/* Header */}
      <div
        className="rounded-2xl p-5 mb-6 flex items-center gap-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div
          className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0 p-2"
          style={{ background: `${accent}18` }}
        >
          {player.team?.logo ? (
            <Image src={player.team.logo} alt={player.team.name} width={56} height={56} unoptimized
              style={{ objectFit: 'contain' }} />
          ) : (
            <span className="font-black text-3xl" style={{ color: accent, fontFamily: 'var(--font-display)' }}>
              {player.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[11px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5"
            style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}
          >
            {player.flag && (
              <Image src={player.flag} alt="" width={16} height={11} unoptimized
                style={{ objectFit: 'contain' }} />
            )}
            {player.leagueLabel}
          </div>
          <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {player.name}
          </h1>
          {bio.length > 0 && (
            <div className="text-[12px] text-[#9A9AAA] mt-1">{bio.join(' · ')}</div>
          )}
          {player.team && (
            <Link
              href={`/equipo/${player.team.slug}`}
              className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
            >
              {player.team.name} ›
            </Link>
          )}
        </div>
      </div>

      {/* Season stats */}
      {player.stats.length > 0 && (
        <>
          <div
            className="text-[10px] font-black uppercase tracking-widest text-[#5A5A6A] mb-3"
            style={{ fontFamily: 'var(--font-sport)' }}
          >
            {player.season ? `Estadísticas · ${player.season}` : 'Estadísticas de la temporada'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {player.stats.map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  {s.value}
                </div>
                <div className="text-[10px] text-[#5A5A6A] uppercase tracking-wide mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Club recent matches */}
      {player.recent.length > 0 && player.team && (
        <>
          <div
            className="text-[10px] font-black uppercase tracking-widest text-[#5A5A6A] mb-3"
            style={{ fontFamily: 'var(--font-sport)' }}
          >
            Últimos partidos · {player.team.name}
          </div>
          {player.recent.map(r => (
            <MatchRow key={r.matchRef} r={r} teamId={player.team!.id} />
          ))}
        </>
      )}

      {player.stats.length === 0 && player.recent.length === 0 && (
        <div className="text-center py-10 text-[#5A5A6A] text-sm">
          Sin estadísticas disponibles para este jugador
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────
export default async function JugadorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const player = await fetchPlayer(slug)
  if (!player) notFound()

  return (
    <>
      <LiveStrip />
      <Header />
      <main style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Suspense>
          <PlayerContent player={player} />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
