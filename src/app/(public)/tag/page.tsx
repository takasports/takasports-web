import type { Metadata } from 'next'
import Link from 'next/link'
import { sanityClient, allTagsFlatQuery, MIN_TAG_ARTICLES, isJunkTag } from '@/lib/sanity'
import { SITE_URL } from '@/lib/constants'
import ScrollToTop from '@/components/ScrollToTop'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Etiquetas: todos los temas de TakaSports',
  description:
    'Explora todos los temas, equipos, jugadores y competiciones cubiertos por TakaSports. Encuentra todas las noticias agrupadas por etiqueta.',
  alternates: { canonical: `${SITE_URL}/tag` },
  openGraph: {
    title: 'Etiquetas: todos los temas de TakaSports',
    description: 'Explora todos los temas y noticias de TakaSports agrupados por etiqueta.',
    url: `${SITE_URL}/tag`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
}

// Devuelve los tags indexables (>=3 artículos, no basura) ordenados por frecuencia.
// Es el hub que da enlaces internos rastreables a las páginas /tag/[tag] —antes
// huérfanas— y reemplaza el soft-404 que devolvía /tag. (Fase 1 SEO, jun 2026)
async function getIndexableTags(): Promise<Array<{ tag: string; count: number }>> {
  const flat = await sanityClient.fetch<string[]>(allTagsFlatQuery).catch(() => [] as string[])
  const counts = new Map<string, number>()
  for (const raw of flat) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim()
    if (!tag) continue
    counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([tag, count]) => count >= MIN_TAG_ARTICLES && !isJunkTag(tag))
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export default async function TagIndexPage() {
  const tags = await getIndexableTags()

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Etiquetas', item: `${SITE_URL}/tag` },
    ],
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-20">
        <div className="pt-10 pb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="section-accent" />
            <span className="section-label">Ranking</span>
          </div>
          <h1
            className="font-black leading-tight mb-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
            }}
          >
            Etiquetas
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {tags.length} temas con cobertura en TakaSports
          </p>
        </div>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-sport)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  textDecoration: 'none',
                }}
              >
                #{tag}
                <span style={{ color: 'var(--text-faint)', fontSize: 11, fontWeight: 700 }}>{count}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aún no hay temas con cobertura suficiente.</p>
        )}
      </div>

      <ScrollToTop />
    </div>
  )
}
