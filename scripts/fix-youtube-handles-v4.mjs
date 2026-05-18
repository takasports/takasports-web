#!/usr/bin/env node
// fix-youtube-handles-v4.mjs
// Correcciones finales: ajusta handles del v3 que resultaron erróneos.
//
// Uso:
//   node scripts/fix-youtube-handles-v4.mjs --apply

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

const FIXES_BY_NAME = [
  // Corrección v3: @feb (NOT_FOUND) → @BaloncestoEsp (50K, confirmado)
  { name: 'Baloncesto España',  key: 'youtube', fix: '@BaloncestoEsp'         },
  // Corrección v3: @PremierPadel (36 subs equivocado) → @PremierPadelOfficial (852K)
  { name: 'World Padel Tour',   key: 'youtube', fix: '@PremierPadelOfficial'  },
  // @drgarcia (62K) - canal de Luis García México, pero muy pequeño. Dejarlo para Instagram
  { name: 'Luis García "El Doctor"', key: 'youtube', fix: null },
  // @ESPNDeportes corresponde a ESPN Deportes (otra entrada), no a Fútbol Picante como programa
  { name: 'Fútbol Picante',     key: 'youtube', fix: null },
  // @FichajeNet → 7 subs (canal equivocado)
  { name: 'Fichajes.net',       key: 'youtube', fix: null },
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const names = FIXES_BY_NAME.map(f => f.name)
  const { data: entries, error } = await sb
    .from('ranking_entries').select('id, name, handles')
    .in('name', names).in('category', ['creadores', 'periodistas', 'creadores_wwe'])
  if (error) throw error

  const byName = {}
  for (const e of entries) {
    if (!byName[e.name] || e.handles) byName[e.name] = e
  }

  for (const fix of FIXES_BY_NAME) {
    const entry = byName[fix.name]
    if (!entry) { console.log(`  SKIP "${fix.name}" — not found`); continue }
    const newHandles = { ...(entry.handles ?? {}) }
    fix.fix === null ? delete newHandles[fix.key] : (newHandles[fix.key] = fix.fix)
    const old = entry.handles?.[fix.key] ?? '(none)'
    const arrow = fix.fix === null ? '→ (removed)' : `→ ${fix.fix}`
    console.log(`  ${fix.name.padEnd(28)} ${fix.key}: "${old}" ${arrow}`)
    if (APPLY) {
      const { error: err } = await sb.from('ranking_entries').update({ handles: newHandles }).eq('id', entry.id)
      if (err) console.error(`    FAIL: ${err.message}`)
    }
  }
  if (!APPLY) console.log('\nDRY RUN — pasa --apply para escribir.')
  else console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
