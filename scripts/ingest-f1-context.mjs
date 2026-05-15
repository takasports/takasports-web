#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-f1-context.mjs
//
// Actualiza `contexto_auto` de los pilotos de F1 basándose en
// la posición del equipo en el Campeonato de Constructores.
//
// Un piloto hereda el contexto de su constructor:
//   Constructores #1: 96   (equipo dominante)
//   Constructores #2: 91
//   Constructores #3: 85
//   Constructores #4: 79
//   Constructores #5: 73
//   Constructores #6: 67
//   Constructores #7-10: 62-55
//
// Fuente: ESPN F1 standings API (gratuita, sin auth)
//
// Uso:
//   node scripts/ingest-f1-context.mjs           # DRY RUN
//   node scripts/ingest-f1-context.mjs --apply
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

const F1_STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports/racing/f1/standings'

function constructorRankToScore(rank) {
  const scale = [96, 91, 85, 79, 73, 67, 62, 59, 56, 53]
  return scale[Math.min(rank - 1, scale.length - 1)]
}

function driverRankToScore(rank) {
  if (rank <= 3)  return 94 - (rank - 1) * 3  // 94, 91, 88
  if (rank <= 6)  return 82 - (rank - 4) * 3  // 82, 79, 76
  if (rank <= 10) return 72 - (rank - 7) * 2  // 72, 70, 68, 66
  return Math.max(52, 64 - (rank - 11) * 1.5)
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

async function fetchF1Standings() {
  const r = await fetch(F1_STANDINGS_URL)
  if (!r.ok) throw new Error(`ESPN F1 standings HTTP ${r.status}`)
  const d = await r.json()

  const drivers = new Map()     // normalizedName → rank
  const constructors = new Map() // normalizedName → rank
  // pilot → constructorName (for fallback matching)
  const pilotToConstructor = new Map()

  for (const child of d.children ?? []) {
    const isDrivers = child.name?.toLowerCase().includes('driver')
    for (const e of child.standings?.entries ?? []) {
      const name = (e.athlete ?? e.team)?.displayName ?? ''
      const stats = Object.fromEntries((e.stats ?? []).map(s => [s.name, Number(s.value) || 0]))
      const rank = stats.rank || 0
      if (!name || !rank) continue
      if (isDrivers) {
        drivers.set(normalize(name), rank)
        // Store constructor name too if available
        if (e.team?.displayName) pilotToConstructor.set(normalize(name), normalize(e.team.displayName))
      } else {
        constructors.set(normalize(name), rank)
      }
    }
  }
  return { drivers, constructors, pilotToConstructor }
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading DB F1 entries (jugadores)...')
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, contexto_auto')
    .eq('sport', 'formula1')
    .not('category', 'in', '("creadores","periodistas","clubes")')
  if (error) throw error
  console.log(`  ${entries.length} pilotos`)

  console.log('\nFetching ESPN F1 standings...')
  const { drivers, constructors, pilotToConstructor } = await fetchF1Standings()
  console.log(`  Constructores: ${constructors.size} equipos | Drivers: ${drivers.size} pilotos`)

  if (VERBOSE) {
    console.log('  Drivers:', [...drivers.entries()].map(([n,r]) => `${r}.${n}`).join(', '))
    console.log('  Constructors:', [...constructors.entries()].map(([n,r]) => `${r}.${n}`).join(', '))
  }

  const updates = []
  for (const e of entries) {
    const key = normalize(e.name)
    // Try driver ranking directly
    const driverRank = drivers.get(key)
    if (driverRank) {
      updates.push({
        entryId: e.id, category: e.category, name: e.name,
        rank: driverRank, source: 'driver',
        newScore: driverRankToScore(driverRank),
        prev: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
      })
      continue
    }

    // Partial name match: try first+last token
    const tokens = e.name.toLowerCase().split(/\s+/).filter(Boolean)
    let matched = null
    for (const [dKey, dRank] of drivers) {
      const match = tokens.some(t => t.length >= 4 && dKey.includes(normalize(t)))
      if (match) { matched = { rank: dRank, source: 'driver_partial' }; break }
    }
    if (matched) {
      updates.push({
        entryId: e.id, category: e.category, name: e.name,
        rank: matched.rank, source: matched.source,
        newScore: driverRankToScore(matched.rank),
        prev: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
      })
      continue
    }

    // Fallback: use constructor rank via team name in entry ID
    const idLower = e.id.toLowerCase()
    for (const [cKey, cRank] of constructors) {
      if (idLower.includes(cKey) || cKey.split(/\s+/).some(w => w.length >= 4 && idLower.includes(w))) {
        updates.push({
          entryId: e.id, category: e.category, name: e.name,
          rank: cRank, source: 'constructor_id',
          newScore: constructorRankToScore(cRank),
          prev: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
        })
        break
      }
    }
  }

  updates.sort((a, b) => b.newScore - a.newScore)

  console.log(`\n--- F1 contexto (${updates.length} matched) ---`)
  updates.forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    console.log(`  #${String(u.rank).padStart(2)} [${u.source}]  ${u.name.padEnd(28)}  ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})`)
  })

  if (VERBOSE) {
    const matched = new Set(updates.map(u => u.entryId))
    console.log('Sin match:', entries.filter(e => !matched.has(e.id)).map(e => e.name).join(', '))
  }

  console.log(`\nMatched: ${updates.length} / ${entries.length}`)
  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ contexto_auto: u.newScore })
      .eq('id', u.entryId).eq('category', u.category)
    if (err) { fail++; console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
