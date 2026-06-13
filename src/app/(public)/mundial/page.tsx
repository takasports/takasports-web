// /mundial — URL directa al cliente de predicciones del Mundial 2026.
// Ideal para campañas, bio de IG, etc. Misma experiencia que
// /predicciones → tab Mundial pero sin el hub de navegación encima.

import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/constants'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import MundialWrapper from './MundialWrapper'

export const metadata: Metadata = {
  // Sin sufijo " | TakaSports": el root layout ya aplica title.template '%s | TakaSports'.
  title: 'Mundial 2026 — Predice cada partido',
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
      <MundialWrapper />
      {/* Enlace interno server-rendered al calendario del Mundial (SEO + descubrimiento). */}
      <nav
        aria-label="Más sobre el Mundial 2026"
        style={{ maxWidth: 680, margin: '0 auto', padding: '8px 16px 0' }}
      >
        <Link
          href="/calendario/mundial"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '14px 18px',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sport)',
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Calendario del Mundial 2026 — partidos, grupos y horarios →
        </Link>
      </nav>
      <NewsletterSection source="mundial" />
      <ScrollToTop />
    </div>
  )
}
