import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Comparador de rankings deportivos',
  description: 'Enfrenta dos deportistas cara a cara: radar de los 4 factores del Índice Taka, desglose y delta total.',
  alternates: { canonical: `${SITE_URL}/rankings/comparar` },
  openGraph: {
    title: 'Comparador de rankings deportivos | TakaSports',
    description: 'Enfrenta dos deportistas cara a cara con el Índice Taka.',
    url: `${SITE_URL}/rankings/comparar`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Comparador de rankings deportivos | TakaSports', site: '@takasportsx' },
}

export default function CompararLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
