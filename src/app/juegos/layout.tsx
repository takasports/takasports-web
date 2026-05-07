import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Juegos deportivos — quiniela, trivia y fantasy',
  description: 'Quiniela, CrackQuiz, Mi Once, Sopa de Cracks y TakaGrid. Pon a prueba tu instinto deportivo cada semana en TakaSports.',
  alternates: { canonical: `${SITE_URL}/juegos` },
  openGraph: {
    title: 'Juegos deportivos — quiniela, trivia y fantasy | TakaSports',
    description: 'Predicciones, trivia, fantasy y puzzle deportivo. Compite cada semana.',
    url: `${SITE_URL}/juegos`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Juegos deportivos — quiniela, trivia y fantasy | TakaSports', site: '@takasports' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Juegos deportivos — TakaSports',
  description: 'Quiniela, CrackQuiz, Mi Once, Sopa de Cracks y TakaGrid.',
  url: `${SITE_URL}/juegos`,
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Quiniela', url: `${SITE_URL}/quiniela` },
    { '@type': 'ListItem', position: 2, name: 'CrackQuiz', url: `${SITE_URL}/crackquiz` },
    { '@type': 'ListItem', position: 3, name: 'Mi Once', url: `${SITE_URL}/mionce` },
    { '@type': 'ListItem', position: 4, name: 'Sopa de Cracks', url: `${SITE_URL}/sopa-cracks` },
    { '@type': 'ListItem', position: 5, name: 'TakaGrid', url: `${SITE_URL}/takagrid` },
  ],
}

export default function JuegosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  )
}
