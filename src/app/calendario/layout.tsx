import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Calendario deportivo — TakaSports',
  description: 'Partidos de hoy y próximos eventos deportivos. Fútbol, NBA, F1, Tenis, UFC y más con resultados en vivo.',
  alternates: { canonical: 'https://takasportsmedia.com/calendario' },
  openGraph: {
    title: 'Calendario deportivo — TakaSports',
    description: 'Partidos de hoy y próximos eventos deportivos en vivo.',
    url: 'https://takasportsmedia.com/calendario',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Calendario deportivo — TakaSports', site: '@takasports' },
}

export default function CalendarioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
