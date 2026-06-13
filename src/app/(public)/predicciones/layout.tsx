import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'
import { RANKED_FUTBOL_ENABLED } from '@/lib/feature-flags'

// SEO atado al feature flag: mientras Ranked Fútbol esté apagado NO lo
// anunciamos (ni "LaLiga") — no hay nada que predecir y sería engañoso.
// Cuando se ponga RANKED_FUTBOL_ENABLED=true, el copy se actualiza solo.
// Sin sufijo " | TakaSports": el root layout ya aplica title.template '%s | TakaSports'.
const title = RANKED_FUTBOL_ENABLED
  ? 'Predicciones — Ranked Fútbol, UFC y Mundial'
  : 'Predicciones — Ranked UFC y Mundial 2026'
const description = RANKED_FUTBOL_ENABLED
  ? 'Predice resultados de LaLiga, UFC y el Mundial 2026. Compite en el Ranked global, crea ligas privadas o únete a ligas de creadores.'
  : 'Predice resultados de UFC y el Mundial 2026. Compite en el Ranked global, crea ligas privadas o únete a ligas de creadores.'
const ogDescription = RANKED_FUTBOL_ENABLED
  ? 'Predice, compite y sube en el Ranked. Fútbol · UFC · Mundial 2026.'
  : 'Predice, compite y sube en el Ranked. UFC · Mundial 2026.'

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
