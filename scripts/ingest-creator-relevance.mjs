#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-creator-relevance.mjs
//
// Factor RELEVANCIA de los creadores (25% de su score, `narrativa_auto`)
// a partir del engagement REAL de YouTube: cuánta gente ve de verdad lo
// que publican, en relación al tamaño de su audiencia.
//
//   ratio = mediana de visitas de sus 10 últimos vídeos / suscriptores
//   score = clamp(72 + 20·log10(ratio / 0.05), 45, 88)
//
// ── POR QUÉ SE CAMBIÓ (2026-07-28) ───────────────────────────────
// Antes la Relevancia salía de las visitas a su artículo de Wikipedia.
// Resultado medido: **solo 6 de 111 creadores tenían artículo** — y los
// seis eran ex-deportistas. Para los otros 105 el factor era un 55 fijo.
// O sea, un cuarto del score lo decidía «¿fuiste futbolista famoso?».
//
// ── QUÉ MIDE Y QUÉ NO ────────────────────────────────────────────
// · Mediana, no media: un vídeo viral no arrastra al resto.
// · Últimos 10 vídeos, no histórico: mide el momento actual. Con el
//   histórico, quien publica mucho salía penalizado por construcción
//   (Más Lucha, con 46.963 vídeos, quedaba último de todos).
// · Destapa audiencias infladas: un canal con 892K suscriptores cuyos
//   últimos vídeos rondan las 1.000 visitas tiene un problema real de
//   relevancia, y el recuento de seguidores solo lo escondía.
// · SESGO conocido: un canal volcado en Shorts o en clips cortos tiene
//   medianas bajas aunque su marca esté viva. Por eso la banda es
//   estrecha (45–88) y el factor pesa 25, no más.
// · COBERTURA: solo llega a quien tiene `yt_channel_id` en
//   `creator_raw_metrics` (~30 de 111). Los nativos de Instagram y
//   TikTok se quedan en el neutro 55 — la API de esas redes no es
//   accesible. Ese es el techo de este factor hoy.
//
// Cuota de YouTube: ~3 unidades por creador (canal + lista + vídeos)
// sobre 10.000/día. Irrelevante.
//
// Uso:
//   node scripts/ingest-creator-relevance.mjs           # DRY RUN
//   node scripts/ingest-creator-relevance.mjs --apply
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
if (!YT_KEY) { console.error('Falta YOUTUBE_API_KEY — sin ella no hay relevancia que calcular'); process.exit(1) }

const CATEGORIES = ['creadores', 'creadores_wwe', 'periodistas']
const NEUTRAL = 55        // sin canal de YouTube: ni premio ni castigo
const PIVOT   = 0.05      // ratio "normal": mediana ≈ 5% de los suscriptores
const FLOOR   = 45
const CEIL    = 88
const RECENT  = 10        // vídeos recientes a mirar
// Por debajo de esta audiencia el ratio es ruido: un canal de 273 suscriptores
// con 50 visitas por vídeo salía con 83 de relevancia, por delante de gente con
// cientos de miles de seguidores. Sin audiencia mínima no hay señal que medir.
const MIN_SUBS = 5000

const yt = (p, q) => `https://www.googleapis.com/youtube/v3/${p}?${q}&key=${YT_KEY}`

async function getJson(url) {
  const r = await fetch(url).catch(() => null)
  if (!r?.ok) return null
  return r.json().catch(() => null)
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b)
  if (!s.length) return 0
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

function ratioToScore(ratio) {
  if (!(ratio > 0)) return null
  const s = 72 + 20 * Math.log10(ratio / PIVOT)
  return Math.round(Math.min(CEIL, Math.max(FLOOR, s)) * 10) / 10
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Relevancia = mediana de visitas de los ${RECENT} últimos vídeos / suscriptores`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, narrativa_auto')
    .eq('active', true)
    .in('category', CATEGORIES)
  if (error) throw error

  const { data: metrics, error: mErr } = await sb
    .from('creator_raw_metrics')
    .select('creator_id, yt_channel_id')
    .not('yt_channel_id', 'is', null)
  if (mErr) throw mErr
  const channelOf = new Map(metrics.map(m => [m.creator_id, m.yt_channel_id]))

  const withChannel = entries.filter(e => channelOf.has(e.id))
  console.log(`\n  ${entries.length} creadores activos · ${withChannel.length} con canal de YouTube`)
  if (!withChannel.length) { console.log('Nada que calcular.'); return }

  // 1) Datos de canal en lotes de 50 (1 unidad por lote).
  const stats = new Map()
  for (let i = 0; i < withChannel.length; i += 50) {
    const batch = withChannel.slice(i, i + 50)
    const d = await getJson(yt('channels', `part=statistics,contentDetails&maxResults=50&id=${batch.map(e => channelOf.get(e.id)).join(',')}`))
    for (const it of d?.items ?? []) {
      stats.set(it.id, {
        subs: Number(it.statistics?.subscriberCount) || 0,
        uploads: it.contentDetails?.relatedPlaylists?.uploads ?? null,
      })
    }
  }

  // 2) Últimos vídeos de cada canal y sus visitas.
  const results = []
  const sinDatos = []
  for (const e of withChannel) {
    const st = stats.get(channelOf.get(e.id))
    if (!st?.subs || !st.uploads) { sinDatos.push(e.name); continue }
    if (st.subs < MIN_SUBS) { sinDatos.push(`${e.name} (solo ${st.subs} subs)`); continue }

    const pl = await getJson(yt('playlistItems', `part=contentDetails&maxResults=${RECENT}&playlistId=${st.uploads}`))
    const videoIds = (pl?.items ?? []).map(i => i.contentDetails?.videoId).filter(Boolean)
    if (!videoIds.length) { sinDatos.push(e.name); continue }

    const vs = await getJson(yt('videos', `part=statistics&id=${videoIds.join(',')}`))
    const views = (vs?.items ?? []).map(v => Number(v.statistics?.viewCount) || 0)
    if (!views.length) { sinDatos.push(e.name); continue }

    const med = median(views)
    const ratio = med / st.subs
    const score = ratioToScore(ratio)
    if (score === null) { sinDatos.push(e.name); continue }

    results.push({
      id: e.id, category: e.category, name: e.name,
      subs: st.subs, med, ratio,
      prev: e.narrativa_auto === null ? null : Number(e.narrativa_auto),
      score,
    })
  }

  results.sort((a, b) => b.score - a.score)
  console.log(`\n--- Relevancia por engagement (${results.length}) ---`)
  for (const r of results) {
    const prev = r.prev === null ? '   –' : r.prev.toFixed(1).padStart(5)
    console.log(
      `  ${r.name.padEnd(26)} subs=${String(r.subs).padStart(8)}` +
      ` mediana=${String(Math.round(r.med)).padStart(7)} ratio=${r.ratio.toFixed(3).padStart(6)}` +
      `  ${prev} → ${r.score.toFixed(1).padStart(5)}`,
    )
  }
  if (sinDatos.length) console.log(`\n  Sin datos utilizables (${sinDatos.length}): ${sinDatos.join(', ')}`)

  // Los que no tienen canal se quedan en el neutro: nunca arrastran un valor
  // heredado de la etapa de Wikipedia, que solo medía fama de ex-deportista.
  const toNeutral = entries.filter(
    e => !results.some(r => r.id === e.id) && Number(e.narrativa_auto) !== NEUTRAL,
  )
  console.log(`  A neutro ${NEUTRAL}: ${toNeutral.length}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const r of results) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ narrativa_auto: r.score })
      .eq('id', r.id).eq('category', r.category)   // la PK es (id, category)
    if (err) { fail++; console.error(`FAIL ${r.id}: ${err.message}`) } else ok++
  }
  for (const e of toNeutral) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ narrativa_auto: NEUTRAL })
      .eq('id', e.id).eq('category', e.category)
    if (err) fail++; else ok++
  }
  console.log(`\nDone. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
