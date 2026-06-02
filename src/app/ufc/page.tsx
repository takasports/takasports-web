// /ufc — Acceso directo a Ranked UFC.
// Misma experiencia que /predicciones → tab UFC pero sin el hub de navegación.

import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import NewsletterSection from '@/components/NewsletterSection'
import UfcWrapper from './UfcWrapper'

export const metadata: Metadata = {
  title: 'Ranked UFC — Predice cada combate | Taka Sports',
  description: 'Predice al ganador de cada pelea UFC. Elige también el método de victoria para sumar puntos extra. Gratis.',
  alternates: { canonical: `${SITE_URL}/ufc` },
  openGraph: {
    title: 'Ranked UFC — Taka Sports',
    description: 'Predice cada combate UFC, acumula puntos y sube en el ranking. Gratis.',
    url: `${SITE_URL}/ufc`,
    siteName: 'Taka Sports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card:  'summary_large_image',
    title: 'Ranked UFC — Taka Sports',
    site:  '@takasportsx',
  },
}

export default function UfcPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />
      <UfcWrapper />
      <NewsletterSection source="ufc" />
      <Footer />
      <ScrollToTop />
    </div>
  )
}
