#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// anchor-creator-youtube.mjs
//
// Ancla cada creador a su canal REAL de YouTube y trae sus suscriptores.
//
// ── POR QUÉ ──────────────────────────────────────────────────────
// La Audiencia (50% del score de un creador) y la Relevancia (25%) solo son
// datos de verdad si hay un canal detrás. Sin él, la audiencia se queda con la
// cifra estática que se sembró a mano y la relevancia en el neutro 55.
// Auditado 2026-07-28: de 103 creadores activos, **61 tenían handle de YouTube
// en `ranking_entries.handles` pero solo 28 tenían el canal anclado** en
// `creator_raw_metrics`. El dato estaba en la casa, sin usar.
//
// Además, la mayoría de esos "handles" YA SON el id del canal (`UC…`): nunca
// hizo falta llamar a nadie para resolverlos, solo copiarlos a su sitio.
//
// ── QUÉ HACE ─────────────────────────────────────────────────────
//   1. `UC…` (24 chars) → es el id del canal, se usa tal cual.
//   2. `@handle` o nombre suelto → se resuelve con la API (`forHandle`, y si
//      falla, búsqueda por nombre limitada a canales).
//   3. Verifica que el canal EXISTE y trae sus suscriptores reales.
//   4. Escribe `yt_channel_id` + `yt_subscribers` en creator_raw_metrics.
//
// Un handle que no resuelve se reporta, no se inventa: mejor un creador sin
// anclar y visible en la lista de fallos que uno apuntando a otro canal.
//
// Correr después: f_sync_creator_scores() (recalcula audiencia) y
// ingest-creator-relevance.mjs (engagement, que necesita el canal).
//
// Uso:
//   node scripts/anchor-creator-youtube.mjs           # DRY RUN
//   node scripts/anchor-creator-youtube.mjs --apply
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const YT_KEY = process.env.YOUTUBE_API_KEY
const APPLY = process.argv.includes('--apply')

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }
if (!YT_KEY) { console.error('Falta YOUTUBE_API_KEY'); process.exit(1) }

const CATEGORIES = ['creadores', 'creadores_wwe']
const CHANNEL_ID_RE = /^UC[\w-]{22}$/

const yt = (p, q) => `https://www.googleapis.com/youtube/v3/${p}?${q}&key=${YT_KEY}`
const getJson = async (url) => {
  const r = await fetch(url).catch(() => null)
  if (!r?.ok) return null
  return r.json().catch(() => null)
}

// ¿El canal encontrado es de quien buscábamos? Igual que con los títulos de
// Wikipedia: una búsqueda por nombre SIEMPRE devuelve algo, así que sin
// verificar acabaríamos anclando a un creador al canal de otro.
const normTitle = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '')

function titleMatchesName(title, name) {
  const [t, n] = [normTitle(title), normTitle(name)]
  if (!t || !n) return false
  if (t.includes(n) || n.includes(t)) return true
  // Nombres compuestos: basta con que compartan las dos primeras palabras.
  const words = (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(normTitle).filter(Boolean)
  return words.length === 2 && words.every(w => t.includes(w))
}

// Busca el canal por NOMBRE. Cuesta 100 unidades de cuota (frente a 1 de
// forHandle), así que solo se usa cuando no hay otra salida.
async function searchChannelByName(name) {
  const s = await getJson(yt('search', `part=snippet&type=channel&maxResults=3&q=${encodeURIComponent(name)}`))
  for (const it of s?.items ?? []) {
    const cid = it.snippet?.channelId ?? it.id?.channelId
    const title = it.snippet?.title ?? it.snippet?.channelTitle
    if (cid && titleMatchesName(title, name)) return { channelId: cid, title }
  }
  return null
}

// Handle (@x, x, o una URL) → id de canal. Devuelve null si no se resuelve.
async function resolveHandle(raw) {
  const handle = raw.trim().replace(/^https?:\/\/(www\.)?youtube\.com\//i, '').replace(/^\/?(c|user|channel)\//i, '')
  if (CHANNEL_ID_RE.test(handle)) return handle

  const clean = handle.replace(/^@/, '').split(/[/?]/)[0]
  if (!clean) return null

  const d = await getJson(yt('channels', `part=id&forHandle=@${encodeURIComponent(clean)}`))
  const byHandle = d?.items?.[0]?.id
  if (byHandle) return byHandle

  // Último recurso: búsqueda por nombre acotada a canales.
  const s = await getJson(yt('search', `part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(clean)}`))
  return s?.items?.[0]?.snippet?.channelId ?? s?.items?.[0]?.id?.channelId ?? null
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, handles')
    .eq('active', true)
    .in('category', CATEGORIES)
  if (error) throw error

  const { data: metrics, error: mErr } = await sb
    .from('creator_raw_metrics')
    .select('creator_id, yt_channel_id')
  if (mErr) throw mErr
  const known = new Map(metrics.map(m => [m.creator_id, m.yt_channel_id]))

  const pending = entries.filter(e => {
    const h = e.handles?.youtube
    return h && String(h).trim() && !known.get(e.id)
  })
  console.log(`\n  ${entries.length} creadores activos · ${[...known.values()].filter(Boolean).length} ya anclados · ${pending.length} por anclar`)
  if (!pending.length) { console.log('Nada que hacer.'); return }

  // 1) Resolver ids
  const resolved = []
  const failed = []
  for (const e of pending) {
    const cid = await resolveHandle(String(e.handles.youtube))
    if (cid) resolved.push({ ...e, channelId: cid, directo: CHANNEL_ID_RE.test(String(e.handles.youtube).trim()) })
    else failed.push(e)
  }

  // 2) Verificar que existen y traer suscriptores (lotes de 50 = 1 unidad)
  const stats = new Map()
  for (let i = 0; i < resolved.length; i += 50) {
    const batch = resolved.slice(i, i + 50)
    const d = await getJson(yt('channels', `part=statistics,snippet&maxResults=50&id=${batch.map(r => r.channelId).join(',')}`))
    for (const it of d?.items ?? []) {
      stats.set(it.id, { subs: Number(it.statistics?.subscriberCount) || 0, title: it.snippet?.title ?? '' })
    }
  }

  const ok = [], ghosts = []
  const rescued = []
  for (const r of resolved) {
    const st = stats.get(r.channelId)
    if (st) { ok.push({ ...r, subs: st.subs, ytTitle: st.title }); continue }

    // El id tiene forma de canal (UC…) pero YouTube no lo conoce: está
    // inventado. Se intenta recuperar por nombre, validando el título.
    const found = await searchChannelByName(r.name)
    if (!found) { ghosts.push(r); continue }
    const v = await getJson(yt('channels', `part=statistics,snippet&id=${found.channelId}`))
    const it = v?.items?.[0]
    if (!it) { ghosts.push(r); continue }
    const rec = {
      ...r,
      channelId: found.channelId,
      subs: Number(it.statistics?.subscriberCount) || 0,
      ytTitle: it.snippet?.title ?? found.title,
      rescatado: true,
      idFalso: r.channelId,
    }
    ok.push(rec)
    rescued.push(rec)
  }

  ok.sort((a, b) => b.subs - a.subs)
  console.log(`\n--- Anclados (${ok.length}) ---`)
  for (const r of ok) {
    const via = r.rescatado ? `  ← RESCATADO por nombre (el id ${r.idFalso} no existe)` : r.directo ? '' : '  ← resuelto por handle'
    console.log(`  ${r.name.padEnd(26)} ${String(r.subs).padStart(9)} subs  ${r.channelId}  «${r.ytTitle}»${via}`)
  }
  if (rescued.length) console.log(`\n  ${rescued.length} tenían un id de canal INVENTADO y se han recuperado por nombre — revisa que el canal sea el correcto.`)
  if (ghosts.length) console.log(`\n  ⚠️  Sin canal localizable (${ghosts.length}): ${ghosts.map(g => `${g.name} [${g.handles.youtube}]`).join(', ')}`)
  if (failed.length) console.log(`  ⚠️  Handle irresoluble (${failed.length}): ${failed.map(f => `${f.name} [${f.handles.youtube}]`).join(', ')}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let done = 0, fail = 0
  for (const r of ok) {
    // Las columnas de otras plataformas suman con `+` en creator_scores_view y
    // un NULL propaga a todo el cálculo: si la fila es nueva, van a 0.
    const row = known.has(r.id)
      ? { creator_id: r.id, yt_channel_id: r.channelId, yt_subscribers: r.subs, fetched_at: new Date().toISOString() }
      : {
          creator_id: r.id, yt_channel_id: r.channelId, yt_subscribers: r.subs,
          twitch_known: 0, tiktok_known: 0, twitter_known: 0, instagram_known: 0,
          fetched_at: new Date().toISOString(),
        }
    const { error: err } = await sb.from('creator_raw_metrics').upsert(row, { onConflict: 'creator_id' })
    if (err) { fail++; console.error(`FAIL ${r.id}: ${err.message}`) } else done++
  }
  console.log(`\nDone. anclados=${done} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
