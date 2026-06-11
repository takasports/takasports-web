import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Sobre TakaSports — Quiénes somos',
  description: 'TakaSports es la plataforma de noticias deportivas en español que combina periodismo editorial con datos en tiempo real. Conoce nuestro equipo y misión.',
  alternates: { canonical: `${SITE_URL}/sobre` },
  openGraph: {
    title: 'Sobre TakaSports — Quiénes somos',
    description: 'TakaSports: noticias deportivas, resultados en vivo, rankings y juegos. Periodismo deportivo para la comunidad hispana.',
    url: `${SITE_URL}/sobre`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sobre TakaSports',
    description: 'Noticias deportivas en español con datos en tiempo real.',
    site: '@takasportsx',
  },
}

// Organization (NewsMediaOrganization) se define una sola vez en el root layout
// como #organization. Aquí solo emitimos breadcrumbs + AboutPage referenciándolo.

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Sobre nosotros', item: `${SITE_URL}/sobre` },
  ],
}

const webPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'Sobre TakaSports',
  url: `${SITE_URL}/sobre`,
  description: 'Información sobre TakaSports: equipo, misión y valores.',
  inLanguage: 'es-ES',
  publisher: { '@id': `${SITE_URL}/#organization` },
}

export default function SobrePage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">

        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="section-accent" />
            <span className="section-label">Sobre nosotros</span>
          </div>
          <h1
            className="font-black leading-tight mb-4"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
            }}
          >
            Somos TakaSports
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            La plataforma de noticias y análisis deportivos en español que combina
            periodismo editorial con datos en tiempo real. Fútbol, NBA, F1, UFC,
            tenis y mucho más — para la comunidad hispana.
          </p>
        </div>

        <div className="space-y-10" style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>

          {/* Misión */}
          <section>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
              color: '#E8E8F4', marginBottom: '0.75rem',
            }}>
              Nuestra misión
            </h2>
            <p>
              Hacer el deporte más accesible, más informado y más entretenido para millones
              de hispanohablantes. Creemos que la afición merece análisis de calidad,
              resultados en vivo sin paywalls y contexto editorial que va más allá del marcador.
            </p>
          </section>

          {/* Qué ofrecemos */}
          <section>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
              color: '#E8E8F4', marginBottom: '0.75rem',
            }}>
              Qué encontrarás en TakaSports
            </h2>
            <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong style={{ color: '#E8E8F4' }}>Noticias de actualidad</strong> — artículos long-form escritos y editados por nuestro equipo, actualizados cada hora.</li>
              <li><strong style={{ color: '#E8E8F4' }}>Resultados en vivo</strong> — marcadores de LaLiga, Premier League, NBA, F1, UFC, ATP y más, sin registrarse.</li>
              <li><strong style={{ color: '#E8E8F4' }}>Índice Taka</strong> — rankings editoriales semanales de los deportistas y creadores más relevantes del momento.</li>
              <li><strong style={{ color: '#E8E8F4' }}>Juegos</strong> — quiniela, CrackQuiz, Sopa de Cracks, Mi Once y TakaGrid para toda la comunidad.</li>
              <li><strong style={{ color: '#E8E8F4' }}>Calendario</strong> — todos los partidos y eventos deportivos de la semana en un solo lugar.</li>
            </ul>
          </section>

          {/* Editorial */}
          <section>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
              color: '#E8E8F4', marginBottom: '0.75rem',
            }}>
              Nuestros estándares editoriales
            </h2>
            <p>
              Todo el contenido publicado en TakaSports pasa por revisión editorial antes de salir.
              Citamos nuestras fuentes, corregimos los errores con transparencia y distinguimos
              claramente entre hechos y opinión. Nuestro objetivo es ganarnos tu confianza
              artículo a artículo.
            </p>
          </section>

          {/* Contacto */}
          <section>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
              color: '#E8E8F4', marginBottom: '0.75rem',
            }}>
              Contacto
            </h2>
            <p>
              ¿Tienes una historia, una corrección o quieres colaborar con nosotros?
              Escríbenos a{' '}
              <a
                href="mailto:contactotakasports@gmail.com"
                style={{ color: '#7C3AED', textDecoration: 'underline' }}
              >
                contactotakasports@gmail.com
              </a>
              {' '}o síguenos en{' '}
              <a
                href="https://www.instagram.com/taka.sports"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7C3AED', textDecoration: 'underline' }}
              >
                Instagram
              </a>
              {' '}y{' '}
              <a
                href="https://x.com/takasportsx"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#7C3AED', textDecoration: 'underline' }}
              >
                X (Twitter)
              </a>.
            </p>
          </section>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
            Última actualización: 3 de junio de 2026.
          </p>
        </div>
      </div>

    </div>
  )
}
