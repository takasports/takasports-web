// Server Component shell para /juegos.
// Provee:
//   · metadata (title, description, canonical, OG)
//   · JSON-LD CollectionPage + ItemList<VideoGame>
//   · Delega la UI a <JuegosPageClient />
//
// La UI sigue siendo idéntica a la versión previa; lo que ganamos es
// SEO: títulos correctos, OG image, structured data indexable.

import type { Metadata } from 'next'
import { Suspense } from 'react'
import JuegosPageClient from './JuegosPageClient'

const SITE_URL = 'https://takasportsmedia.com'

export const metadata: Metadata = {
  title: 'Juegos · Predicciones, trivia y fantasy deportivo — TakaSports',
  description: 'Quiniela, CrackQuiz, Mi Once, Sopa de Cracks y TakaGrid. Compite cada semana en el ranking global de TakaSports.',
  alternates: { canonical: `${SITE_URL}/juegos` },
  openGraph: {
    type:        'website',
    url:         `${SITE_URL}/juegos`,
    title:       'Juegos · TakaSports',
    description: 'Predicciones, trivia, fantasy y arcade. Compite cada semana.',
    siteName:    'TakaSports',
    locale:      'es_ES',
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Juegos · TakaSports',
    description: 'Predicciones, trivia, fantasy y arcade. Compite cada semana.',
  },
}

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type':    'CollectionPage',
  url:        `${SITE_URL}/juegos`,
  name:       'Juegos de TakaSports',
  description: 'Colección de juegos deportivos: Quiniela, CrackQuiz, Mi Once, Sopa de Cracks, TakaGrid.',
  publisher:  { '@type': 'Organization', name: 'TakaSports', url: SITE_URL },
  mainEntity: {
    '@type':           'ItemList',
    numberOfItems:     5,
    itemListElement: [
      { '@type': 'ListItem', position: 1, item: { '@type': 'VideoGame', name: 'Quiniela',       url: `${SITE_URL}/quiniela`,    genre: 'Predicción', applicationCategory: 'Game' } },
      { '@type': 'ListItem', position: 2, item: { '@type': 'VideoGame', name: 'CrackQuiz',      url: `${SITE_URL}/crackquiz`,   genre: 'Trivia',     applicationCategory: 'Game' } },
      { '@type': 'ListItem', position: 3, item: { '@type': 'VideoGame', name: 'Mi Once',        url: `${SITE_URL}/mionce`,      genre: 'Fantasy',    applicationCategory: 'Game' } },
      { '@type': 'ListItem', position: 4, item: { '@type': 'VideoGame', name: 'Sopa de Cracks', url: `${SITE_URL}/sopa-cracks`, genre: 'Puzzle',     applicationCategory: 'Game' } },
      { '@type': 'ListItem', position: 5, item: { '@type': 'VideoGame', name: 'TakaGrid',       url: `${SITE_URL}/takagrid`,    genre: 'Grid',       applicationCategory: 'Game' } },
    ],
  },
}

export default function JuegosPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Serialización confiable: el objeto está controlado server-side.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {/* Suspense: aísla useSearchParams() del filtro para que Next.js
          pueda mantener el shell estático sin warnings en build. */}
      <Suspense fallback={null}>
        <JuegosPageClient />
      </Suspense>
    </>
  )
}
