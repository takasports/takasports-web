// Auto-match de entries del Índice Taka mencionadas en un artículo.
//
// Estrategia: cargar nombres + aliases del top 500 entries por score y
// buscar substring case-insensitive (sin acentos) en el texto del artículo.
// Devuelve hasta `limit` entries únicas ordenadas por score.
//
// Sin LLM, sin API externa, sin coste. Cacheado por revalidate de Next.

import { createClient } from '@supabase/supabase-js'

export interface MatchedEntry {
  id: string
  name: string
  subtitle: string | null
  sport: string | null
  category: string | null
  score: number
  rank: number | null
  image_url: string | null
  trend: string | null
  score_prev: number | null
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Mantén short tokens fuera (Iker, Joao, etc. solos sí, pero "AS" o "El" no)
const STOPWORDS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'al', 'en', 'y', 'es', 'un', 'una', 'as', 'sport', 'marca', 'real', 'fc', 'cf'])

export async function matchEntriesInText(
  title: string,
  body: string | null | undefined,
  tags: string[] = [],
  limit = 3,
): Promise<MatchedEntry[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return []

  const haystack = norm([title, body ?? '', tags.join(' ')].join('  '))
  if (haystack.length < 10) return []

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  )

  // Top 500 entries — los relevantes para noticias suelen ser top del mundo
  const { data: entries } = await sb
    .from('ranking_view')
    .select('id,name,subtitle,sport,category,score,rank,image_url,trend,score_prev')
    .order('score', { ascending: false })
    .limit(500)

  if (!entries) return []

  // Aliases (apodos): "El Sheik" → ufc-topuria, etc.
  const { data: aliases } = await sb.from('entry_aliases').select('alias, entry_id')

  const aliasMap = new Map<string, string>()
  for (const a of aliases ?? []) aliasMap.set(norm(a.alias), a.entry_id)

  // Score por cada entry: longitud del match (preferimos "Lamine Yamal" sobre "Yamal")
  type Scored = { entry: MatchedEntry; matchScore: number }
  const hits: Scored[] = []

  for (const e of entries) {
    const candidates = [e.name]
    // Si el nombre tiene 2+ palabras, intentar también solo el apellido (último token)
    const tokens = e.name.split(/\s+/).filter(Boolean)
    if (tokens.length >= 2) {
      const last = tokens[tokens.length - 1]
      if (last.length >= 4 && !STOPWORDS.has(norm(last))) candidates.push(last)
    }

    let best = 0
    for (const c of candidates) {
      const needle = norm(c)
      if (needle.length < 3 || STOPWORDS.has(needle)) continue
      if (haystack.includes(needle)) {
        best = Math.max(best, needle.length)
      }
    }

    // Aliases registrados que apuntan a esta entry
    for (const [alias, entryId] of aliasMap) {
      if (entryId === e.id && haystack.includes(alias)) {
        best = Math.max(best, alias.length + 2)  // bonus por alias intencional
      }
    }

    if (best > 0) hits.push({ entry: e as MatchedEntry, matchScore: best })
  }

  // Ordena por: (1) length del match desc (matches específicos primero),
  //             (2) score del entry desc
  hits.sort((a, b) => b.matchScore - a.matchScore || b.entry.score - a.entry.score)

  // Dedupe por id (la vista puede repetirlos si están en varias categorías)
  const seen = new Set<string>()
  const final: MatchedEntry[] = []
  for (const h of hits) {
    if (seen.has(h.entry.id)) continue
    seen.add(h.entry.id)
    final.push(h.entry)
    if (final.length >= limit) break
  }
  return final
}
