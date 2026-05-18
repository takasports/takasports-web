#!/usr/bin/env node
// Reemplazo de la lógica inline de WF-10 (n8n).
//
// Antes WF-10 hacía fetch al endpoint anónimo de Instagram
// (`web_profile_info`), que ahora devuelve 401 sistemático y deja
// `reels.json` congelado. Este script usa la Graph API OFICIAL
// (INSTAGRAM_ACCESS_TOKEN) y sube el resultado a Supabase Storage.
//
// En n8n: sustituir el nodo de fetch anónimo por un Execute Command
//   node scripts/sync-reels-storage.mjs
// (o portar este fetch a un nodo HTTP Request con el token).
//
// Env requeridas:
//   INSTAGRAM_ACCESS_TOKEN       token largo OAuth (60 días)
//   NEXT_PUBLIC_SUPABASE_URL     proyecto Supabase
//   SUPABASE_SERVICE_ROLE_KEY    para escribir en el bucket `reels`

const TOKEN  = process.env.INSTAGRAM_ACCESS_TOKEN
const SUPA   = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const SPORT_KEYWORDS = {
  futbol:     ['futbol','football','laliga','champions','premier','bundesliga','seriea','serie a','gol','messi','ronaldo','madrid','barca','barcelona','copa','neymar','mourinho','mbapp','bellingham','vinicius','yamal','pedri','lewandowski','haaland','salah','ancelotti','guardiola','portero','delantero','derbi','derby','rashford','ascenso','fichaje'],
  baloncesto: ['nba','baloncesto','basketball','basket','lakers','celtics','curry','lebron','doncic','jokic','tatum','antetokounmpo','euroleague','acb','eurobasket'],
  formula1:   ['formula 1','formula1','formula one','f1','verstappen','hamilton','ferrari','mclaren','mercedes','red bull','monaco','grand prix','alonso','norris','leclerc','sainz','pole','circuito'],
  tenis:      ['tenis','tennis','atp','wta','alcaraz','djokovic','nadal','sinner','swiatek','wimbledon','roland garros','us open','tiebreak','ace'],
  ufc:        ['ufc','mma','boxing','boxeo','pelea','fight','octagon','knockout','ko','combate','cinturon','campeon','mcgregor','makhachev','adesanya'],
  wwe:        ['wwe','wrestling','lucha libre','aew','raw','smackdown','wrestlemania','royal rumble','summerslam','samoano','roman reigns','cody rhodes','cm punk','seth rollins','undertaker','liv morgan','iyo sky','jacob fatu','becky lynch','sami zayn','trick williams'],
  rugby:      ['rugby','rugbi','six nations','all blacks','top 14','scrum','try'],
}

function detectSport(caption) {
  const text = (caption || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [sport, kws] of Object.entries(SPORT_KEYWORDS)) {
    if (kws.some(k => (k.length <= 4 ? new RegExp(`\\b${k}\\b`).test(text) : text.includes(k)))) return sport
  }
  return ''
}

function extractTitle(caption) {
  if (!caption) return 'Reel'
  const first = caption.split('\n')[0].replace(/#\S+/g, '').replace(/@\S+/g, '').trim()
  if (!first) return 'Reel'
  return first.length > 65 ? first.slice(0, 62) + '…' : first
}

async function fetchGraphReels() {
  const url = new URL('https://graph.instagram.com/me/media')
  url.searchParams.set('fields', 'id,media_type,thumbnail_url,timestamp,caption,permalink')
  url.searchParams.set('access_token', TOKEN)
  url.searchParams.set('limit', '50')

  const res = await fetch(url.toString())
  const data = await res.json()
  if (data.error) throw new Error(`Graph API: ${data.error.message}`)
  if (!res.ok)    throw new Error(`Graph API HTTP ${res.status}`)

  return (data.data ?? [])
    .filter(m => m.media_type === 'REEL' || m.media_type === 'VIDEO')
    .map(m => {
      const caption = m.caption ?? ''
      const thumb = m.thumbnail_url
      return {
        id:            m.id,
        instagram_url: m.permalink,
        thumbnail_url: thumb ? `/api/instagram/thumbnail?url=${encodeURIComponent(thumb)}` : null,
        video_url:     null, // Graph no expone video_url; el frontend cae al embed oficial
        timestamp:     m.timestamp, // ISO 8601
        caption,
        sport:         detectSport(caption),
        title:         extractTitle(caption),
      }
    })
}

async function uploadToStorage(reels) {
  const endpoint = `${SUPA}/storage/v1/object/reels/reels.json`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SVCKEY}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
      'cache-control': 'max-age=300',
    },
    body: JSON.stringify(reels),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Storage upload HTTP ${res.status}: ${txt.slice(0, 200)}`)
  }
}

async function main() {
  if (!TOKEN)  throw new Error('Falta INSTAGRAM_ACCESS_TOKEN')
  if (!SUPA)   throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL')
  if (!SVCKEY) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')

  process.stdout.write('Fetching @taka.sports (Graph API)... ')
  const reels = await fetchGraphReels()
  console.log(`OK — ${reels.length} reels`)
  if (reels.length === 0) throw new Error('Graph API devolvió 0 reels (¿token caducado?)')

  await uploadToStorage(reels)
  const newest = reels
    .map(r => new Date(r.timestamp).getTime())
    .sort((a, b) => b - a)[0]
  console.log(`✅ Subido a Storage. Reel más reciente: ${new Date(newest).toISOString()}`)
}

main().catch(err => {
  console.error('\n❌', err.message)
  process.exit(1)
})
