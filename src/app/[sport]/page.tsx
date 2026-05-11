import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sanityClient, articlesBySportQuery, reelsQuery, eventsBySportQuery } from '@/lib/sanity'
import { SLUG_TO_LABEL, getSportEmoji } from '@/lib/sports'
import { getRanking } from '@/lib/rankings-data'
import reelsData from '@/lib/reels-data.json'
import Header from '@/components/Header'
import BreakingNewsBar from '@/components/BreakingNewsBar'
import LiveStrip from '@/components/LiveStrip'
import NoticiasContent from '@/components/NoticiasContent'
import SportHubHeader from '@/components/SportHubHeader'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { urlFor } from '@/lib/sanity'
import { SITE_URL, LOGO_URL } from '@/lib/constants'

export const revalidate = 300

export function generateStaticParams() {
  return Object.keys(SLUG_TO_LABEL).map(sport => ({ sport }))
}

// Metadata dinámica por deporte
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>
}): Promise<Metadata> {
  const { sport } = await params
  const label = SLUG_TO_LABEL[sport.toLowerCase()]
  if (!label) return {}

  const emoji = getSportEmoji(label)
  const title = `${label}: noticias, resultados y análisis`
  const description = `Últimas noticias de ${label}: resultados, fichajes, partidos en vivo y análisis en profundidad. Actualizado al minuto.`

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${sport}`,
    },
    openGraph: {
      title: `${emoji} ${title} | TakaSports`,
      description,
      siteName: 'TakaSports',
      locale: 'es_ES',
      type: 'website',
      url: `${SITE_URL}/${sport}`,
      images: [{ url: LOGO_URL, width: 800, height: 800, alt: `${label} — TakaSports` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${emoji} ${title} | TakaSports`,
      description,
      site: '@takasportsx',
    },
  }
}

export default async function SportPage({
  params,
}: {
  params: Promise<{ sport: string }>
}) {
  const { sport } = await params
  const label = SLUG_TO_LABEL[sport.toLowerCase()]

  // Si el slug no es un deporte válido → 404
  if (!label) notFound()

  const sportSlug = sport.toLowerCase()
  const rankCategory = sportSlug === 'wwe' ? 'creadores_wwe' : 'jugadores'

  const [articles, reels, allRankings, upcomingEvents] = await Promise.all([
    sanityClient.fetch(articlesBySportQuery, { sport: sportSlug }),
    sanityClient.fetch(reelsQuery),
    getRanking(rankCategory),
    sanityClient.fetch(eventsBySportQuery, { sport: sportSlug }),
  ])

  const topRankings = rankCategory === 'jugadores'
    ? allRankings.filter((e: { sport?: string }) => e.sport === sportSlug).slice(0, 5)
    : allRankings.slice(0, 5)

  // Filter out any null/undefined entries (Sanity can return nulls for broken references)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeArticles = (articles as any[]).filter(Boolean)
  const igReels = (reels as unknown[]).length > 0 ? reels : reelsData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sportEvents = ((upcomingEvents as any[]) ?? []).filter(Boolean)

  const sportUrl = `${SITE_URL}/${sport}`

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${label} — TakaSports`,
    description: `Últimas noticias de ${label}: resultados, fichajes, partidos en vivo y análisis en profundidad.`,
    url: sportUrl,
    inLanguage: 'es-ES',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Noticias', item: `${SITE_URL}/noticias` },
      { '@type': 'ListItem', position: 3, name: label, item: sportUrl },
    ],
  }

  type SportArticle = { _id: string; slug?: string; title: string; imageUrl?: string | null; image?: { asset: { _ref: string } } | null }
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Últimas noticias de ${label}`,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: Math.min(safeArticles.length, 20),
    itemListElement: (safeArticles as SportArticle[]).slice(0, 20).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: a.slug ? `${SITE_URL}/noticias/${a.slug}` : undefined,
      name: a.title,
      image: a.imageUrl ?? (a.image?.asset ? urlFor(a.image).width(1200).height(630).url() : undefined),
    })),
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Header />
      <BreakingNewsBar
        items={safeArticles.slice(0, 8).map(
          (a: { title: string; sport?: string; category?: string }) => ({
            title: a.title,
            sport: a.sport || a.category,
          })
        )}
      />
      <LiveStrip />
      <SportHubHeader
        sport={sportSlug}
        label={label}
        topRankings={topRankings}
        upcomingEvents={sportEvents}
      />

      <main className="max-w-[1440px] mx-auto pb-24">
        <NoticiasContent
          articles={safeArticles}
          reels={igReels as typeof reels}
          initialCategory={label}
        />
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
