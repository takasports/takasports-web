/**
 * seed-rankings-to-db.ts
 *
 * Vuelca los 12 arrays estáticos de rankings.ts → tabla ranking_entries de Supabase.
 * Comportamiento: UPSERT que respeta editorial_locked y preserva los campos _manual
 * (solo sobreescribe la capa _auto, igual que hace el cron n8n).
 *
 * Uso:
 *   pnpm rankings:seed            # pobla la DB con los datos actuales del estático
 *   pnpm rankings:seed --dry-run  # muestra lo que haría sin tocar la DB
 *   pnpm rankings:seed --category jugadores  # solo una categoría
 *
 * Requiere: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Carga .env.local (Next.js no lo carga automáticamente en scripts)
config({ path: resolve(process.cwd(), '.env.local') })

import {
  RANKING_JUGADORES, RANKING_JUGADORAS,
  RANKING_CLUBES, RANKING_CLUBES_FEMENINO,
  RANKING_ENTRENADORES,
  RANKING_CREADORES, RANKING_PERIODISTAS,
  RANKING_LUCHADORAS_UFC, RANKING_CREADORES_WWE,
  RANKING_JUGADORES_SUB21, RANKING_JUGADORES_LATAM, RANKING_JUGADORES_CONCACAF,
  calcScore,
  type RankingEntry,
} from '../src/lib/rankings'

const SOURCES: { category: string; entries: RankingEntry[] }[] = [
  { category: 'jugadores',       entries: RANKING_JUGADORES },
  { category: 'jugadoras',       entries: RANKING_JUGADORAS },
  { category: 'clubes',          entries: RANKING_CLUBES },
  { category: 'clubes_femenino', entries: RANKING_CLUBES_FEMENINO },
  { category: 'entrenadores',    entries: RANKING_ENTRENADORES },
  { category: 'creadores',       entries: RANKING_CREADORES },
  { category: 'periodistas',     entries: RANKING_PERIODISTAS },
  { category: 'luchadoras_ufc',  entries: RANKING_LUCHADORAS_UFC },
  { category: 'creadores_wwe',   entries: RANKING_CREADORES_WWE },
  { category: 'sub21',           entries: RANKING_JUGADORES_SUB21 },
  { category: 'latam',           entries: RANKING_JUGADORES_LATAM },
  { category: 'concacaf',        entries: RANKING_JUGADORES_CONCACAF },
]

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const onlyCategory = args.find(a => a.startsWith('--category='))?.split('=')[1]
  ?? (args.indexOf('--category') !== -1 ? args[args.indexOf('--category') + 1] : null)

function entryToRow(e: RankingEntry, category: string) {
  const score = e.factors ? calcScore(e.factors, e.editorialBoost) : e.score
  const factors = e.factors ?? null
  return {
    id: e.id,
    category,
    name: e.name,
    subtitle: e.subtitle ?? null,
    sport: e.sport ?? null,
    emoji: e.emoji ?? null,
    image_url: e.image ?? null,
    country: e.country ?? null,
    league: e.league ?? null,
    position: e.position ?? null,
    region: e.region ?? null,
    gender: e.gender ?? null,
    badge: e.badge ?? null,
    featured: e.featured ?? false,
    active: true,
    // Capa AUTO — el seed trata los datos estáticos como valores auto iniciales
    rank_auto: e.rank,
    score_auto: score,
    insight_auto: e.insight ?? null,
    trend_reason_auto: e.trendReason ?? null,
    rendimiento_auto: factors?.rendimiento ?? null,
    contexto_auto: factors?.contexto ?? null,
    mediatico_auto: factors?.mediatico ?? null,
    narrativa_auto: factors?.narrativa ?? null,
    score_prev: e.scorePrev ?? null,
    last_auto_update: new Date().toISOString(),
    // Los campos _manual y editorial_locked no se tocan: onConflict los preserva
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[seed] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
  }

  const sources = onlyCategory
    ? SOURCES.filter(s => s.category === onlyCategory)
    : SOURCES

  if (onlyCategory && sources.length === 0) {
    console.error(`[seed] Categoría desconocida: "${onlyCategory}". Válidas: ${SOURCES.map(s => s.category).join(', ')}`)
    process.exit(1)
  }

  let totalEntries = 0
  sources.forEach(s => { totalEntries += s.entries.length })

  console.log(`[seed] ${dryRun ? '(DRY RUN) ' : ''}Procesando ${sources.length} categorías, ${totalEntries} entries en total…`)

  if (dryRun) {
    for (const { category, entries } of sources) {
      console.log(`  ${category}: ${entries.length} entries → (no escrito)`)
      for (const e of entries.slice(0, 3)) {
        const row = entryToRow(e, category)
        console.log(`    rank ${row.rank_auto} · ${row.name} · score_auto=${row.score_auto}`)
      }
      if (entries.length > 3) console.log(`    … y ${entries.length - 3} más`)
    }
    console.log('[seed] Dry run completado. Sin cambios en la DB.')
    return
  }

  const sb = createClient(url, key, { auth: { persistSession: false } })
  let totalUpserted = 0
  let totalErrors = 0

  for (const { category, entries } of sources) {
    const rows = entries.map(e => entryToRow(e, category))

    // Upsert en lotes de 50 para no saturar Supabase
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error } = await sb
        .from('ranking_entries')
        .upsert(batch, {
          onConflict: 'id,category',
          ignoreDuplicates: false,
        })

      if (error) {
        console.error(`[seed] Error en ${category} batch ${i}–${i + batch.length}:`, error.message)
        totalErrors += batch.length
      } else {
        totalUpserted += batch.length
      }
    }

    console.log(`[seed] ✓ ${category}: ${entries.length} entries`)
  }

  // Recalcula trends (score_auto vs score_prev)
  const { error: rpcErr } = await sb.rpc('f_ranking_recompute_trends')
  if (rpcErr) {
    console.warn('[seed] ⚠ f_ranking_recompute_trends falló:', rpcErr.message)
  } else {
    console.log('[seed] ✓ trends recalculados')
  }

  console.log(`\n[seed] Completado: ${totalUpserted} upserted, ${totalErrors} errores`)
  if (totalErrors > 0) process.exit(1)
}

main().catch(e => { console.error(e); process.exit(1) })
