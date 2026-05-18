#!/usr/bin/env node
// fix-youtube-handles-v3.mjs
// Tercera ronda de correcciones a partir de investigación manual/agente.
//
// Uso:
//   node scripts/fix-youtube-handles-v3.mjs           # DRY RUN
//   node scripts/fix-youtube-handles-v3.mjs --apply

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

// Busca por nombre ya que los IDs pueden variar
// formato: { name, key, fix }  — fix=null elimina la clave
const FIXES_BY_NAME = [
  // ── YouTube handle corrections (agent-researched + API-verified) ──
  { name: 'AS Diario',            key: 'youtube', fix: '@diarioas'              }, // 1.8M
  { name: 'Win Sports',           key: 'youtube', fix: '@winsportstv'           }, // 1.8M
  { name: 'Israel Adesanya',      key: 'youtube', fix: '@freestylebender'       }, // 1.12M
  { name: 'NFL en Español',       key: 'youtube', fix: '@mundonfl'              }, // 220K
  { name: 'Selección México',     key: 'youtube', fix: '@miseleccionmx'         },
  { name: 'Cádiz CF',             key: 'youtube', fix: '@cadizcf'               }, // 257K
  { name: 'Baloncesto España',    key: 'youtube', fix: '@feb'                   },
  { name: 'Luis García "El Doctor"', key: 'youtube', fix: '@drgarcia'           }, // 1M+
  { name: 'Fichajes.net',         key: 'youtube', fix: '@FichajeNet'            },
  { name: 'Juanma Castaño',       key: 'youtube', fix: '@partidazocope'         },
  { name: 'Relevo',               key: 'youtube', fix: '@Relevo_Deportes'       },
  { name: 'Estadio Deportivo',    key: 'youtube', fix: '@estadiodeportivo_oficial' },
  { name: 'Fernando Alonso',      key: 'youtube', fix: '@fernandoalonsooficial' },
  { name: 'World Padel Tour',     key: 'youtube', fix: '@PremierPadel'          }, // WPT → Premier Padel
  { name: 'Fútbol Picante',       key: 'youtube', fix: '@ESPNDeportes'          }, // programa de ESPN

  // ── Fix typo en Instagram handle ──────────────────────────────────
  { name: 'Ibai Llanos',          key: 'instagram', fix: 'ibaillanos' },  // era: ibaillanoss (doble s)
]

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const names = FIXES_BY_NAME.map(f => f.name)
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, handles')
    .in('name', names)
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
  if (error) throw error

  // Map: name → first entry with handles
  const byName = {}
  for (const e of entries) {
    if (!byName[e.name] || e.handles) byName[e.name] = e
  }

  let fixed = 0, skipped = 0
  for (const fix of FIXES_BY_NAME) {
    const entry = byName[fix.name]
    if (!entry) { console.log(`  SKIP  "${fix.name}" — not found`); skipped++; continue }

    const newHandles = { ...(entry.handles ?? {}) }
    if (fix.fix === null) {
      delete newHandles[fix.key]
    } else {
      newHandles[fix.key] = fix.fix
    }

    const old = entry.handles?.[fix.key] ?? '(none)'
    const arrow = fix.fix === null ? '→ (removed)' : `→ ${fix.fix}`
    console.log(`  ${fix.name.padEnd(28)} ${fix.key}: "${old}" ${arrow}`)

    if (APPLY) {
      const { error: err } = await sb
        .from('ranking_entries')
        .update({ handles: newHandles })
        .eq('id', entry.id)
      if (err) { console.error(`    FAIL: ${err.message}`); continue }
    }
    fixed++
  }

  console.log(`\n${fixed} entries ${APPLY ? 'patched' : 'would be patched'}, ${skipped} skipped`)
  if (!APPLY) console.log('DRY RUN — pasa --apply para escribir.')
}

main().catch(err => { console.error(err); process.exit(1) })
