#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// curate-active-entries.mjs
//
// Activa/desactiva entradas en ranking_entries basándose en score_auto.
// Para cada sport+category, activa los top-N por score_auto donde al
// menos un factor real está calculado (no todo por defecto).
//
// Diseño: desacopla el flag `active` de n8n — ahora lo controla la
// relevancia deportiva (score), no la cobertura editorial.
//
// Reglas:
//   1. Una entrada califica si tiene al menos un factor != null
//   2. Se activan los top-N de cada sport+category por score_auto
//   3. Las demás del mismo sport+category se desactivan
//   4. Entradas con editorial_boost != 0 o != null siempre se activan
//      (override editorial manual)
//
// Uso:
//   node scripts/curate-active-entries.mjs           # DRY RUN
//   node scripts/curate-active-entries.mjs --apply
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

// Top-N por sport+category
const LIMITS = {
  'futbol/jugadores':         200,
  'futbol/jugadoras':         100,
  'futbol/sub21':              80,
  'futbol/latam':              80,
  'futbol/concacaf':           50,
  'futbol/entrenadores':       50,
  'futbol/clubes':             50,
  'futbol/clubes_femenino':    50,
  'tenis/jugadores':           60,
  'tenis/jugadoras':           60,
  'formula1/jugadores':        25,
  'ufc/jugadores':             40,
  'ufc/luchadoras_ufc':        30,
  'baloncesto/jugadores':      60,
  'baloncesto/sub21':          30,
  'baloncesto/latam':          30,
  'baloncesto/concacaf':       20,
  'nba/jugadores':             60,
}
const DEFAULT_LIMIT = 30

async function loadAll(sb) {
  let all = [], page = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, sport, category, active, score_auto, rendimiento_auto, contexto_auto, mediatico_auto, narrativa_auto, editorial_boost')
      .not('category', 'in', '("creadores","periodistas")')  // no tocar contenido editorial
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) throw error
    all = all.concat(data)
    if (data.length < 1000) break
    page++
  }
  return all
}

function hasRealData(e) {
  return e.rendimiento_auto !== null
    || e.contexto_auto !== null
    || e.mediatico_auto !== null
    || e.narrativa_auto !== null
}

function hasEditorialBoost(e) {
  return e.editorial_boost !== null && e.editorial_boost !== 0
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading all entries...')
  const all = await loadAll(sb)
  console.log(`  ${all.length} entradas (sin creadores/periodistas)`)

  // Group by sport+category
  const groups = new Map()
  for (const e of all) {
    const key = `${e.sport}/${e.category}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  }

  const toActivate   = new Set()
  const toDeactivate = new Set()

  for (const [key, entries] of groups) {
    const limit = LIMITS[key] ?? DEFAULT_LIMIT

    // Separate editorial boosts (always active) from normal
    const editBoost = entries.filter(hasEditorialBoost)
    const candidates = entries.filter(e => !hasEditorialBoost(e) && hasRealData(e))
    const noData = entries.filter(e => !hasEditorialBoost(e) && !hasRealData(e))

    // Sort candidates by score_auto desc
    candidates.sort((a, b) => (b.score_auto ?? 0) - (a.score_auto ?? 0))

    const topN = candidates.slice(0, limit)
    const rest = candidates.slice(limit)

    for (const e of [...editBoost, ...topN]) {
      if (!e.active) toActivate.add(e.id + '|' + e.category)
    }
    for (const e of [...rest, ...noData]) {
      if (e.active) toDeactivate.add(e.id + '|' + e.category)
    }

    if (VERBOSE || (toActivate.size + toDeactivate.size > 0 && entries.length > 5)) {
      const activating = [...editBoost, ...topN].filter(e => !e.active).length
      const deactivating = [...rest, ...noData].filter(e => e.active).length
      if (activating || deactivating) {
        console.log(`  ${key.padEnd(28)}  top=${limit}  qualified=${candidates.length}  +${activating} -${deactivating}`)
      }
    }
  }

  console.log(`\nTotal cambios: +${toActivate.size} activar, -${toDeactivate.size} desactivar`)

  // Summary by category
  const summaryActivate = {}, summaryDeactivate = {}
  for (const key of toActivate) {
    const [id, cat] = key.split('|')
    const e = all.find(x => x.id === id)
    if (!e) continue
    const k = `${e.sport}/${e.category}`
    summaryActivate[k] = (summaryActivate[k] ?? 0) + 1
  }
  for (const key of toDeactivate) {
    const [id, cat] = key.split('|')
    const e = all.find(x => x.id === id)
    if (!e) continue
    const k = `${e.sport}/${e.category}`
    summaryDeactivate[k] = (summaryDeactivate[k] ?? 0) + 1
  }

  console.log('\n  Activaciones:')
  for (const [k, n] of Object.entries(summaryActivate).sort()) console.log(`    +${n}  ${k}`)
  console.log('  Desactivaciones:')
  for (const [k, n] of Object.entries(summaryDeactivate).sort()) console.log(`    -${n}  ${k}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  // Apply in batches — activate
  let ok = 0, fail = 0
  const activateList = [...toActivate].map(k => {
    const [id] = k.split('|')
    return all.find(x => x.id === id)
  }).filter(Boolean)

  for (let i = 0; i < activateList.length; i += 500) {
    const batch = activateList.slice(i, i + 500)
    const ids = batch.map(e => e.id)
    const { error } = await sb.from('ranking_entries').update({ active: true }).in('id', ids)
    if (error) { fail += batch.length; console.error(`FAIL activate batch: ${error.message}`) }
    else ok += batch.length
    if (i % 2000 === 0 && i > 0) console.log(`  activados ${ok}/${activateList.length}...`)
  }

  // Deactivate
  const deactivateList = [...toDeactivate].map(k => {
    const [id] = k.split('|')
    return all.find(x => x.id === id)
  }).filter(Boolean)

  for (let i = 0; i < deactivateList.length; i += 500) {
    const batch = deactivateList.slice(i, i + 500)
    const ids = batch.map(e => e.id)
    const { error } = await sb.from('ranking_entries').update({ active: false }).in('id', ids)
    if (error) { fail += batch.length; console.error(`FAIL deactivate batch: ${error.message}`) }
    else ok += batch.length
    if (i % 2000 === 0 && i > 0) console.log(`  desactivados ${Math.min(i+500, deactivateList.length)}/${deactivateList.length}...`)
  }

  console.log(`\nDone. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
