#!/usr/bin/env node
// ingest-creator-images-yt.mjs
//
// Obtiene imágenes de perfil vía YouTube Data API v3 para entradas sin image_url.
// Estrategia por prioridad:
//   1. Canal por ID (UC...) si handles.youtube empieza por UC
//   2. Canal por handle (@handle) si handles.youtube empieza por @
//   3. Búsqueda por nombre como fallback
//
// Uso:
//   node scripts/ingest-creator-images-yt.mjs             # DRY RUN
//   node scripts/ingest-creator-images-yt.mjs --apply
//   node scripts/ingest-creator-images-yt.mjs --apply --storage  # guarda en Supabase Storage

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY   = process.argv.includes('--apply')
const FORCE   = process.argv.includes('--force')
const STORAGE = process.argv.includes('--storage')
const BUCKET  = 'avatars'

const YT_API_KEY = process.env.YOUTUBE_API_KEY
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Sube imagen a Supabase Storage, devuelve URL pública o null
async function uploadToStorage(id, imageUrl) {
  try {
    const res = await fetch(imageUrl, { headers: { 'User-Agent': 'TakaSports/1.0' } })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 1000) return null
    const ext = contentType.includes('png') ? 'png' : 'jpg'
    const filePath = `${id}.${ext}`
    const { error } = await sb.storage.from(BUCKET).upload(filePath, buffer, { contentType, upsert: true })
    if (error) { console.error(`    UPLOAD FAIL ${id}: ${error.message}`); return null }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath)
    return data.publicUrl
  } catch (err) { console.error(`    DOWNLOAD FAIL ${id}: ${err.message}`); return null }
}

// Obtiene thumbnail de canal por ID o handle
async function getChannelThumbnail(ytHandle, searchName) {
  const base = 'https://www.googleapis.com/youtube/v3'

  // 1. Canal por ID (UCxxxx)
  if (ytHandle?.match(/^UC[A-Za-z0-9_-]{20,}$/)) {
    const url = `${base}/channels?part=snippet&id=${ytHandle}&key=${YT_API_KEY}`
    const res = await fetch(url)
    const d = await res.json()
    const thumb = d?.items?.[0]?.snippet?.thumbnails?.high?.url
                ?? d?.items?.[0]?.snippet?.thumbnails?.default?.url
    if (thumb) return upgradeThumb(thumb)
  }

  // 2. Canal por handle
  if (ytHandle?.startsWith('@')) {
    const handle = ytHandle.replace(/^@/, '')
    const url = `${base}/channels?part=snippet&forHandle=${encodeURIComponent(handle)}&key=${YT_API_KEY}`
    const res = await fetch(url)
    const d = await res.json()
    const thumb = d?.items?.[0]?.snippet?.thumbnails?.high?.url
                ?? d?.items?.[0]?.snippet?.thumbnails?.default?.url
    if (thumb) return upgradeThumb(thumb)
  }

  // 3. Búsqueda por nombre
  if (searchName) {
    const url = `${base}/search?part=snippet&type=channel&q=${encodeURIComponent(searchName)}&key=${YT_API_KEY}&maxResults=5`
    const res = await fetch(url)
    const d = await res.json()
    if (d?.items?.length) {
      // Toma el primer resultado cuyo título contiene alguna palabra del nombre buscado
      const words = searchName.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      const match = d.items.find(item => {
        const title = item.snippet.channelTitle.toLowerCase()
        return words.some(w => title.includes(w))
      }) ?? d.items[0]
      const thumb = match?.snippet?.thumbnails?.high?.url
                  ?? match?.snippet?.thumbnails?.default?.url
      if (thumb) return upgradeThumb(thumb)
    }
  }

  return null
}

// Sube resolución de thumbnail: s88 → s240
function upgradeThumb(url) {
  return url.replace(/=s\d+/, '=s240').replace(/-c-k-c0xffffffff-no-rj-mo/, '')
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | Storage: ${STORAGE}\n`)

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, handles, image_url')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
    .eq('active', true)
    .order('name')
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const candidates = entries.filter(e => (FORCE || !e.image_url) && e.handles?.youtube)
  console.log(`Candidatos con YouTube handle y sin imagen: ${candidates.length}\n`)

  if (APPLY && STORAGE) {
    const { data: buckets } = await sb.storage.listBuckets()
    if (!buckets?.find(b => b.id === BUCKET)) {
      await sb.storage.createBucket(BUCKET, { public: true })
      console.log(`Bucket "${BUCKET}" creado.`)
    }
  }

  let ok = 0, fail = 0
  for (const entry of candidates) {
    const ytHandle = entry.handles.youtube
    const thumb = await getChannelThumbnail(ytHandle, entry.name)

    if (!thumb) {
      console.log(`  ❌ ${entry.name.padEnd(36)} yt:${ytHandle}`)
      fail++
    } else {
      console.log(`  ✅ ${entry.name.padEnd(36)} yt:${ytHandle}`)

      if (APPLY) {
        let finalUrl = thumb
        if (STORAGE) {
          const stored = await uploadToStorage(entry.id, thumb)
          if (stored) { finalUrl = stored; console.log(`    💾 → Storage`) }
          else console.log(`    ⚠️  Storage falló, usando URL directa`)
        }
        const { error: e } = await sb.from('ranking_entries').update({ image_url: finalUrl }).eq('id', entry.id)
        if (e) { console.error(`    SAVE FAIL: ${e.message}`); fail++; continue }
        console.log(`    → ${finalUrl.substring(0, 80)}`)
      }
      ok++
    }

    await sleep(200)
  }

  console.log(`\nEncontradas: ${ok} | Sin resultado: ${fail}`)
  if (!APPLY) console.log('DRY RUN — pasa --apply para guardar.')
}

main().catch(err => { console.error(err); process.exit(1) })
