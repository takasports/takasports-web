#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-f1-dpc.mjs
//
// Mejora el factor `rendimiento_auto` de los pilotos de F1 usando
// el Driver Performance Coefficient (DPC): puntos del piloto vs
// puntos de su compañero de equipo en el mismo coche.
//
// DPC = puntos_piloto / (puntos_piloto + puntos_compañero)
//   0.50 = igualados → coche compartido
//   0.70 = domina al compañero → mérito propio
//   0.30 = es dominado → mérito menor
//
// Score final: 65% puntos absolutos relativos + 35% DPC
// (un piloto en Haas con DPC 0.9 sigue siendo peor que líder de
// Mercedes con DPC 0.55 — los puntos siguen mandando).
//
// Fuente: https://api.jolpi.ca/ergast/f1/2026/driverStandings.json
// IDs DB: f1-{driverId}
//
// Uso:
//   node scripts/ingest-f1-dpc.mjs              # DRY RUN
//   node scripts/ingest-f1-dpc.mjs --apply      # Escribe
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE keys in .env.local')
  process.exit(1)
}

const YEAR = new Date().getFullYear()
const URL_STANDINGS  = `https://api.jolpi.ca/ergast/f1/${YEAR}/driverStandings.json`

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN'} · Season ${YEAR}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('Fetching Jolpica F1 standings...')
  const r = await fetch(URL_STANDINGS)
  if (!r.ok) throw new Error(`Jolpica ${r.status}`)
  const data = await r.json()
  const standings = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []
  if (standings.length === 0) throw new Error('No standings — temporada no iniciada?')
  console.log(`  ${standings.length} pilotos`)

  // Index by constructor
  const byTeam = new Map()
  const drivers = []
  for (const s of standings) {
    const team = s.Constructors?.[0]?.constructorId ?? 'unknown'
    const d = {
      id: `f1-${s.Driver.driverId}`,
      name: `${s.Driver.givenName} ${s.Driver.familyName}`,
      points: Number(s.points) || 0,
      wins:   Number(s.wins) || 0,
      position: Number(s.position) || 99,
      team,
      teamName: s.Constructors?.[0]?.name ?? team,
    }
    drivers.push(d)
    if (!byTeam.has(team)) byTeam.set(team, [])
    byTeam.get(team).push(d)
  }

  // Calculate DPC per driver
  for (const [team, ds] of byTeam) {
    const total = ds.reduce((a, b) => a + b.points, 0)
    for (const d of ds) {
      // Si todo el equipo tiene 0 puntos, DPC neutro 0.5
      d.dpc = total > 0 ? d.points / total : 0.5
      d.teammate = ds.find(x => x.id !== d.id)?.name ?? '(solo)'
    }
  }

  // Compute rendimiento score
  const maxPoints = Math.max(...drivers.map(d => d.points), 1)
  for (const d of drivers) {
    // Puntos: 60-100 según fracción del líder
    const pointsScore = 60 + (d.points / maxPoints) * 40
    // DPC: 0.5→82, 0.7→92, 0.9→100, 0.3→72
    const dpcScore = 82 + (d.dpc - 0.5) * 50
    // Boost por wins (cada victoria suma +2, max +10)
    const winsBoost = Math.min(10, d.wins * 2)
    d.rendimiento = Math.round(Math.min(100, Math.max(0,
      pointsScore * 0.65 + dpcScore * 0.30 + winsBoost * 0.05 * 100 / 10
    )) * 10) / 10
  }

  // Sort by rendimiento desc to display
  drivers.sort((a, b) => b.rendimiento - a.rendimiento)

  console.log(`\n--- F1 ${YEAR} Driver Performance ---`)
  console.log('  Pos  Driver                  Team           Points  DPC   Rendimiento  vs Teammate')
  for (const d of drivers) {
    console.log(
      `  ${String(d.position).padStart(3)}  ${d.name.padEnd(22)} ${d.teamName.padEnd(14)} ` +
      `${String(d.points).padStart(6)}  ${d.dpc.toFixed(2)}  ${d.rendimiento.toFixed(1).padStart(6)}` +
      `       (${d.teammate})`
    )
  }

  // Match with DB
  console.log('\nLoading DB F1 entries...')
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, rendimiento_auto')
    .eq('sport', 'formula1')
    .in('category', ['jugadores'])
  if (error) throw error
  console.log(`  Found ${entries.length} F1 entries in DB`)

  const byId = new Map(entries.map(e => [e.id, e]))
  const updates = []
  const unmatched = []
  for (const d of drivers) {
    const e = byId.get(d.id)
    if (!e) { unmatched.push(d.id); continue }
    const prev = e.rendimiento_auto !== null ? Number(e.rendimiento_auto) : null
    updates.push({ id: e.id, category: e.category, name: d.name, prev, newScore: d.rendimiento })
  }
  console.log(`\nMatched: ${updates.length}, Unmatched IDs: ${unmatched.length}`)
  if (VERBOSE && unmatched.length > 0) {
    console.log('Unmatched:', unmatched.join(', '))
  }

  if (!APPLY) {
    console.log(`\nDRY RUN. Pasa --apply para escribir.`)
    return
  }

  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb
      .from('ranking_entries')
      .update({ rendimiento_auto: u.newScore })
      .eq('id', u.id)
      .eq('category', u.category)
    if (err) { fail++; console.error(`FAIL ${u.id}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
