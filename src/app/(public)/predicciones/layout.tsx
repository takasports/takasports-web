import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'
import { RANKED_FUTBOL_ENABLED } from '@/lib/feature-flags'

// SEO atado al feature flag: mientras Ranked Fútbol esté apagado NO lo
// anunciamos (ni "LaLiga") — no hay nada que predecir y sería engañoso.
// Cuando se ponga RANKED_FUTBOL_ENABLED=true, el copy se actualiza solo.
// Sin sufijo " | TakaSports": el root layout ya aplica title.template '%s | TakaSports'.
const title = RANKED_FUTBOL_ENABLED
  ? 'Predicciones — La Jornada de fútbol y Ranked UFC'
  : 'Predicciones — Ranked UFC'
const description = RANKED_FUTBOL_ENABLED
  ? 'Predice los partidos de LaLiga y las veladas de UFC. Compite en la clasificación global, crea ligas privadas o únete a ligas de creadores.'
  : 'Predice las veladas de UFC. Compite en la clasificación global, crea ligas privadas o únete a ligas de creadores.'
const ogDescription = RANKED_FUTBOL_ENABLED
  ? 'Predice, compite y sube en la clasificación. Fútbol · UFC.'
  : 'Predice, compite y sube en la clasificación. UFC.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/predicciones` },
  openGraph: {
    title,
    description: ogDescription,
    url: `${SITE_URL}/predicciones`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card:  'summary_large_image',
    title: 'Mundial 2026 — Predice en TakaSports',
    site:  '@takasportsx',
  },
  // opengraph-image.tsx en este directorio genera la imagen automáticamente.
}

export default function PrediccionesLayout({ children }: { children: React.ReactNode }) {
  return children
}
