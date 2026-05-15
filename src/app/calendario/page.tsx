import { cookies } from 'next/headers'
import { sanityClient, eventsQuery } from '@/lib/sanity'
import { normalizeEvent } from '@/lib/events'
import { fetchEspnEvents, fetchEspnPastEvents } from '@/lib/espn'
import { fetchPadelEvents } from '@/lib/padel'
import { fetchRecentFormByTeams } from '@/lib/past-events'
import { TZ_KEY, SOURCE_TZ } from '@/lib/timezone'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import CalendarioContent from '@/components/CalendarioContent'

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
  const [espnEvents, rawSanity, padelEvents, espnPast] = await Promise.allSettled([
    fetchEspnEvents(),
    sanityClient.fetch(eventsQuery),
    fetchPadelEvents(),
    fetchEspnPastEvents(),
  ])

  const sanityEvents = rawSanity.status === 'fulfilled' && Array.isArray(rawSanity.value) && rawSanity.value.length > 0
    ? rawSanity.value.map(normalizeEvent)
    : []

  const espn   = espnEvents.status === 'fulfilled'  ? espnEvents.value  : []
  const padel  = padelEvents.status === 'fulfilled' ? padelEvents.value : []
  const past   = espnPast.status === 'fulfilled'    ? espnPast.value    : []

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

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />
      <CalendarioContent
        events={events}
        pastEvents={past}
        recentForms={recentForms}
        initialTz={initialTz}
      />
      <Footer />
      <ScrollToTop />
    </div>
  )
}
