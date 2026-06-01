// Fotos para tenistas top (ATP+WTA) y luchadores WWE via Wikipedia.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/kun/Desktop/Proyectos Claude/takasports/takasports-web/.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const BUCKET = 'avatars'

async function fetchBuf(url, minKb = 3) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'TakaSports/1.0 (taka@takasportsmedia.com)' }, redirect: 'follow' })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < minKb * 1024) return null
    return { buf, ct: r.headers.get('content-type') ?? 'image/jpeg' }
  } catch { return null }
}

async function wikiSearchThenSummary(query, lang = 'en') {
  try {
    const s = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodeURIComponent(query)}&srlimit=1`,
      { headers: { 'User-Agent': 'TakaSports/1.0 (taka@takasportsmedia.com)' } })
    const sj = await s.json()
    const title = sj?.query?.search?.[0]?.title
    if (!title) return null
    const sum = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { headers: { 'User-Agent': 'TakaSports/1.0 (taka@takasportsmedia.com)' } })
    const sj2 = await sum.json()
    const url = sj2?.originalimage?.source ?? sj2?.thumbnail?.source
    if (!url) return null
    return await fetchBuf(url, 3)
  } catch { return null }
}

async function findTennis(r) {
  return (await wikiSearchThenSummary(`${r.name} tennis player`, 'en')) ||
         (await wikiSearchThenSummary(r.name, 'en')) ||
         (await wikiSearchThenSummary(r.name, 'es'))
}
async function findWWE(r) {
  return (await wikiSearchThenSummary(`${r.name} wrestler`, 'en')) ||
         (await wikiSearchThenSummary(`${r.name} WWE`, 'en')) ||
         (await wikiSearchThenSummary(r.name, 'en'))
}

async function upload(id, payload) {
  const ext = payload.ct.includes('png') ? 'png' : 'jpg'
  const key = `${id}.${ext}`
  const up = await sb.storage.from(BUCKET).upload(key, payload.buf, { contentType: payload.ct, upsert: true })
  if (up.error) throw new Error(up.error.message)
  return sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
}

async function processBatch(rows, finder, label) {
  console.log(`\n== ${label} (${rows.length}) ==`)
  let ok = 0, fail = 0
  for (const r of rows) {
    process.stdout.write(`  ${(r.id+' '+r.name).slice(0,46).padEnd(46)} `)
    const payload = await finder(r)
    if (!payload) { console.log('❌'); fail++; continue }
    try {
      const url = await upload(r.id, payload)
      await sb.from('ranking_entries').update({ image_url: url, updated_at: new Date().toISOString() }).eq('id', r.id)
      console.log(`✓ ${(payload.buf.length/1024).toFixed(0)}kb`)
      ok++
    } catch (e) { console.log('❌', e.message); fail++ }
    await new Promise(r => setTimeout(r, 100))  // rate-limit polite
  }
  console.log(`${ok} OK · ${fail} fail`)
}

async function main() {
  const { data: tennis } = await sb.from('ranking_entries')
    .select('id, name')
    .in('category', ['jugadores', 'jugadoras']).eq('sport', 'tenis').eq('active', true).is('image_url', null)
  await processBatch(tennis ?? [], findTennis, 'Tenistas')

  const { data: wwe } = await sb.from('ranking_entries')
    .select('id, name')
    .eq('category', 'jugadores').in('sport', ['wrestling', 'wwe']).eq('active', true).is('image_url', null)
  await processBatch(wwe ?? [], findWWE, 'WWE')
}
main()
