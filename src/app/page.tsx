import type { Metadata } from 'next'
import { sanityClient, articlesQuery, reelsQuery, eventsQuery } from '@/lib/sanity'
import { SLUG_TO_LABEL } from '@/lib/sports'
import { normalizeEvent } from '@/lib/events'
import { fetchEspnEvents } from '@/lib/espn'
import { fetchPublicReels } from '@/lib/instagram-public'
import { SEED_REELS } from '@/lib/seed-reels'
import Header from '@/components/Header'
import BreakingNewsBar from '@/components/BreakingNewsBar'
import LiveStrip from '@/components/LiveStrip'
import HomeContent from '@/components/HomeContent'
import Footer from '@/components/Footer'
import { urlFor } from '@/lib/sanity'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 300

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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakaSports — Noticias deportivas en tiempo real',
    description: 'Noticias deportivas de actualidad: fútbol, NBA, F1, UFC y tenis. Resultados en vivo, calendario y juegos.',
    site: '@takasportsx',
    creator: '@takasportsx',
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
  const [rawArticles, sanityReels, rawEvents, espnEvents, igReels] = await Promise.all([
    sanityClient.fetch<HomeArticle[]>(articlesQuery),
    sanityClient.fetch(reelsQuery),
    sanityClient.fetch(eventsQuery).catch(() => []),
    fetchEspnEvents().catch(() => []),
    fetchPublicReels().catch(() => []),
  ])

  const articles = sortForHome(rawArticles)

  // SSR: Sanity reels → live Instagram API → seed placeholders
  const reels = (sanityReels as unknown[]).length > 0
    ? sanityReels
    : igReels.length > 0
      ? igReels
      : SEED_REELS

  const sanityEvents = Array.isArray(rawEvents) && rawEvents.length > 0
    ? rawEvents.map(normalizeEvent)
    : []
  const sanityIds = new Set(sanityEvents.map((e: { home: string; away: string | null }) => `${e.home}|${e.away}`))
  const events = [...sanityEvents, ...espnEvents.filter(e => !sanityIds.has(`${e.home}|${e.away}`))]

  // Convertir slug de URL ('futbol') → label visual ('Fútbol') para el estado inicial
  const initialSport = sport ? (SLUG_TO_LABEL[sport.toLowerCase()] ?? '') : ''

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Últimas noticias — TakaSports',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: Math.min(articles.length, 20),
    isPartOf: { '@id': `${SITE_URL}/#website` },
    itemListElement: articles.slice(0, 20).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: a.slug ? `${SITE_URL}/noticias/${a.slug}` : undefined,
      name: a.title,
      image: a.imageUrl ?? (a.image?.asset ? urlFor(a.image).width(1200).height(630).url() : undefined),
    })),
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Header />
      <h1 className="sr-only">TakaSports — Noticias deportivas en tiempo real</h1>
      <BreakingNewsBar items={articles.slice(0, 8).map((a: { title: string; slug?: string; sport?: string; category?: string }) => ({ title: a.title, slug: a.slug, sport: a.sport || a.category }))} />
      <LiveStrip />
      <HomeContent articles={articles} reels={reels} events={events} initialSport={initialSport} />
      <Footer />
    </div>
  )
}
