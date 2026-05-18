#!/usr/bin/env node
// cleanup-athletes-contenidos.mjs
// Desactiva deportistas puros de las categorías creadores/periodistas/creadores_wwe.
// Solo deben aparecer en Contenidos creadores y periodistas, NO deportistas activos.
//
// Deportistas a desactivar (active → false):
//   UFC: yair-rodriguez-content, alexa-grasso-content
//   WWE: stephanie-vaquer-wwe
//
// Se mantienen (son también creadores de contenido):
//   fabricio-werdum-content  → analista ESPN + canal YouTube propio
//   brandon-moreno-podcast   → host podcast oficial UFC Entre Asaltos
//
// Uso:
//   node scripts/cleanup-athletes-contenidos.mjs
//   node scripts/cleanup-athletes-contenidos.mjs --apply

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

// Deportistas puros — aparecen en categorías de contenidos pero NO son creadores/periodistas
const ATHLETE_IDS = [
  'yair-rodriguez-content',   // El Pantera — peleador UFC, no creador
  'alexa-grasso-content',     // Ex-campeona UFC — peleadora, no creadora
  'stephanie-vaquer-wwe',     // NXT Women's Champion — luchadora, no creadora
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const { data: found } = await sb
    .from('ranking_entries')
    .select('id, name, category, sport, active')
    .in('id', ATHLETE_IDS)

  if (!found || found.length === 0) {
    console.log('No se encontraron entradas con esos IDs.')
    return
  }

  console.log('Entradas a desactivar:')
  found.forEach(e => console.log(`  ${e.name.padEnd(30)} [${e.sport}/${e.category}] active=${e.active}`))

  const alreadyInactive = found.filter(e => !e.active)
  const toDeactivate = found.filter(e => e.active !== false)

  if (alreadyInactive.length) {
    console.log(`\nYa inactivos (skip): ${alreadyInactive.map(e => e.name).join(', ')}`)
  }

  if (toDeactivate.length === 0) {
    console.log('\nNada que cambiar.')
    return
  }

  console.log(`\nA desactivar: ${toDeactivate.map(e => e.name).join(', ')}`)

  if (!APPLY) { console.log('\nDRY RUN — pasa --apply para escribir.'); return }

  const { error } = await sb
    .from('ranking_entries')
    .update({ active: false })
    .in('id', toDeactivate.map(e => e.id))

  if (error) { console.error('UPDATE FAIL:', error.message); process.exit(1) }
  console.log(`\nDesactivadas ${toDeactivate.length} entradas (active = false).`)
  console.log('Estas entradas ya no aparecerán en la sección Contenidos.')
}

main().catch(err => { console.error(err); process.exit(1) })
