import type { Metadata } from 'next'
import Link from 'next/link'
import Image from '@/components/DynamicImage'
import { sanityClient, urlFor } from '@/lib/sanity'
import { SITE_URL, LOGO_URL } from '@/lib/constants'
import { timeAgo } from '@/lib/timeAgo'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Redacción Taka Sports — Equipo editorial',
  description:
    'Redacción Taka Sports: el equipo editorial detrás de las noticias, análisis y rankings deportivos de TakaSports Media. Conoce nuestra forma de trabajar.',
  alternates: { canonical: `${SITE_URL}/autor/redaccion` },
  openGraph: {
    title: 'Redacción Taka Sports — Equipo editorial',
    description:
      'El equipo editorial de TakaSports Media: noticias deportivas, análisis y rankings con estándares periodísticos.',
    url: `${SITE_URL}/autor/redaccion`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'profile',
    images: [{ url: LOGO_URL, width: 1200, height: 630, alt: 'Redacción Taka Sports' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Redacción Taka Sports',
    description: 'El equipo editorial de TakaSports Media.',
    site: '@takasportsx',
    images: [LOGO_URL],
  },
}

interface RecentArticle {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  sport?: string
  imageUrl?: string | null
  image?: { asset: { _ref: string } } | null
}

const recentByRedaccionQuery = `*[_type == "article"
    && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))
  ] | order(publishedAt desc)[0...20] {
    _id,
    "slug": slug.current,
    "title": select(defined(headline) => headline, title),
    "short_summary": select(defined(headline) => metaDescription, short_summary),
    publishedAt,
    sport,
    "imageUrl": select(defined(headline) => imageUrl, null),
    "image": select(defined(headline) => mainImage, image),
  }`

export default async function RedaccionAuthorPage() {
  const recent = await sanityClient
    .fetch<RecentArticle[]>(recentByRedaccionQuery)
    .catch(() => [] as RecentArticle[])

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    '@id': `${SITE_URL}/autor/redaccion#author`,
    name: 'Redacción Taka Sports',
    alternateName: 'Equipo editorial de TakaSports',
    url: `${SITE_URL}/autor/redaccion`,
    image: LOGO_URL,
    logo: { '@type': 'ImageObject', url: LOGO_URL, width: 512, height: 512 },
    description:
      'Equipo editorial de TakaSports Media. Redactamos, verificamos y publicamos noticias, análisis y rankings deportivos con estándares periodísticos.',
    knowsAbout: ['Fútbol', 'Baloncesto', 'Fórmula 1', 'UFC', 'Tenis', 'WWE', 'Rugby', 'MotoGP'],
    sameAs: [
      'https://www.instagram.com/takasportsmedia',
      'https://x.com/takasportsx',
    ],
    parentOrganization: { '@id': `${SITE_URL}/#organization` },
    // Mismas policies que el publisher raíz: refuerzan el EEAT del autor
    publishingPrinciples: `${SITE_URL}/politica-editorial`,
    actionableFeedbackPolicy: `${SITE_URL}/politica-editorial#seccion-5`,
    correctionsPolicy: `${SITE_URL}/politica-editorial#seccion-5`,
    verificationFactCheckingPolicy: `${SITE_URL}/politica-editorial#seccion-3`,
    ethicsPolicy: `${SITE_URL}/politica-editorial#seccion-6`,
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'contacto@takasportsmedia.com',
      contactType: 'editorial',
      availableLanguage: ['Spanish', 'es'],
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Autores', item: `${SITE_URL}/autor/redaccion` },
      { '@type': 'ListItem', position: 3, name: 'Redacción Taka Sports', item: `${SITE_URL}/autor/redaccion` },
    ],
  }

  const profileJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: 'Redacción Taka Sports',
    url: `${SITE_URL}/autor/redaccion`,
    inLanguage: 'es-ES',
    mainEntity: { '@id': `${SITE_URL}/autor/redaccion#author` },
    publisher: { '@id': `${SITE_URL}/#organization` },
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="section-accent" />
            <span className="section-label">Equipo editorial</span>
          </div>

          <div className="flex items-center gap-5 mb-6">
            <div
              className="rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                width: 88,
                height: 88,
                background: 'rgba(124,58,237,0.1)',
                border: '2px solid rgba(124,58,237,0.3)',
                overflow: 'hidden',
              }}
            >
              <Image
                src="/taka-icon.png"
                alt="Logo TakaSports"
                width={88}
                height={88}
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div>
              <h1
                className="font-black leading-tight"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.8rem, 4.5vw, 2.6rem)',
                  color: '#F8F8FF',
                  letterSpacing: '-0.02em',
                  marginBottom: 4,
                }}
              >
                Redacción Taka Sports
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Equipo editorial · TakaSports Media
              </p>
            </div>
          </div>

          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            La Redacción de Taka Sports es el equipo editorial responsable de las noticias,
            análisis y rankings publicados en TakaSports Media. Cubrimos fútbol, baloncesto,
            Fórmula 1, UFC, tenis y los principales eventos deportivos del momento, con
            piezas largas de actualidad (≤72 horas) y datos en tiempo real.
          </p>
        </div>

        {/* Cómo trabajamos */}
        <section className="mb-10">
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800,
            color: '#E8E8F4', marginBottom: '0.75rem',
          }}>
            Cómo trabajamos
          </h2>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', lineHeight: 1.75 }}>
            <li>Verificamos cada noticia con al menos una fuente oficial o un medio de referencia antes de publicar.</li>
            <li>Usamos herramientas de asistencia editorial automatizadas para acelerar la redacción y la curación de datos, siempre con revisión humana final.</li>
            <li>Distinguimos con claridad entre hechos, contexto y opinión.</li>
            <li>Corregimos los errores con transparencia: las correcciones se indican explícitamente en el artículo afectado.</li>
            <li>No publicamos contenido patrocinado sin etiquetarlo como tal.</li>
          </ul>
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
            Puedes leer nuestra{' '}
            <Link href="/politica-editorial" style={{ color: '#7C3AED', textDecoration: 'underline' }}>
              política editorial completa
            </Link>{' '}
            para conocer todos los estándares con los que operamos.
          </p>
        </section>

        {/* Contacto */}
        <section className="mb-12">
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800,
            color: '#E8E8F4', marginBottom: '0.75rem',
          }}>
            Contacto editorial
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Para enviar una historia, reportar un error o proponer una colaboración:{' '}
            <a href="mailto:contacto@takasportsmedia.com" style={{ color: '#7C3AED', textDecoration: 'underline' }}>
              contacto@takasportsmedia.com
            </a>.
          </p>
        </section>

        {/* Artículos recientes */}
        {recent.length > 0 && (
          <section>
            <div className="flex items-center gap-2.5 mb-5">
              <span className="section-accent" />
              <h2 className="section-label">Artículos recientes de la redacción</h2>
            </div>
            <div className="flex flex-col gap-4">
              {recent.map((a) => {
                if (!a.slug) return null
                const img = a.imageUrl ?? (a.image?.asset ? urlFor(a.image).width(160).height(90).url() : null)
                return (
                  <Link
                    key={a._id}
                    href={`/noticias/${a.slug}`}
                    className="group flex gap-3 rounded-xl p-3 transition-colors"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    {img && (
                      <div className="rounded-lg overflow-hidden flex-shrink-0" style={{ width: 96, height: 64, background: 'rgba(255,255,255,0.04)' }}>
                        <Image src={img} alt={a.title} width={96} height={64} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                      </div>
                    )}
                    <div className="flex flex-col justify-between min-w-0">
                      <h3 className="text-sm font-semibold line-clamp-2" style={{ color: '#E8E8F4' }}>
                        {a.title}
                      </h3>
                      {a.publishedAt && (
                        <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                          {timeAgo(a.publishedAt)}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>

    </div>
  )
}
