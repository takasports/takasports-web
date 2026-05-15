#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-nba-per.mjs
//
// Mejora el factor `rendimiento_auto` de los jugadores NBA usando
// el PER (Player Efficiency Rating) de ESPN — métrica avanzada
// que pondera todo (tiros, rebotes, asistencias, turnovers, defensa)
// ajustado por minutos. Sustituye al PPG crudo que infla scorers
// de volumen sin tener en cuenta eficiencia.
//
// Fuente: ESPN Core API
//   /v2/sports/basketball/leagues/nba/seasons/{YEAR}/types/2/leaders
//   Categoría "PER" (ya documentada, pública, sin auth).
//
// IDs DB: espn-nba-{athleteId}
//
// Uso:
//   node scripts/ingest-nba-per.mjs              # DRY RUN
//   node scripts/ingest-nba-per.mjs --apply
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

// Temporada NBA: si estamos en oct-jun, es la temporada que cierra el año actual;
// jul-sep es offseason → usar año actual igualmente (devuelve última temporada).
const YEAR = new Date().getFullYear()
const URL_PER = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${YEAR}/types/2/leaders?lang=en`

// PER → score 0-100
//   PER 30+   → 99  (MVP-tier, Jokic / SGA / Wemby)
//   PER 25    → 90
//   PER 22    → 85  (All-Star)
//   PER 18    → 78  (starter sólido)
//   PER 15    → 70  (rotación)
//   PER 12    → 60  (role player)
//   PER < 10  → 50
function perToScore(per) {
  let s
  if (per >= 30)      s = 95 + Math.min(4, (per - 30))
  else if (per >= 25) s = 88 + (per - 25) / 5 * 7
  else if (per >= 22) s = 83 + (per - 22) / 3 * 5
  else if (per >= 18) s = 76 + (per - 18) / 4 * 7
  else if (per >= 15) s = 68 + (per - 15) / 3 * 8
  else if (per >= 12) s = 58 + (per - 12) / 3 * 10
  else                s = Math.max(40, 58 - (12 - per) * 2)
  return Math.round(Math.min(100, Math.max(0, s)) * 10) / 10
}

function extractIdFromRef(ref) {
  const m = /athletes\/(\d+)/.exec(ref ?? '')
  return m ? m[1] : null
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} · Season ${YEAR}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('Fetching ESPN PER + minutesPerGame leaders...')
  const r = await fetch(URL_PER)
  if (!r.ok) throw new Error(`ESPN ${r.status}`)
  const data = await r.json()
  const cats = data?.categories ?? []
  const perCat = cats.find(c => c.name === 'PER' || c.abbreviation === 'PER')
  const mpgCat = cats.find(c => c.name === 'minutesPerGame' || c.abbreviation === 'MPG')
  if (!perCat) throw new Error('PER category not found')

  // Index MPG by athlete ID — solo titulares reales (MPG >= 25)
  const mpgById = new Map()
  for (const l of mpgCat?.leaders ?? []) {
    const id = extractIdFromRef(l.athlete?.$ref)
    if (id) mpgById.set(id, Number(l.value))
  }

  const leadersAll = (perCat.leaders ?? []).map(l => ({
    per: Number(l.value),
    espnId: extractIdFromRef(l.athlete?.$ref),
    mpg: mpgById.get(extractIdFromRef(l.athlete?.$ref)) ?? null,
  })).filter(l => l.espnId && Number.isFinite(l.per))
  console.log(`  ${leadersAll.length} jugadores con PER (MPG conocido: ${leadersAll.filter(l => l.mpg !== null).length})`)

  // Load DB entries
  console.log('Loading DB NBA entries...')
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, rendimiento_auto')
    .eq('sport', 'baloncesto')
    .eq('category', 'jugadores')
  if (error) throw error
  console.log(`  ${entries.length} entries de baloncesto`)

  const byId = new Map(entries.map(e => [e.id, e]))

  // Heurística anti-outlier: aceptar si MPG>=25 (titular)
  // OR si rend_auto previo >= 65 (jugador con historial relevante).
  // Esto filtra a Tristen Newton (PER 32 con MPG bajo, prev=60)
  // pero conserva a Giannis (PER 32, prev=75) y Wembanyama (prev=76).
  const MIN_MPG = 25
  const MIN_PREV_REND = 65

  const updates = []
  const unmatched = []
  const skipped = []
  for (const l of leadersAll) {
    const dbId = `espn-nba-${l.espnId}`
    const e = byId.get(dbId)
    if (!e) { unmatched.push(dbId); continue }
    const prev = e.rendimiento_auto !== null ? Number(e.rendimiento_auto) : null
    const isStarter = l.mpg !== null && l.mpg >= MIN_MPG
    const isKnown = prev !== null && prev >= MIN_PREV_REND
    if (!isStarter && !isKnown) {
      skipped.push({ name: e.name, per: l.per, mpg: l.mpg, prev })
      continue
    }
    const newScore = perToScore(l.per)
    updates.push({
      id: e.id, category: e.category, name: e.name,
      per: l.per, prev, newScore, delta: prev !== null ? newScore - prev : null,
    })
  }
  if (skipped.length > 0) {
    console.log(`\nSkipped (PER alto con poco minutaje y sin historial relevante):`)
    skipped.forEach(s => console.log(`  ${s.name.padEnd(28)} PER=${s.per.toFixed(1)} MPG=${s.mpg ?? '?'} prev=${s.prev ?? '?'}`))
  }

  // Sort by PER desc para display
  updates.sort((a, b) => b.per - a.per)

  console.log(`\n--- Top 20 NBA por PER ---`)
  updates.slice(0, 20).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const sign = u.delta !== null && u.delta >= 0 ? '+' : ''
    const dlt = u.delta !== null ? `${sign}${u.delta.toFixed(1)}` : 'NEW'
    console.log(`  PER=${u.per.toFixed(1).padStart(5)} ${u.name.padEnd(28)} rend: ${prev} -> ${u.newScore.toFixed(1).padStart(5)} (${dlt})`)
  })

  console.log(`\nMatched: ${updates.length}, Unmatched: ${unmatched.length}`)
  if (VERBOSE && unmatched.length > 0) console.log('  Unmatched:', unmatched.slice(0, 20).join(', '))

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
