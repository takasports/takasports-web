#!/usr/bin/env node
// ingest-twitter-avatars-pw.mjs
//
// Fallback script: uses Playwright to fetch profile photos from Twitter/X
// for ranking_entries that still lack image_url (after Instagram attempt).
//
// Strategy:
//   1. GET https://x.com/{handle}/ → extract og:image via Playwright browser
//   2. Download CDN image inside browser context
//   3. Upload to Supabase Storage "avatars"
//   4. Update ranking_entries.image_url
//
// Usage:
//   node scripts/ingest-twitter-avatars-pw.mjs              # DRY RUN
//   node scripts/ingest-twitter-avatars-pw.mjs --apply
//   node scripts/ingest-twitter-avatars-pw.mjs --apply --ids=alfredo-martinez,arigeli

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY   = process.argv.includes('--apply')
const BUCKET  = 'avatars'
const IDS_ARG = process.argv.find(a => a.startsWith('--ids='))
const ONLY_IDS = IDS_ARG ? new Set(IDS_ARG.split('=')[1].split(',')) : null
const FORCE   = process.argv.includes('--force')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function jitter(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

async function fetchImageAsBase64(page, handle) {
  try {
    await page.goto(`https://x.com/${handle}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })
    await sleep(2000)

    const result = await page.evaluate(async () => {
      // Try og:image first
      const meta = document.querySelector('meta[property="og:image"]')
        || document.querySelector('meta[name="twitter:image"]')
        || document.querySelector('meta[property="twitter:image"]')
      if (!meta?.content) return { ok: false, reason: 'no_og_image' }

      const url = meta.content
      // Skip generic Twitter egg/default images
      if (url.includes('default_profile') || url.includes('abs.twimg.com/sticky')) {
        return { ok: false, reason: 'default_avatar' }
      }

      // Upgrade to larger size: _normal → _400x400
      const hiresUrl = url.replace(/_normal\./, '_400x400.')

      try {
        let res = await fetch(hiresUrl)
        if (!res.ok) res = await fetch(url)
        if (!res.ok) return { ok: false, reason: 'fetch_' + res.status }
        const buf = await res.arrayBuffer()
        const bytes = new Uint8Array(buf)
        if (bytes.length < 500) return { ok: false, reason: 'too_small_' + bytes.length }
        let b64 = ''
        const CHUNK = 8192
        for (let i = 0; i < bytes.length; i += CHUNK) {
          b64 += btoa(String.fromCharCode(...bytes.slice(i, i + CHUNK)))
        }
        const ct = res.headers.get('content-type') || 'image/jpeg'
        return { ok: true, b64, contentType: ct, size: bytes.length }
      } catch (e) {
        return { ok: false, reason: 'err:' + e.message }
      }
    })

    return result
  } catch (e) {
    return { ok: false, reason: 'nav:' + e.message.slice(0, 60) }
  }
}

function sanitizeStorageId(id) {
  return id.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_\-]/g, '_')
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

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, handles, image_url')
    .eq('active', true)
    .order('name')
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const candidates = entries.filter(e => {
    if (!e.handles?.twitter) return false
    if (ONLY_IDS && !ONLY_IDS.has(e.id)) return false
    if (!FORCE && e.image_url) return false
    return true
  })

  console.log(`Entries to process: ${candidates.length}\n`)
  if (candidates.length === 0) { console.log('Nothing to do.'); return }

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ]
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'es-ES',
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  // Warm up with x.com homepage
  console.log('Warming up X/Twitter session...')
  await page.goto('https://x.com/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
  await sleep(2000)

  let ok = 0, fail = 0
  const failures = []

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i]
    const handle = entry.handles.twitter.replace(/^@/, '').trim()
    const prefix = `[${String(i+1).padStart(3)}/${candidates.length}]`

    const result = await fetchImageAsBase64(page, handle)

    if (!result.ok) {
      console.log(`${prefix} ❌ ${entry.name.padEnd(32)} @${handle.padEnd(24)} — ${result.reason}`)
      failures.push({ id: entry.id, handle, reason: result.reason })
      fail++
      await sleep(jitter(1500, 3000))
      continue
    }

    const sizeKB = Math.round(result.size / 1024)
    console.log(`${prefix} ✅ ${entry.name.padEnd(32)} @${handle.padEnd(24)} ${sizeKB}KB`)

    if (APPLY) {
      try {
        const buffer = Buffer.from(result.b64, 'base64')
        const storageUrl = await uploadToStorage(entry.id, buffer, result.contentType)
        const { error: e } = await sb.from('ranking_entries').update({ image_url: storageUrl }).eq('id', entry.id)
        if (e) { console.error(`    SAVE FAIL: ${e.message}`); fail++; continue }
        console.log(`    💾 ${storageUrl.substring(0, 80)}`)
        ok++
      } catch (err) {
        console.error(`    UPLOAD FAIL: ${err.message}`)
        fail++
        failures.push({ id: entry.id, handle, reason: 'upload:' + err.message })
      }
    } else {
      ok++
    }

    await sleep(jitter(2000, 4000))
  }

  await browser.close()

  console.log(`\n✅ OK: ${ok} | ❌ Failed: ${fail}`)
  if (failures.length > 0) {
    console.log('\nFailed entries:')
    failures.forEach(f => console.log(`  ${f.id} @${f.handle} — ${f.reason}`))
  }

  if (!APPLY) console.log('\nDRY RUN — pass --apply to actually upload.')
}

main().catch(err => { console.error(err); process.exit(1) })
