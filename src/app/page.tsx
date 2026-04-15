import Link from 'next/link'
import { sanityClient, articlesQuery, reelsQuery } from '@/lib/sanity'
import Header from '@/components/Header'
import BreakingNewsBar from '@/components/BreakingNewsBar'
import ReelsSection from '@/components/ReelsSection'
import LiveEventsSection from '@/components/LiveEventsSection'
import FeaturedArticle from '@/components/FeaturedArticle'
import SecondaryArticles from '@/components/SecondaryArticles'
import NewsFeed from '@/components/NewsFeed'
import Sidebar from '@/components/Sidebar'
import QuinielaModule from '@/components/QuinielaModule'
import Footer from '@/components/Footer'

export const revalidate = 60

// ── CTAs de sección ─────────────────────────────────────────
function SectionCTA({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
      style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
    >
      {label}
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

export default async function Home() {
  const [articles, reels] = await Promise.all([
    sanityClient.fetch(articlesQuery),
    sanityClient.fetch(reelsQuery),
  ])

  const featuredArticles = articles.slice(0, 3)
  const secondaryArticles = articles.slice(3, 6)

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <BreakingNewsBar />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-16">

        {/* Reels strip */}
        <ReelsSection reels={reels} />

        {/* Separador sutil */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '18px 0' }} />

        {/* Calendario preview */}
        <LiveEventsSection preview={true} />

        {/* Bloque editorial hero */}
        {featuredArticles.length > 0 && (
          <div className="mt-5">
            <FeaturedArticle articles={featuredArticles} />
            {secondaryArticles.length > 0 && (
              <SecondaryArticles articles={secondaryArticles} />
            )}
          </div>
        )}

        {/* Layout 2 columnas: feed + sidebar */}
        <div className="flex gap-8 mt-8 items-start">

          {/* Columna principal */}
          <div className="flex-1 min-w-0">

            {/* News preview — 8 artículos + CTA */}
            <NewsFeed
              articles={articles}
              limit={8}
              viewAllHref="/noticias"
              baseRoute="/"
            />

            {/* Quiniela preview — solo mobile */}
            <div className="lg:hidden mt-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="section-accent" />
                  <h2 className="section-label">Quiniela</h2>
                </div>
                <SectionCTA href="/quiniela" label="Ver quiniela" />
              </div>
              <QuinielaModule />
            </div>

          </div>

          {/* Sidebar — solo desktop */}
          <aside className="w-72 xl:w-80 flex-shrink-0 hidden lg:block">
            <Sidebar />
          </aside>

        </div>
      </main>

      <Footer />
    </div>
  )
}
