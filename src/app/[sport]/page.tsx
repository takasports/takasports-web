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
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'

export const revalidate = 60

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
    },
    twitter: {
      card: 'summary_large_image',
      title: `${emoji} ${title} | TakaSports`,
      description,
      site: '@takasports',
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

  const igReels = (reels as unknown[]).length > 0 ? reels : reelsData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sportEvents = (upcomingEvents as any[]) ?? []

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: label, item: `${SITE_URL}/${sport}` },
    ],
  }

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${label} — TakaSports`,
    description: `Últimas noticias de ${label}: resultados, fichajes, partidos en vivo y análisis en profundidad.`,
    url: `${SITE_URL}/${sport}`,
    inLanguage: 'es-ES',
    publisher: {
      '@type': 'Organization',
      name: 'TakaSports',
      url: SITE_URL,
    },
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <Header />
      <BreakingNewsBar
        items={articles.slice(0, 8).map(
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
          articles={articles}
          reels={igReels as typeof reels}
          initialCategory={label}
        />
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
