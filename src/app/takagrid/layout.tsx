import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'TakaGrid — TakaSports',
  description: 'Grid 3×3 diario: encuentra el jugador que cruza club y categoría. Un intento por celda.',
  alternates: { canonical: `${SITE_URL}/takagrid` },
  openGraph: {
    title: 'TakaGrid — TakaSports',
    description: 'El reto diario de fútbol: conecta jugadores con sus clubes en un grid 3×3. ¿Cuántas aciertas?',
    url: `${SITE_URL}/takagrid`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TakaGrid — TakaSports',
    description: 'El reto diario de fútbol: conecta jugadores con sus clubes.',
    site: '@takasports',
  },
}

export default function TakaGridLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
