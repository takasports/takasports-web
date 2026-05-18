#!/usr/bin/env node
// ingest-creator-images.mjs
//
// Busca y guarda image_url para todas las entradas de categorías
// creadores / periodistas / creadores_wwe que no tengan imagen aún.
//
// Fuentes (en cascada):
//   1. YouTube Data API v3  → snippet.thumbnails.high.url (canal avatar)
//   2. Twitch GQL            → profileImageURL
//   3. Wikipedia ES/EN       → page thumbnail
//   4. Twitter/X og:image    → perfil público og:image
//
// Variables necesarias en .env.local:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_API_KEY
//
// Uso:
//   node scripts/ingest-creator-images.mjs           # DRY RUN
//   node scripts/ingest-creator-images.mjs --apply
//   node scripts/ingest-creator-images.mjs --force   # sobreescribe imágenes existentes

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const APPLY   = process.argv.includes('--apply')
const FORCE   = process.argv.includes('--force')  // re-fetch even if image_url exists

const YT_KEY  = process.env.YOUTUBE_API_KEY
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const TWITCH_GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── YouTube: avatar via snippet ────────────────────────────────────
async function ytAvatar(handle) {
  if (!YT_KEY || !handle) return null
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handle)}&key=${YT_KEY}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const item = data.items?.[0]
    if (!item) return null
    const t = item.snippet?.thumbnails
    return t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null
  } catch { return null }
}

// UCxxx channel id → avatar
async function ytAvatarById(channelId) {
  if (!YT_KEY || !channelId) return null
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${YT_KEY}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const item = data.items?.[0]
    if (!item) return null
    const t = item.snippet?.thumbnails
    return t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null
  } catch { return null }
}

// ── Twitch: avatar via GQL anónimo ────────────────────────────────
async function twitchAvatar(login) {
  if (!login) return null
  const clean = login.replace(/^@/, '').toLowerCase()
  try {
    const body = JSON.stringify([{
      operationName: 'ChannelRoot_AboutPanel',
      variables: { channelLogin: clean, skipSchedule: true },
      extensions: { persistedQuery: { version: 1, sha256Hash: '6089531acef6c09ece401b9c59f4e4e12a8b08498e42a23e2285fb30a2e50680' } }
    }])
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST', headers: { 'Client-ID': TWITCH_GQL_CLIENT_ID, 'Content-Type': 'application/json' },
      body,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data[0]?.data?.user?.profileImageURL ?? null
  } catch { return null }
}

// ── Wikipedia: thumbnail ──────────────────────────────────────────
async function wikiThumb(title, lang = 'es') {
  if (!title) return null
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'))
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`
    const res = await fetch(url, { headers: { 'User-Agent': 'TakaSports/1.0' } })
    if (!res.ok) return null
    const data = await res.json()
    return data.thumbnail?.source ?? data.originalimage?.source ?? null
  } catch { return null }
}

// ── Twitter/X og:image via curl ───────────────────────────────────
function twitterOgImage(handle) {
  if (!handle) return null
  const clean = handle.replace(/^@/, '')
  try {
    const out = execSync(
      `curl -sL --max-time 8 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "https://twitter.com/${clean}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    )
    const m = out.match(/<meta property="og:image" content="([^"]+)"/i)
    return m?.[1] ?? null
  } catch { return null }
}

// ── Cascade para una entry ─────────────────────────────────────────
async function findImage(entry) {
  const h = entry.handles ?? {}
  let img = null

  // 1. YouTube — canal avatar (más fiable para creadores)
  if (h.youtube) {
    const handle = h.youtube.startsWith('@') ? h.youtube : null
    const ucId   = h.youtube.startsWith('UC') ? h.youtube : null
    if (handle) img = await ytAvatar(handle)
    if (!img && ucId) img = await ytAvatarById(ucId)
    if (img) return { src: img, via: 'youtube' }
    await sleep(150)
  }

  // 2. Twitch
  if (h.twitch) {
    img = await twitchAvatar(h.twitch)
    if (img) return { src: img, via: 'twitch' }
    await sleep(200)
  }

  // 3. Wikipedia ES → EN (por nombre)
  img = await wikiThumb(entry.name, 'es')
  if (!img) img = await wikiThumb(entry.name, 'en')
  if (img) return { src: img, via: 'wikipedia' }
  await sleep(200)

  // 4. Twitter og:image (lento, último recurso)
  if (h.twitter) {
    img = twitterOgImage(h.twitter)
    if (img) return { src: img, via: 'twitter' }
  }

  return null
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}  Force: ${FORCE}\n`)

  if (!YT_KEY) console.warn('⚠️  YOUTUBE_API_KEY no configurada — solo Twitch/Wikipedia/Twitter')

  // Carga todas las entradas contenido
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, handles, image_url')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
    .eq('active', true)
    .order('name')

  if (error) { console.error('DB error:', error.message); process.exit(1) }

  const targets = FORCE
    ? entries
    : entries.filter(e => !e.image_url)

  console.log(`Entradas totales: ${entries.length}`)
  console.log(`Sin imagen:       ${entries.filter(e => !e.image_url).length}`)
  console.log(`A procesar:       ${targets.length}\n`)

  if (targets.length === 0) {
    console.log('Todas las entradas ya tienen imagen. Usa --force para re-fetchear.')
    return
  }

  const results = []
  let found = 0, notFound = 0

  for (const entry of targets) {
    const result = await findImage(entry)
    const status = result ? `✅ [${result.via}]` : '❌ sin imagen'
    console.log(`  ${entry.name.padEnd(36)} ${status}`)
    if (result) {
      results.push({ id: entry.id, image_url: result.src })
      found++
    } else {
      notFound++
    }
    await sleep(100)
  }

  console.log(`\nEncontradas: ${found} | Sin imagen: ${notFound}`)

  if (!APPLY) { console.log('\nDRY RUN — pasa --apply para guardar en DB.'); return }
  if (results.length === 0) { console.log('Nada que guardar.'); return }

  // Actualiza en lotes de 50
  let ok = 0, fail = 0
  for (let i = 0; i < results.length; i += 50) {
    const batch = results.slice(i, i + 50)
    for (const { id, image_url } of batch) {
      const { error: e } = await sb
        .from('ranking_entries')
        .update({ image_url })
        .eq('id', id)
      if (e) { console.error(`  FAIL ${id}: ${e.message}`); fail++ }
      else ok++
    }
    await sleep(100)
  }

  console.log(`\nGuardadas: ${ok} | Fallidas: ${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
