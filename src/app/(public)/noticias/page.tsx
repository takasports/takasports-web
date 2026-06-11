import type { Metadata } from 'next'
import { sanityClient, articlesQuery, reelsQuery, urlFor } from '@/lib/sanity'
import reelsData from '@/lib/reels-data.json'
import NoticiasContent from '@/components/NoticiasContent'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 300

export const metadata: Metadata = {
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

export default async function NoticiasPage() {
  // B (2026-06-06): el filtro por ?sport= se aplica en CLIENTE (NoticiasContent) para que
  // esta página sea estática/ISR (cacheable, rápida — antes era no-store por leer searchParams).
  // El deep-link/compartido sigue funcionando: tras hidratar, el chip del deporte se activa y
  // carga sus noticias. El canonical fijo a /noticias evita competir con los hubs /[sport],
  // y la vista filtrada deja de ser una URL distinta indexable (sustituye al noindex anterior).
  const [articles, reels] = await Promise.all([
    sanityClient.fetch(articlesQuery),
    sanityClient.fetch(reelsQuery),
  ])

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

      <div className="max-w-[1440px] mx-auto pb-24">
        <NoticiasContent
          articles={articles}
          reels={igReels as typeof reels}
        />
      </div>

      <NewsletterSection source="noticias" />
      <ScrollToTop />
    </div>
  )
}
