// v2: si el channel id no funciona, busca por nombre con YouTube search.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/kun/Desktop/Proyectos Claude/takasports/takasports-web/.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const YT = process.env.YOUTUBE_API_KEY
const BUCKET = 'avatars'

async function fetchBuf(url, minKb = 4) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < minKb * 1024) return null
    return { buf, ct: r.headers.get('content-type') ?? 'image/jpeg' }
  } catch { return null }
}

async function ytChannelById(id) {
  if (!id) return null
  const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${id}&key=${YT}`)
  const j = await r.json()
  return j?.items?.[0]
}
async function ytChannelByHandle(handle) {
  if (!handle) return null
  const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handle.replace(/^@/, ''))}&key=${YT}`)
  const j = await r.json()
  return j?.items?.[0]
}
async function ytSearch(q) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(q)}&key=${YT}`)
  const j = await r.json()
  return j?.items?.[0]
}

async function findAvatar(name, handles) {
  const h = handles ?? {}
  // 1) channel ID en handles.youtube si parece UC...
  if (h.youtube && /^UC[A-Za-z0-9_-]{22}$/.test(h.youtube)) {
    const c = await ytChannelById(h.youtube)
    const u = c?.snippet?.thumbnails?.high?.url
    if (u) {
      const p = await fetchBuf(u); if (p) return { p, src: 'YT-id' }
    }
  }
  // 2) handle YouTube (@xxx)
  if (h.youtube) {
    const c = await ytChannelByHandle(h.youtube)
    const u = c?.snippet?.thumbnails?.high?.url
    if (u) {
      const p = await fetchBuf(u); if (p) return { p, src: 'YT-handle' }
    }
  }
  // 3) buscar por nombre
  const c = await ytSearch(name)
  const u = c?.snippet?.thumbnails?.high?.url ?? c?.snippet?.thumbnails?.medium?.url
  if (u) {
    const p = await fetchBuf(u); if (p) return { p, src: 'YT-search' }
  }
  return null
}

async function main() {
  const { data: rows } = await sb.from('ranking_entries')
    .select('id, name, handles')
    .eq('category', 'creadores').eq('active', true).is('image_url', null)
  console.log(`procesando ${rows.length} sin foto`)
  let ok = 0, fail = 0
  for (const r of rows) {
    process.stdout.write(`  ${r.id.padEnd(22)} `)
    const found = await findAvatar(r.name, r.handles)
    if (!found) { console.log('❌'); fail++; continue }
    const { p, src } = found
    const ext = p.ct.includes('png') ? 'png' : 'jpg'
    const key = `${r.id}.${ext}`
    const up = await sb.storage.from(BUCKET).upload(key, p.buf, { contentType: p.ct, upsert: true })
    if (up.error) { console.log('❌ st', up.error.message); fail++; continue }
    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
    await sb.from('ranking_entries').update({ image_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', r.id)
    console.log(`✓ ${src} ${(p.buf.length/1024).toFixed(0)}kb`)
    ok++
  }
  console.log(`\n${ok} OK · ${fail} fail`)
}
main()
