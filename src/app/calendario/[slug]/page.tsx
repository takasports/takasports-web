import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { fetchEspnEvents } from '@/lib/espn'
import { fetchPadelEvents } from '@/lib/padel'
import { sanityClient, eventsQuery } from '@/lib/sanity'
import { normalizeEvent } from '@/lib/events'
import type { SportEvent } from '@/lib/types'
import { SITE_URL, LOGO_URL } from '@/lib/constants'
import {
  COMPETITIONS,
  getCompetition,
  matchesCompetition,
} from '@/lib/calendar-competitions'

// ISR cada hora — competiciones evergreen, no necesitan revalidación rápida.
export const revalidate = 3600

export async function generateStaticParams() {
  return COMPETITIONS.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const comp = getCompetition(slug)
  if (!comp) return { title: 'Calendario | TakaSports' }
  const title = `Calendario ${comp.displayName} ${comp.seasonLabel} — Partidos y horarios`
  const description = `${comp.description} Temporada ${comp.seasonLabel}.`
  const canonical = `${SITE_URL}/calendario/${comp.slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'TakaSports',
      locale: 'es_ES',
      type: 'website',
      images: [{ url: comp.logo ?? LOGO_URL, width: 1200, height: 630, alt: comp.displayName }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: '@takasportsx',
    },
  }
}

function dayKey(ev: SportEvent): string {
  return ev.isoDate?.slice(0, 10) ?? ev.date
}

function formatDayHeader(isoDay: string): string {
  try {
    return new Date(`${isoDay}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return isoDay }
}

function formatTime(ev: SportEvent): string {
  if (ev.time && ev.time.trim()) return ev.time
  if (ev.isoDate) {
    try {
      return new Date(ev.isoDate).toLocaleTimeString('es-ES', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
      })
    } catch { return '' }
  }
  return ''
}

export default async function CompetitionCalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const comp = getCompetition(slug)
  if (!comp) notFound()

  const [espnRes, sanityRes, padelRes] = await Promise.allSettled([
    fetchEspnEvents(),
    sanityClient.fetch(eventsQuery),
    fetchPadelEvents(),
  ])

  const espn   = espnRes.status   === 'fulfilled' ? espnRes.value   : []
  const padel  = padelRes.status  === 'fulfilled' ? padelRes.value  : []
  const sanity = sanityRes.status === 'fulfilled' && Array.isArray(sanityRes.value)
    ? sanityRes.value.map(normalizeEvent)
    : []

  const all: SportEvent[] = [...sanity, ...espn, ...padel]
  const filtered = all.filter((e) => matchesCompetition(comp, e))

  // Orden cronológico ascendente para cara al futuro.
  filtered.sort((a, b) => {
    const ta = a.isoDate ? new Date(a.isoDate).getTime() : 0
    const tb = b.isoDate ? new Date(b.isoDate).getTime() : 0
    return ta - tb
  })

  // Agrupar por día.
  const groupedByDay = new Map<string, SportEvent[]>()
  for (const ev of filtered) {
    const k = dayKey(ev)
    if (!groupedByDay.has(k)) groupedByDay.set(k, [])
    groupedByDay.get(k)!.push(ev)
  }
  const dayKeys = [...groupedByDay.keys()].sort()

  const canonical = `${SITE_URL}/calendario/${comp.slug}`

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Calendario', item: `${SITE_URL}/calendario` },
      { '@type': 'ListItem', position: 3, name: comp.displayName, item: canonical },
    ],
  }

  const eventsJsonLd = {
    '@context': 'https://schema.org',
    '@graph': filtered.slice(0, 80).map((e) => {
      const isTeamMatch = Boolean(e.away)
      const name = isTeamMatch ? `${e.home} vs ${e.away}` : e.home
      return {
        '@type': isTeamMatch ? 'SportsEvent' : 'Event',
        name,
        startDate: e.isoDate ?? undefined,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: e.venue ?? `${comp.displayName} — sede por confirmar`,
        },
        description: [e.comp, e.stage].filter(Boolean).join(' · ') || undefined,
        sport: e.sport,
        ...(isTeamMatch
          ? {
              homeTeam: { '@type': 'SportsTeam', name: e.home },
              awayTeam: { '@type': 'SportsTeam', name: e.away },
              competitor: [
                { '@type': 'SportsTeam', name: e.home },
                { '@type': 'SportsTeam', name: e.away },
              ],
            }
          : {}),
        organizer: { '@type': 'Organization', name: comp.displayName, url: canonical },
        image: comp.logo ?? LOGO_URL,
        url: canonical,
      }
    }),
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventsJsonLd) }} />
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">

        <nav aria-label="Migas" className="mb-6 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
          <span>›</span>
          <Link href="/calendario" className="hover:text-white transition-colors">Calendario</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-secondary)' }}>{comp.displayName}</span>
        </nav>

        <header className="mb-10">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="section-accent" />
            <span className="section-label">Calendario {comp.seasonLabel}</span>
          </div>
          <h1
            className="font-black leading-tight mb-4"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.2rem, 5.5vw, 3.4rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
            }}
          >
            Calendario {comp.displayName}
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {comp.description}
          </p>
        </header>

        {filtered.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              No hay eventos disponibles ahora mismo. Vuelve a comprobarlo en unas horas o consulta el{' '}
              <Link href="/calendario" style={{ color: '#7C3AED', textDecoration: 'underline' }}>
                calendario completo
              </Link>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {dayKeys.map((day) => (
              <section key={day}>
                <h2
                  className="mb-3"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: '#E8E8F4',
                    letterSpacing: '-0.005em',
                    textTransform: 'capitalize',
                  }}
                >
                  {formatDayHeader(day)}
                </h2>
                <ul className="flex flex-col gap-2">
                  {groupedByDay.get(day)!.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-xl px-4 py-3 flex items-center gap-4"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                    >
                      <div
                        className="text-sm font-semibold flex-shrink-0"
                        style={{
                          color: ev.accent ?? '#A78BFA',
                          fontFamily: 'var(--font-sport)',
                          minWidth: 56,
                        }}
                      >
                        {formatTime(ev)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#E8E8F4' }}>
                          {ev.away ? `${ev.home} vs ${ev.away}` : ev.home}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {[ev.stage, ev.venue, ev.broadcast].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* Otras competiciones */}
        <section className="mt-14 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
          <h2 className="section-label mb-4">Otros calendarios</h2>
          <div className="flex flex-wrap gap-2">
            {COMPETITIONS.filter((c) => c.slug !== comp.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/calendario/${c.slug}`}
                className="text-xs rounded-full px-3 py-1.5 transition-colors"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                {c.shortName}
              </Link>
            ))}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  )
}
