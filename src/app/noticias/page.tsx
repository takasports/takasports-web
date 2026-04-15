import type { Metadata } from 'next'
import { sanityClient, articlesQuery } from '@/lib/sanity'
import Header from '@/components/Header'
import NewsFeed from '@/components/NewsFeed'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Noticias — TakaSports',
  description: 'Todas las noticias del deporte en tiempo real. Fútbol, NBA, F1, Tenis, UFC y más.',
}

const SPORT_MAP: Record<string, string> = {
  futbol: 'Fútbol',
  ufc: 'UFC',
  nba: 'NBA',
  f1: 'F1',
  tenis: 'Tenis',
  rugby: 'Rugby',
  basquet: 'Básquet',
}

export default async function NoticiasPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>
}) {
  const { sport } = await searchParams
  const [articles] = await Promise.all([sanityClient.fetch(articlesQuery)])
  const initialCategory = sport ? (SPORT_MAP[sport.toLowerCase()] ?? 'Todo') : 'Todo'

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-20">

        {/* Page header */}
        <div className="pt-8 pb-2">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="section-accent" />
            <h1
              className="font-black"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                color: '#F8F8FF',
                letterSpacing: '-0.01em',
              }}
            >
              Noticias
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)', marginLeft: 20 }}>
            Toda la actualidad deportiva, al minuto.
          </p>
        </div>

        {/* Full feed — sin límite */}
        <NewsFeed
          articles={articles}
          initialCategory={initialCategory}
          baseRoute="/noticias"
        />

      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
