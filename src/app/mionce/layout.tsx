import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Mi Once — arma tu once ideal',
  description: 'Alinea tu once ideal en una formación táctica. Reto semanal con leyendas y jugadores actuales.',
  alternates: { canonical: `${SITE_URL}/mionce` },
  openGraph: {
    title: 'Mi Once — arma tu once ideal | TakaSports',
    description: 'Alinea tu once ideal: 4 formaciones, 400+ jugadores. Reto semanal de fútbol.',
    url: `${SITE_URL}/mionce`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mi Once — arma tu once ideal | TakaSports',
    description: 'Alinea tu once ideal: 4 formaciones, 400+ jugadores.',
    site: '@takasportsx',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Mi Once',
  description: 'Alinea tu once ideal en una formación táctica. Reto semanal con leyendas y jugadores actuales.',
  url: `${SITE_URL}/mionce`,
  applicationCategory: 'GameApplication',
  genre: 'Sports',
  inLanguage: 'es-ES',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  operatingSystem: 'All',
}

export default function MiOnceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
