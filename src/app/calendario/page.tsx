import { cookies } from 'next/headers'
import { sanityClient, eventsQuery } from '@/lib/sanity'
import { normalizeEvent } from '@/lib/events'
import { fetchEspnEvents } from '@/lib/espn'
import { fetchPadelEvents } from '@/lib/padel'
import { fetchRecentFormByTeams } from '@/lib/past-events'
import { TZ_KEY, SOURCE_TZ } from '@/lib/timezone'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import CalendarioContent from '@/components/CalendarioContent'
import { SITE_URL, LOGO_URL } from '@/lib/constants'

export const revalidate = 300

/** Normalize a team name for duplicate detection: lowercase, strip accents,
 *  collapse whitespace, strip common suffixes (CF, FC, SL, SAD…). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|cf|sl|sad|sc|afc|fk|ac|as|ss|rc|rcd|ud|sd|cd|rv)\b/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default async function CalendarioPage() {
  // Los resultados pasados ya NO se traen en el SSR (lo hacía 1 fetch por liga,
  // ~38, y la mayoría de usuarios no abre la pestaña Resultados). Se cargan en
  // cliente vía /api/events/past?live=1 cuando hace falta. Aligera HTML y render.
  const [espnEvents, rawSanity, padelEvents] = await Promise.allSettled([
    fetchEspnEvents(),
    sanityClient.fetch(eventsQuery),
    fetchPadelEvents(),
  ])

  const sanityEvents = rawSanity.status === 'fulfilled' && Array.isArray(rawSanity.value) && rawSanity.value.length > 0
    ? rawSanity.value.map(normalizeEvent)
    : []

  const espn   = espnEvents.status === 'fulfilled'  ? espnEvents.value  : []
  const padel  = padelEvents.status === 'fulfilled' ? padelEvents.value : []

  // Build a set of match fingerprints from curated Sanity events.
  // Key = normalized(home)|normalized(away)|YYYY-MM-DD  (or date string)
  const sanityFingerprints = new Set(
    sanityEvents.map(e => {
      const day = e.isoDate?.slice(0, 10) ?? e.date
      return `${norm(e.home)}|${norm(e.away ?? '')}|${day}`
    })
  )

  function hasSanityDupe(home: string, away: string | null, isoDate?: string, date?: string): boolean {
    if (!away) return false   // non-team events are never blocked by Sanity
    const day = isoDate?.slice(0, 10) ?? date ?? ''
    return sanityFingerprints.has(`${norm(home)}|${norm(away)}|${day}`)
  }

  const espnFiltered  = espn.filter(e  => !hasSanityDupe(e.home, e.away, e.isoDate, e.date))
  const padelFiltered = padel.filter(e => !hasSanityDupe(e.home, e.away, e.isoDate, e.date))

  // Final merge + dedup: Sanity first (curated), then ESPN, then Padel.
  // Dedup passes: 1) by id  2) by match fingerprint (team sports)
  const seenIds          = new Set<string>()
  const seenFingerprints = new Set<string>()

  const events = [...sanityEvents, ...espnFiltered, ...padelFiltered].filter(e => {
    if (seenIds.has(e.id)) return false
    seenIds.add(e.id)

    if (e.away) {
      const day = e.isoDate?.slice(0, 10) ?? e.date
      const fp  = `${norm(e.home)}|${norm(e.away)}|${day}`
      if (seenFingerprints.has(fp)) return false
      seenFingerprints.add(fp)
    }
    return true
  })

  // Recent form (last 5 W/D/L) for every team that appears in the upcoming
  // events list. One bulk query to past_events; missing teams or unconfigured
  // Supabase result in empty arrays — UI degrades gracefully.
  const teamNames = Array.from(new Set(
    events.flatMap(e => [e.home, e.away].filter(Boolean) as string[])
  ))
  const recentForms = (await fetchRecentFormByTeams(teamNames, 5)) ?? {}

  // Read TZ preference from cookie so the very first render already uses it
  // and we avoid the hydration flash from Madrid → browser TZ on mount.
  const cookieStore = await cookies()
  const initialTz = cookieStore.get(TZ_KEY)?.value || SOURCE_TZ

  // SportsEvent JSON-LD: emitimos los primeros 60 eventos futuros para
  // que Google los muestre como rich results (carrusel de eventos en SERP).
  // Más de 60 satura el grafo sin beneficio adicional.
  const eventsJsonLd = {
    '@context': 'https://schema.org',
    '@graph': events.slice(0, 60).map((e) => {
      const isTeamMatch = Boolean(e.away)
      const startDate = e.isoDate ?? undefined
      const name = isTeamMatch
        ? `${e.home} vs ${e.away}`
        : e.home
      return {
        '@type': isTeamMatch ? 'SportsEvent' : 'Event',
        name,
        startDate,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
        location: e.venue
          ? { '@type': 'Place', name: e.venue }
          : { '@type': 'VirtualLocation', url: SITE_URL },
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
        organizer: {
          '@type': 'Organization',
          name: e.comp ?? 'TakaSports',
          url: SITE_URL,
        },
        image: LOGO_URL,
        url: `${SITE_URL}/calendario`,
      }
    }),
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventsJsonLd) }}
      />
      <Header />
      <LiveStrip />
      <CalendarioContent
        events={events}
        recentForms={recentForms}
        initialTz={initialTz}
      />
      <NewsletterSection source="calendario" />
      <Footer />
      <ScrollToTop />
    </div>
  )
}
