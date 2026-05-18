#!/usr/bin/env node
// fix-youtube-handles.mjs
// Corrige handles de YouTube incorrectos detectados durante el ingest
// y desactiva entradas duplicadas sin handles.
//
// Uso:
//   node scripts/fix-youtube-handles.mjs           # DRY RUN
//   node scripts/fix-youtube-handles.mjs --apply

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

// ── Fixes de handles de YouTube ────────────────────────────────────
// Formato: { id, field_path, old_val, new_val }
const HANDLE_FIXES = [
  // @FCBarcelona_es (40 subs, canal muerto) → @FCBarcelona (25.9M)
  { id: 'fc-barcelona-canal', key: 'youtube', old: '@FCBarcelona_es', fix: '@FCBarcelona' },
  // @LigaMXoficial (8 subs, inactivo) → @LigaBBVAMX (1.41M, canal oficial actual)
  { id: 'liga-mx',            key: 'youtube', old: '@LigaMXoficial',  fix: '@LigaBBVAMX'  },
  // @realbetisbalompie (NOT FOUND) → @RealBetis (2.83M)
  { id: 'real-betis',         key: 'youtube', old: '@realbetisbalompie', fix: '@RealBetis' },
  // @TUDN (13 subs, canal equivocado) → @TUDN_USA (2.15M)
  { id: 'tudn-oficial',       key: 'youtube', old: '@TUDN',           fix: '@TUDN_USA'    },
  // @KMbappe (NOT FOUND) → @kylianmbappe (1.41M)
  { id: 'mbappe-content',     key: 'youtube', old: '@KMbappe',        fix: '@kylianmbappe' },
  // @AthleticClub (NOT FOUND) → null (su plataforma principal es Twitch/TikTok)
  { id: 'athletic-club',      key: 'youtube', old: '@AthleticClub',   fix: null },
  // @KingsLeague (122 subs, canal muerto) → null (principalmente Twitch/TikTok)
  { id: 'kings-league',       key: 'youtube', old: '@KingsLeague',    fix: null },
]

// ── Entradas duplicadas sin handles a desactivar ───────────────────
const DEACTIVATE_IDS = [
  'barcelona',        // FC Barcelona duplicado (sin handles, active:true)
  'espn-clubf-21372', // Athletic Club duplicado (sin handles, active:true)
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  // ── 1. Leer entradas afectadas ────────────────────────────────────
  const allIds = [...HANDLE_FIXES.map(f => f.id), ...DEACTIVATE_IDS]
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, handles, active')
    .in('id', allIds)
  if (error) throw error

  const byId = Object.fromEntries(entries.map(e => [e.id, e]))

  // ── 2. Handle fixes ───────────────────────────────────────────────
  console.log('── YouTube handle fixes ─────────────────────────────')
  for (const fix of HANDLE_FIXES) {
    const entry = byId[fix.id]
    if (!entry) { console.log(`  SKIP ${fix.id} — not found in DB`); continue }

    const currentVal = entry.handles?.[fix.key]
    if (currentVal !== fix.old) {
      console.log(`  SKIP ${entry.name} — current ${fix.key}="${currentVal}" ≠ expected "${fix.old}"`)
      continue
    }

    const newHandles = { ...entry.handles }
    if (fix.fix === null) {
      delete newHandles[fix.key]
    } else {
      newHandles[fix.key] = fix.fix
    }

    const arrow = fix.fix === null ? '→ (removed)' : `→ ${fix.fix}`
    console.log(`  ${entry.name.padEnd(22)} ${fix.key}: "${fix.old}" ${arrow}`)

    if (APPLY) {
      const { error: err } = await sb
        .from('ranking_entries')
        .update({ handles: newHandles })
        .eq('id', fix.id)
      if (err) console.error(`    FAIL: ${err.message}`)
    }
  }

  // ── 3. Deactivate duplicates ──────────────────────────────────────
  console.log('\n── Deactivate duplicates ────────────────────────────')
  for (const id of DEACTIVATE_IDS) {
    const entry = byId[id]
    if (!entry) { console.log(`  SKIP ${id} — not found`); continue }
    console.log(`  ${entry.name.padEnd(22)} id=${id}  active: ${entry.active} → false`)
    if (APPLY) {
      const { error: err } = await sb
        .from('ranking_entries')
        .update({ active: false })
        .eq('id', id)
      if (err) console.error(`    FAIL: ${err.message}`)
    }
  }

  if (!APPLY) console.log('\nDRY RUN — pasa --apply para escribir.')
  else console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
