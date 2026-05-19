#!/usr/bin/env node
// fix-ranked-images.mjs
//
// Obtiene imágenes para los 10 ranked entries que aún no tienen image_url.
// Usa YouTube API (solo forHandle y by ID — sin search, que gasta 100 unidades).
//
// Ejecutar cuando el cupo de YouTube API se haya reiniciado (medianoche Pacific).
//
// Uso:
//   node scripts/fix-ranked-images.mjs             # DRY RUN
//   node scripts/fix-ranked-images.mjs --apply
//   node scripts/fix-ranked-images.mjs --apply --storage

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY   = process.argv.includes('--apply')
const STORAGE = process.argv.includes('--storage')
const BUCKET  = 'avatars'
const YT_KEY  = process.env.YOUTUBE_API_KEY

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// IDs ranked sin imagen (actualizar si se resuelven antes)
const TARGET_IDS = [
  'area-de-combate-espn',   // solo IG
  'danidelasluchas',        // TikTok + YouTube @danidelasLuchas
  'falbak-wwe',             // YouTube @Falbak
  'iker-ruiz-futbol',       // YouTube @IkerRuizDelBarco
  'lamediainglesa',         // YouTube UCMFBd8gbZBBqJfRZcbCjLrA
  'la-zona-de-combate',     // solo IG
  'losdisplicentes',        // YouTube UCzv5hVNh9ICKa9kHUJNXMTA
  'mmarc-creator',          // YouTube @marcmma
  'rafaescrig-futbol',      // YouTube @RafaEscrig
  'sralexgomez-wwe',        // solo TikTok
]

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function uploadToStorage(id, imageUrl) {
  try {
    const res = await fetch(imageUrl, { headers: { 'User-Agent': 'TakaSports/1.0' } })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 1000) return null
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const { error } = await sb.storage.from(BUCKET).upload(`${id}.${ext}`, buffer, { contentType, upsert: true })
    if (error) { console.error(`    UPLOAD FAIL ${id}: ${error.message}`); return null }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(`${id}.${ext}`)
    return data.publicUrl
  } catch (err) { console.error(`    FAIL ${id}: ${err.message}`); return null }
}

// Solo forHandle y by ID — NO search (100 unidades/req)
async function ytThumb(ytHandle) {
  if (!ytHandle || !YT_KEY) return null
  const base = 'https://www.googleapis.com/youtube/v3'
  try {
    // Canal por UCxxx
    if (ytHandle.match(/^UC[A-Za-z0-9_-]{20,}$/)) {
      const r = await fetch(`${base}/channels?part=snippet&id=${ytHandle}&key=${YT_KEY}`)
      const d = await r.json()
      if (d.error) { console.error('    YT error:', d.error.message); return null }
      const t = d.items?.[0]?.snippet?.thumbnails
      return upgradeThumb(t?.high?.url ?? t?.default?.url)
    }
    // Canal por @handle
    if (ytHandle.startsWith('@')) {
      const handle = ytHandle.replace(/^@/, '')
      const r = await fetch(`${base}/channels?part=snippet&forHandle=${encodeURIComponent(handle)}&key=${YT_KEY}`)
      const d = await r.json()
      if (d.error) { console.error('    YT error:', d.error.message); return null }
      const t = d.items?.[0]?.snippet?.thumbnails
      return upgradeThumb(t?.high?.url ?? t?.default?.url)
    }
  } catch { return null }
  return null
}

function upgradeThumb(url) {
  if (!url) return null
  return url.replace(/=s\d+/, '=s240').replace(/-c-k-c0xffffffff-no-rj-mo/, '')
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | Storage: ${STORAGE}\n`)

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, handles, image_url')
    .in('id', TARGET_IDS)
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  // Sólo los que siguen sin imagen
  const todo = entries.filter(e => !e.image_url)
  console.log(`Pendientes: ${todo.length}\n`)

  for (const entry of todo) {
    const h = entry.handles ?? {}
    const thumb = await ytThumb(h.youtube)

    if (!thumb) {
      console.log(`  ❌ ${entry.name.padEnd(36)} yt:${h.youtube ?? '—'} → sin YouTube (usa IG/TikTok manualmente)`)
    } else {
      console.log(`  ✅ ${entry.name.padEnd(36)} yt:${h.youtube}`)
      if (APPLY) {
        let finalUrl = thumb
        if (STORAGE) {
          const stored = await uploadToStorage(entry.id, thumb)
          if (stored) { finalUrl = stored; console.log(`    💾 → Storage`) }
        }
        const { error: e } = await sb.from('ranking_entries').update({ image_url: finalUrl }).eq('id', entry.id)
        if (e) console.error(`    SAVE FAIL: ${e.message}`)
        else console.log(`    → ${finalUrl.substring(0, 80)}`)
      }
    }
    await sleep(150)
  }

  console.log('\n✅ Hecho. Para los que siguen sin imagen (solo IG/TikTok):')
  console.log('  node scripts/ingest-creator-images-ig.mjs --apply --all --storage')
}

main().catch(err => { console.error(err); process.exit(1) })
