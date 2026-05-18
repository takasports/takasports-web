#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-instagram-followers.mjs
//
// Actualiza rendimiento_auto de creadores que SÓLO tienen datos de
// Instagram (sin YouTube ni Twitch), usando el endpoint público de IG.
//
// Instagram rate-limita agresivamente (~25 requests/sesión vía curl).
// Este script procesa en lotes de 20 con pausa de 3s entre peticiones
// y detiene automáticamente si detecta bloqueo (429/error).
//
// Estrategia recomendada:
//   - Ejecutar 1×/día o cuando los tokens se acumulen
//   - En modo --batch=N procesa sólo N cuentas por ejecución
//   - En modo --all procesa todas (puede tardar 15+ minutos)
//
// Uso:
//   node scripts/ingest-instagram-followers.mjs            # DRY RUN, primeras 30
//   node scripts/ingest-instagram-followers.mjs --apply    # aplica, primeras 30
//   node scripts/ingest-instagram-followers.mjs --apply --batch=50
//   node scripts/ingest-instagram-followers.mjs --apply --all
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY   = process.argv.includes('--apply')
const ALL     = process.argv.includes('--all')
const batchArg = process.argv.find(a => a.startsWith('--batch='))
const BATCH   = ALL ? Infinity : batchArg ? parseInt(batchArg.split('=')[1]) : 30

const DELAY_MS    = 2500  // ms entre peticiones (IG rate-limit ~25 req/sesión con <1s delay)
const MAX_RETRIES = 1

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function reachScore(followers) {
  if (!followers || followers <= 0) return null
  const capped = Math.min(followers, 15_000_000)
  return Math.round((Math.log10(capped + 1) / Math.log10(15_000_001)) * 100 * 10) / 10
}

function fetchIG(username) {
  const clean = username.replace(/^@/, '').toLowerCase()
  for (let attempt = 0; attempt < MAX_RETRIES + 1; attempt++) {
    try {
      const out = execSync(
        `curl -s --max-time 10 ` +
        `-H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" ` +
        `-H "x-ig-app-id: 936619743392459" ` +
        `"https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(clean)}"`,
        { encoding: 'utf8', timeout: 12000 }
      )
      const data = JSON.parse(out)
      if (data?.message?.includes('wait')) {
        console.warn(`  ⚠️  Rate-limited por Instagram (${clean}) — deteniendo.`)
        return { rateLimit: true }
      }
      const count = data?.data?.user?.edge_followed_by?.count
      return typeof count === 'number' && count > 0 ? count : null
    } catch { return null }
  }
  return null
}

function fmt(n) {
  if (n == null) return '    ?'
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n/1e3)}K`
  return String(n)
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | Batch: ${ALL ? 'ALL' : BATCH}\n`)

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, handles, rendimiento_auto')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
    .not('handles', 'is', null)
  if (error) throw error

  // Prioridad: primero los que no tienen rendimiento_auto, luego los que sí tienen
  const withIG = entries.filter(e => e.handles?.instagram)
  const noScore = withIG.filter(e => !e.rendimiento_auto)
  const withScore = withIG.filter(e => e.rendimiento_auto)
  const ordered = [...noScore, ...withScore].slice(0, BATCH)

  console.log(`Total con Instagram: ${withIG.length} | Sin rendimiento: ${noScore.length} | Procesando: ${ordered.length}\n`)

  let ok = 0, fail = 0, skipped = 0
  for (const entry of ordered) {
    const ig = entry.handles.instagram
    const result = fetchIG(ig)

    if (result && typeof result === 'object' && result.rateLimit) {
      console.log(`\n🛑 Rate-limit detectado tras ${ok + fail} peticiones. Ejecuta de nuevo más tarde.`)
      break
    }

    const followers = typeof result === 'number' ? result : null
    const newRend = reachScore(followers)
    const changed = entry.rendimiento_auto !== newRend

    console.log(
      `  ${entry.name.padEnd(26)}` +
      `  IG=${fmt(followers).padStart(6)}` +
      `  rend: ${entry.rendimiento_auto?.toFixed(1).padStart(5) ?? ' null'} → ${newRend?.toFixed(1).padStart(5) ?? ' null'}` +
      (changed ? '  ✓' : '')
    )

    if (followers != null) {
      ok++
      if (APPLY && newRend != null) {
        const patch = { last_auto_update: new Date().toISOString() }
        // Solo actualiza rendimiento si no tiene o si mejora el score
        if (!entry.rendimiento_auto || newRend > entry.rendimiento_auto) {
          patch.rendimiento_auto = newRend
        }
        const { error: err } = await sb.from('ranking_entries').update(patch).eq('id', entry.id)
        if (err) console.error(`    FAIL: ${err.message}`)
      }
    } else {
      fail++
    }

    await sleep(DELAY_MS)
  }

  console.log(`\nIG con datos: ${ok} / ${ordered.length} | Sin datos: ${fail}`)
  if (!APPLY) console.log('DRY RUN — pasa --apply para escribir.')
}

main().catch(err => { console.error(err); process.exit(1) })
