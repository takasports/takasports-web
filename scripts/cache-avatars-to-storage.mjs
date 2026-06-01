#!/usr/bin/env node
// cache-avatars-to-storage.mjs
//
// Descarga TODAS las image_url que apunten a unavatar.io y las cachea
// a Supabase Storage (bucket "avatars"). Sustituye image_url por la URL
// pública permanente del bucket. Hace que las fotos no dependan de un
// servicio externo (unavatar puede caer o renombrar handles).
//
// Uso:
//   node scripts/cache-avatars-to-storage.mjs            # DRY RUN
//   node scripts/cache-avatars-to-storage.mjs --apply
//   node scripts/cache-avatars-to-storage.mjs --apply --limit=20

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY = process.argv.includes('--apply')
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null
const BUCKET = 'avatars'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function ensureBucket() {
  const { data: buckets } = await sb.storage.listBuckets()
  if (buckets?.find(b => b.id === BUCKET)) return
  if (!APPLY) { console.log(`(dry) crearía bucket "${BUCKET}"`); return }
  const { error } = await sb.storage.createBucket(BUCKET, { public: true })
  if (error) throw new Error('No se pudo crear bucket: ' + error.message)
  console.log(`Bucket "${BUCKET}" creado.`)
}

async function download(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TakaSports/1.0' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1024) return null  // imagen demasiado pequeña → placeholder
    const ct = res.headers.get('content-type') || 'image/jpeg'
    return { buffer: buf, contentType: ct }
  } catch (e) {
    return null
  }
}

async function upload(id, payload) {
  const ext = payload.contentType.includes('png') ? 'png' : 'jpg'
  const key = `${id}.${ext}`
  const { error } = await sb.storage.from(BUCKET).upload(key, payload.buffer, {
    contentType: payload.contentType,
    upsert: true,
  })
  if (error) throw new Error('Upload falló: ' + error.message)
  const { data } = sb.storage.from(BUCKET).getPublicUrl(key)
  return data.publicUrl
}

async function main() {
  console.log(APPLY ? '🔥 APPLY mode' : 'DRY RUN — añade --apply para escribir')
  await ensureBucket()

  let query = sb
    .from('ranking_entries')
    .select('id, name, image_url')
    .like('image_url', '%unavatar.io%')
    .eq('active', true)
  const { data, error } = await query
  if (error) { console.error(error); process.exit(1) }

  let pool = data
  if (LIMIT) pool = pool.slice(0, LIMIT)
  console.log(`Procesando ${pool.length} entries con avatar de unavatar.io`)

  let ok = 0, fail = 0
  for (const row of pool) {
    process.stdout.write(`  ${row.id.padEnd(36)} `)
    const payload = await download(row.image_url)
    if (!payload) {
      console.log('❌ download')
      fail++
      await sleep(150)
      continue
    }
    if (!APPLY) {
      console.log(`✓ (dry) ${(payload.buffer.length / 1024).toFixed(0)}kb`)
      ok++
      continue
    }
    try {
      const publicUrl = await upload(row.id, payload)
      const { error: upErr } = await sb
        .from('ranking_entries')
        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (upErr) throw new Error(upErr.message)
      console.log(`✓ ${publicUrl}`)
      ok++
    } catch (e) {
      console.log('❌ ' + e.message)
      fail++
    }
    await sleep(250)
  }

  console.log(`\nDone: ${ok} OK · ${fail} fail`)
}

main().catch(e => { console.error(e); process.exit(1) })
