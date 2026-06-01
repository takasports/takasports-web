// Para creators sin foto, intenta:
//   1) YouTube Data API (channel snippet.thumbnails.high.url)
//   2) Instagram via mobile.instagram.com og:image
//   3) Twitter unavatar como último fallback
// Sube todo a Supabase Storage.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/kun/Desktop/Proyectos Claude/takasports/takasports-web/.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const YT_KEY = process.env.YOUTUBE_API_KEY
const BUCKET = 'avatars'

async function tryFetch(url, minKb = 4) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TakaBot/1.0)' },
      redirect: 'follow',
    })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < minKb * 1024) return null
    return { buf, ct: r.headers.get('content-type') ?? 'image/jpeg' }
  } catch { return null }
}

async function fromYouTube(channelIdOrHandle) {
  if (!YT_KEY || !channelIdOrHandle) return null
  let id = channelIdOrHandle.replace(/^@/, '')
  let url
  if (id.startsWith('UC') && id.length === 24) {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${id}&key=${YT_KEY}`
  } else {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(id)}&key=${YT_KEY}`
  }
  try {
    const r = await fetch(url)
    const j = await r.json()
    const thumb = j?.items?.[0]?.snippet?.thumbnails
    const imgUrl = thumb?.high?.url ?? thumb?.medium?.url ?? thumb?.default?.url
    if (!imgUrl) return null
    return await tryFetch(imgUrl)
  } catch { return null }
}

async function fromInstagram(handle) {
  if (!handle) return null
  try {
    const r = await fetch(`https://www.instagram.com/${handle}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    })
    if (!r.ok) return null
    const html = await r.text()
    const m = html.match(/<meta property="og:image"[^>]+content="([^"]+)"/i)
    if (!m) return null
    return await tryFetch(m[1].replace(/&amp;/g, '&'))
  } catch { return null }
}

async function fromUnavatarTwitter(handle) {
  if (!handle) return null
  return await tryFetch(`https://unavatar.io/twitter/${handle.replace(/^@/, '')}`, 5)
}

async function main() {
  const { data: rows } = await sb
    .from('ranking_entries')
    .select('id, name, handles')
    .eq('category', 'creadores').eq('active', true)
    .is('image_url', null)
  console.log(`procesando ${rows.length} sin foto`)
  let ok = 0, fail = 0
  for (const r of rows) {
    process.stdout.write(`  ${r.id.padEnd(22)} `)
    const h = r.handles ?? {}
    let payload = null, src = ''
    if (h.youtube)   { payload = await fromYouTube(h.youtube);     if (payload) src = 'YT' }
    if (!payload && h.instagram) { payload = await fromInstagram(h.instagram); if (payload) src = 'IG' }
    if (!payload && h.twitter)   { payload = await fromUnavatarTwitter(h.twitter); if (payload) src = 'TW' }
    if (!payload) { console.log('❌ ningún source'); fail++; continue }

    const ext = payload.ct.includes('png') ? 'png' : 'jpg'
    const key = `${r.id}.${ext}`
    const up = await sb.storage.from(BUCKET).upload(key, payload.buf, { contentType: payload.ct, upsert: true })
    if (up.error) { console.log('❌ storage', up.error.message); fail++; continue }
    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
    await sb.from('ranking_entries').update({ image_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', r.id)
    console.log(`✓ ${src} ${(payload.buf.length/1024).toFixed(0)}kb`)
    ok++
  }
  console.log(`\nDone: ${ok} OK · ${fail} fail`)
}
main()
