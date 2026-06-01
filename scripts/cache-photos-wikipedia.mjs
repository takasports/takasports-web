// Descarga fotos de entrenadores (Wikipedia) y logos de clubes femeninos (ESPN/Wikipedia)
// y las sube a Supabase Storage.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/kun/Desktop/Proyectos Claude/takasports/takasports-web/.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const BUCKET = 'avatars'

async function fetchBuf(url, minKb = 4) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'TakaSports/1.0 (contact@takasportsmedia.com)' }, redirect: 'follow' })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < minKb * 1024) return null
    return { buf, ct: r.headers.get('content-type') ?? 'image/jpeg' }
  } catch { return null }
}

// Wikipedia REST: /page/summary/<title> devuelve thumbnail.source
async function wikipediaImage(query) {
  for (const lang of ['es', 'en']) {
    try {
      const search = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodeURIComponent(query)}&srlimit=1`)
      const sj = await search.json()
      const title = sj?.query?.search?.[0]?.title
      if (!title) continue
      const sum = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
      const sj2 = await sum.json()
      const url = sj2?.originalimage?.source ?? sj2?.thumbnail?.source
      if (!url) continue
      const p = await fetchBuf(url, 5)
      if (p) return p
    } catch {}
  }
  return null
}

// Para clubes: prueba ESPN logo por team_id si es espn-club-XXXX o espn-clubf-XXXX
async function espnLogo(id) {
  const m = id.match(/^espn-(club|clubf)-(\d+)$/)
  if (!m) return null
  const teamId = m[2]
  const url = `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`
  return await fetchBuf(url, 1)
}

async function upload(id, payload) {
  const ext = payload.ct.includes('png') ? 'png' : 'jpg'
  const key = `${id}.${ext}`
  const up = await sb.storage.from(BUCKET).upload(key, payload.buf, { contentType: payload.ct, upsert: true })
  if (up.error) throw new Error(up.error.message)
  return sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
}

async function processRows(rows, finder, label) {
  console.log(`\n== ${label} (${rows.length}) ==`)
  let ok = 0, fail = 0
  for (const r of rows) {
    process.stdout.write(`  ${r.id.padEnd(36)} `)
    const payload = await finder(r)
    if (!payload) { console.log('❌'); fail++; continue }
    try {
      const url = await upload(r.id, payload)
      await sb.from('ranking_entries').update({ image_url: url, updated_at: new Date().toISOString() }).eq('id', r.id)
      console.log(`✓ ${(payload.buf.length/1024).toFixed(0)}kb`)
      ok++
    } catch (e) { console.log('❌', e.message); fail++ }
  }
  console.log(`${ok} OK · ${fail} fail`)
}

async function main() {
  // Entrenadores
  const { data: coaches } = await sb.from('ranking_entries')
    .select('id, name')
    .eq('category', 'entrenadores').eq('active', true).is('image_url', null)
  await processRows(coaches ?? [], (r) => wikipediaImage(r.name), 'Entrenadores')

  // Clubes femeninos
  const { data: clubsF } = await sb.from('ranking_entries')
    .select('id, name')
    .eq('category', 'clubes_femenino').eq('active', true).is('image_url', null)
  await processRows(clubsF ?? [], async (r) => {
    const espn = await espnLogo(r.id)
    if (espn) return espn
    return await wikipediaImage(r.name + ' Femenino')
  }, 'Clubes femeninos')

  // Luchadores WWE top en jugadores (sin foto)
  const { data: wweTop } = await sb.from('ranking_entries')
    .select('id, name')
    .eq('category', 'jugadores').eq('active', true).eq('sport', 'wwe').is('image_url', null)
  await processRows(wweTop ?? [], (r) => wikipediaImage(r.name + ' wrestler'), 'WWE jugadores')
}
main()
