import type { Metadata } from 'next'
import Link from 'next/link'
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

const GLOSARIO_URL = `${SITE_URL}/glosario`

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Glosario', item: GLOSARIO_URL },
  ],
}

// DefinedTermSet: el schema más específico para glosarios curados.
// Permite que Google muestre los términos en Knowledge Panels y rich results.
const definedTermSetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  '@id': `${GLOSARIO_URL}/#termset`,
  name: 'Glosario deportivo TakaSports',
  description: 'Conceptos del fútbol, baloncesto, F1, tenis y otros deportes explicados de forma clara y breve.',
  url: GLOSARIO_URL,
  inLanguage: 'es-ES',
  publisher: {
    '@type': 'Organization',
    name: 'TakaSports',
    url: SITE_URL,
  },
  hasDefinedTerm: GLOSARIO_TERMS.map(t => ({
    '@type': 'DefinedTerm',
    name: t.term,
    description: t.summary,
    url: `${GLOSARIO_URL}/${t.slug}`,
    inDefinedTermSet: `${GLOSARIO_URL}/#termset`,
  })),
}

const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Glosario deportivo — TakaSports',
  numberOfItems: GLOSARIO_TERMS.length,
  itemListElement: GLOSARIO_TERMS.map((t, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${GLOSARIO_URL}/${t.slug}`,
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
  const SPORT_META: Record<GlosarioSport, { emoji: string; accent: string }> = {
    futbol:     { emoji: '⚽',  accent: '#22c55e' },
    baloncesto: { emoji: '🏀',  accent: '#f59e0b' },
    f1:         { emoji: '🏎️',  accent: '#ef4444' },
    tenis:      { emoji: '🎾',  accent: '#d97706' },
    ufc:        { emoji: '🥊',  accent: '#f97316' },
    general:    { emoji: '📘',  accent: '#7C3AED' },
  }
  const activeSports = order.filter((s) => bySport[s]?.length)

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSetJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-20">

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

          {/* Nav de categorías — salto a cada sección */}
          <div className="flex flex-wrap gap-2 mt-6">
            {activeSports.map((sport) => {
              const { emoji, accent } = SPORT_META[sport]
              return (
                <a
                  key={sport}
                  href={`#${sport}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all hover:brightness-125"
                  style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}33`, fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
                >
                  <span>{emoji}</span>
                  {SPORT_LABEL[sport]}
                  <span className="tabular-nums" style={{ opacity: 0.6 }}>{bySport[sport].length}</span>
                </a>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-12">
          {activeSports.map((sport) => {
            const { emoji, accent } = SPORT_META[sport]
            return (
            <section key={sport} id={sport} style={{ scrollMarginTop: 90 }}>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="flex items-center justify-center rounded-xl text-xl flex-shrink-0"
                  style={{ width: 40, height: 40, background: `${accent}18`, border: `1px solid ${accent}33` }}
                >
                  {emoji}
                </span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#F0F0FA', letterSpacing: '-0.01em' }}>
                  {SPORT_LABEL[sport]}
                </h2>
                <span
                  className="text-[11px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: `${accent}14`, color: accent, fontFamily: 'var(--font-sport)' }}
                >
                  {bySport[sport].length} términos
                </span>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${accent}33, transparent)` }} />
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {bySport[sport].map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/glosario/${t.slug}`}
                      className="group block h-full rounded-xl px-4 py-3 transition-all hover:-translate-y-0.5"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `2.5px solid ${accent}`, textDecoration: 'none' }}
                    >
                      <p className="text-sm font-bold mb-1 transition-colors" style={{ color: '#F0F0FA' }}>{t.term}</p>
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {t.summary}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            )
          })}
        </div>

      </div>

    </div>
  )
}
