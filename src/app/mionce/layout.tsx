import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Mi Once — arma tu once ideal',
  description: 'Alinea tu once ideal en una formación táctica. Reto semanal con leyendas y jugadores actuales.',
  alternates: { canonical: `${SITE_URL}/mionce` },
  openGraph: {
    title: 'Mi Once — arma tu once ideal',
    description: 'Alinea tu once ideal: 4 formaciones, 400+ jugadores. Reto semanal de fútbol.',
    url: `${SITE_URL}/mionce`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mi Once — arma tu once ideal',
    description: 'Alinea tu once ideal: 4 formaciones, 400+ jugadores.',
    site: '@takasports',
  },
}

export default function MiOnceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
