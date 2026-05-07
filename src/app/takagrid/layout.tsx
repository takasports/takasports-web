import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'TakaGrid — el grid de fútbol diario',
  description: 'Grid 3×3 diario: encuentra el jugador que cruza club y categoría. Un intento por celda.',
  alternates: { canonical: `${SITE_URL}/takagrid` },
  openGraph: {
    title: 'TakaGrid — el grid de fútbol diario | TakaSports',
    description: 'El reto diario de fútbol: conecta jugadores con sus clubes en un grid 3×3. ¿Cuántas aciertas?',
    url: `${SITE_URL}/takagrid`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakaGrid — el grid de fútbol diario | TakaSports',
    description: 'El reto diario de fútbol: conecta jugadores con sus clubes.',
    site: '@takasports',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'TakaGrid',
  description: 'Grid 3×3 diario: encuentra el jugador que cruza club y categoría. Un intento por celda.',
  url: `${SITE_URL}/takagrid`,
  applicationCategory: 'GameApplication',
  genre: 'Sports',
  inLanguage: 'es-ES',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  operatingSystem: 'All',
}

export default function TakaGridLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
