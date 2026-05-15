#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-tennis-context.mjs
//
// Actualiza `contexto_auto` de los jugadores de tenis usando
// el ranking oficial ATP/WTA de tennisabstract.com (misma fuente
// que el Elo de rendimiento — ya tenemos el HTML parseado).
//
// Escala ranking → contexto:
//   1-5:    92  (dominadores absolutos)
//   6-15:   85
//   16-30:  78
//   31-50:  71
//   51-100: 63
//   101-200: 54
//   >200:   46
//
// Uso:
//   node scripts/ingest-tennis-context.mjs           # DRY RUN
//   node scripts/ingest-tennis-context.mjs --apply
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

const ATP_URL = 'https://tennisabstract.com/reports/atp_elo_ratings.html'
const WTA_URL = 'https://tennisabstract.com/reports/wta_elo_ratings.html'
const USER_AGENT = 'takasports-rankings/1.0 (+https://takasportsmedia.com)'
const TOP_N = 250

function rankToScore(rank) {
  if (rank <= 5)   return 92
  if (rank <= 15)  return 85
  if (rank <= 30)  return 78
  if (rank <= 50)  return 71
  if (rank <= 100) return 63
  if (rank <= 200) return 54
  return 46
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

// Mismo parser que ingest-tennis-elo.mjs: rank + name de la tabla HTML
function parseRankings(html) {
  const rows = []
  const re = /<tr><td[^>]*>(\d+)<\/td><td><a[^>]+>([^<]+)<\/a>/g
  let m
  while ((m = re.exec(html)) !== null && rows.length < TOP_N) {
    const rank = parseInt(m[1])
    const name = m[2].replace(/&nbsp;/g, ' ').trim()
    rows.push({ rank, name })
  }
  return rows
}

async function fetchRankings(url) {
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const html = await r.text()
  return parseRankings(html)
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading DB tennis entries...')
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, contexto_auto')
    .eq('sport', 'tenis')
  if (error) throw error
  console.log(`  ${entries.length} entradas tenis`)

  const byNorm = new Map()
  for (const e of entries) {
    const key = normalize(e.name)
    if (!byNorm.has(key)) byNorm.set(key, [])
    byNorm.get(key).push(e)
  }

  console.log('\nFetching ATP/WTA rankings...')
  const [atp, wta] = await Promise.all([
    fetchRankings(ATP_URL).catch(err => { console.error('ATP error:', err.message); return [] }),
    fetchRankings(WTA_URL).catch(err => { console.error('WTA error:', err.message); return [] }),
  ])
  console.log(`  ATP top-${atp.length}, WTA top-${wta.length}`)

  const updates = []
  for (const { rank, name } of [...atp, ...wta]) {
    const key = normalize(name)
    const matched = byNorm.get(key) ?? []
    for (const e of matched) {
      if (updates.some(u => u.entryId === e.id)) continue
      const newScore = rankToScore(rank)
      updates.push({
        entryId: e.id, category: e.category, name: e.name,
        rankName: name, rank, newScore,
        prev: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
      })
    }
  }

  updates.sort((a, b) => a.rank - b.rank)

  console.log(`\n--- Tenis contexto (top 20) ---`)
  updates.slice(0, 20).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    console.log(`  rank=${String(u.rank).padStart(4)}  ${u.rankName.padEnd(28)}  ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})`)
  })

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
