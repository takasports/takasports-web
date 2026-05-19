#!/usr/bin/env node
// ingest-unavatar-fallback.mjs
//
// Fetches profile photos via unavatar.io (free, no API key) for all
// ranking_entries still missing image_url that have a Twitter handle.
//
// unavatar.io aggregates profile photos from multiple platforms.
// URL: https://unavatar.io/twitter/{handle}  → redirects to CDN image
//
// Usage:
//   node scripts/ingest-unavatar-fallback.mjs              # DRY RUN
//   node scripts/ingest-unavatar-fallback.mjs --apply

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY  = process.argv.includes('--apply')
const FORCE  = process.argv.includes('--force')
const BUCKET = 'avatars'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function sanitizeStorageId(id) {
  return id.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_\-]/g, '_')
}

async function fetchViaUnavatar(handle) {
  const url = `https://unavatar.io/twitter/${encodeURIComponent(handle)}?fallback=false`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TakaSports/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 500) return null
    return { buffer, contentType }
  } catch { return null }
}

async function uploadToStorage(id, buffer, contentType) {
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const filePath = `${sanitizeStorageId(id)}.${ext}`
  const { error } = await sb.storage.from(BUCKET).upload(filePath, buffer, { contentType, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  let entries = []
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, name, handles, image_url')
      .eq('active', true)
      .order('name')
      .range(from, from + 999)
    if (error) { console.error('DB error:', error.message); process.exit(1) }
    if (!data?.length) break
    entries = entries.concat(data)
    if (data.length < 1000) break
    from += 1000
  }

  const candidates = entries.filter(e => {
    if (!e.handles?.twitter) return false
    if (!FORCE && e.image_url) return false
    return true
  })

  console.log(`Entries to process: ${candidates.length}\n`)
  if (candidates.length === 0) { console.log('Nothing to do.'); return }

  let ok = 0, fail = 0
  const failures = []

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i]
    const handle = entry.handles.twitter.replace(/^@/, '').trim()
    const prefix = `[${String(i+1).padStart(3)}/${candidates.length}]`

    const img = await fetchViaUnavatar(handle)

    if (!img) {
      console.log(`${prefix} ❌ ${entry.name.padEnd(32)} @${handle.padEnd(24)} — not found`)
      failures.push({ id: entry.id, handle })
      fail++
      await sleep(500)
      continue
    }

    const sizeKB = Math.round(img.buffer.length / 1024)
    console.log(`${prefix} ✅ ${entry.name.padEnd(32)} @${handle.padEnd(24)} ${sizeKB}KB`)

    if (APPLY) {
      try {
        const storageUrl = await uploadToStorage(entry.id, img.buffer, img.contentType)
        const { error: e } = await sb.from('ranking_entries').update({ image_url: storageUrl }).eq('id', entry.id)
        if (e) { console.error(`    SAVE FAIL: ${e.message}`); fail++; continue }
        console.log(`    💾 ${storageUrl.substring(0, 80)}`)
        ok++
      } catch (err) {
        console.error(`    UPLOAD FAIL: ${err.message}`)
        fail++
        failures.push({ id: entry.id, handle, reason: err.message })
      }
    } else {
      ok++
    }

    await sleep(800) // respect unavatar.io rate limits
  }

  console.log(`\n✅ OK: ${ok} | ❌ Failed: ${fail}`)
  if (failures.length > 0) {
    console.log('\nFailed entries:')
    failures.forEach(f => console.log(`  ${f.id} @${f.handle}`))
  }
  if (!APPLY) console.log('\nDRY RUN — pass --apply to save.')
}

main().catch(err => { console.error(err); process.exit(1) })
