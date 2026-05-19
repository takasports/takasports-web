#!/usr/bin/env node
// ingest-creator-images-ig2.mjs
//
// Obtiene fotos de perfil de Instagram extrayendo la URL firmada
// directamente del HTML SSR de Instagram (sin API, sin login).
//
// Método: GET https://www.instagram.com/{handle}/ → parsea og:image del HTML
//   → descarga con headers Sec-Fetch-* de browser → sube a Supabase Storage
//
// Sin rate-limit de API. Funciona indefinidamente con pauses modestas.
// Guarda en bucket "avatars" → URL permanente en Supabase Storage.
//
// Uso:
//   node scripts/ingest-creator-images-ig2.mjs              # DRY RUN, batch 50
//   node scripts/ingest-creator-images-ig2.mjs --apply
//   node scripts/ingest-creator-images-ig2.mjs --apply --all
//   node scripts/ingest-creator-images-ig2.mjs --apply --force
//   node scripts/ingest-creator-images-ig2.mjs --apply --ids=rafaescrig-futbol,iker-ruiz-futbol

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY   = process.argv.includes('--apply')
const FORCE   = process.argv.includes('--force')
const ALL     = process.argv.includes('--all')
const BUCKET  = 'avatars'

const BATCH = (() => {
  const b = process.argv.find(a => a.startsWith('--batch='))
  return b ? parseInt(b.split('=')[1]) : 50
})()
const IDS_ARG  = process.argv.find(a => a.startsWith('--ids='))
const ONLY_IDS = IDS_ARG ? new Set(IDS_ARG.split('=')[1].split(',')) : null

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const IG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
}

const IMG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
  'Referer': 'https://www.instagram.com/',
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Mode': 'no-cors',
  'Sec-Fetch-Site': 'cross-site',
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Descarga el HTML de un perfil y extrae la URL de la foto de perfil
async function fetchIGProfilePicUrl(handle) {
  const clean = handle.replace(/^@/, '').toLowerCase()
  try {
    const res = await fetch(`https://www.instagram.com/${clean}/`, {
      headers: IG_HEADERS,
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null

    // Lee HTML (puede ser gzip — fetch descomprime automáticamente)
    const html = await res.text()
    if (!html || html.length < 1000) return null

    // Extrae la URL del og:image del HTML. Patrón: t51.2885-19/...jpg?...&oh=...&oe=...
    const match = html.match(/t51\.2885-19\/[^"&?]*\.jpg[^"]*(?:oh=[^&"]+)[^"]*(?:oe=[^&"]+)[^"]*/)
    if (!match) return null

    // Decodifica entidades HTML (&amp; → &) y construye URL completa
    const rawParams = match[0].replace(/&amp;/g, '&')
    const imgUrl = `https://scontent.cdninstagram.com/v/${rawParams}`

    // Intenta subir resolución: s100x100 → s320x320
    return imgUrl.replace(/stp=dst-jpg_s\d+x\d+[^&]*/, 'stp=dst-jpg_s320x320')

  } catch { return null }
}

// Descarga imagen desde URL firmada de Instagram CDN
async function downloadImage(url) {
  try {
    const res = await fetch(url, {
      headers: IMG_HEADERS,
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      // Si falla la versión 320x320, intenta s100x100
      if (url.includes('s320x320')) {
        const fallback = url.replace('stp=dst-jpg_s320x320', 'stp=dst-jpg_s100x100_tt6')
        const res2 = await fetch(fallback, { headers: IMG_HEADERS, signal: AbortSignal.timeout(15000) })
        if (!res2.ok) return null
        const contentType = res2.headers.get('content-type') ?? 'image/jpeg'
        if (!contentType.startsWith('image/')) return null
        const buffer = Buffer.from(await res2.arrayBuffer())
        return buffer.length >= 1000 ? { buffer, contentType } : null
      }
      return null
    }
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return buffer.length >= 1000 ? { buffer, contentType } : null
  } catch { return null }
}

// Sube imagen a Supabase Storage y devuelve URL pública
async function uploadToStorage(id, buffer, contentType) {
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const filePath = `${id}.${ext}`
  const { error } = await sb.storage.from(BUCKET).upload(filePath, buffer, { contentType, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | Batch: ${ALL ? 'ALL' : BATCH} | Force: ${FORCE}\n`)

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, handles, image_url')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
    .eq('active', true)
    .not('handles', 'is', null)
    .order('name')
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const candidates = entries.filter(e => {
    if (!e.handles?.instagram) return false
    if (ONLY_IDS && !ONLY_IDS.has(e.id)) return false
    if (!FORCE && e.image_url) return false
    return true
  })

  const toProcess = ALL ? candidates : candidates.slice(0, BATCH)
  console.log(`Con IG sin imagen: ${candidates.length} | Procesando: ${toProcess.length}\n`)

  if (APPLY) {
    const { data: buckets } = await sb.storage.listBuckets()
    if (!buckets?.find(b => b.id === BUCKET)) {
      await sb.storage.createBucket(BUCKET, { public: true })
      console.log(`Bucket "${BUCKET}" creado.`)
    }
  }

  let ok = 0, fail = 0
  for (const entry of toProcess) {
    const handle = entry.handles.instagram.replace(/^@/, '')

    const picUrl = await fetchIGProfilePicUrl(handle)
    if (!picUrl) {
      console.log(`  ❌ ${entry.name.padEnd(36)} @${handle} — sin URL`)
      fail++
      await sleep(1500)
      continue
    }

    const img = await downloadImage(picUrl)
    if (!img) {
      console.log(`  ❌ ${entry.name.padEnd(36)} @${handle} — descarga falló`)
      fail++
      await sleep(1500)
      continue
    }

    const sizeKB = Math.round(img.buffer.length / 1024)
    console.log(`  ✅ ${entry.name.padEnd(36)} @${handle} (${sizeKB}KB)`)

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
      }
    } else {
      ok++
    }

    await sleep(1200) // 1.2s entre requests
  }

  console.log(`\nDescargadas: ${ok} | Sin resultado: ${fail}`)
  if (!APPLY) console.log('DRY RUN — pasa --apply para guardar.')
}

main().catch(err => { console.error(err); process.exit(1) })
