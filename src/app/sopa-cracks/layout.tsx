import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Sopa de Cracks — sopa de letras futbolera',
  description: 'Encuentra a las leyendas del fútbol escondidas en la sopa de letras. Nuevo puzzle cada semana.',
  alternates: { canonical: `${SITE_URL}/sopa-cracks` },
  openGraph: {
    title: 'Sopa de Cracks — sopa de letras futbolera | TakaSports',
    description: 'Sopa de letras con las leyendas del fútbol. Nuevo puzzle temático cada semana.',
    url: `${SITE_URL}/sopa-cracks`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sopa de Cracks — sopa de letras futbolera | TakaSports',
    description: 'Sopa de letras futbolera semanal.',
    site: '@takasports',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Sopa de Cracks',
  description: 'Sopa de letras con leyendas del fútbol. Nuevo puzzle temático cada semana.',
  url: `${SITE_URL}/sopa-cracks`,
  applicationCategory: 'GameApplication',
  genre: 'Sports',
  inLanguage: 'es-ES',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  operatingSystem: 'All',
}

export default function SopaCracksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
