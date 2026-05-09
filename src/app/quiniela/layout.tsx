import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Quiniela — predice la jornada y compite',
  description: 'Predice los resultados de la jornada de LaLiga, compite en el ranking semanal y demuestra que sabes de fútbol.',
  alternates: { canonical: `${SITE_URL}/quiniela` },
  openGraph: {
    title: 'Quiniela — predice la jornada y compite | TakaSports',
    description: 'Predice los resultados de la jornada y sube en el ranking semanal.',
    url: `${SITE_URL}/quiniela`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Quiniela — predice la jornada y compite | TakaSports', site: '@takasportsx' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Quiniela TakaSports',
  description: 'Predice los resultados de la jornada de LaLiga. Compite en el ranking semanal y demuestra que sabes de fútbol.',
  url: `${SITE_URL}/quiniela`,
  applicationCategory: 'GameApplication',
  genre: 'Sports',
  inLanguage: 'es-ES',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  operatingSystem: 'All',
}

export default function QuinielaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
