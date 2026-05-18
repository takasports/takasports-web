#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-creator-social.mjs
//
// Actualiza rendimiento_auto y contexto_auto de creadores/periodistas.
//
// Factores actualizados:
//   rendimiento_auto (40%) — Alcance: max(yt_subs, twitch_followers, ig_followers)
//                            log10-normalizado, cap 15M
//   contexto_auto    (20%) — Presencia: nº plataformas con handle activo
//
// Factores NO tocados:
//   mediatico_auto   (25%) — Wikipedia pageviews (ingest-wikipedia-views.mjs)
//   narrativa_auto   (15%) — decay temporal (ingest-narrativa-decay.mjs)
//
// Fuentes:
//   Twitch:    GQL anónimo — funciona sin ninguna API key
//   YouTube:   YouTube Data API v3 (YOUTUBE_API_KEY opcional, gratis, 10K unidades/día)
//              Si no está configurada, se usa sólo Twitch + Instagram.
//   Instagram: Endpoint público no oficial (sin API key)
//              Rate-limit: ~500ms entre peticiones
//
// Variables opcionales en .env.local:
//   YOUTUBE_API_KEY  — https://console.cloud.google.com → YouTube Data API v3
//
// Uso:
//   node scripts/ingest-creator-social.mjs           # DRY RUN
//   node scripts/ingest-creator-social.mjs --apply
//   node scripts/ingest-creator-social.mjs --apply --verbose
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const YT_KEY       = process.env.YOUTUBE_API_KEY   // opcional
const APPLY        = process.argv.includes('--apply')
const VERBOSE      = process.argv.includes('--verbose')

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

// Client-ID anónimo embebido en el propio sitio web de Twitch (no requiere registro)
const TWITCH_GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Score helpers ─────────────────────────────────────────────────

// Parsea "14.2M subscribers" / "123K" / "1,5 Mio." / "14 M. suscriptores"
function parseCount(text) {
  if (!text) return null
  const clean = text.replace(/,/g, '.').replace(/\s/g, '').toLowerCase()
  const m = clean.match(/([\d.]+)(k|m|b|mio\.?|mil\.?)?/)
  if (!m) return null
  const n = parseFloat(m[1])
  if (isNaN(n) || n <= 0) return null
  const mult = m[2]
    ? ({ k: 1e3, m: 1e6, b: 1e9, 'mio.': 1e6, mio: 1e6, 'mil.': 1e3, mil: 1e3 }[m[2]] ?? 1)
    : 1
  return Math.round(n * mult)
}

// Alcance: log10-normalizado, cap 15M → score 100
function reachScore(followers) {
  if (!followers || followers <= 0) return null
  const capped = Math.min(followers, 15_000_000)
  return Math.round((Math.log10(capped + 1) / Math.log10(15_000_001)) * 100 * 10) / 10
}

// Presencia: escala lineal por número de plataformas activas (0-5)
function presenceScore(count) {
  return [30, 45, 60, 72, 82, 90][Math.min(count, 5)]
}

// ── YouTube Data API v3 (opcional) ───────────────────────────────
// Soporta dos formatos:
//   UCxxxx  → batch de 50, 1 unidad de quota por llamada
//   @handle → llamada individual con forHandle=, 1 unidad cada una

async function fetchAllYouTubeSubs(channelIds) {
  if (!YT_KEY || channelIds.length === 0) return {}
  const result = {}

  const ucIds    = channelIds.filter(id => !id.startsWith('@'))
  const handles  = channelIds.filter(id =>  id.startsWith('@'))

  // ── Batch UCxxxx ───────────────────────────────────────────────
  for (let i = 0; i < ucIds.length; i += 50) {
    const ids = ucIds.slice(i, i + 50).join(',')
    try {
      const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${ids}&key=${YT_KEY}`
      const res = await fetch(url)
      if (!res.ok) { if (VERBOSE) console.error(`  YT API HTTP ${res.status}`); continue }
      const data = await res.json()
      for (const item of data.items ?? []) {
        const subs = parseInt(item.statistics?.subscriberCount)
        if (subs > 0) result[item.id] = subs
      }
    } catch (e) { if (VERBOSE) console.error(`  YT API error (batch): ${e.message}`) }
    await sleep(150)
  }

  // ── Individual @handles ────────────────────────────────────────
  for (const handle of handles) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=${encodeURIComponent(handle)}&key=${YT_KEY}`
      const res = await fetch(url)
      if (!res.ok) { if (VERBOSE) console.error(`  YT API HTTP ${res.status} for ${handle}`); await sleep(150); continue }
      const data = await res.json()
      const item = data.items?.[0]
      if (item) {
        const subs = parseInt(item.statistics?.subscriberCount)
        if (subs > 0) result[handle] = subs
      }
    } catch (e) { if (VERBOSE) console.error(`  YT API error (${handle}): ${e.message}`) }
    await sleep(150)
  }

  return result
}

// ── Instagram (endpoint público no oficial) ───────────────────────
// Usa el endpoint web de Instagram que devuelve datos públicos de perfil.
// Rate-limit suave: 500ms entre peticiones, retry una vez si falla.

// Instagram usa TLS fingerprinting que bloquea el fetch nativo de Node.js.
// Se usa curl vía child_process (funciona en macOS/Linux; script de mantenimiento).
function fetchInstagramFollowers(username) {
  if (!username) return null
  const clean = username.replace(/^@/, '').toLowerCase()
  try {
    const out = execSync(
      `curl -s --max-time 8 ` +
      `-H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15" ` +
      `-H "x-ig-app-id: 936619743392459" ` +
      `"https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(clean)}"`,
      { encoding: 'utf8', timeout: 10000 }
    )
    const data = JSON.parse(out)
    const count = data?.data?.user?.edge_followed_by?.count
    return typeof count === 'number' && count > 0 ? count : null
  } catch (e) {
    if (VERBOSE) console.error(`  IG error (${clean}): ${e.message?.slice(0,80)}`)
    return null
  }
}

// ── Twitch via GQL anónimo ────────────────────────────────────────

async function fetchTwitchFollowers(login) {
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: {
        'Client-Id': TWITCH_GQL_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        query: `{user(login:"${login.toLowerCase()}"){followers{totalCount}}}`,
        variables: {},
      }]),
    })
    if (!res.ok) return null
    const data = await res.json()
    const count = data[0]?.data?.user?.followers?.totalCount
    return typeof count === 'number' ? count : null
  } catch { return null }
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, sport, category, handles, rendimiento_auto, contexto_auto')
    .in('category', ['creadores', 'periodistas', 'creadores_wwe'])
    .not('handles', 'is', null)
  if (error) throw error
  console.log(`${entries.length} creadores con handles\n`)

  // ── YouTube (API v3 opcional) ────────────────────────────────────
  const ytIds = entries.map(e => e.handles?.youtube).filter(Boolean)
  if (YT_KEY) {
    console.log(`Fetching ${ytIds.length} canales YouTube via Data API v3...`)
  } else {
    console.log(`YouTube omitido (sin YOUTUBE_API_KEY) — ${ytIds.length} canales sin datos de YT`)
  }
  const ytSubs = await fetchAllYouTubeSubs(ytIds)
  const ytOk = Object.values(ytSubs).filter(v => v != null && v > 0).length
  if (YT_KEY) console.log(`  → ${ytOk}/${ytIds.length} con datos\n`)

  // ── Twitch (GQL anónimo, requests individuales) ──────────────────
  const twLogins = entries.filter(e => e.handles?.twitch).map(e => ({ id: e.id, login: e.handles.twitch }))
  console.log(`Fetching ${twLogins.length} canales Twitch via GQL...`)
  const twFollowers = {}
  for (const { id, login } of twLogins) {
    twFollowers[login] = await fetchTwitchFollowers(login)
    await sleep(150)
  }
  const twOk = Object.values(twFollowers).filter(v => v != null).length
  console.log(`  → ${twOk}/${twLogins.length} con datos\n`)

  // ── Instagram (curl, requests individuales con pausa) ────────────
  const igLogins = entries.filter(e => e.handles?.instagram).map(e => ({ id: e.id, user: e.handles.instagram }))
  console.log(`Fetching ${igLogins.length} perfiles Instagram (via curl)...`)
  const igFollowers = {}
  for (const { user } of igLogins) {
    igFollowers[user] = fetchInstagramFollowers(user)   // sync
    await sleep(600)  // 600ms para no disparar rate-limit
  }
  const igOk = Object.values(igFollowers).filter(v => v != null).length
  console.log(`  → ${igOk}/${igLogins.length} con datos\n`)

  // ── Calcular scores ──────────────────────────────────────────────
  const updates = []

  for (const entry of entries) {
    const h = entry.handles ?? {}
    const activePlatforms = ['youtube', 'twitch', 'instagram', 'tiktok', 'twitter'].filter(p => h[p]).length

    const yt = h.youtube   ? (ytSubs[h.youtube]      ?? null) : null
    const tw = h.twitch    ? (twFollowers[h.twitch]   ?? null) : null
    const ig = h.instagram ? (igFollowers[h.instagram] ?? null) : null
    const maxFollowers = Math.max(yt ?? 0, tw ?? 0, ig ?? 0)

    const newRendimiento = maxFollowers > 0 ? reachScore(maxFollowers) : null
    const newContexto    = presenceScore(activePlatforms)

    const fmt = n => n == null ? '    ?' : n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n/1e3)}K` : String(n)
    console.log(
      `  ${entry.name.padEnd(26)}` +
      `  YT=${fmt(yt).padStart(6)}  TW=${fmt(tw).padStart(6)}  IG=${fmt(ig).padStart(6)}` +
      `  plat=${activePlatforms}` +
      `  → rend=${newRendimiento?.toFixed(1).padStart(5) ?? ' null'}  ctx=${newContexto}`
    )

    updates.push({ id: entry.id, name: entry.name, newRendimiento, newContexto })
  }

  const withData = updates.filter(u => u.newRendimiento !== null)
  console.log(`\nCon datos de alcance: ${withData.length} / ${updates.length}`)

  if (!APPLY) { console.log('\nDRY RUN — pasa --apply para escribir.'); return }

  console.log('\nEscribiendo en Supabase...')
  let ok = 0, fail = 0
  for (const u of updates) {
    const patch = {
      ...(u.newRendimiento !== null && { rendimiento_auto: u.newRendimiento }),
      contexto_auto: u.newContexto,
      last_auto_update: new Date().toISOString(),
    }
    const { error: err } = await sb.from('ranking_entries').update(patch).eq('id', u.id)
    if (err) { fail++; console.error(`FAIL ${u.id}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
