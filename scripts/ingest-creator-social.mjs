#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-creator-social.mjs
//
// Actualiza los 4 factores auto de creadores/periodistas basándose
// en métricas reales de redes sociales.
//
// Factores → Métricas:
//   rendimiento_auto (40%) = Alcance  — max(followers) log-normalizado
//   mediatico_auto   (25%) = Engagement — ER ponderado por plataforma
//   contexto_auto    (20%) = Consistencia — frecuencia publicación + nº plataformas
//   narrativa_auto   (15%) = Crecimiento — delta 30d (snapshot vs anterior)
//
// Fuentes (Fase 1, coste €0):
//   YouTube Data API v3  — suscriptores, vistas, vídeos recientes
//   Twitch Helix API     — seguidores, total views
//
// Variables de entorno necesarias:
//   YOUTUBE_API_KEY       — Google Cloud, API habilitada: YouTube Data API v3
//   TWITCH_CLIENT_ID      — dev.twitch.tv → nueva aplicación
//   TWITCH_CLIENT_SECRET  — idem
//
// Uso:
//   node scripts/ingest-creator-social.mjs           # DRY RUN
//   node scripts/ingest-creator-social.mjs --apply
//   node scripts/ingest-creator-social.mjs --apply --verbose
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const YT_KEY       = process.env.YOUTUBE_API_KEY
const TW_ID        = process.env.TWITCH_CLIENT_ID
const TW_SECRET    = process.env.TWITCH_CLIENT_SECRET
const APPLY        = process.argv.includes('--apply')
const VERBOSE      = process.argv.includes('--verbose')

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Score helpers ─────────────────────────────────────────────────

// Alcance: log10-normalizado, cap en 15M (Ibai-level), escala 0-100
function reachScore(maxFollowers) {
  if (!maxFollowers || maxFollowers <= 0) return null
  const capped = Math.min(maxFollowers, 15_000_000)
  return Math.round((Math.log10(capped + 1) / Math.log10(15_000_001)) * 100 * 10) / 10
}

// Engagement: normalizado por plataforma (benchmarks deportivos), 0-100
function engagementScore(platform, erPercent) {
  const benchmarks = {
    youtube:   { strong: 4.0, weak: 0.5 },   // (likes+comments)/views*100
    twitch:    { strong: 4.0, weak: 0.5 },   // avgConcurrent/followers*100
    instagram: { strong: 3.0, weak: 0.5 },
    tiktok:    { strong: 8.0, weak: 2.0 },
    twitter:   { strong: 1.5, weak: 0.2 },
  }
  const b = benchmarks[platform] ?? { strong: 3, weak: 0.5 }
  const norm = Math.max(0, Math.min(1, (erPercent - b.weak) / (b.strong - b.weak)))
  return Math.round(norm * 100 * 10) / 10
}

// Consistencia: posts/semana + número de plataformas activas, 0-100
function consistencyScore(postsPerWeek, activePlatforms) {
  const postScore = Math.min(1, postsPerWeek / 5) * 70      // cap 5x/semana = 70pts
  const platScore = Math.min(activePlatforms, 4) / 4 * 30   // 4 plataformas = 30pts
  return Math.round((postScore + platScore) * 10) / 10
}

// Crecimiento: delta 30d respecto a snapshot anterior, 0-100
// Sin snapshot previo → 50 (neutral)
function growthScore(currentFollowers, prevFollowers) {
  if (!prevFollowers || prevFollowers <= 0) return 50
  const deltaPct = (currentFollowers - prevFollowers) / prevFollowers * 100
  // -5% → 0, 0% → 50, +10% → 100
  const norm = Math.max(0, Math.min(1, (deltaPct + 5) / 15))
  return Math.round(norm * 100 * 10) / 10
}

// ── YouTube API ───────────────────────────────────────────────────

async function fetchYouTubeChannel(channelId) {
  if (!YT_KEY) return null
  const isHandle = channelId.startsWith('@')
  const param = isHandle ? `forHandle=${encodeURIComponent(channelId)}` : `id=${channelId}`
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&${param}&key=${YT_KEY}`
  const r = await fetch(url)
  if (!r.ok) { if (VERBOSE) console.error(`YT ${channelId} HTTP ${r.status}`); return null }
  const d = await r.json()
  const ch = d.items?.[0]
  if (!ch) return null

  const stats = ch.statistics ?? {}
  const subs  = parseInt(stats.subscriberCount) || 0
  const views = parseInt(stats.viewCount)        || 0
  const videos= parseInt(stats.videoCount)       || 0

  // Últimos 10 vídeos para engagement y consistencia
  const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads
  let recentViews = [], recentLikes = [], recentComments = [], postDates = []

  if (uploadsId && videos > 0) {
    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=10&key=${YT_KEY}`
    )
    if (plRes.ok) {
      const plData = await plRes.json()
      const videoIds = (plData.items ?? []).map(i => i.snippet?.resourceId?.videoId).filter(Boolean)
      postDates = (plData.items ?? []).map(i => i.snippet?.publishedAt).filter(Boolean)

      if (videoIds.length > 0) {
        const vRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(',')}&key=${YT_KEY}`
        )
        if (vRes.ok) {
          const vData = await vRes.json()
          for (const v of vData.items ?? []) {
            recentViews.push(parseInt(v.statistics?.viewCount) || 0)
            recentLikes.push(parseInt(v.statistics?.likeCount) || 0)
            recentComments.push(parseInt(v.statistics?.commentCount) || 0)
          }
        }
      }
    }
    await sleep(50)
  }

  const avgViews    = recentViews.length ? recentViews.reduce((a, b) => a + b, 0) / recentViews.length : views / Math.max(videos, 1)
  const avgLikes    = recentLikes.length ? recentLikes.reduce((a, b) => a + b, 0) / recentLikes.length : 0
  const avgComments = recentComments.length ? recentComments.reduce((a, b) => a + b, 0) / recentComments.length : 0
  const erPct       = avgViews > 0 ? (avgLikes + avgComments) / avgViews * 100 : 0

  // Frecuencia: posts en últimos 30 días
  const now = Date.now()
  const postsLast30 = postDates.filter(d => (now - new Date(d).getTime()) < 30 * 86400_000).length
  const postsPerWeek = postsLast30 / 4.3

  return { platform: 'youtube', subscribers: subs, totalViews: views, videoCount: videos, avgViews, erPct, postsPerWeek }
}

// ── Twitch API ────────────────────────────────────────────────────

let _twitchToken = null
async function getTwitchToken() {
  if (_twitchToken) return _twitchToken
  if (!TW_ID || !TW_SECRET) return null
  const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${TW_ID}&client_secret=${TW_SECRET}&grant_type=client_credentials`, { method: 'POST' })
  if (!r.ok) return null
  const d = await r.json()
  _twitchToken = d.access_token
  return _twitchToken
}

async function fetchTwitchChannel(login) {
  const token = await getTwitchToken()
  if (!token) return null

  const headers = { 'Client-Id': TW_ID, 'Authorization': `Bearer ${token}` }

  const uRes = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, { headers })
  if (!uRes.ok) return null
  const uData = await uRes.json()
  const user = uData.data?.[0]
  if (!user) return null

  const fRes = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`, { headers })
  const fData = fRes.ok ? await fRes.json() : {}
  const followers = fData.total ?? 0

  // Actividad reciente (si está en directo o ha emitido recientemente)
  const sRes = await fetch(`https://api.twitch.tv/helix/videos?user_id=${user.id}&type=archive&first=10`, { headers })
  const sData = sRes.ok ? await sRes.json() : {}
  const vods = sData.data ?? []
  const now = Date.now()
  const streamsLast30 = vods.filter(v => (now - new Date(v.created_at).getTime()) < 30 * 86400_000).length
  const postsPerWeek = streamsLast30 / 4.3

  // Avg viewers no disponible sin historial de terceros → usar view_count total como proxy de alcance
  return { platform: 'twitch', followers, totalViews: parseInt(user.view_count) || 0, postsPerWeek }
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  if (!YT_KEY)     console.warn('⚠  YOUTUBE_API_KEY no configurada — YouTube omitido')
  if (!TW_ID)      console.warn('⚠  TWITCH_CLIENT_ID no configurada — Twitch omitido')

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Cargar creadores con handles definidos
  const { data: entries, error } = await sb.from('ranking_entries')
    .select('id, name, sport, category, handles, rendimiento_auto, mediatico_auto, contexto_auto, narrativa_auto, score_auto')
    .in('category', ['creadores','periodistas','creadores_wwe'])
    .not('handles', 'is', null)
  if (error) throw error
  console.log(`\n${entries.length} creadores con handles definidos`)

  const updates = []

  for (const entry of entries) {
    const h = entry.handles ?? {}
    if (!h.youtube && !h.twitch) {
      if (VERBOSE) console.log(`  skip ${entry.id} (sin YouTube ni Twitch)`)
      continue
    }

    const platforms = []
    let maxFollowers = 0
    let erScores = [], postsPerWeek = 0, activePlatforms = 0

    // YouTube
    if (h.youtube && YT_KEY) {
      const yt = await fetchYouTubeChannel(h.youtube)
      await sleep(100)
      if (yt) {
        platforms.push(yt)
        maxFollowers = Math.max(maxFollowers, yt.subscribers)
        if (yt.erPct > 0) erScores.push(engagementScore('youtube', yt.erPct))
        postsPerWeek = Math.max(postsPerWeek, yt.postsPerWeek)
        activePlatforms++
        if (VERBOSE) console.log(`    YT  ${entry.id}: subs=${yt.subscribers.toLocaleString()} ER=${yt.erPct.toFixed(2)}% posts/w=${yt.postsPerWeek.toFixed(1)}`)
      }
    }

    // Twitch
    if (h.twitch && TW_ID) {
      const tw = await fetchTwitchChannel(h.twitch)
      await sleep(100)
      if (tw) {
        platforms.push(tw)
        maxFollowers = Math.max(maxFollowers, tw.followers)
        postsPerWeek = Math.max(postsPerWeek, tw.postsPerWeek)
        activePlatforms++
        if (VERBOSE) console.log(`    TW  ${entry.id}: followers=${tw.followers.toLocaleString()} posts/w=${tw.postsPerWeek.toFixed(1)}`)
      }
    }

    // Bonus plataformas sin API (Instagram/TikTok/Twitter presentes en handles)
    if (h.instagram) activePlatforms++
    if (h.tiktok)    activePlatforms++
    if (h.twitter)   activePlatforms++

    if (platforms.length === 0) continue

    const newRendimiento = reachScore(maxFollowers)
    const newMediatico   = erScores.length ? Math.round(erScores.reduce((a, b) => a + b, 0) / erScores.length * 10) / 10 : null
    const newContexto    = consistencyScore(postsPerWeek, Math.min(activePlatforms, 5))
    const newNarrativa   = growthScore(maxFollowers, null)  // 50 hasta tener snapshot previo

    updates.push({
      id: entry.id,
      name: entry.name,
      sport: entry.sport,
      maxFollowers,
      newRendimiento,
      newMediatico,
      newContexto,
      newNarrativa,
      prevScore: entry.score_auto,
    })
  }

  updates.sort((a, b) => (b.newRendimiento ?? 0) - (a.newRendimiento ?? 0))

  console.log(`\n--- Creadores actualizados (${updates.length}) ---`)
  updates.forEach(u => {
    const reach = u.maxFollowers >= 1_000_000 ? `${(u.maxFollowers/1_000_000).toFixed(1)}M` : `${Math.round(u.maxFollowers/1000)}K`
    console.log(
      `  ${u.name.padEnd(28)} ${reach.padStart(6)} followers` +
      `  rend=${u.newRendimiento?.toFixed(1).padStart(5) ?? '  null'}` +
      `  media=${u.newMediatico?.toFixed(1).padStart(5) ?? '  null'}` +
      `  ctx=${u.newContexto?.toFixed(1).padStart(5)}` +
      `  [${u.sport}]`
    )
  })

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of updates) {
    const patch = {
      ...(u.newRendimiento !== null && { rendimiento_auto: u.newRendimiento }),
      ...(u.newMediatico   !== null && { mediatico_auto:   u.newMediatico }),
      ...(u.newContexto    !== null && { contexto_auto:    u.newContexto }),
      ...(u.newNarrativa   !== null && { narrativa_auto:   u.newNarrativa }),
      last_auto_update: new Date().toISOString(),
    }
    const { error: err } = await sb.from('ranking_entries').update(patch).eq('id', u.id)
    if (err) { fail++; console.error(`FAIL ${u.id}: ${err.message}`) } else ok++
  }
  console.log(`\nDone. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
