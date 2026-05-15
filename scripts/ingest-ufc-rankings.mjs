#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-ufc-rankings.mjs
//
// Actualiza `rendimiento_auto` y `contexto_auto` de luchadores UFC
// a partir de los rankings oficiales de ufc.com/rankings.
//
// Escala rendimiento (basado en posición en ranking de división):
//   Campeón:    95
//   P4P #1-3:   92-88
//   División #1-3:  85-78
//   División #4-7:  72-64
//   División #8-15: 60-50
//   No rankeado: 45
//
// Escala contexto (mismo ranking, distinta escala):
//   Campeón:    95
//   División #1-5:  85-73
//   División #6-10: 70-60
//   División #11-15: 57-50
//   No rankeado: 52
//
// Uso:
//   node scripts/ingest-ufc-rankings.mjs           # DRY RUN
//   node scripts/ingest-ufc-rankings.mjs --apply
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

const URL_RANKINGS = 'https://www.ufc.com/rankings'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

function rankToRendimiento(rank, isChamp, isP4P) {
  if (isChamp) return 95
  if (isP4P) {
    if (rank <= 3) return 94 - (rank - 1) * 2  // 94, 92, 90
    if (rank <= 7) return 86 - (rank - 4) * 2  // 86, 84, 82, 80
    if (rank <= 15) return 76 - (rank - 8)     // 76..69
    return 65
  }
  if (rank <= 3) return 85 - (rank - 1) * 3.5  // 85, 81.5, 78
  if (rank <= 7) return 74 - (rank - 4) * 2    // 74, 72, 70, 68
  if (rank <= 15) return 64 - (rank - 8)       // 64..57
  return 48
}

function rankToContexto(rank, isChamp) {
  if (isChamp) return 95
  if (rank <= 5) return 87 - (rank - 1) * 3   // 87, 84, 81, 78, 75
  if (rank <= 10) return 72 - (rank - 6) * 2  // 72, 70, 68, 66, 64
  if (rank <= 15) return 60 - (rank - 11)     // 60..56
  return 52
}

function decodeEntities(s) {
  return s.replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
}

function parseUfcRankings(html) {
  const segments = html.split('<div class="view-grouping-header">').slice(1)
  const divisions = []
  for (const seg of segments) {
    const nameMatch = seg.match(/^\s*([^<]+)</)
    if (!nameMatch) continue
    const name = decodeEntities(nameMatch[1].trim())
    const champMatch = seg.match(/<h5[^>]*>\s*<a [^>]*>([^<]+)<\/a>/)
    const champion = champMatch ? decodeEntities(champMatch[1].trim()) : null
    const rowRe = /<td class="views-field views-field-weight-class-rank">\s*(\d+)\s*<\/td>\s*<td class="views-field views-field-title">\s*<a [^>]*>([^<]+)<\/a>/g
    const contenders = []
    let m
    while ((m = rowRe.exec(seg)) !== null) {
      contenders.push({ rank: parseInt(m[1]), name: decodeEntities(m[2].trim()) })
      if (contenders.length >= 15) break
    }
    divisions.push({ name, champion, contenders })
  }
  return divisions
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading DB UFC entries...')
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, rendimiento_auto, contexto_auto')
    .eq('sport', 'ufc')
    .not('category', 'in', '("creadores")')
  if (error) throw error
  console.log(`  ${entries.length} luchadores/as UFC`)

  const byNorm = new Map()
  for (const e of entries) {
    const key = normalize(e.name)
    if (!byNorm.has(key)) byNorm.set(key, [])
    byNorm.get(key).push(e)
  }

  console.log('\nFetching ufc.com/rankings...')
  const r = await fetch(URL_RANKINGS, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`ufc.com HTTP ${r.status}`)
  const html = await r.text()
  const divisions = parseUfcRankings(html)
  console.log(`  ${divisions.length} divisiones parseadas`)

  const bestByEntry = new Map()

  for (const div of divisions) {
    const isP4P = div.name.toLowerCase().includes('pound-for-pound')

    // Champion
    if (div.champion) {
      const key = normalize(div.champion)
      const matched = byNorm.get(key) ?? []
      for (const e of matched) {
        if (!bestByEntry.has(e.id) || bestByEntry.get(e.id).rendimiento < rankToRendimiento(0, true, false)) {
          bestByEntry.set(e.id, {
            entryId: e.id, category: e.category, name: e.name,
            division: div.name, rank: 0, isChamp: true,
            newRendimiento: rankToRendimiento(0, true, false),
            newContexto: rankToContexto(0, true),
            prevR: e.rendimiento_auto !== null ? Number(e.rendimiento_auto) : null,
            prevC: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
          })
        }
      }
    }

    // Contenders
    for (const c of div.contenders) {
      const key = normalize(c.name)
      const matched = byNorm.get(key) ?? []
      for (const e of matched) {
        const newR = rankToRendimiento(c.rank, false, isP4P)
        const existing = bestByEntry.get(e.id)
        if (!existing || existing.newRendimiento < newR) {
          bestByEntry.set(e.id, {
            entryId: e.id, category: e.category, name: e.name,
            division: div.name, rank: c.rank, isChamp: false,
            newRendimiento: newR,
            newContexto: rankToContexto(c.rank, false),
            prevR: e.rendimiento_auto !== null ? Number(e.rendimiento_auto) : null,
            prevC: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
          })
        }
      }
    }
  }

  const updates = [...bestByEntry.values()].sort((a, b) => b.newRendimiento - a.newRendimiento)

  console.log(`\n--- UFC rankings (${updates.length} matched) ---`)
  updates.forEach(u => {
    const pr = u.prevR !== null ? u.prevR.toFixed(1).padStart(5) : '    -'
    const pc = u.prevC !== null ? u.prevC.toFixed(1).padStart(5) : '    -'
    const label = u.isChamp ? 'CHAMP' : `  #${u.rank}`
    console.log(`  ${label.padEnd(6)}  ${u.name.padEnd(28)}  rend: ${pr}→${String(u.newRendimiento).padStart(4)}  ctx: ${pc}→${String(u.newContexto).padStart(4)}  [${u.division}]`)
  })

  console.log(`\nMatched: ${updates.length} / ${entries.length}`)

  if (VERBOSE) {
    const matched = new Set(updates.map(u => u.entryId))
    console.log('Sin match:', entries.filter(e => !matched.has(e.id)).map(e => e.name).join(', '))
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ rendimiento_auto: u.newRendimiento, contexto_auto: u.newContexto })
      .eq('id', u.entryId).eq('category', u.category)
    if (err) { fail++; console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
