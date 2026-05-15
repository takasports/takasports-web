#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// fix-duplicates-and-categories.mjs
//
// Fix one-time:
//   1. Desactiva entradas duplicadas — por cada (sport, category,
//      nombre normalizado), mantiene la de mayor score_auto;
//      en empate, prefiere entradas editoriales (con country/emoji)
//      sobre las ESPN-ingested (id empieza por "espn-").
//   2. Desactiva europeos mal categorizados en latam/concacaf.
//
// Uso:
//   node scripts/fix-duplicates-and-categories.mjs           # DRY RUN
//   node scripts/fix-duplicates-and-categories.mjs --apply
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

// Europeos / no-LATAM que aparecen en categoría latam o concacaf
const WRONG_CATEGORY_IDS = [
  'wemba-lat',    // Victor Wembanyama (Francia) en latam baloncesto
  'jokic-lat',    // Nikola Jokić (Serbia) en latam baloncesto
  'luka-lat',     // Luka Dončić (Eslovenia) en latam baloncesto
  'bonmati-lat',  // Aitana Bonmatí (España) en latam fútbol
  'alcaraz-lat',  // Carlos Alcaraz (España) en latam tenis
]

// Entry con datos de nombre equivocado (id jokic-prev → nombre Jayson Tatum)
const WRONG_DATA_IDS = [
  'jokic-prev',  // ID de Jokic pero nombre "Jayson Tatum" — corrupción de datos
]

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

// Prefiere entradas editoriales (con emoji/country) sobre ESPN-ingested
function editorialScore(e) {
  let bonus = 0
  if (e.emoji)   bonus += 2
  if (e.country) bonus += 1
  if (e.id?.startsWith('espn-')) bonus -= 5
  return bonus
}

async function loadAllActive(sb) {
  let all = [], page = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, name, sport, category, active, score_auto, emoji, country, editorial_boost')
      .eq('active', true)
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
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading active entries...')
  const all = await loadAllActive(sb)
  console.log(`  ${all.length} entradas activas`)

  const toDeactivate = new Set()

  // ── 1. Duplicados ─────────────────────────────────────────────
  console.log('\n[1/3] Detectando duplicados...')
  const groups = new Map()
  for (const e of all) {
    const key = `${e.sport}|${e.category}|${normalize(e.name)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  }

  let dupGroups = 0
  for (const [key, entries] of groups) {
    if (entries.length <= 1) continue
    dupGroups++

    // Sort: mayor score_auto primero; en empate, preferir editorial
    entries.sort((a, b) => {
      const scoreDiff = (b.score_auto ?? 0) - (a.score_auto ?? 0)
      if (Math.abs(scoreDiff) > 0.5) return scoreDiff
      return editorialScore(b) - editorialScore(a)
    })

    const winner = entries[0]
    const losers = entries.slice(1)

    // No desactivar si tiene editorial_boost (override manual explícito)
    const eligibleLosers = losers.filter(e => !e.editorial_boost)

    if (VERBOSE) {
      const [,, name] = key.split('|')
      console.log(`  DUP ${key}: keep=${winner.id}(${winner.score_auto?.toFixed(1)}) drop=${eligibleLosers.map(e => e.id).join(',')}`)
    }
    for (const e of eligibleLosers) toDeactivate.add(e.id)
  }
  console.log(`  ${dupGroups} grupos duplicados → ${toDeactivate.size} a desactivar`)

  // ── 2. Europeos en categoría LATAM/CONCACAF ───────────────────
  console.log('\n[2/3] Mal categorizados...')
  let wrongCat = 0
  for (const id of WRONG_CATEGORY_IDS) {
    const entry = all.find(e => e.id === id)
    if (entry) {
      toDeactivate.add(id)
      wrongCat++
      console.log(`  ✗ ${id} — ${entry.name} (${entry.sport}/${entry.category})`)
    } else {
      console.log(`  – ${id} ya inactivo o no existe`)
    }
  }

  // ── 3. Entradas con datos corruptos ───────────────────────────
  console.log('\n[3/3] Datos corruptos...')
  let wrongData = 0
  for (const id of WRONG_DATA_IDS) {
    const entry = all.find(e => e.id === id)
    if (entry) {
      toDeactivate.add(id)
      wrongData++
      console.log(`  ✗ ${id} — name="${entry.name}" (sospechoso)`)
    } else {
      console.log(`  – ${id} ya inactivo o no existe`)
    }
  }

  console.log(`\nTotal a desactivar: ${toDeactivate.size}`)
  console.log(`  duplicados: ${toDeactivate.size - wrongCat - wrongData}  mal_cat: ${wrongCat}  datos_corruptos: ${wrongData}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  // Apply in batches of 500
  const ids = [...toDeactivate]
  let ok = 0, fail = 0
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500)
    const { error } = await sb.from('ranking_entries').update({ active: false }).in('id', batch)
    if (error) { fail += batch.length; console.error(`FAIL: ${error.message}`) }
    else ok += batch.length
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
