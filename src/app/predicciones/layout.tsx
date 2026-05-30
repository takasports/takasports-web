import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Predicciones — Ranked Fútbol, UFC y Mundial | TakaSports',
  description: 'Predice resultados de LaLiga, UFC y el Mundial 2026. Compite en el Ranked global, crea ligas privadas o únete a ligas de creadores.',
  alternates: { canonical: `${SITE_URL}/predicciones` },
  openGraph: {
    title: 'Predicciones — Ranked Fútbol, UFC y Mundial | TakaSports',
    description: 'Predice, compite y sube en el Ranked. Fútbol · UFC · Mundial 2026.',
    url: `${SITE_URL}/predicciones`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Predicciones | TakaSports',
    site: '@takasportsx',
  },
}

export default function PrediccionesLayout({ children }: { children: React.ReactNode }) {
  return children
}
