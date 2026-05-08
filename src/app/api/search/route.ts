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

/** Normaliza texto: quita acentos y convierte a minúsculas */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Construye filtro OR de ilike para búsqueda multi-palabra y multi-campo */
function buildPlayerFilter(q: string): string {
  const words = normalize(q).split(/\s+/).filter(w => w.length >= 2)
  if (!words.length) return `name.ilike.%${q}%`

  // Para cada palabra, buscamos en name y subtitle
  // Supabase postgREST OR: or=(field.ilike.%val%,field2.ilike.%val%)
  const clauses: string[] = []
  for (const word of words) {
    clauses.push(`name.ilike.%${word}%`)
    clauses.push(`subtitle.ilike.%${word}%`)
  }
  // También el query completo como fallback para nombres compuestos
  if (words.length > 1) {
    clauses.push(`name.ilike.%${q}%`)
  }
  return clauses.join(',')
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
          .or(buildPlayerFilter(q))
          .order('score', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ])

  const articles = articleRes.status === 'fulfilled' ? (articleRes.value ?? []) : []

  let players: Record<string, unknown>[] = []
  if (playerRes.status === 'fulfilled' && playerRes.value && 'data' in playerRes.value) {
    const raw = (playerRes.value.data ?? []) as Record<string, unknown>[]

    // Dedup por id (en caso de que el OR duplique) y limitar a 6
    const seen = new Set<string>()
    players = raw
      .filter(p => {
        const id = p.id as string
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      .slice(0, 6)
      .map(p => ({
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
  }

  return NextResponse.json(
    { articles, players },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
  )
}
