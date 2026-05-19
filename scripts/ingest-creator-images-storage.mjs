#!/usr/bin/env node
// ingest-creator-images-storage.mjs
//
// Descarga fotos de perfil de Instagram y las sube a Supabase Storage.
// Resultado: image_url apunta a https://<project>.supabase.co/storage/v1/object/public/avatars/<id>.jpg
// — URL permanente, no expira, self-hosted.
//
// Método: unavatar.io/instagram/<handle> (proxy público, sin API key, sin rate-limit propio)
//   → descarga imagen → sube a bucket "avatars" → guarda URL pública
//
// Procesa solo los que tengan handles.instagram y no tengan image_url (o --force).
// Puede filtrarse a IDs específicos con --ids=id1,id2,id3
//
// Uso:
//   node scripts/ingest-creator-images-storage.mjs           # DRY RUN
//   node scripts/ingest-creator-images-storage.mjs --apply
//   node scripts/ingest-creator-images-storage.mjs --apply --force
//   node scripts/ingest-creator-images-storage.mjs --apply --ids=iker-ruiz-futbol,lacobra-futbol

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')
const IDS_ARG = process.argv.find(a => a.startsWith('--ids='))
const ONLY_IDS = IDS_ARG ? new Set(IDS_ARG.split('=')[1].split(',')) : null
const BUCKET = 'avatars'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Asegura que el bucket exista (crea si no existe)
async function ensureBucket() {
  const { data: buckets } = await sb.storage.listBuckets()
  if (buckets?.find(b => b.id === BUCKET)) return
  const { error } = await sb.storage.createBucket(BUCKET, { public: true })
  if (error) throw new Error('No se pudo crear bucket: ' + error.message)
  console.log(`Bucket "${BUCKET}" creado.`)
}

// Descarga imagen vía unavatar.io/instagram/<handle>
// Devuelve { buffer: Buffer, contentType: string } o null
async function downloadFromIG(handle) {
  const clean = handle.replace(/^@/, '').toLowerCase()
  const url = `https://unavatar.io/instagram/${clean}?fallback=false`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TakaSports/1.0' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 1000) return null  // imagen vacía / fallback svg
    return { buffer, contentType }
  } catch { return null }
}

// Sube imagen a Storage y devuelve la URL pública
async function uploadToStorage(id, buffer, contentType) {
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const filePath = `${id}.${ext}`
  const { error } = await sb.storage.from(BUCKET).upload(filePath, buffer, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(error.message)
  const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} | Force: ${FORCE} | Bucket: ${BUCKET}\n`)

  if (APPLY) await ensureBucket()

  // Cargar entradas
  let query = sb.from('ranking_entries')
    .select('id, name, handles, image_url')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
    .eq('active', true)
    .not('handles', 'is', null)
    .order('name')

  const { data: entries, error } = await query
  if (error) { console.error('DB error:', error.message); process.exit(1) }

  // Filtrar: tienen IG, no tienen imagen (o --force), opcionalmente --ids
  const candidates = entries.filter(e => {
    if (!e.handles?.instagram) return false
    if (ONLY_IDS && !ONLY_IDS.has(e.id)) return false
    if (!FORCE && e.image_url) return false
    return true
  })

  console.log(`Candidatos: ${candidates.length}\n`)

  let ok = 0, fail = 0
  for (const entry of candidates) {
    const handle = entry.handles.instagram.replace(/^@/, '')
    const result = await downloadFromIG(handle)

    if (!result) {
      console.log(`  ❌ ${entry.name.padEnd(36)} @${handle}`)
      fail++
    } else {
      const sizeKB = Math.round(result.buffer.length / 1024)
      console.log(`  ✅ ${entry.name.padEnd(36)} @${handle} (${sizeKB}KB)`)
      if (APPLY) {
        try {
          const url = await uploadToStorage(entry.id, result.buffer, result.contentType)
          const { error: e } = await sb.from('ranking_entries').update({ image_url: url }).eq('id', entry.id)
          if (e) { console.error(`    SAVE FAIL: ${e.message}`); fail++; continue }
          console.log(`    → ${url}`)
        } catch(err) { console.error(`    UPLOAD FAIL: ${err.message}`); fail++; continue }
      }
      ok++
    }

    await sleep(800)  // respeta rate-limit de unavatar.io
  }

  console.log(`\nDescargadas: ${ok} | Sin resultado: ${fail}`)
  if (!APPLY) console.log('DRY RUN — pasa --apply para guardar.')
}

main().catch(err => { console.error(err); process.exit(1) })
