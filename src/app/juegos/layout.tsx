import type { Metadata } from 'next'
import { SITE_URL, LOGO_URL, ICON_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Juegos deportivos — TakaSports',
  description: 'Quiniela, CrackQuiz, Mi Once, Sopa de Cracks y TakaGrid. Pon a prueba tu instinto deportivo cada semana.',
  alternates: { canonical: `${SITE_URL}/juegos` },
  openGraph: {
    title: 'Juegos deportivos — TakaSports',
    description: 'Predicciones, trivia, fantasy y puzzle deportivo. Compite cada semana.',
    url: `${SITE_URL}/juegos`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Juegos deportivos — TakaSports', site: '@takasports' },
}

export default function JuegosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
