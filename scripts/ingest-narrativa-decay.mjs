#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-narrativa-decay.mjs
//
// Aplica decay temporal al factor `narrativa_auto`:
//   - Si no hubo actualización editorial en ≥21 días → -2 pts/semana
//   - Mínimo: 65 (nadie cae por debajo del baseline)
//   - Protección: no decae si editorial_locked = true
//
// Esto evita que jugadores con hype viejo mantengan un score de
// narrativa inflado indefinidamente. El editor puede restaurarlo
// escribiendo narrativa_manual o actualizando narrativa_auto.
//
// También marca en narrativa_auto a jugadores cuyo Google Trends
// o Wikipedia haya subido bruscamente (señal de alerta editorial).
// [Señal de spikes: implementación futura — por ahora solo decay]
//
// Uso:
//   node scripts/ingest-narrativa-decay.mjs           # DRY RUN
//   node scripts/ingest-narrativa-decay.mjs --apply
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

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

const DECAY_RATE       = 2    // puntos por semana
const DECAY_FLOOR      = 65   // mínimo narrativa_auto tras decay
const STALE_DAYS       = 21   // días sin update editorial para considerar "stale"

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Regla: −${DECAY_RATE} pts/semana si narrativa_auto > ${DECAY_FLOOR} y sin update editorial en >${STALE_DAYS} días`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Entradas con narrativa alta y sin update reciente (y no bloqueadas editorialmente)
  const { data: candidates, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, narrativa_auto, narrativa_manual, editorial_locked, last_auto_update')
    .gt('narrativa_auto', DECAY_FLOOR + DECAY_RATE - 0.1)  // al menos decay_floor + 1 step
    .or('last_auto_update.is.null,last_auto_update.lt.' + staleThreshold)
    .not('editorial_locked', 'eq', true)
    .is('narrativa_manual', null)  // si hay override manual, no tocar auto

  if (error) throw error

  const updates = candidates.map(e => ({
    entryId: e.id, category: e.category, name: e.name,
    prev: Number(e.narrativa_auto),
    newScore: Math.max(DECAY_FLOOR, Number(e.narrativa_auto) - DECAY_RATE),
    lastUpdate: e.last_auto_update,
  }))

  updates.sort((a, b) => (b.prev - b.newScore) - (a.prev - a.newScore) || b.prev - a.prev)

  console.log(`\nCandidatos a decay: ${updates.length}`)
  if (updates.length > 0) {
    console.log('\n--- Primeros 30 ---')
    updates.slice(0, 30).forEach(u => {
      const lastUpd = u.lastUpdate ? new Date(u.lastUpdate).toISOString().slice(0, 10) : 'nunca'
      console.log(`  ${u.prev.toFixed(1).padStart(5)} → ${u.newScore.toFixed(1).padStart(5)}  ${u.name.padEnd(30)}  último update: ${lastUpd}`)
    })
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ narrativa_auto: u.newScore })
      .eq('id', u.entryId).eq('category', u.category)
    if (err) { fail++; console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
