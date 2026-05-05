import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mi Once — TakaSports',
  description: 'Alinea tu once ideal en una formación táctica. Reto semanal con leyendas y jugadores actuales.',
  alternates: { canonical: 'https://takasportsmedia.com/mionce' },
  openGraph: {
    title: 'Mi Once — TakaSports',
    description: 'Alinea tu once ideal: 4 formaciones, 400+ jugadores. Reto semanal de fútbol.',
    url: 'https://takasportsmedia.com/mionce',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: 'https://takasportsmedia.com/og-mionce.png', width: 1200, height: 630, alt: 'Mi Once' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mi Once — TakaSports',
    description: 'Alinea tu once ideal: 4 formaciones, 400+ jugadores.',
    site: '@takasports',
    images: ['https://takasportsmedia.com/og-mionce.png'],
  },
}

export default function MiOnceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
