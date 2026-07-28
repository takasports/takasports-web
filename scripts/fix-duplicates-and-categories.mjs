#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// fix-duplicates-and-categories.mjs
//
// Retira entradas concretas mal catalogadas o corruptas y las marca
// `suppressed` para que ningún proceso automático las resucite.
//
// ── QUÉ YA NO HACE (2026-07-28) ──────────────────────────────────
// Antes deduplicaba por (sport, category, nombre). Se ha quitado:
//   · duplicaba la lógica de curate-active-entries.mjs, que ahora es el
//     DUEÑO ÚNICO de `active` y colapsa por identidad (nombre + deporte
//     + género) CRUZANDO categorías — que es donde estaban los clones
//     de verdad (`saka` vs `espn-…`, `yamal` vs `yamal-sub21`);
//   · agrupaba dentro de la misma categoría, así que fusionaba
//     homónimos (Nico González, Álvaro García, Idrissa Gueye, Pedro)
//     sin protección alguna;
//   · escribía con `.in('id', ids)` SIN filtrar categoría, y la PK es
//     (id, category): desactivar `alcaraz-sub21` en jugadores (el
//     futbolista del Everton) tumbaba también su fila en sub21, que es
//     OTRA PERSONA (el tenista).
//
// Uso:
//   node scripts/fix-duplicates-and-categories.mjs           # DRY RUN
//   node scripts/fix-duplicates-and-categories.mjs --apply
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

// Europeos / no-LATAM que aparecen en categoría latam o concacaf
const WRONG_CATEGORY_IDS = [
  'wemba-lat',    // Victor Wembanyama (Francia) en latam baloncesto
  'jokic-lat',    // Nikola Jokić (Serbia) en latam baloncesto
  'luka-lat',     // Luka Dončić (Eslovenia) en latam baloncesto
  'bonmati-lat',  // Aitana Bonmatí (España) en latam fútbol
  'alcaraz-lat',  // Carlos Alcaraz (España) en latam tenis
]

// Entry con datos de nombre equivocado (id jokic-prev → nombre Jayson Tatum)
const WRONG_DATA_IDS = [
  'jokic-prev',  // ID de Jokic pero nombre "Jayson Tatum" — corrupción de datos
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const targets = [...WRONG_CATEGORY_IDS, ...WRONG_DATA_IDS]
  const { data, error } = await sb
    .from('ranking_entries')
    .select('id, name, sport, category, active, suppressed')
    .in('id', targets)
  if (error) throw error

  const pending = data.filter(e => !e.suppressed)
  for (const e of data) {
    const estado = e.suppressed ? 'ya suprimida' : e.active ? 'ACTIVA → suprimir' : 'inactiva → suprimir'
    console.log(`  ${e.id}/${e.category} — ${e.name} (${e.sport}) — ${estado}`)
  }
  for (const id of targets) {
    if (!data.some(e => e.id === id)) console.log(`  – ${id} no existe`)
  }

  console.log(`\nA suprimir: ${pending.length}`)
  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0
  for (const e of pending) {
    const { error: err } = await sb
      .from('ranking_entries')
      .update({ suppressed: true, active: false })
      .eq('id', e.id)
      .eq('category', e.category)      // ← la PK es (id, category)
    if (err) console.error(`FAIL ${e.id}/${e.category}: ${err.message}`)
    else ok++
  }
  console.log(`Done. suprimidas=${ok}`)
}

main().catch(err => { console.error(err); process.exit(1) })
