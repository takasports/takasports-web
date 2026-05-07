import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sanityClient, articlesBySportQuery, reelsQuery } from '@/lib/sanity'
import { SLUG_TO_LABEL, getSportEmoji } from '@/lib/sports'
import reelsData from '@/lib/reels-data.json'
import Header from '@/components/Header'
import BreakingNewsBar from '@/components/BreakingNewsBar'
import LiveStrip from '@/components/LiveStrip'
import NoticiasContent from '@/components/NoticiasContent'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'

export const revalidate = 60

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
  const title = `${label} — Noticias TakaSports`
  const description = `Últimas noticias de ${label}: resultados, fichajes, análisis y mucho más en TakaSports.`

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${sport}`,
    },
    openGraph: {
      title: `${emoji} ${title}`,
      description,
      siteName: 'TakaSports',
      locale: 'es_ES',
      type: 'website',
      url: `${SITE_URL}/${sport}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${emoji} ${title}`,
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

  const [articles, reels] = await Promise.all([
    sanityClient.fetch(articlesBySportQuery, { sport: sport.toLowerCase() }),
    sanityClient.fetch(reelsQuery),
  ])

  const igReels = (reels as unknown[]).length > 0 ? reels : reelsData

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
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
