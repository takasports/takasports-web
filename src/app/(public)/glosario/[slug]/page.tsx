import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SITE_URL, LOGO_URL } from '@/lib/constants'
import {
  GLOSARIO_TERMS,
  getGlosarioTerm,
  getRelatedTerms,
  type GlosarioSport,
} from '@/lib/glosario-terms'

export const dynamicParams = false

export async function generateStaticParams() {
  return GLOSARIO_TERMS.map((t) => ({ slug: t.slug }))
}

const SPORT_LABEL: Record<GlosarioSport, string> = {
  futbol: 'Fútbol',
  baloncesto: 'Baloncesto',
  f1: 'Fórmula 1',
  tenis: 'Tenis',
  ufc: 'UFC',
  general: 'General',
}

const SPORT_HUB: Record<GlosarioSport, string> = {
  futbol: '/futbol',
  baloncesto: '/baloncesto',
  f1: '/formula1',
  tenis: '/tenis',
  ufc: '/ufc',
  general: '/noticias',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const term = getGlosarioTerm(slug)
  if (!term) return { title: 'Glosario | TakaSports' }
  const canonical = `${SITE_URL}/glosario/${term.slug}`
  return {
    title: `${term.term} — ¿Qué es y cómo funciona?`,
    description: term.summary,
    alternates: { canonical },
    openGraph: {
      title: `${term.term} — Glosario TakaSports`,
      description: term.summary,
      url: canonical,
      siteName: 'TakaSports',
      locale: 'es_ES',
      type: 'article',
      images: [{ url: LOGO_URL, width: 1200, height: 630, alt: term.term }],
    },
    twitter: {
      card: 'summary_large_image',
      title: term.term,
      description: term.summary,
      site: '@takasportsx',
    },
  }
}

export default async function GlosarioTermPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const term = getGlosarioTerm(slug)
  if (!term) notFound()

  const related = getRelatedTerms(slug, 3)
  const canonical = `${SITE_URL}/glosario/${term.slug}`

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Glosario', item: `${SITE_URL}/glosario` },
      { '@type': 'ListItem', position: 3, name: term.term, item: canonical },
    ],
  }

  const definedTermJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: term.term,
    description: term.summary,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'Glosario deportivo TakaSports',
      url: `${SITE_URL}/glosario`,
    },
    url: canonical,
    inLanguage: 'es-ES',
  }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `¿Qué es ${term.term}?`,
        acceptedAnswer: { '@type': 'Answer', text: term.summary },
      },
    ],
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">

        <nav aria-label="Migas" className="mb-6 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
          <span>›</span>
          <Link href="/glosario" className="hover:text-white transition-colors">Glosario</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-secondary)' }}>{term.term}</span>
        </nav>

        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="section-accent" />
            <Link href={SPORT_HUB[term.sport]} className="section-label hover:text-white transition-colors">
              {SPORT_LABEL[term.sport]}
            </Link>
          </div>
          <h1
            className="font-black leading-tight mb-4"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.2rem, 5.5vw, 3.2rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
            }}
          >
            {term.term}
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {term.summary}
          </p>
        </div>

        <article className="flex flex-col" style={{ maxWidth: 680 }}>
          {term.body.map((p, i) => {
            if (/^\*\*(.+)\*\*$/.test(p)) {
              return (
                <h2
                  key={i}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: '#E8E8F4',
                    letterSpacing: '-0.01em',
                    marginTop: '2rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  {p.slice(2, -2)}
                </h2>
              )
            }
            return (
              <p
                key={i}
                style={{ color: '#B8B8D0', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '1rem' }}
              >
                {p}
              </p>
            )
          })}
        </article>

        <p className="mt-8 text-xs" style={{ color: 'var(--text-faint)' }}>
          Última actualización: {new Date(term.updatedAt).toLocaleDateString('es-ES', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>

        {related.length > 0 && (
          <section className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
            <h2 className="section-label mb-4">Términos relacionados</h2>
            <ul className="flex flex-col gap-2.5">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/glosario/${r.slug}`}
                    className="block rounded-xl px-4 py-3 transition-colors"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    <p className="text-sm font-semibold" style={{ color: '#E8E8F4', marginBottom: 2 }}>{r.term}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{r.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>

    </div>
  )
}
