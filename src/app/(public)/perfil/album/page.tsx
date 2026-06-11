import type { Metadata } from 'next'
import LiveStrip from '@/components/LiveStrip'
import ScrollToTop from '@/components/ScrollToTop'
import AlbumClient from './AlbumClient'

export const metadata: Metadata = {
  title: 'Tu álbum · TakaSports',
  description: 'Todos los cracks que has colocado correctamente en TakaGrid y Mi Once.',
}

export default function AlbumPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <LiveStrip />
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24 pt-8">
        <AlbumClient />
      </div>
      <ScrollToTop />
    </div>
  )
}
