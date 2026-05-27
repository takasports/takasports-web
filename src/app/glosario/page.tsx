import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SITE_URL } from '@/lib/constants'
import { GLOSARIO_TERMS, type GlosarioSport } from '@/lib/glosario-terms'

export const metadata: Metadata = {
  title: 'Glosario deportivo — Términos explicados',
  description:
    'Glosario de TakaSports: qué es el VAR, el fuera de juego, el DRS, el pick and roll, el tie-break y más. Conceptos del fútbol, baloncesto, F1 y tenis explicados de forma clara y breve.',
  alternates: { canonical: `${SITE_URL}/glosario` },
  openGraph: {
    title: 'Glosario deportivo — TakaSports',
    description: 'Conceptos del fútbol, baloncesto, F1, tenis y más, explicados de forma clara.',
    url: `${SITE_URL}/glosario`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Glosario deportivo — TakaSports',
    description: 'Conceptos del deporte explicados, en español.',
    site: '@takasportsx',
  },
}

const SPORT_LABEL: Record<GlosarioSport, string> = {
  futbol: 'Fútbol',
  baloncesto: 'Baloncesto',
  f1: 'Fórmula 1',
  tenis: 'Tenis',
  ufc: 'UFC',
  general: 'General',
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Glosario', item: `${SITE_URL}/glosario` },
  ],
}

const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Glosario deportivo — TakaSports',
  numberOfItems: GLOSARIO_TERMS.length,
  itemListElement: GLOSARIO_TERMS.map((t, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE_URL}/glosario/${t.slug}`,
    name: t.term,
  })),
}

export default function GlosarioIndexPage() {
  const bySport = GLOSARIO_TERMS.reduce<Record<string, typeof GLOSARIO_TERMS>>((acc, t) => {
    acc[t.sport] = acc[t.sport] ?? []
    acc[t.sport].push(t)
    return acc
  }, {})

  const order: GlosarioSport[] = ['futbol', 'baloncesto', 'f1', 'tenis', 'ufc', 'general']

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">

        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="section-accent" />
            <span className="section-label">Glosario</span>
          </div>
          <h1
            className="font-black leading-tight mb-4"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.2rem, 5.5vw, 3.4rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
            }}
          >
            Glosario deportivo
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Los conceptos del fútbol, baloncesto, Fórmula 1, tenis y otros deportes,
            explicados de forma clara y breve. ¿Qué es el VAR? ¿Cómo funciona el DRS?
            ¿Qué es un Grand Slam? Empieza por aquí.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {order.filter((s) => bySport[s]?.length).map((sport) => (
            <section key={sport}>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.4rem',
                fontWeight: 800,
                color: '#E8E8F4',
                marginBottom: '0.75rem',
              }}>
                {SPORT_LABEL[sport]}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {bySport[sport].map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/glosario/${t.slug}`}
                      className="block rounded-xl px-4 py-3 transition-colors"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                    >
                      <p className="text-sm font-semibold" style={{ color: '#E8E8F4', marginBottom: 2 }}>{t.term}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {t.summary}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

      </main>

      <Footer />
    </div>
  )
}
