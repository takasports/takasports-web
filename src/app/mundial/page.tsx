// /mundial — URL directa al cliente de predicciones del Mundial 2026.
// Ideal para campañas, bio de IG, etc. Misma experiencia que
// /predicciones → tab Mundial pero sin el hub de navegación encima.

import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import MundialWrapper from './MundialWrapper'

export const metadata: Metadata = {
  title: 'Mundial 2026 — Predice cada partido | TakaSports',
  description: 'Predice los resultados del Mundial 2026. Pick 1·X·2, acumula puntos y compite en el ranking global. Gratis.',
  alternates: { canonical: `${SITE_URL}/mundial` },
  openGraph: {
    title: 'Mundial 2026 — Predice en TakaSports',
    description: 'Predice cada partido del Mundial 2026, acumula puntos y sube en el ranking. Gratis.',
    url: `${SITE_URL}/mundial`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card:  'summary_large_image',
    title: 'Mundial 2026 — TakaSports',
    site:  '@takasportsx',
  },
}

export default function MundialPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />
      <MundialWrapper />
      <NewsletterSection source="mundial" />
      <Footer />
      <ScrollToTop />
    </div>
  )
}
