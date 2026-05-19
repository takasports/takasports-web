#!/usr/bin/env node
// image-collector-server.mjs
//
// Servidor HTTP local (puerto 3099) que recibe imágenes en base64
// desde el contexto del browser y las sube a Supabase Storage.
//
// Uso (en una terminal separada, luego ejecuta el script del Chrome):
//   node scripts/image-collector-server.mjs

import { createClient } from '@supabase/supabase-js'
import { createServer }  from 'http'
import { config }        from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const PORT   = 3099
const BUCKET = 'avatars'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const server = createServer(async (req, res) => {
  // CORS + Private Network Access (Chrome blocks HTTPS→HTTP localhost without this)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (req.method !== 'POST' || req.url !== '/upload') {
    res.writeHead(404); res.end('Not found'); return
  }

  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', async () => {
    try {
      const { id, dataUrl } = JSON.parse(body)
      if (!id || !dataUrl) throw new Error('Missing id or dataUrl')

      // dataUrl = "data:image/jpeg;base64,/9j/..."
      const [meta, b64] = dataUrl.split(',')
      if (!b64) throw new Error('Invalid dataUrl format')
      const contentType = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      const buffer = Buffer.from(b64, 'base64')

      if (buffer.length < 1000) throw new Error(`Image too small: ${buffer.length} bytes`)

      const ext = contentType.includes('png') ? 'png' : 'jpg'
      const filePath = `${id}.${ext}`

      const { error: upErr } = await sb.storage.from(BUCKET).upload(filePath, buffer, { contentType, upsert: true })
      if (upErr) throw new Error('Storage upload: ' + upErr.message)

      const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      const { error: dbErr } = await sb.from('ranking_entries').update({ image_url: publicUrl }).eq('id', id)
      if (dbErr) throw new Error('DB update: ' + dbErr.message)

      console.log(`  ✅ ${id} → ${Math.round(buffer.length/1024)}KB → Storage`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, url: publicUrl }))

    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: err.message }))
    }
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Image collector server en http://127.0.0.1:${PORT}/upload`)
  console.log('   Esperando imágenes del browser...\n')
})
