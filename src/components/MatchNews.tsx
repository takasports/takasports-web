// "Noticias relacionadas" para /partido — artículos del propio Taka que mencionan
// a cualquiera de los dos equipos/jugadores del partido. Es la ventaja única de
// Taka frente a Flashscore/Sofascore (no tienen redacción): enlaza el producto
// editorial con el de fixtures. Server component, sin JS cliente → indexable y
// distribuye autoridad interna partido → noticia. Si no hay artículos, no renderiza.

import ArticleCard from '@/components/news/ArticleCard'
import { sanityClient, articlesByMatchQuery } from '@/lib/sanity'

interface RelatedArticle {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  sport?: string
  imageUrl?: string | null
  image?: { asset: { _ref: string } } | null
}

export default async function MatchNews({
  homeTeam,
  awayTeam,
  limit = 4,
}: {
  homeTeam?: string
  awayTeam?: string
  limit?: number
}) {
  if (!homeTeam || !awayTeam) return null

  const articles = await sanityClient
    .fetch<RelatedArticle[]>(articlesByMatchQuery, {
      home: `${homeTeam.trim().toLowerCase()}*`,
      away: `${awayTeam.trim().toLowerCase()}*`,
      limit,
    })
    .catch(() => [] as RelatedArticle[])

  if (articles.length === 0) return null

  return (
    <section className="mt-10 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="section-accent" />
        <h2 className="section-label" style={{ fontFamily: 'var(--font-sport)', textTransform: 'uppercase' }}>
          Noticias relacionadas
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {articles.map((a) => (
          a.slug ? <ArticleCard key={a._id} article={a} variant="row" size="sm" prefetch={false} /> : null
        ))}
      </div>
    </section>
  )
}
