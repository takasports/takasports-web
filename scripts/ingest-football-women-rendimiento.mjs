#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-football-women-rendimiento.mjs  (fuente: FBref.com)
//
// Mejora el factor `rendimiento_auto` de las jugadoras de fútbol
// femenino usando Goles + Asistencias de FBref.
//
// FBref no ofrece xG para ligas femeninas — usamos G+A reales.
// Métrica: GI90 = (Goles + Asistencias) / (minutos / 90)
//
// Thresholds calibrados para fútbol femenino:
//   GI90 ≥ 0.70 → 90-95  (élite: Shaw, Kerr, Bonmatí, Pajor)
//   GI90 ≥ 0.50 → 82-90  (All-Star ofensiva)
//   GI90 ≥ 0.35 → 74-82  (muy buena)
//   GI90 ≥ 0.22 → 64-74  (buena mediocampista/extremo)
//   GI90 ≥ 0.12 → 52-64  (rotación)
//   GI90 ≥ 0.04 → 40-52  (suplente / CDM)
//   GI90 <  0.04 → 30-40 (defensa/portera — omitida si sin historial)
//
// Ligas: Liga F, WSL, Division 1 Féminine, NWSL, Frauen-Bundesliga
// Categorías: jugadoras, sub21, latam, concacaf
//
// Datos: scripts/fbref-women-seed.json (actualizar periódicamente
// abriendo cada liga en Chrome y re-ejecutando el seed generator)
//
// Uso:
//   node scripts/ingest-football-women-rendimiento.mjs           # DRY RUN
//   node scripts/ingest-football-women-rendimiento.mjs --apply
//   node scripts/ingest-football-women-rendimiento.mjs --apply --verbose
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY   = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE keys in .env.local')
  process.exit(1)
}

const SEED_PATH = path.join(__dirname, 'fbref-women-seed.json')
const MIN_MINUTES = 270   // ~3 partidos completos
const MIN_PREV_REND = 65  // umbral para actualizar defensas/GK de bajo GI

const TARGET_CATEGORIES = ['jugadoras', 'sub21', 'latam', 'concacaf']

// Aliases para jugadoras conocidas por apodo o nombre corto en la DB
const NAME_ALIASES = {
  'aitanabonmati':         'aitana',
  'aitanabonmaticonesa':   'aitana',
  'alexiaputellas':        'alexia',
  'alexiaputellasconesa':  'alexia',
  'khadijashaw':           'shaw',
  'alessiarusso':          'russo',
  'viviannemiedema':       'miedema',
  'carolineweir':          'weir',
  'lucybronze':            'bronze',
  'virginiatorrecilla':    'torrecilla',
  'samkerr':               'kerr',
  'ewapajor':              'pajor',
  'fridolinarolfo':        'rolfo',
  'magdalenaeriksson':     'eriksson',
  'pernilleharder':        'harder',
  'carolinegrahanhansen':  'grahamhansen',
  'vickylopes':            'vicky',
  'claudionapina':         'claudia',
  'mariaputellas':         'alexia',
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
           .toLowerCase().replace(/[^a-z]/g, '')
}

function nameVariants(rawName) {
  const full  = normalize(rawName)
  const alias = NAME_ALIASES[full]
  const tokens = rawName.split(/[\s\-]+/).filter(Boolean)
  const twoToken = tokens.length >= 2 ? normalize(tokens[0] + tokens[1]) : full
  const lastName = tokens.length >= 2 ? normalize(tokens[tokens.length - 1]) : null
  return [...new Set([full, twoToken, ...(lastName ? [lastName] : []), ...(alias ? [alias] : [])])]
}

// Score calibrado para fútbol femenino (G+A real, no xG)
// Cap: tier1→95, tier2→88
function gi90ToScore(gi90, tier = 1) {
  const cap = tier === 1 ? 95 : 88
  let s
  if      (gi90 >= 0.70) s = 90 + Math.min(5, (gi90 - 0.70) * 25)
  else if (gi90 >= 0.50) s = 82 + (gi90 - 0.50) / 0.20 * 8
  else if (gi90 >= 0.35) s = 74 + (gi90 - 0.35) / 0.15 * 8
  else if (gi90 >= 0.22) s = 64 + (gi90 - 0.22) / 0.13 * 10
  else if (gi90 >= 0.12) s = 52 + (gi90 - 0.12) / 0.10 * 12
  else if (gi90 >= 0.04) s = 40 + (gi90 - 0.04) / 0.08 * 12
  else                   s = Math.max(30, 40 - (0.04 - gi90) * 50)
  return Math.round(Math.min(cap, Math.max(0, s)) * 10) / 10
}

async function loadEntries(sb) {
  const PAGE = 1000
  let all = [], from = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, name, category, rendimiento_auto')
      .eq('sport', 'futbol')
      .in('category', TARGET_CATEGORIES)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} · Fútbol Femenino · FBref G+A`)

  // Load seed data
  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Seed file not found: ${SEED_PATH}`)
    console.error('Run the seed generator first (see script header).')
    process.exit(1)
  }
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'))
  const seedDate = new Date(fs.statSync(SEED_PATH).mtime).toISOString().slice(0, 10)
  console.log(`Seed: ${SEED_PATH} (modified ${seedDate})`)

  // Print league summary
  for (const [league, { tier, players }] of Object.entries(seed)) {
    const qualified = players.filter(p => p.min >= MIN_MINUTES)
    console.log(`  ${league}: ${qualified.length} jugadoras (≥${MIN_MINUTES} min) de ${players.length} totales [tier${tier}]`)
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log(`\nLoading DB entries (categories: ${TARGET_CATEGORIES.join(', ')})...`)
  const entries = await loadEntries(sb)
  console.log(`  ${entries.length} entradas`)

  // Index DB by normalized name → array of entries
  const byNorm = new Map()
  for (const e of entries) {
    const key = normalize(e.name)
    if (!byNorm.has(key)) byNorm.set(key, [])
    byNorm.get(key).push(e)
  }

  // bestByEntry: Map<entryId, bestData> — highest score across all leagues
  const bestByEntry = new Map()
  const allPlayers  = []

  for (const [leagueName, { tier, players }] of Object.entries(seed)) {
    for (const p of players) {
      if (p.min < MIN_MINUTES) continue
      const gi90 = (p.g + p.a) / (p.min / 90)
      allPlayers.push({ ...p, league: leagueName, tier, gi90 })

      for (const variant of nameVariants(p.player)) {
        const matched = byNorm.get(variant) ?? []
        for (const e of matched) {
          const newScore = gi90ToScore(gi90, tier)
          const existing = bestByEntry.get(e.id)
          if (!existing || newScore > existing.newScore) {
            bestByEntry.set(e.id, {
              entryId:  e.id,
              category: e.category,
              name:     e.name,
              fbName:   p.player,
              league:   leagueName,
              tier,
              position: p.pos,
              minutes:  p.min,
              g:        p.g,
              a:        p.a,
              gi90,
              prev:     e.rendimiento_auto !== null ? Number(e.rendimiento_auto) : null,
              newScore,
            })
          }
        }
      }
    }
  }

  // Filter out low-GI defenders/GKs with no relevant history
  const updates = [], skipped = []
  for (const u of bestByEntry.values()) {
    const pos = (u.position ?? '').toUpperCase()
    const isDefensive = pos.startsWith('D') || pos === 'GK' || pos === 'G'
    if (isDefensive && u.gi90 < 0.04 && (u.prev === null || u.prev < MIN_PREV_REND)) {
      skipped.push(u)
      continue
    }
    updates.push(u)
  }

  updates.sort((a, b) => b.gi90 - a.gi90)
  allPlayers.sort((a, b) => b.gi90 - a.gi90)

  console.log('\n--- Top 20 jugadoras por GI90 (todas las ligas) ---')
  allPlayers.slice(0, 20).forEach(p => {
    const score = gi90ToScore(p.gi90, p.tier)
    console.log(
      `  GI=${p.gi90.toFixed(3)} (${p.g}g+${p.a}a/${p.min}min)` +
      `  ${p.player.padEnd(26)} [${(p.pos ?? '??').padEnd(6)}]` +
      `  ${p.league.padEnd(22)} → ${score.toFixed(1)}`
    )
  })

  console.log('\n--- Matches en DB (top 20) ---')
  updates.slice(0, 20).forEach(u => {
    const prev  = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt   = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    console.log(
      `  GI=${u.gi90.toFixed(3)} (${u.g}g+${u.a}a)` +
      `  ${u.fbName.padEnd(26)} [${(u.position ?? '??').padEnd(6)}]` +
      `  ${u.league.padEnd(22)} ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})`
    )
  })

  if (skipped.length > 0 && VERBOSE) {
    console.log('\nSkipped (defensivas bajo GI sin historial relevante):')
    skipped.forEach(s => console.log(
      `  ${s.fbName.padEnd(28)} ${(s.position ?? '??').padEnd(6)} GI90=${s.gi90.toFixed(3)} prev=${s.prev ?? '?'}`
    ))
  }

  const totalMatched = updates.length + skipped.length
  console.log(`\nMatched: ${totalMatched} / ${allPlayers.length} scrapeadas (≥${MIN_MINUTES}min)`)
  console.log(`  updates=${updates.length}, skipped=${skipped.length}`)
  console.log(`Sin datos FBref: ${entries.length - totalMatched}`)

  if (VERBOSE) {
    const matched = new Set([...updates, ...skipped].map(u => u.entryId))
    const unm = entries.filter(e => !matched.has(e.id))
    if (unm.length > 0) {
      console.log('\nNo matcheadas (primeras 40):', unm.slice(0, 40).map(e => `${e.name} [${e.category}]`).join(', '))
    }
  }

  if (!APPLY) {
    console.log('\nDRY RUN. Pasa --apply para escribir en Supabase.')
    return
  }

  console.log('\nWriting to Supabase...')
  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb
      .from('ranking_entries')
      .update({ rendimiento_auto: u.newScore })
      .eq('id', u.entryId)
      .eq('category', u.category)
    if (err) { fail++; console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
