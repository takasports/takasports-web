#!/usr/bin/env node
// ingest-instagram-avatars-pw.mjs
//
// Uses Playwright (Chromium) to extract Instagram profile photos for all
// ranking_entries that are missing image_url. Runs fully autonomously.
//
// Strategy:
//   1. Navigate to instagram.com/{handle}/
//   2. Read og:image meta tag (available even without login, even on error pages)
//   3. Use page.evaluate() to fetch the CDN image + return as base64
//   4. Upload Buffer to Supabase Storage bucket "avatars"
//   5. Update ranking_entries.image_url
//
// Usage:
//   node scripts/ingest-instagram-avatars-pw.mjs              # DRY RUN
//   node scripts/ingest-instagram-avatars-pw.mjs --apply
//   node scripts/ingest-instagram-avatars-pw.mjs --apply --ids=illojuan,nexxuzHD

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
    // Navigate with realistic timeout
    await page.goto(`https://www.instagram.com/${handle}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000
    })
    // Brief wait for SSR meta tags to be in DOM
    await sleep(1500)

    // Run fetch inside browser context — no CORS issues, no HMAC mismatch
    const result = await page.evaluate(async () => {
      const meta = document.querySelector('meta[property="og:image"]')
      if (!meta?.content) return { ok: false, reason: 'no_og_image' }

      // Try s320x320 first, fall back to s100x100
      let url = meta.content
      // Prefer a reasonable resolution but small file
      url = url.replace(/stp=dst-jpg_e35_s\d+x\d+[^&]*/g, 'stp=dst-jpg_e35_s240x240')
            || url

      try {
        let res = await fetch(url)
        if (!res.ok && url.includes('s240x240')) {
          // try original URL
          res = await fetch(meta.content)
        }
        if (!res.ok) return { ok: false, reason: 'fetch_' + res.status }
        const buf = await res.arrayBuffer()
        const bytes = new Uint8Array(buf)
        if (bytes.length < 500) return { ok: false, reason: 'too_small_' + bytes.length }
        // Convert to base64 in chunks to avoid call stack overflow on large images
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
  // Supabase Storage keys must be ASCII — normalize accents and strip remaining non-safe chars
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

  // Fetch ALL entries with pagination (Supabase default limit is 1000)
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
    if (!e.handles?.instagram) return false
    if (ONLY_IDS && !ONLY_IDS.has(e.id)) return false
    if (!FORCE && e.image_url) return false
    return true
  })

  console.log(`Entries to process: ${candidates.length}\n`)
  if (candidates.length === 0) { console.log('Nothing to do.'); return }

  if (APPLY) {
    const { data: buckets } = await sb.storage.listBuckets()
    if (!buckets?.find(b => b.id === BUCKET)) {
      await sb.storage.createBucket(BUCKET, { public: true })
      console.log(`Bucket "${BUCKET}" created.`)
    }
  }

  // Launch Playwright Chromium (non-headless for better IG fingerprint)
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ]
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'es-ES',
    extraHTTPHeaders: {
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    }
  })

  // Dismiss automation banner
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  // Visit Instagram home first to get cookies/session
  console.log('Warming up Instagram session...')
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
  await sleep(2000)

  let ok = 0, fail = 0, skip = 0
  const failures = []

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i]
    const handle = entry.handles.instagram.replace(/^@/, '').trim()
    const prefix = `[${String(i+1).padStart(3)}/${candidates.length}]`

    const result = await fetchImageAsBase64(page, handle)

    if (!result.ok) {
      const msg = `${prefix} ❌ ${entry.name.padEnd(32)} @${handle.padEnd(24)} — ${result.reason}`
      console.log(msg)
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

    // Realistic delay between requests (2-5s)
    await sleep(jitter(2000, 5000))
  }

  await browser.close()

  console.log(`\n✅ OK: ${ok} | ❌ Failed: ${fail} | ⏭ Skipped: ${skip}`)

  if (failures.length > 0) {
    console.log('\nFailed entries:')
    failures.forEach(f => console.log(`  ${f.id} @${f.handle} — ${f.reason}`))
  }

  if (!APPLY) console.log('\nDRY RUN — pass --apply to actually upload.')
}

main().catch(err => { console.error(err); process.exit(1) })
