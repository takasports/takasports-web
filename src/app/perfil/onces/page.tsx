import type { Metadata } from 'next'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import OncesClient from './OncesClient'

export const metadata: Metadata = {
  title: 'Tus onces · TakaSports',
  description: 'Onces que has guardado desde Mi Once. Hasta 12, gratis y sin perderse.',
}

export default function OncesPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24 pt-8">
        <OncesClient />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  )
}
