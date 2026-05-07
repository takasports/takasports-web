/**
 * sync-rankings-from-db.ts
 *
 * Lee `ranking_view` de Supabase (datos canónicos con overrides aplicados) y
 * regenera `src/lib/rankings.ts` con los nuevos arrays. Conserva la cabecera
 * de metodología, los tipos y los exports auxiliares (filters, scope, etc.)
 *
 * Diseñado para ejecutarse:
 *   · Al final del workflow n8n WF-11 (curl POST a la web → revalidate), o
 *   · Localmente: `pnpm rankings:sync`
 *
 * Si Supabase no está configurado o devuelve 0 filas → no toca el archivo
 * (mantiene la versión actual). Idempotente.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

type Category =
  | 'jugadores' | 'jugadoras' | 'clubes' | 'clubes_femenino'
  | 'entrenadores' | 'creadores' | 'periodistas' | 'luchadoras_ufc'
  | 'creadores_wwe' | 'sub21' | 'latam' | 'concacaf'

const CATEGORY_TO_EXPORT: Record<Category, string> = {
  jugadores:        'RANKING_JUGADORES',
  jugadoras:        'RANKING_JUGADORAS',
  clubes:           'RANKING_CLUBES',
  clubes_femenino:  'RANKING_CLUBES_FEMENINO',
  entrenadores:     'RANKING_ENTRENADORES',
  creadores:        'RANKING_CREADORES',
  periodistas:      'RANKING_PERIODISTAS',
  luchadoras_ufc:   'RANKING_LUCHADORAS_UFC',
  creadores_wwe:    'RANKING_CREADORES_WWE',
  sub21:            'RANKING_JUGADORES_SUB21',
  latam:            'RANKING_JUGADORES_LATAM',
  concacaf:         'RANKING_JUGADORES_CONCACAF',
}

function rowToTSObject(row: any): string {
  const lines: string[] = ['  {']
  const pushIf = (k: string, v: any, raw = false) => {
    if (v === null || v === undefined || v === '') return
    const val = raw ? v : JSON.stringify(v)
    lines.push(`    ${k}: ${val},`)
  }
  pushIf('id', row.id)
  pushIf('rank', row.rank, true)
  pushIf('name', row.name)
  pushIf('subtitle', row.subtitle)
  pushIf('sport', row.sport)
  pushIf('score', Number(row.score), true)
  pushIf('trend', row.trend)
  pushIf('insight', row.insight)
  pushIf('emoji', row.emoji)
  pushIf('image', row.image_url)
  pushIf('badge', row.badge)
  pushIf('region', row.region)
  pushIf('country', row.country)
  pushIf('league', row.league)
  pushIf('position', row.position)
  pushIf('gender', row.gender)
  if (row.featured) pushIf('featured', true, true)
  if (row.score_prev !== null) pushIf('scorePrev', Number(row.score_prev), true)
  pushIf('trendReason', row.trend_reason)
  if (row.factors) pushIf('factors', JSON.stringify(row.factors), true)
  if (row.editorial_boost !== null) pushIf('editorialBoost', Number(row.editorial_boost), true)
  pushIf('editorialNote', row.editorial_note)
  lines.push('  },')
  return lines.join('\n')
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('[sync] Supabase no configurado — saltando.')
    process.exit(0)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const filePath = join(process.cwd(), 'src/lib/rankings.ts')
  const original = readFileSync(filePath, 'utf8')

  // Por cada categoría, leer y reemplazar el bloque entre los marcadores
  let updated = original
  let totalRows = 0

  for (const [cat, exportName] of Object.entries(CATEGORY_TO_EXPORT)) {
    const { data, error } = await sb
      .from('ranking_view')
      .select('*')
      .eq('category', cat)
      .order('rank', { ascending: true })

    if (error) { console.error(`[sync] ${cat}:`, error.message); continue }
    if (!data || data.length === 0) {
      console.log(`[sync] ${cat}: 0 filas en DB — mantengo versión estática.`)
      continue
    }

    totalRows += data.length

    const newBody = data.map(rowToTSObject).join('\n')
    const newBlock = `export const ${exportName}: RankingEntry[] = [\n${newBody}\n]`

    // Match: export const NAME: RankingEntry[] = [...]
    const re = new RegExp(
      `export\\s+const\\s+${exportName}\\s*:\\s*RankingEntry\\[\\]\\s*=\\s*\\[[\\s\\S]*?\\n\\]`,
      'm'
    )
    if (re.test(updated)) {
      updated = updated.replace(re, newBlock)
      console.log(`[sync] ${cat}: ${data.length} entradas escritas.`)
    } else {
      console.warn(`[sync] ${cat}: no encontré el bloque ${exportName} para reemplazar.`)
    }
  }

  if (totalRows === 0) {
    console.log('[sync] DB vacía — sin cambios al archivo.')
    return
  }

  // Marca de fecha
  const today = new Date().toISOString().slice(0, 10)
  updated = updated.replace(
    /\/\/ Índice Taka — datos actualizados a \d{4}-\d{2}-\d{2}/,
    `// Índice Taka — datos actualizados a ${today} (auto-sync desde Supabase)`
  )

  writeFileSync(filePath, updated, 'utf8')
  console.log(`[sync] OK · ${totalRows} entradas totales · ${filePath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
