#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// apply-score-caps.mjs
//
// Techo COMÚN entre deportes para rendimiento y contexto.
//
// ── POR QUÉ ──────────────────────────────────────────────────────
// Cada ingest calibra su deporte por separado y con topes distintos:
// tenis y F1 llegaban a 100 (nº1 del ranking / líder del Mundial),
// NBA a 99, fútbol a 99. Eso no compara talento, compara ESCALAS: el
// líder del Mundial de F1 superaba a Haaland sin que ninguno de los
// dos hubiera hecho nada, solo porque su deporte tenía más techo.
//
// Se aplica DESPUÉS de todos los ingests de factores, así que vale
// también para los que se añadan en el futuro sin acordarse del tope.
// Comprime solo la punta: preserva el orden dentro de cada deporte y
// deja que el desempate entre líderes lo decidan mediático y forma.
//
//   rendimiento_auto ≤ 96
//   contexto_auto    ≤ 95
//
// Uso:
//   node scripts/apply-score-caps.mjs           # DRY RUN
//   node scripts/apply-score-caps.mjs --apply
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

const REND_CAP = 96
const CTX_CAP  = 95

// Creadores tienen su propia fórmula (audiencia/crecimiento/relevancia): sus
// factores no son comparables con los de un deportista.
const SKIP_CATEGORIES = ['creadores', 'creadores_wwe']

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Techos: rendimiento ≤ ${REND_CAP} · contexto ≤ ${CTX_CAP}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, sport, rendimiento_auto, contexto_auto')
    .eq('active', true)
    .not('category', 'in', `(${SKIP_CATEGORIES.map(c => `"${c}"`).join(',')})`)
    .or(`rendimiento_auto.gt.${REND_CAP},contexto_auto.gt.${CTX_CAP}`)
  if (error) throw error

  console.log(`\n${data.length} entradas por encima del techo`)
  const bySport = {}
  for (const e of data) bySport[e.sport ?? '?'] = (bySport[e.sport ?? '?'] ?? 0) + 1
  for (const [s, n] of Object.entries(bySport).sort()) console.log(`  ${n.toString().padStart(4)}  ${s}`)

  for (const e of data.slice(0, 20)) {
    const r = Number(e.rendimiento_auto), c = Number(e.contexto_auto)
    console.log(`  ${e.name.padEnd(26)} [${(e.sport ?? '?').padEnd(10)}] rend ${r > REND_CAP ? `${r}→${REND_CAP}` : r} · ctx ${c > CTX_CAP ? `${c}→${CTX_CAP}` : c}`)
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const e of data) {
    const update = {}
    if (Number(e.rendimiento_auto) > REND_CAP) update.rendimiento_auto = REND_CAP
    if (Number(e.contexto_auto)    > CTX_CAP)  update.contexto_auto    = CTX_CAP
    const { error: err } = await sb.from('ranking_entries')
      .update(update)
      .eq('id', e.id).eq('category', e.category)   // la PK es (id, category)
    if (err) { fail++; console.error(`FAIL ${e.id}/${e.category}: ${err.message}`) } else ok++
  }
  console.log(`\nDone. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
