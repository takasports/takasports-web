import type { Metadata } from 'next'
import Header from '@/components/Header'
import { getMergedReels } from '@/lib/reels-feed'
import { SITE_URL } from '@/lib/constants'
import ReelsClient from './ReelsClient'

// ISR 30 min — alineado con el TTL del cache de getMergedReels.
export const revalidate = 1800
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Reels — vídeos deportivos en vertical',
  description: 'Los mejores reels deportivos de TakaSports: fútbol, NBA, UFC, F1, tenis y más. Vídeos cortos, uno tras otro.',
  alternates: { canonical: `${SITE_URL}/reels` },
  openGraph: {
    title: 'Reels deportivos — TakaSports',
    description: 'Vídeos cortos de fútbol, NBA, UFC, F1 y más. Desliza y disfruta.',
    url: `${SITE_URL}/reels`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: `${SITE_URL}/taka-logo.png`, width: 1200, height: 630, alt: 'Reels deportivos — TakaSports' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reels deportivos — TakaSports',
    description: 'Vídeos cortos de fútbol, NBA, UFC, F1 y más.',
    site: '@takasportsx',
    images: [`${SITE_URL}/taka-logo.png`],
  },
}

// Convierte el timestamp del reel (epoch en segundos o fecha ISO) a ISO válido.
// Si no parsea, devuelve undefined en vez de reventar el render (RangeError → 500).
function safeUploadDate(timestamp?: string | null): string | undefined {
  if (!timestamp) return undefined
  const value = /^\d+$/.test(timestamp) ? parseInt(timestamp, 10) * 1000 : timestamp
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export default async function ReelsPage() {
  const reels = (await getMergedReels().catch(() => [])).slice(0, 40)

  // JSON-LD ItemList de VideoObject — ayuda a Google a indexar cada reel.
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Reels deportivos — TakaSports',
    numberOfItems: reels.length,
    itemListElement: reels.slice(0, 20).map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'VideoObject',
        name: r.title || 'Reel deportivo',
        description: r.caption?.slice(0, 200) || r.title || 'Reel deportivo de TakaSports',
        thumbnailUrl: r.thumbnail_url
          ? (r.thumbnail_url.startsWith('http') ? r.thumbnail_url : `${SITE_URL}${r.thumbnail_url}`)
          : `${SITE_URL}/taka-icon.png`,
        // embedUrl, NO contentUrl: instagram_url es la página HTML del post, no un
        // fichero de vídeo servible, así que como contentUrl no valida para resultados
        // de vídeo. Se usa el reproductor embebible, igual que player_loc en
        // video-sitemap.xml (ver la nota de esa ruta).
        embedUrl: `${r.instagram_url.replace(/\/+$/, '')}/embed/`,
        uploadDate: safeUploadDate(r.timestamp),
      },
    })),
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <Header />
      <h1 className="sr-only">Reels deportivos de TakaSports</h1>
      <ReelsClient reels={reels} />
    </div>
  )
}
