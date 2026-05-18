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
//   NEXT_PUBLIC_SUPABASE_URL     proyecto Supabase
//   SUPABASE_SERVICE_ROLE_KEY    leer/escribir app_secrets + bucket reels
//   INSTAGRAM_ACCESS_TOKEN       (opcional) solo bootstrap si app_secrets vacío
//
// El token vive en la tabla privada `app_secrets` (clave ig_access_token).
// Cada corrida lo refresca (Graph ig_refresh_token, sin login) y lo
// reescribe, así que NUNCA caduca mientras el WF-10 corra cada ≤60d.

const SUPA   = process.env.NEXT_PUBLIC_SUPABASE_URL
const SVCKEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ENV_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN

const restHeaders = () => ({
  apikey: SVCKEY, Authorization: `Bearer ${SVCKEY}`, 'Content-Type': 'application/json',
})

async function readToken() {
  try {
    const res = await fetch(
      `${SUPA}/rest/v1/app_secrets?key=eq.ig_access_token&select=value`,
      { headers: restHeaders() })
    if (res.ok) { const r = await res.json(); if (r[0]?.value) return r[0].value }
  } catch { /* fallback abajo */ }
  return ENV_TOKEN ?? null
}

async function writeToken(token, expiresInSec) {
  const res = await fetch(`${SUPA}/rest/v1/app_secrets`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      key: 'ig_access_token', value: token,
      expires_at: expiresInSec ? new Date(Date.now() + expiresInSec * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }),
  })
  return res.ok
}

// Refresca el token (no requiere login). Si falla, seguimos con el actual.
async function refreshToken(current) {
  try {
    const url = new URL('https://graph.instagram.com/refresh_access_token')
    url.searchParams.set('grant_type', 'ig_refresh_token')
    url.searchParams.set('access_token', current)
    const res = await fetch(url.toString())
    const d = await res.json()
    if (d.access_token) {
      await writeToken(d.access_token, d.expires_in)
      console.log(`   ↻ token renovado (+${Math.floor((d.expires_in ?? 0) / 86400)}d)`)
      return d.access_token
    }
    console.log(`   ⚠ refresh no aplicado: ${d.error?.message ?? res.status}`)
  } catch (e) { console.log(`   ⚠ refresh error: ${e.message}`) }
  return current
}

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

async function fetchGraphReels(token) {
  const url = new URL('https://graph.instagram.com/me/media')
  url.searchParams.set('fields', 'id,media_type,thumbnail_url,timestamp,caption,permalink')
  url.searchParams.set('access_token', token)
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
  if (!SUPA)   throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL')
  if (!SVCKEY) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')

  let token = await readToken()
  if (!token) throw new Error('Sin token: re-autentica en /api/instagram/auth')

  // Refrescar primero mantiene el token vivo indefinidamente sin login.
  token = await refreshToken(token)

  process.stdout.write('Fetching @taka.sports (Graph API)... ')
  const reels = await fetchGraphReels(token)
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
