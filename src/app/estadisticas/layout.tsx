import type { Metadata } from 'next'
import Script from 'next/script'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Estadísticas deportivas en vivo',
  description: 'Goleadores, asistencias, clasificaciones de LaLiga, Premier League, NBA, F1 y más ligas actualizadas en tiempo real.',
  alternates: { canonical: `${SITE_URL}/estadisticas` },
  openGraph: {
    title: 'Estadísticas deportivas en vivo | TakaSports',
    description: 'Clasificaciones actualizadas de las principales ligas del mundo.',
    url: `${SITE_URL}/estadisticas`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Estadísticas deportivas — TakaSports', site: '@takasports' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Estadísticas deportivas en vivo — TakaSports',
  description: 'Clasificaciones, goleadores y rankings en vivo de LaLiga, Premier League, NBA, F1 y más ligas del mundo.',
  url: `${SITE_URL}/estadisticas`,
  isPartOf: { '@type': 'WebSite', name: 'TakaSports', url: SITE_URL },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Estadísticas', item: `${SITE_URL}/estadisticas` },
    ],
  },
}

export default function EstadisticasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="estadisticas-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
