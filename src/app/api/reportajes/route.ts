import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@sanity/client'
import { captureException } from '@/lib/monitoring'
import { readingMinutes } from '@/lib/reading'
import { displayAuthor } from '@/lib/brand'
import { urlFor } from '@/lib/sanity'

// Reportajes para la app móvil. Mismo cliente/caché que /api/articles (CDN de
// Sanity, solo contenido publicado).
//
// Devuelve `readingMinutes` y `author` YA RESUELTOS: la app pinta lo que le
// llega y no reimplementa ni la fórmula de lectura ni el fallback de la firma,
// que es como se desincronizan web y app.
const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: true,
})

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const QUERY = `*[_type == "article"
  && type == "reportaje"
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))
] | order(publishedAt desc)[$start...$end] {
  _id,
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image),
  publishedAt,
  sport,
  "category": select(defined(headline) => competition, category),
  "isTaka": defined(headline),
  "author": select(defined(headline) => author, author->name),
  "readChars": length(pt::text(body))
}`

const COUNT_QUERY = `count(*[_type == "article"
  && type == "reportaje"
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))])`

interface Row {
  _id: string
  readChars?: number | null
  author?: string | null
  imageUrl?: string | null
  image?: { asset?: { _ref?: string } } | null
  [k: string]: unknown
}

// La app solo sabe pintar `imageUrl`. Los reportajes redactados en el Studio
// llevan la foto como referencia de asset (`image`) y no traen imageUrl, así que
// la resolvemos aquí; si no, la app se quedaría sin portada.
function resolveCover(row: Row): string | null {
  if (row.imageUrl) return row.imageUrl
  if (!row.image?.asset?._ref) return null
  try {
    return urlFor(row.image).width(900).height(600).url()
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const limitRaw = Number(sp.get('limit') ?? DEFAULT_LIMIT)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT))
  const page = Math.max(1, Number(sp.get('page') ?? '1'))
  const start = (page - 1) * limit
  const end = start + limit

  try {
    const [rows, total] = await Promise.all([
      sanity.fetch<Row[]>(QUERY, { start, end }),
      sanity.fetch<number>(COUNT_QUERY),
    ])

    const reportajes = rows.map(row => {
      const { readChars, author, image, ...rest } = row
      return {
        ...rest,
        imageUrl: resolveCover(row),
        author: displayAuthor(author),
        readingMinutes: readingMinutes(readChars),
      }
    })

    const cache = 'public, s-maxage=300, stale-while-revalidate=900'
    return NextResponse.json(
      { reportajes, total, page, limit, hasMore: end < total },
      { headers: { 'Cache-Control': cache, 'CDN-Cache-Control': cache } }
    )
  } catch (err) {
    captureException(err, { route: '/api/reportajes', page, limit })
    return NextResponse.json({ error: 'Failed to fetch reportajes' }, { status: 500 })
  }
}
