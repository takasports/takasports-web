#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-tennis-elo.mjs
//
// Mejora el factor `rendimiento_auto` de los jugadores y jugadoras de
// tenis usando los Elo ratings de tennisabstract.com (más precisos que
// el ranking ATP/WTA oficial: dan crédito por *contra quién* ganas, no
// solo por la ronda alcanzada).
//
// Fuente: https://tennisabstract.com/reports/{atp,wta}_elo_ratings.html
//   - Pública, sin auth, sin coste.
//   - Actualizada semanalmente (campo `Last-Modified` indica fecha real).
//
// Uso:
//   node scripts/ingest-tennis-elo.mjs            # DRY RUN: muestra cambios
//   node scripts/ingest-tennis-elo.mjs --apply    # Escribe a ranking_entries
//
// Integración con cron (recomendado): añadir como último paso de WF-11 en
// n8n, justo después del ingest-tennis original. El orden importa: este
// script SOBREESCRIBE rendimiento_auto, así que si va antes que el ingest
// oficial, sus valores se pisan.
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
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const ATP_URL = 'https://tennisabstract.com/reports/atp_elo_ratings.html'
const WTA_URL = 'https://tennisabstract.com/reports/wta_elo_ratings.html'

const USER_AGENT = 'takasports-rankings/1.0 (+https://takasportsmedia.com)'
const TOP_N = 150

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
          .toLowerCase().replace(/[^a-z]/g, '')
}

// Parser de la tabla HTML. Las filas tienen forma:
//   <tr><td align="right">RANK</td><td><a ...>Name&nbsp;Surname</a></td>
//        <td align="right">AGE</td><td align="right">ELO</td>...
// Capturamos rank + name + elo del overall.
function parseEloTable(html) {
  const rows = []
  const re = /<tr><td[^>]*>(\d+)<\/td><td><a[^>]+>([^<]+)<\/a><\/td><td[^>]*>[\d.]+<\/td><td[^>]*>([\d.]+)<\/td>/g
  let m
  while ((m = re.exec(html))) {
    const rank = parseInt(m[1], 10)
    const name = m[2].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    const elo  = parseFloat(m[3])
    if (Number.isFinite(elo) && elo > 1000) rows.push({ rank, name, elo })
  }
  return rows
}

// Elo → rendimiento_auto (0-100) con curva ajustada.
//   Top mundial (Sinner ~2330) → 99
//   Top 10 (~2000-2100)        → 88-93
//   Top 50 (~1850-1950)        → 78-86
//   Top 100 (~1750-1830)       → 70-76
//   Resto                      → degrada suave
function eloToScore(elo) {
  let s
  if (elo >= 2300) s = 99
  else if (elo >= 2000) s = 88 + (elo - 2000) / 300 * 11
  else if (elo >= 1850) s = 78 + (elo - 1850) / 150 * 10
  else if (elo >= 1700) s = 65 + (elo - 1700) / 150 * 13
  else s = Math.max(40, 65 - (1700 - elo) / 15)
  return Math.round(Math.min(100, Math.max(0, s)) * 10) / 10
}

async function fetchHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) throw new Error(`${url}: ${r.status} ${r.statusText}`)
  return r.text()
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('Fetching Elo data...')
  const [atpHtml, wtaHtml] = await Promise.all([fetchHtml(ATP_URL), fetchHtml(WTA_URL)])
  const atp = parseEloTable(atpHtml).slice(0, TOP_N)
  const wta = parseEloTable(wtaHtml).slice(0, TOP_N)
  console.log(`Parsed ATP=${atp.length}, WTA=${wta.length}`)
  if (atp.length === 0 || wta.length === 0) {
    console.error('Failed to parse Elo tables — fuente probablemente cambió de formato.')
    process.exit(1)
  }
  console.log('  Top 3 ATP:', atp.slice(0, 3).map(p => `${p.rank}. ${p.name} (Elo ${p.elo})`).join(' | '))
  console.log('  Top 3 WTA:', wta.slice(0, 3).map(p => `${p.rank}. ${p.name} (Elo ${p.elo})`).join(' | '))

  console.log('Loading DB tennis entries...')
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, sport, rendimiento_auto')
    .eq('sport', 'tenis')
    .in('category', ['jugadores', 'jugadoras'])
  if (error) throw error
  console.log(`  Found ${entries.length} tennis entries in DB`)

  const byName = new Map()
  for (const e of entries) byName.set(normalize(e.name), e)

  const updates = []
  const unmatched = []
  for (const tour of [{ data: atp, label: 'atp' }, { data: wta, label: 'wta' }]) {
    for (const p of tour.data) {
      const e = byName.get(normalize(p.name))
      if (!e) { unmatched.push(`[${tour.label}] ${p.name}`); continue }
      const newScore = eloToScore(p.elo)
      const prev = e.rendimiento_auto !== null ? Number(e.rendimiento_auto) : null
      const delta = prev !== null ? newScore - prev : null
      updates.push({
        id: e.id, category: e.category, name: e.name,
        elo: p.elo, prev, newScore, delta, tour: tour.label,
      })
    }
  }

  // Orden por delta absoluto descendente para mostrar los mayores cambios
  updates.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))

  console.log(`\n--- Summary ---`)
  console.log(`  Matched: ${updates.length}`)
  console.log(`  Unmatched (in Elo but not in DB): ${unmatched.length}`)

  console.log(`\n--- Top 20 biggest changes (rend_auto delta) ---`)
  updates.slice(0, 20).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1) : '  -'
    const sign = u.delta !== null && u.delta >= 0 ? '+' : ''
    const deltaStr = u.delta !== null ? `${sign}${u.delta.toFixed(1)}` : 'NEW'
    console.log(`  [${u.tour}] ${u.name.padEnd(28)} Elo=${u.elo.toFixed(1).padStart(7)}  rend: ${prev.padStart(5)} -> ${u.newScore.toFixed(1).padStart(5)} (${deltaStr})`)
  })

  if (VERBOSE && unmatched.length > 0) {
    console.log(`\n--- Unmatched (probable name spelling diff) ---`)
    unmatched.slice(0, 30).forEach(n => console.log(`  ${n}`))
  }

  if (!APPLY) {
    console.log(`\nDRY RUN. Pasa --apply para escribir ${updates.length} updates en ranking_entries.`)
    return
  }

  console.log(`\nApplying ${updates.length} updates...`)
  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb
      .from('ranking_entries')
      .update({ rendimiento_auto: u.newScore })
      .eq('id', u.id)
      .eq('category', u.category)
    if (err) { fail++; console.error(`  FAIL ${u.id}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
