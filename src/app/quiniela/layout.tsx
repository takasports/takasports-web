import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Quiniela LaLiga — TakaSports',
  description: 'Predice los resultados de la jornada de LaLiga, compite en el ranking semanal y demuestra que sabes de fútbol.',
  alternates: { canonical: 'https://takasportsmedia.com/quiniela' },
  openGraph: {
    title: 'Quiniela LaLiga — TakaSports',
    description: 'Predice los resultados de la jornada y sube en el ranking semanal.',
    url: 'https://takasportsmedia.com/quiniela',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Quiniela LaLiga — TakaSports', site: '@takasports' },
}

export default function QuinielaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
