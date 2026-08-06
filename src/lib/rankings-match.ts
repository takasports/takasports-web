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

/** Igual que norm() pero conservando mayúsculas: hace falta para distinguir
 *  un nombre propio ("Raquel Rodríguez") de una palabra corriente. */
function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Mantén short tokens fuera (Iker, Joao, etc. solos sí, pero "AS" o "El" no)
const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'al', 'en', 'y', 'es', 'un', 'una',
  'as', 'sport', 'marca', 'real', 'fc', 'cf',
  // Calificadores de equipo: son el ÚLTIMO token de muchas entries
  // ("FC Barcelona Femenino"), así que sin esto cualquier texto que hable de
  // una "división femenina" arrastraba clubes que no pintan nada.
  'femenino', 'femenina', 'femenil', 'masculino', 'masculina',
  'women', 'womens', 'men', 'mens', 'club', 'equipo', 'seleccion',
])

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g

/**
 * ¿El texto menciona de verdad a `entryName` cuando aparece `needle`?
 *
 * El problema: buscar substrings sueltos confunde entidades distintas que
 * comparten una palabra. Casos reales vistos en producción:
 *   · "Raquel Rodríguez" (WWE)  →  activaba la ficha de "Arón Rodríguez"
 *   · "Mercedes Moné" (WWE)     →  activaba la ficha de "Mercedes" (F1)
 *
 * Método: por cada aparición se reconstruye el nombre propio COMPLETO al que
 * pertenece (la racha de palabras capitalizadas que la contiene) y se compara
 * con el nombre de la entry.
 *   · racha == nombre de la entry            → mención exacta
 *   · racha ⊂ nombre de la entry             → apellido/alias suelto, válido
 *   · racha es otro nombre propio más largo  → es OTRA entidad, conflicto
 *
 * Se acepta si hay alguna aparición válida y, cuando además hay conflictos,
 * solo si en algún punto aparece el nombre completo de la entry.
 */
export function entryMentioned(hayRaw: string, entryName: string, needle: string): boolean {
  const re = new RegExp(`\\b${deaccent(needle).replace(ESCAPE_RE, '\\$&')}\\b`, 'giu')
  const entry = norm(entryName)
  const CH = `[\\p{L}\\p{N}'’.-]`
  const backRe = new RegExp(`\\p{Lu}${CH}*\\s+$`, 'u')
  const fwdRe = new RegExp(`^\\s+\\p{Lu}${CH}*`, 'u')

  let clean = false
  let exact = false
  let conflict = false

  let m: RegExpExecArray | null
  while ((m = re.exec(hayRaw))) {
    // Los nombres de entries son nombres propios: si en el texto aparece en
    // minúscula es la palabra corriente, no la entidad. Sin esto, el club
    // "Como" se activaba con cualquier "como" de una frase.
    if (!/^\p{Lu}/u.test(m[0])) continue

    // Extiende hacia atrás y hacia delante mientras haya palabras capitalizadas.
    let start = m.index
    let end = m.index + m[0].length
    for (;;) {
      const prev = backRe.exec(hayRaw.slice(0, start))
      if (!prev) break
      start -= prev[0].length
    }
    for (;;) {
      const next = fwdRe.exec(hayRaw.slice(end))
      if (!next) break
      end += next[0].length
    }

    const run = norm(hayRaw.slice(start, end).trim())
    if (run === entry) { exact = true; clean = true }
    else if (entry.includes(run)) clean = true   // parte del nombre (apellido suelto)
    else conflict = true                          // otro nombre propio distinto
  }

  return clean && (!conflict || exact)
}

export async function matchEntriesInText(
  title: string,
  body: string | null | undefined,
  tags: string[] = [],
  limit = 3,
): Promise<MatchedEntry[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return []

  // hayRaw = solo titular + cuerpo: es prosa, con mayúsculas reales, y es donde
  // entryMentioned() puede distinguir un nombre propio de una palabra corriente.
  // Los tags van aparte porque se guardan en minúscula: ahí no hay pistas de
  // capitalización, pero son curados, así que una coincidencia exacta vale.
  const prose = [title, body ?? ''].join('  ')
  const haystack = norm([prose, tags.join(' ')].join('  '))
  const hayRaw = deaccent(prose)
  const tagSet = new Set(tags.map(norm))
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
    let best = 0

    // 1) Nombre completo — en la prosa (validado) o como tag exacto
    const full = norm(e.name)
    if (full.length >= 3 && !STOPWORDS.has(full) && (tagSet.has(full) || entryMentioned(hayRaw, e.name, e.name))) {
      best = full.length
    }

    // 2) Solo el apellido (último token) — validando que no sea el apellido de
    //    otra persona distinta (ver entryMentioned).
    const tokens = e.name.split(/\s+/).filter(Boolean)
    if (tokens.length >= 2) {
      const last = tokens[tokens.length - 1]
      const lastNorm = norm(last)
      if (
        last.length >= 4 &&
        lastNorm.length >= 3 &&
        !STOPWORDS.has(lastNorm) &&
        haystack.includes(lastNorm) &&
        entryMentioned(hayRaw, e.name, last)
      ) {
        best = Math.max(best, lastNorm.length)
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
