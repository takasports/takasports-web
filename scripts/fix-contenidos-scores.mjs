#!/usr/bin/env node
// fix-contenidos-scores.mjs
//
// Fija rendimiento_auto y contexto_auto para los 28 creadores/periodistas
// que los tienen en NULL (bloquea score=null en ranking_view).
//
// Estrategia para creadores de contenido:
//   rendimiento_auto = round(mediatico_auto × 0.65 + narrativa_auto × 0.35)
//     → proxy de "desempeño del canal": alcance ponderado por calidad narrativa
//   contexto_auto por deporte:
//     futbol: 68  (demanda constante)
//     ufc:    72  (boom Topuria / crecimiento UFC LATAM)
//     wwe:    70  (resurgimiento WWE bajo TKO)
//
// Uso:
//   node scripts/fix-contenidos-scores.mjs           # DRY RUN
//   node scripts/fix-contenidos-scores.mjs --apply

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY = process.argv.includes('--apply')
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const CONTEXTO_BY_SPORT = { futbol: 68, ufc: 72, wwe: 70 }

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, sport, category, rendimiento_auto, contexto_auto, mediatico_auto, narrativa_auto')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
    .eq('active', true)
    .is('rendimiento_auto', null)
    .is('contexto_auto', null)
    .order('sport')
    .order('name')

  if (error) { console.error('DB error:', error.message); process.exit(1) }

  console.log(`Entradas a corregir: ${entries.length}\n`)

  const updates = entries.map(e => {
    const med = e.mediatico_auto ?? 50
    const nar = e.narrativa_auto ?? 55
    const rendimiento = Math.round(med * 0.65 + nar * 0.35)
    const contexto = CONTEXTO_BY_SPORT[e.sport] ?? 65
    return { id: e.id, name: e.name, sport: e.sport, rendimiento, contexto }
  })

  // Print preview
  const bySport = {}
  updates.forEach(u => {
    if (!bySport[u.sport]) bySport[u.sport] = []
    bySport[u.sport].push(u)
  })
  for (const [sport, group] of Object.entries(bySport)) {
    console.log(`  ${sport}:`)
    group.forEach(u => console.log(`    ${u.name.padEnd(36)} rend:${u.rendimiento}  ctx:${u.contexto}`))
    console.log()
  }

  if (!APPLY) { console.log('DRY RUN — pasa --apply para guardar.'); return }

  let ok = 0, fail = 0
  for (const { id, rendimiento, contexto } of updates) {
    const { error: e } = await sb
      .from('ranking_entries')
      .update({ rendimiento_auto: rendimiento, contexto_auto: contexto })
      .eq('id', id)
    if (e) { console.error(`  FAIL ${id}: ${e.message}`); fail++ }
    else ok++
  }
  console.log(`Actualizadas: ${ok} | Fallidas: ${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
