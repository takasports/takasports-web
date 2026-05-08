import { sanityClient, eventsQuery } from '@/lib/sanity'
import { normalizeEvent } from '@/lib/events'
import { fetchEspnEvents, fetchEspnPastEvents } from '@/lib/espn'
import { fetchPadelEvents } from '@/lib/padel'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import CalendarioContent from '@/components/CalendarioContent'

export const revalidate = 300

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

  // Merge: Sanity events (curated) first, ESPN + Padel fill the rest
  const sanityIds = new Set(sanityEvents.map(e => `${e.home}|${e.away}`))
  const espnFiltered  = espn.filter(e => !sanityIds.has(`${e.home}|${e.away}`))
  const padelFiltered = padel.filter(e => !sanityIds.has(`${e.home}|${e.away}`))
  const events = [...sanityEvents, ...espnFiltered, ...padelFiltered]

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />
      <CalendarioContent events={events} pastEvents={past} />
      <Footer />
      <ScrollToTop />
    </div>
  )
}
