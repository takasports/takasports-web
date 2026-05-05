import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TakaGrid — TakaSports',
  description: 'Grid 3×3 diario: encuentra el jugador que cruza club y categoría. Un intento por celda.',
  alternates: { canonical: 'https://takasportsmedia.com/takagrid' },
  openGraph: {
    title: 'TakaGrid — TakaSports',
    description: 'El reto diario de fútbol: conecta jugadores con sus clubes en un grid 3×3. ¿Cuántas aciertas?',
    url: 'https://takasportsmedia.com/takagrid',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: 'https://takasportsmedia.com/og-takagrid.png', width: 1200, height: 630, alt: 'TakaGrid' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakaGrid — TakaSports',
    description: 'El reto diario de fútbol: conecta jugadores con sus clubes.',
    site: '@takasports',
    images: ['https://takasportsmedia.com/og-takagrid.png'],
  },
}

export default function TakaGridLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
