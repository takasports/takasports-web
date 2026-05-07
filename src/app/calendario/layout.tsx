import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Calendario deportivo — partidos hoy',
  description: 'Partidos de hoy y próximos eventos deportivos. Fútbol, NBA, F1, Tenis, UFC y más con resultados en vivo.',
  alternates: { canonical: `${SITE_URL}/calendario` },
  openGraph: {
    title: 'Calendario deportivo — partidos hoy | TakaSports',
    description: 'Partidos de hoy y próximos eventos deportivos en vivo.',
    url: `${SITE_URL}/calendario`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Calendario deportivo — partidos hoy | TakaSports', site: '@takasports' },
}

export default function CalendarioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
