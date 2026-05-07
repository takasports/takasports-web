import { type NextRequest, NextResponse } from 'next/server'
import { createClient as createSanity } from '@sanity/client'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { captureException } from '@/lib/monitoring'

const sanity = createSanity({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: true,
})

export const revalidate = 30

const ARTICLE_QUERY = `*[
  _type == "article"
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))
  && (
    title match $q + "*"
    || headline match $q + "*"
    || sport match $q + "*"
    || category match $q + "*"
    || competition match $q + "*"
  )
] | order(publishedAt desc)[0...5] {
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

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createSupabase(url, key)
}

const CAT_LABEL: Record<string, string> = {
  jugadores: 'Jugador', jugadoras: 'Jugadora', clubes: 'Club',
  entrenadores: 'Entrenador', sub21: 'Sub-21', latam: 'LATAM',
  concacaf: 'CONCACAF', creadores: 'Creador', periodistas: 'Periodista',
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const q = raw.replace(/[*?^${}()|[\]\\]/g, '').slice(0, 100)

  if (q.length < 2) return NextResponse.json({ articles: [], players: [] })

  const sb = getSupabase()

  const [articleRes, playerRes] = await Promise.allSettled([
    sanity.fetch(ARTICLE_QUERY, { q }).catch(() => []),
    sb
      ? sb
          .from('ranking_view')
          .select('id,name,subtitle,category,sport,score,rank,emoji,image_url')
          .ilike('name', `%${q}%`)
          .order('score', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], error: null }),
  ])

  const articles = articleRes.status === 'fulfilled' ? (articleRes.value ?? []) : []
  const players  = playerRes.status === 'fulfilled' && playerRes.value && 'data' in playerRes.value
    ? (playerRes.value.data ?? []).map((p: Record<string, unknown>) => ({
        id:       p.id,
        name:     p.name,
        subtitle: p.subtitle,
        category: p.category,
        sport:    p.sport,
        score:    p.score,
        rank:     p.rank,
        emoji:    p.emoji,
        photo:    p.image_url,
        catLabel: CAT_LABEL[p.category as string] ?? String(p.category),
      }))
    : []

  return NextResponse.json(
    { articles, players },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
  )
}
