#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// fix-score-auto-bulk.mjs
//
// One-time backfill: recalcula score_auto para todas las entradas
// cuyo valor no coincide con la fórmula v6.
//
// Usa actualización directa de score_auto (no toca factor columns),
// lo que es equivalente a lo que haría el trigger en cada UPDATE.
//
// Uso:
//   node scripts/fix-score-auto-bulk.mjs           # DRY RUN
//   node scripts/fix-score-auto-bulk.mjs --apply
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

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

function computeScore(e) {
  return Math.round((
    (e.rendimiento_auto ?? 50) * 0.40 +
    (e.contexto_auto    ?? 50) * 0.20 +
    (e.mediatico_auto   ?? 50) * 0.25 +
    (e.narrativa_auto   ?? 50) * 0.15 +
    (e.editorial_boost  ??  0)
  ) * 10) / 10
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  let page = 0, stale = [], total = 0
  console.log('Scanning entries...')
  while (true) {
    const { data, error } = await sb.from('ranking_entries')
      .select('id, category, rendimiento_auto, contexto_auto, mediatico_auto, narrativa_auto, editorial_boost, score_auto')
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) throw error
    if (!data?.length) break
    total += data.length
    for (const e of data) {
      const expected = computeScore(e)
      if (Math.abs((e.score_auto ?? 0) - expected) >= 0.2) {
        stale.push({ id: e.id, category: e.category, expected, current: e.score_auto })
      }
    }
    if (page % 5 === 0) process.stdout.write(`  ${total} escaneados, ${stale.length} stale...\r`)
    if (data.length < 1000) break
    page++
  }
  console.log(`\nTotal: ${total} | Stale: ${stale.length} | Up-to-date: ${total - stale.length}`)

  if (stale.length === 0) { console.log('Nada que actualizar.'); return }

  // Sample
  console.log('\nEjemplos de cambio:')
  stale.slice(0, 10).forEach(e =>
    console.log(`  ${e.id} · ${(e.current ?? 0).toFixed(1)} → ${e.expected.toFixed(1)} (Δ${(e.expected - (e.current ?? 0)).toFixed(1)})`)
  )

  if (!APPLY) { console.log(`\nDRY RUN. ${stale.length} updates pendientes.`); return }

  let ok = 0, fail = 0
  for (const u of stale) {
    const { error } = await sb.from('ranking_entries')
      .update({ score_auto: u.expected })
      .eq('id', u.id).eq('category', u.category)
    if (error) { fail++; console.error(`FAIL ${u.id}: ${error.message}`) } else ok++
    if ((ok + fail) % 500 === 0) console.log(`  ${ok + fail}/${stale.length}...`)
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
