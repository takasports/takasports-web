#!/usr/bin/env node
// ingest-creator-images-ig.mjs
//
// Busca image_url desde Instagram para entradas de contenidos que:
//   - NO tienen image_url todavía (o --force para sobreescribir)
//   - tienen handles.instagram
//
// Usa el mismo endpoint público que ingest-instagram-followers.mjs
// (curl + iPhone User-Agent + x-ig-app-id).
// Extrae profile_pic_url_hd (o profile_pic_url como fallback).
//
// Instagram rate-limit: ~25-30 req antes de bloquear.
// En ese caso para automáticamente. Ejecuta de nuevo más tarde.
//
// Uso:
//   node scripts/ingest-creator-images-ig.mjs           # DRY RUN, batch 25
//   node scripts/ingest-creator-images-ig.mjs --apply
//   node scripts/ingest-creator-images-ig.mjs --apply --batch=50
//   node scripts/ingest-creator-images-ig.mjs --apply --all
//   node scripts/ingest-creator-images-ig.mjs --apply --force   # sobreescribe existentes

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')
const ALL   = process.argv.includes('--all')
const BATCH = (() => {
  const b = process.argv.find(a => a.startsWith('--batch='))
  return b ? parseInt(b.split('=')[1]) : 25
})()

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Devuelve { pic, followers } o { rateLimit: true } o null
function fetchIGProfile(username) {
  const clean = username.replace(/^@/, '').toLowerCase()
  try {
    const out = execSync(
      `curl -s --max-time 10 ` +
      `-H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" ` +
      `-H "x-ig-app-id: 936619743392459" ` +
      `"https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(clean)}"`,
      { encoding: 'utf8', timeout: 12000 }
    )
    const data = JSON.parse(out)
    if (data?.message?.toLowerCase().includes('wait') || data?.message?.toLowerCase().includes('login')) {
      return { rateLimit: true }
    }
    const user = data?.data?.user
    if (!user) return null
    const pic = user.profile_pic_url_hd ?? user.profile_pic_url ?? null
    const followers = user.edge_followed_by?.count ?? null
    return pic ? { pic, followers } : null
  } catch { return null }
}

function fmt(n) {
  if (n == null) return '   ?'
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n/1e3)}K`
  return String(n)
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | Batch: ${ALL ? 'ALL' : BATCH} | Force: ${FORCE}\n`)

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, handles, image_url')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
    .eq('active', true)
    .not('handles', 'is', null)
    .order('name')
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  // Solo los que tienen IG
  const withIG = entries.filter(e => e.handles?.instagram)

  // Sin imagen primero (o todos si --force)
  const candidates = FORCE
    ? withIG
    : withIG.filter(e => !e.image_url)

  const toProcess = ALL ? candidates : candidates.slice(0, BATCH)

  console.log(`Con Instagram: ${withIG.length} | Sin imagen: ${withIG.filter(e => !e.image_url).length} | Procesando: ${toProcess.length}\n`)

  const updates = []
  let ok = 0, fail = 0, rateLimited = false

  for (const entry of toProcess) {
    const igHandle = entry.handles.instagram.replace(/^@/, '')
    const result = fetchIGProfile(igHandle)

    if (result && result.rateLimit) {
      console.log(`\n🛑 Rate-limit detectado tras ${ok + fail} peticiones. Ejecuta de nuevo más tarde.`)
      rateLimited = true
      break
    }

    if (result?.pic) {
      const followers = result.followers ? ` (${fmt(result.followers)} seg)` : ''
      console.log(`  ✅ ${entry.name.padEnd(36)} @${igHandle}${followers}`)
      updates.push({ id: entry.id, image_url: result.pic })
      ok++
    } else {
      console.log(`  ❌ ${entry.name.padEnd(36)} @${igHandle}`)
      fail++
    }

    await sleep(600) // 600ms entre requests para evitar rate-limit
  }

  console.log(`\nEncontradas: ${ok} | Sin resultado: ${fail}${rateLimited ? ' | ⚠️ Rate-limited' : ''}`)

  if (!APPLY) { console.log('\nDRY RUN — pasa --apply para guardar.'); return }
  if (updates.length === 0) { console.log('Nada que guardar.'); return }

  let saved = 0, failed = 0
  for (const { id, image_url } of updates) {
    const { error: e } = await sb
      .from('ranking_entries')
      .update({ image_url })
      .eq('id', id)
    if (e) { console.error(`  FAIL ${id}: ${e.message}`); failed++ }
    else saved++
  }
  console.log(`Guardadas: ${saved} | Fallidas: ${failed}`)
}

main().catch(err => { console.error(err); process.exit(1) })
