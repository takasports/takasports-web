#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-narrativa-decay.mjs  →  FACTOR "FORMA" (momentum real)
//
// `narrativa_auto` pesa un 20% del score y desde la migración 110 ya no
// es "narrativa" sino **FORMA**: si el deportista viene de menos a más.
// Se calcula de la tendencia real del score en las últimas ~6 semanas
// de `ranking_score_history`:
//
//     forma = clamp(75 + (score_reciente − score_antiguo) × 1.2, 58, 92)
//     sin al menos 2 snapshots → 75 (neutro, no penaliza al recién llegado)
//
// ── QUÉ HACÍA ANTES (2026-07-28) ─────────────────────────────────
// Restaba 2 pts/semana a quien no se hubiera actualizado en 21 días,
// con suelo 65. Era un decay de "hype viejo" heredado de cuando el
// factor era narrativa editorial. Con los pesos actuales eso ERA UN
// BUG: aplastaba hacia 65 la Forma que el pipeline acababa de calcular,
// castigando al que no se movía en vez de medir su tendencia.
//
// El nombre del fichero se mantiene porque el orquestador semanal
// (~/.taka/weekly-rankings.mjs) lo invoca por ruta.
//
// Uso:
//   node scripts/ingest-narrativa-decay.mjs           # DRY RUN
//   node scripts/ingest-narrativa-decay.mjs --apply
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY   = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

const WINDOW_DAYS = 45     // ~6 semanas de snapshots
const NEUTRAL     = 75     // sin histórico suficiente
const SLOPE       = 1.2    // pts de forma por punto de score ganado
const FLOOR       = 58
const CEIL        = 92

// Snapshots anteriores a esta fecha NO se usan: durante julio de 2026 los scores
// se movieron por recálculos manuales del sistema (rendimiento objetivo desde
// ESPN, mediático bilingüe EN×ES, coeficiente de fuerza de liga en latam), no
// porque los deportistas cambiaran de forma. Medir sobre ese tramo daba
// disparates — Bonmatí y Miedema al suelo 58 por un cambio de fuente, Luis
// Enrique a 89 por una recalibración. Hasta que haya 2+ snapshots limpios, la
// Forma es neutra: mejor un factor honesto en 75 que uno que mide mis ediciones.
const CLEAN_SINCE = '2026-07-28T00:00:00Z'

// Creadores: su narrativa_auto es "Relevancia", no forma. No se toca.
const SKIP_CATEGORIES = ['creadores', 'creadores_wwe', 'periodistas']

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v * 10) / 10))

function formaScore(scores) {
  if (!scores || scores.length < 2) return NEUTRAL
  const delta = scores[scores.length - 1] - scores[0]   // reciente − más antiguo
  return clamp(NEUTRAL + delta * SLOPE, FLOOR, CEIL)
}

async function loadHistory(sb) {
  const window = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString()
  const cutoff = window > CLEAN_SINCE ? window : CLEAN_SINCE
  const map = new Map()
  let page = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_score_history')
      .select('entry_id, category, week_start, score')
      .gte('captured_at', cutoff)
      .order('week_start', { ascending: true })
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) throw error
    for (const h of data) {
      if (h.score == null) continue
      const k = `${h.entry_id}|${h.category}`
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(Number(h.score))
    }
    if (data.length < 1000) break
    page++
  }
  return map
}

async function loadEntries(sb) {
  let all = [], page = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, name, category, narrativa_auto, narrativa_manual, editorial_locked')
      .eq('active', true)
      .not('category', 'in', `(${SKIP_CATEGORIES.map(c => `"${c}"`).join(',')})`)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) throw error
    all = all.concat(data)
    if (data.length < 1000) break
    page++
  }
  return all
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Forma = clamp(${NEUTRAL} + Δscore(${WINDOW_DAYS}d) × ${SLOPE}, ${FLOOR}, ${CEIL}) · neutro ${NEUTRAL} sin histórico`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const [history, entries] = await Promise.all([loadHistory(sb), loadEntries(sb)])
  console.log(`\n  ${history.size} entradas con histórico · ${entries.length} entradas activas`)

  const updates = []
  let sinHistorico = 0
  for (const e of entries) {
    if (e.editorial_locked === true) continue      // el editor manda
    if (e.narrativa_manual !== null) continue      // hay override manual
    const scores = history.get(`${e.id}|${e.category}`)
    if (!scores || scores.length < 2) sinHistorico++
    const forma = formaScore(scores)
    const prev = e.narrativa_auto === null ? null : Number(e.narrativa_auto)
    if (prev !== null && Math.abs(prev - forma) < 0.05) continue
    updates.push({ id: e.id, category: e.category, name: e.name, prev, forma })
  }

  updates.sort((a, b) => b.forma - a.forma)
  console.log(`  ${sinHistorico} sin histórico suficiente → neutro ${NEUTRAL}`)
  console.log(`\nCambios: ${updates.length}`)

  const show = VERBOSE ? updates : [...updates.slice(0, 15), ...updates.slice(-15)]
  for (const u of show) {
    console.log(`  ${String(u.prev ?? '–').padStart(5)} → ${u.forma.toFixed(1).padStart(5)}  ${u.name}`)
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  // Agrupado por (categoría, valor): la mayoría comparte el mismo valor, así que
  // esto son un puñado de escrituras en vez de una por entrada.
  const buckets = new Map()
  for (const u of updates) {
    const k = `${u.category}|${u.forma}`
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(u.id)
  }

  let ok = 0, fail = 0
  for (const [k, ids] of buckets) {
    const [category, forma] = [k.slice(0, k.lastIndexOf('|')), Number(k.slice(k.lastIndexOf('|') + 1))]
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500)
      const { error } = await sb.from('ranking_entries')
        .update({ narrativa_auto: forma })
        .in('id', batch).eq('category', category)   // la PK es (id, category)
      if (error) { fail += batch.length; console.error(`FAIL ${category}: ${error.message}`) } else ok += batch.length
    }
  }
  console.log(`Done. OK=${ok} FAIL=${fail} (${buckets.size} escrituras agrupadas)`)
}

main().catch(err => { console.error(err); process.exit(1) })
