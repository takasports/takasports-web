// v2: queries específicas + fallback a YouTube thumbnail si Wikipedia falla
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '/Users/kun/Desktop/Proyectos Claude/takasports/takasports-web/.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const BUCKET = 'avatars'
const YT = process.env.YOUTUBE_API_KEY

async function fetchBuf(url, minKb = 4) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'TakaSports/1.0 (taka@takasportsmedia.com)' }, redirect: 'follow' })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < minKb * 1024) return null
    return { buf, ct: r.headers.get('content-type') ?? 'image/jpeg' }
  } catch { return null }
}

async function wikipediaImage(title, lang = 'en') {
  try {
    const sum = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { headers: { 'User-Agent': 'TakaSports/1.0 (taka@takasportsmedia.com)' } })
    if (!sum.ok) return null
    const sj = await sum.json()
    const url = sj?.originalimage?.source ?? sj?.thumbnail?.source
    if (!url) return null
    return await fetchBuf(url, 3)
  } catch { return null }
}

// Mapping manual de coaches → títulos Wikipedia exactos
const COACH_TITLES = {
  'coach-flick':      'Hansi_Flick',
  'coach-amorim':     'Rúben_Amorim',
  'coach-guardiola':  'Pep_Guardiola',
  'coach-inzaghi':    'Simone_Inzaghi',
  'coach-pioli':      'Stefano_Pioli',
  'coach-ancelotti':  'Carlo_Ancelotti',
  'coach-arteta':     'Mikel_Arteta',
  'coach-conte':      'Antonio_Conte',
  'coach-enrique':    'Luis_Enrique',
  'coach-allegri':    'Massimiliano_Allegri',
  'coach-kompany':    'Vincent_Kompany',
  'coach-slot':       'Arne_Slot',
  'coach-tudor':      'Igor_Tudor',
  'coach-fonseca':    'Paulo_Fonseca',
}

// Mapping clubes femeninos → títulos
const CLUB_TITLES = {
  'realmadrid-f':       'Real_Madrid_Femenino',
  'chelsea-w':          'Chelsea_F.C._Women',
  'barca-f':            'FC_Barcelona_Femení',
  'arsenal-w':          'Arsenal_W.F.C.',
  'lyon-f':             'Olympique_Lyonnais_(women)',
  'wolfsburg-f':        'VfL_Wolfsburg_(women)',
  'espn-clubf-131393':  'CD_Tenerife',
  'espn-clubf-22329':   'RC_Strasbourg_Alsace',
  'espn-clubf-131297':  'RC_Lens',
  'espn-clubf-22328':   'FC_Nantes',
  'espn-clubf-131298':  'Olympique_Marseille',
  'espn-clubf-21175':   'CD_Logroño',
  'espn-clubf-21963':   'AS_Saint-Étienne',
}

async function upload(id, payload) {
  const ext = payload.ct.includes('png') ? 'png' : 'jpg'
  const key = `${id}.${ext}`
  const up = await sb.storage.from(BUCKET).upload(key, payload.buf, { contentType: payload.ct, upsert: true })
  if (up.error) throw new Error(up.error.message)
  return sb.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
}

async function tryAll(rows, mapping, fallbackQueryFn, label) {
  console.log(`\n== ${label} (${rows.length}) ==`)
  let ok = 0, fail = 0
  for (const r of rows) {
    process.stdout.write(`  ${r.id.padEnd(36)} `)
    let payload = null
    if (mapping[r.id]) {
      payload = await wikipediaImage(mapping[r.id], 'en') || await wikipediaImage(mapping[r.id], 'es')
    }
    if (!payload && fallbackQueryFn) {
      const q = fallbackQueryFn(r)
      payload = await wikipediaImage(q, 'en') || await wikipediaImage(q, 'es')
    }
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
  const { data: coaches } = await sb.from('ranking_entries')
    .select('id, name').eq('category', 'entrenadores').eq('active', true).is('image_url', null)
  await tryAll(coaches ?? [], COACH_TITLES, (r) => r.name + ' (footballer)', 'Entrenadores')

  const { data: clubsF } = await sb.from('ranking_entries')
    .select('id, name').eq('category', 'clubes_femenino').eq('active', true).is('image_url', null)
  await tryAll(clubsF ?? [], CLUB_TITLES, (r) => r.name, 'Clubes femeninos')
}
main()
