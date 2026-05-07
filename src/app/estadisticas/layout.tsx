import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Estadísticas deportivas — TakaSports',
  description: 'Clasificaciones de LaLiga, Premier League, NBA, F1 y más ligas deportivas actualizadas en tiempo real.',
  alternates: { canonical: `${SITE_URL}/estadisticas` },
  openGraph: {
    title: 'Estadísticas deportivas — TakaSports',
    description: 'Clasificaciones actualizadas de las principales ligas del mundo.',
    url: `${SITE_URL}/estadisticas`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Estadísticas deportivas — TakaSports', site: '@takasports' },
}

export default function EstadisticasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
