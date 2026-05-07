import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@sanity/client'
import { captureException } from '@/lib/monitoring'

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: true,
})

// Sanity GROQ full-text search — filters server-side, returns max 8 results.
// Accepts ?q=query (min 2 chars). Results are cached 60s via ISR.
export const revalidate = 60

const SEARCH_QUERY = `*[
  _type == "article"
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))
  && (
    title match $q + "*"
    || headline match $q + "*"
    || sport match $q + "*"
    || category match $q + "*"
    || competition match $q + "*"
  )
] | order(publishedAt desc)[0...8] {
  _id,
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "short_summary": select(defined(headline) => metaDescription, short_summary),
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image),
  publishedAt,
  sport,
  "category": select(defined(headline) => competition, category)
}`

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  // Strip GROQ-sensitive chars; enforce min/max length
  const q = raw.replace(/[*?^${}()|[\]\\]/g, '').slice(0, 100)

  if (q.length < 2) {
    return NextResponse.json([])
  }

  try {
    const results = await sanity.fetch(SEARCH_QUERY, { q })
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    })
  } catch (err) {
    captureException(err, { route: '/api/search', q })
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
