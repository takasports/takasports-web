#!/usr/bin/env node
// upload-from-dec.mjs
// Reads a decimal-encoded image file (/tmp/{id}.dec) and uploads to Supabase Storage.
// Called after Chrome MCP extracts each image.
//
// Usage:
//   node scripts/upload-from-dec.mjs <id> <decfile>
//   node scripts/upload-from-dec.mjs rafaescrig-futbol /tmp/rafaescrig-futbol.dec

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const BUCKET = 'avatars'
const [,, id, decFile] = process.argv
if (!id || !decFile) { console.error('Usage: upload-from-dec.mjs <id> <decfile>'); process.exit(1) }

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const decStr = fs.readFileSync(decFile, 'utf8').trim()
const bytes = decStr.split(' ').map(Number)
const buffer = Buffer.from(bytes)

if (buffer.length < 500) { console.error('Too small:', buffer.length, 'bytes'); process.exit(1) }

// Detect content type from magic bytes
const contentType = (buffer[0]===0xFF && buffer[1]===0xD8) ? 'image/jpeg'
  : (buffer[0]===0x89 && buffer[1]===0x50) ? 'image/png' : 'image/jpeg'
const ext = contentType.includes('png') ? 'png' : 'jpg'
const filePath = `${id}.${ext}`

const { error: upErr } = await sb.storage.from(BUCKET).upload(filePath, buffer, { contentType, upsert: true })
if (upErr) { console.error('Upload failed:', upErr.message); process.exit(1) }

const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath)
const publicUrl = data.publicUrl

const { error: dbErr } = await sb.from('ranking_entries').update({ image_url: publicUrl }).eq('id', id)
if (dbErr) { console.error('DB update failed:', dbErr.message); process.exit(1) }

fs.unlinkSync(decFile)
console.log(`✅ ${id} → ${Math.round(buffer.length/1024)}KB → ${publicUrl.substring(0,80)}`)
