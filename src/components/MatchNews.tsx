// "Noticias relacionadas" para /partido — artículos del propio Taka que mencionan
// a cualquiera de los dos equipos/jugadores del partido. Es la ventaja única de
// Taka frente a Flashscore/Sofascore (no tienen redacción): enlaza el producto
// editorial con el de fixtures. Server component, sin JS cliente → indexable y
// distribuye autoridad interna partido → noticia. Si no hay artículos, no renderiza.

import ArticleCard from '@/components/news/ArticleCard'
import { sanityClient, articlesByMatchQuery } from '@/lib/sanity'
import SectionHeader from '@/components/ui/SectionHeader'
import { matchNewsParams } from '@/lib/match-news'

interface RelatedArticle {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  sport?: string
  imageUrl?: string | null
  image?: { asset: { _ref: string } } | null
  type?: string
}

export default async function MatchNews({
  homeTeam,
  awayTeam,
  sport,
  leagueSlug,
  startDate,
  limit = 4,
}: {
  homeTeam?: string
  awayTeam?: string
  sport?: string
  leagueSlug?: string
  startDate?: string
  limit?: number
}) {
  // Sin equipos o sin deporte cubierto por la redacción: no hay bloque.
  const params = matchNewsParams({ homeTeam, awayTeam, sport, leagueSlug, startDate, limit })
  if (!params) return null

  const articles = await sanityClient
    .fetch<RelatedArticle[]>(articlesByMatchQuery, { ...params })
    .catch(() => [] as RelatedArticle[])

  // La previa ya va destacada arriba del Resumen (PreviaPartido): aquí sobraría.
  const lista = articles.filter((a) => a.type !== 'previa')
  if (lista.length === 0) return null

  return (
    <section className="mt-10 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <SectionHeader>Noticias relacionadas</SectionHeader>

      <div className="flex flex-col gap-2">
        {lista.map((a) => (
          a.slug ? <ArticleCard key={a._id} article={a} variant="row" size="sm" prefetch={false} /> : null
        ))}
      </div>
    </section>
  )
}
