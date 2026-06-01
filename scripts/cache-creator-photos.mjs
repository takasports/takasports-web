// Descarga avatares de creators con URL unavatar.io y los sube a Supabase Storage.
// Si el handle Twitter devuelve placeholder (<5KB), intenta scrape og:image
// directamente desde x.com/<handle>.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join('/Users/kun/Desktop/Proyectos Claude/takasports/takasports-web', '.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)
const BUCKET = 'avatars'

async function ensureBucket() {
  const { data } = await sb.storage.listBuckets()
  if (!data?.find(b => b.id === BUCKET)) {
    await sb.storage.createBucket(BUCKET, { public: true })
    console.log(`bucket ${BUCKET} creado`)
  }
}

async function tryFetch(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'TakaSports/1.0' }, redirect: 'follow' })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 5 * 1024) return null  // placeholder
    return { buf, ct: r.headers.get('content-type') ?? 'image/jpeg' }
  } catch { return null }
}

// Scrape og:image directo (cuando unavatar falla)
async function ogImage(handle) {
  for (const host of ['nitter.net', 'x.com']) {
    try {
      const r = await fetch(`https://${host}/${handle}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TakaBot/1.0)' },
      })
      if (!r.ok) continue
      const html = await r.text()
      const m = html.match(/<meta property="og:image"[^>]+content="([^"]+)"/) ||
                html.match(/<meta name="twitter:image"[^>]+content="([^"]+)"/)
      if (m?.[1]) {
        const img = await tryFetch(m[1].replace(/&amp;/g, '&'))
        if (img) return img
      }
    } catch { /* try next */ }
  }
  return null
}

async function main() {
  await ensureBucket()
  const { data: rows, error } = await sb
    .from('ranking_entries')
    .select('id, name, image_url, handles')
    .eq('category', 'creadores').eq('active', true)
    .like('image_url', '%unavatar.io%')
  if (error) { console.error(error); process.exit(1) }
  console.log(`Procesando ${rows.length} creadores con unavatar`)

  let ok = 0, fail = 0
  for (const r of rows) {
    process.stdout.write(`  ${r.id.padEnd(28)} `)
    const handle = (r.handles?.twitter || r.handles?.instagram || '').replace(/^@/, '')
    let payload = await tryFetch(r.image_url)
    if (!payload && handle) {
      process.stdout.write('(unavatar fail, trying og:image) ')
      payload = await ogImage(handle)
    }
    if (!payload) {
      console.log('❌ no avatar')
      fail++; continue
    }
    const ext = payload.ct.includes('png') ? 'png' : 'jpg'
    const key = `${r.id}.${ext}`
    const upRes = await sb.storage.from(BUCKET).upload(key, payload.buf, {
      contentType: payload.ct, upsert: true,
    })
    if (upRes.error) { console.log('❌', upRes.error.message); fail++; continue }
    const publicUrl = sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
    const { error: upErr } = await sb.from('ranking_entries')
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', r.id)
    if (upErr) { console.log('❌ DB', upErr.message); fail++; continue }
    console.log(`✓ ${(payload.buf.length/1024).toFixed(0)}kb`)
    ok++
  }
  console.log(`\nDone: ${ok} OK · ${fail} fail`)
}
main()
