import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { sanityClient, reportajesAllQuery } from '@/lib/sanity'
import ReportajeCard, { coverUrl } from '@/components/ReportajeCard'
import type { Reportaje } from '@/components/ReportajesBlock'
import NewsletterSection from '@/components/NewsletterSection'
import ScrollToTop from '@/components/ScrollToTop'
import { SITE_URL, REPORTAJES_ENABLED } from '@/lib/constants'

export const revalidate = 300

const TITLE = 'Reportajes'
const DESC = 'Las piezas de fondo de TakaSports: investigaciones, perfiles y análisis largos sobre el deporte, para leer sin prisa.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE_URL}/reportajes` },
  openGraph: {
    title: `${TITLE} | TakaSports`,
    description: DESC,
    url: `${SITE_URL}/reportajes`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: `${TITLE} — TakaSports`, site: '@takasportsx' },
}

export default async function ReportajesPage() {
  // Reportajes en pausa: en vez de un índice vacío que Google indexa como
  // soft-404, mandamos al feed. Redirección temporal (307) porque la
  // sección vuelve en cuanto REPORTAJES_ENABLED sea true.
  if (!REPORTAJES_ENABLED) redirect('/noticias')

  const reportajes = await sanityClient.fetch<Reportaje[]>(reportajesAllQuery).catch(() => [] as Reportaje[])

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: TITLE, item: `${SITE_URL}/reportajes` },
    ],
  }
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${TITLE} — TakaSports`,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: Math.min(reportajes.length, 20),
    isPartOf: { '@id': `${SITE_URL}/#website` },
    itemListElement: reportajes.slice(0, 20).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: r.slug ? `${SITE_URL}/noticias/${r.slug}` : undefined,
      name: r.title,
      image: coverUrl(r, 1200, 630) ?? undefined,
    })),
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-7 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <header className="mb-7">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="section-accent" style={{ background: 'var(--reportaje)', height: 19 }} />
          <h1
            className="font-black"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.9rem, 4vw, 2.6rem)', lineHeight: 1, letterSpacing: '-0.025em', color: '#F2F2FA' }}
          >
            Reportajes
          </h1>
        </div>
        <p className="max-w-[62ch]" style={{ fontSize: '0.92rem', lineHeight: 1.6, color: '#8E8EA6' }}>
          {DESC}
        </p>
      </header>

      {reportajes.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-14 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: '#C8C8DC', marginBottom: 8 }}>
            Todavía no hay reportajes publicados
          </p>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Estamos trabajando en las primeras piezas de fondo. Mientras tanto, tienes toda la actualidad en el feed.
          </p>
          <Link
            href="/noticias"
            className="inline-block text-xs font-semibold px-4 py-2 rounded-full transition-opacity hover:opacity-80"
            style={{
              background: 'rgba(232,163,61,0.14)',
              color: 'var(--reportaje)',
              border: '1px solid rgba(232,163,61,0.32)',
              fontFamily: 'var(--font-sport)',
              textDecoration: 'none',
            }}
          >
            Ir a las noticias
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportajes.map((r, i) => (
            <ReportajeCard key={r._id} r={r} lcp={i === 0} />
          ))}
        </div>
      )}

      <NewsletterSection source="reportajes" />
      <ScrollToTop />
    </div>
  )
}
