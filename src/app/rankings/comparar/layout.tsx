import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Comparador de rankings — TakaSports',
  description: 'Enfrenta dos deportistas cara a cara: radar de los 4 factores del Índice Taka, desglose y delta total.',
  alternates: { canonical: 'https://takasportsmedia.com/rankings/comparar' },
  openGraph: {
    title: 'Comparador de rankings — TakaSports',
    description: 'Enfrenta dos deportistas cara a cara con el Índice Taka.',
    url: 'https://takasportsmedia.com/rankings/comparar',
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Comparador de rankings — TakaSports', site: '@takasports' },
}

export default function CompararLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
