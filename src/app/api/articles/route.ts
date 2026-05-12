import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@sanity/client'
import { captureException } from '@/lib/monitoring'

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: true,
})

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

// Base filter: public articles from both schemas
const BASE_FILTER = `_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))`

interface Filters {
  sport?: string
  from?: string // ISO date YYYY-MM-DD inclusive
  to?: string   // ISO date YYYY-MM-DD inclusive
  q?: string    // free-text search
}

function buildFilterClause(f: Filters): string {
  const parts: string[] = [BASE_FILTER]
  if (f.sport) parts.push(`(sport == $sport || competition == $sport)`)
  if (f.from) parts.push(`publishedAt >= $from`)
  if (f.to) parts.push(`publishedAt <= $to`)
  if (f.q) parts.push(`(title match $q || headline match $q || short_summary match $q || metaDescription match $q)`)
  return parts.join(' && ')
}

function buildQuery(start: number, end: number, f: Filters) {
  return `*[${buildFilterClause(f)}] | order(publishedAt desc)[${start}...${end}] {
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
    "isTaka": defined(headline),
    "takaStatus": select(defined(headline) => status, null)
  }`
}

function buildCountQuery(f: Filters) {
  return `count(*[${buildFilterClause(f)}])`
}

// Normaliza un YYYY-MM-DD del usuario a ISO; rangos inclusivos día completo.
function toIsoStart(date?: string | null): string | undefined {
  if (!date) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return undefined
  return `${date}T00:00:00.000Z`
}
function toIsoEnd(date?: string | null): string | undefined {
  if (!date) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return undefined
  return `${date}T23:59:59.999Z`
}

// Sanitiza la query de búsqueda: limita longitud, elimina chars conflictivos
// de GROQ match (* y ? son comodines válidos pero los recortamos por simplicidad).
function sanitizeQuery(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[*?"\\]/g, ' ').trim().slice(0, 80)
  if (!cleaned) return undefined
  // GROQ match con prefix wildcard: `messi*` matchea palabras que empiezan por messi.
  return `${cleaned}*`
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const page = Math.max(1, Number(sp.get('page') ?? '1'))
  const pageSizeRaw = Number(sp.get('pageSize') ?? DEFAULT_PAGE_SIZE)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE))
  const sport = sp.get('sport') || undefined
  const from = toIsoStart(sp.get('from'))
  const to = toIsoEnd(sp.get('to'))
  const q = sanitizeQuery(sp.get('q'))

  const filters: Filters = { sport, from, to, q }
  const start = (page - 1) * pageSize
  const end = start + pageSize

  try {
    const params: Record<string, string> = {}
    if (sport) params.sport = sport
    if (from) params.from = from
    if (to) params.to = to
    if (q) params.q = q

    const [articles, total] = await Promise.all([
      sanity.fetch(buildQuery(start, end, filters), params),
      sanity.fetch<number>(buildCountQuery(filters), params),
    ])

    return NextResponse.json(
      { articles, total, page, pageSize, hasMore: end < total },
      { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } }
    )
  } catch (err) {
    captureException(err, { route: '/api/articles', page, sport, from, to, q })
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}
