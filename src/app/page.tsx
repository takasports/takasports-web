import type { Metadata } from 'next'
import { sanityClient, articlesQuery, reelsQuery, eventsQuery } from '@/lib/sanity'
import { SLUG_TO_LABEL } from '@/lib/sports'
import { normalizeEvent } from '@/lib/events'
import { fetchEspnEvents } from '@/lib/espn'
import { SEED_REELS } from '@/lib/seed-reels'
import reelsData from '@/lib/reels-data.json'
import Header from '@/components/Header'
import BreakingNewsBar from '@/components/BreakingNewsBar'
import LiveStrip from '@/components/LiveStrip'
import HomeContent from '@/components/HomeContent'
import Footer from '@/components/Footer'
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'

export const revalidate = 60

export const metadata: Metadata = {
  title: { absolute: 'TakaSports — Noticias deportivas en tiempo real' },
  description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario, rankings y juegos. Actualizado cada hora.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'TakaSports — Noticias deportivas en tiempo real',
    description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario, rankings y juegos.',
    url: SITE_URL,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: 'TakaSports — Noticias deportivas' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakaSports — Noticias deportivas en tiempo real',
    description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario y juegos.',
    site: '@takasports',
    creator: '@takasports',
  },
}

interface HomeArticle {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  priority?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
  isTaka?: boolean
}

// Hero del día: artículos con priority alta publicados en las últimas 24h suben al top
const PRIORITY_BOOST: Record<string, number> = { hero: 3, destacado: 2, normal: 1, secundario: 0 }
const DAY_MS = 24 * 60 * 60 * 1000

function sortForHome(articles: HomeArticle[]): HomeArticle[] {
  const now = Date.now()
  return [...articles].sort((a, b) => {
    const ageA = now - new Date(a.publishedAt ?? 0).getTime()
    const ageB = now - new Date(b.publishedAt ?? 0).getTime()
    const boostA = ageA < DAY_MS ? (PRIORITY_BOOST[a.priority ?? 'normal'] ?? 1) : 0
    const boostB = ageB < DAY_MS ? (PRIORITY_BOOST[b.priority ?? 'normal'] ?? 1) : 0
    if (boostA !== boostB) return boostB - boostA
    return ageA - ageB
  })
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>
}) {
  const { sport } = await searchParams
  const [rawArticles, sanityReels, rawEvents, espnEvents] = await Promise.all([
    sanityClient.fetch<HomeArticle[]>(articlesQuery),
    sanityClient.fetch(reelsQuery),
    sanityClient.fetch(eventsQuery).catch(() => []),
    fetchEspnEvents().catch(() => []),
  ])

  const articles = sortForHome(rawArticles)

  // SSR: Sanity reels → reels-data.json estático → seed. Los thumbnails reales eliminan el flash
  const reels = (sanityReels as unknown[]).length > 0
    ? sanityReels
    : (reelsData as unknown[]).length > 0
      ? reelsData
      : SEED_REELS

  const sanityEvents = Array.isArray(rawEvents) && rawEvents.length > 0
    ? rawEvents.map(normalizeEvent)
    : []
  const sanityIds = new Set(sanityEvents.map((e: { home: string; away: string | null }) => `${e.home}|${e.away}`))
  const events = [...sanityEvents, ...espnEvents.filter(e => !sanityIds.has(`${e.home}|${e.away}`))]

  // Convertir slug de URL ('futbol') → label visual ('Fútbol') para el estado inicial
  const initialSport = sport ? (SLUG_TO_LABEL[sport.toLowerCase()] ?? '') : ''

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TakaSports',
    url: SITE_URL,
  }

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TakaSports',
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: LOGO_URL },
    sameAs: ['https://twitter.com/takasports'],
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <Header />
      <BreakingNewsBar items={articles.slice(0, 8).map((a: { title: string; slug?: string; sport?: string; category?: string }) => ({ title: a.title, slug: a.slug, sport: a.sport || a.category }))} />
      <LiveStrip />
      <HomeContent articles={articles} reels={reels} events={events} initialSport={initialSport} />
      <Footer />
    </div>
  )
}
