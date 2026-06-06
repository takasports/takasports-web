import type { Metadata } from 'next'
import { sanityClient, articlesQuery, articlesBySportQuery, reelsQuery, urlFor } from '@/lib/sanity'
import { SLUG_TO_LABEL } from '@/lib/sports'
import reelsData from '@/lib/reels-data.json'
import Header from '@/components/Header'
import BreakingNewsBar from '@/components/BreakingNewsBar'
import LiveStrip from '@/components/LiveStrip'
import NoticiasContent from '@/components/NoticiasContent'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 300

const baseMetadata: Metadata = {
  title: 'Noticias deportivas en tiempo real',
  description: 'Todas las noticias del deporte al minuto: fútbol, NBA, F1, Tenis, UFC, WWE y más. Actualizado cada hora.',
  alternates: { canonical: `${SITE_URL}/noticias` },
  openGraph: {
    title: 'Noticias deportivas en tiempo real | TakaSports',
    description: 'Todas las noticias del deporte en tiempo real. Fútbol, NBA, F1, Tenis, UFC y más.',
    url: `${SITE_URL}/noticias`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Noticias deportivas — TakaSports', site: '@takasportsx' },
}

// A1 (2026-06-06): la vista filtrada /noticias?sport=X NO se indexa para no competir con el
// hub canónico /[sport] (la página rica del deporte: ranking + eventos + noticias). El
// canonical de la variante apunta a ese hub; el listado base /noticias se indexa normal.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ sport?: string }> }): Promise<Metadata> {
  const { sport } = await searchParams
  const slug = sport?.toLowerCase()
  const valid = slug && SLUG_TO_LABEL[slug] ? slug : undefined
  if (!valid) return baseMetadata
  const label = SLUG_TO_LABEL[valid]
  return {
    ...baseMetadata,
    title: `Noticias de ${label}`,
    description: `Últimas noticias de ${label}: actualidad, fichajes, resultados y análisis en TakaSports.`,
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}/${valid}` },
  }
}

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>
}) {
  const { sport } = await searchParams
  // F2 — Deep-link por deporte: si llega ?sport=<slug válido>, filtramos el feed
  // YA en SSR para que el enlace directo/compartido muestre el deporte correcto
  // (antes el chip salía activo pero el feed era el global → parecía "muestra fútbol").
  const sportSlug = sport?.toLowerCase()
  const validSport = sportSlug && SLUG_TO_LABEL[sportSlug] ? sportSlug : undefined
  const [articles, reels] = await Promise.all([
    validSport
      ? sanityClient.fetch(articlesBySportQuery, { sport: validSport })
      : sanityClient.fetch(articlesQuery),
    sanityClient.fetch(reelsQuery),
  ])
  const initialCategory = validSport ? SLUG_TO_LABEL[validSport] : 'Todo'

  const igReels = (reels as unknown[]).length > 0 ? reels : reelsData

  type ListArticle = { _id: string; slug?: string; title: string; imageUrl?: string | null; image?: { asset: { _ref: string } } | null }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Noticias', item: `${SITE_URL}/noticias` },
    ],
  }
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Noticias deportivas — TakaSports',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: Math.min((articles as ListArticle[]).length, 20),
    isPartOf: { '@id': `${SITE_URL}/#website` },
    itemListElement: (articles as ListArticle[]).slice(0, 20).map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: a.slug ? `${SITE_URL}/noticias/${a.slug}` : undefined,
      name: a.title,
      image: a.imageUrl ?? (a.image?.asset ? urlFor(a.image).width(1200).height(630).url() : undefined),
    })),
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Header />
      <BreakingNewsBar items={[
        ...articles.filter((a: { takaStatus?: string | null }) => a.takaStatus === 'breaking'),
        ...articles.filter((a: { takaStatus?: string | null }) => a.takaStatus !== 'breaking'),
      ].slice(0, 8).map((a: { title: string; slug?: string; sport?: string; category?: string }) => ({ title: a.title, slug: a.slug, sport: a.sport || a.category }))} />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto pb-24">
        <NoticiasContent
          articles={articles}
          reels={igReels as typeof reels}
          initialCategory={initialCategory}
        />
      </main>

      <NewsletterSection source="noticias" />
      <Footer />
      <ScrollToTop />
    </div>
  )
}
