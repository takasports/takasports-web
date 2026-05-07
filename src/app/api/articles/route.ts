import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@sanity/client'
import { captureException } from '@/lib/monitoring'

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: true,
})

const PAGE_SIZE = 20

// Base filter: public articles from both schemas
const BASE_FILTER = `_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))`

function buildQuery(start: number, end: number, sport?: string) {
  const sportFilter = sport
    ? ` && (sport == $sport || competition == $sport)`
    : ''

  return `*[${BASE_FILTER}${sportFilter}] | order(publishedAt desc)[${start}...${end}] {
    _id,
    "slug": slug.current,
    "title": select(defined(headline) => headline, title),
    "short_summary": select(defined(headline) => metaDescription, short_summary),
    "imageUrl": select(defined(headline) => imageUrl, null),
    "image": select(defined(headline) => mainImage, image),
    publishedAt,
    sport,
    "category": select(defined(headline) => competition, category),
    "priority": select(defined(headline) => "destacado", priority),
    "isTaka": defined(headline)
  }`
}

function buildCountQuery(sport?: string) {
  const sportFilter = sport
    ? ` && (sport == $sport || competition == $sport)`
    : ''
  return `count(*[${BASE_FILTER}${sportFilter}])`
}

export async function GET(req: NextRequest) {
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1'))
  const sport = req.nextUrl.searchParams.get('sport') ?? undefined
  const start = (page - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE

  try {
    const params = sport ? { sport } : {}
    const [articles, total] = await Promise.all([
      sanity.fetch(buildQuery(start, end, sport), params),
      sanity.fetch<number>(buildCountQuery(sport), params),
    ])

    return NextResponse.json(
      { articles, total, page, pageSize: PAGE_SIZE, hasMore: end < total },
      { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } }
    )
  } catch (err) {
    captureException(err, { route: '/api/articles', page, sport })
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}
