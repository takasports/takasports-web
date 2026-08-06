#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-tiktok-engagement.mjs  →  RELEVANCIA de quien vive en TikTok
//
// ── EL PROBLEMA ──────────────────────────────────────────────────
// La Relevancia pesa un 25% del score de Contenido y se medía SOLO con
// YouTube: mediana de visitas de los últimos vídeos entre suscriptores. Pero
// 85 de los 165 perfiles del ranking no tienen canal de YouTube — viven en
// TikTok y en Instagram —, así que se quedaban en el valor neutro 55.
//
// Resultado: el 70% de las fichas compartía el mismo valor en un factor que
// pesa un cuarto de la nota. Medio ranking se ordenaba con un factor que para
// ellos no medía nada.
//
// ── LA MEDIDA ────────────────────────────────────────────────────
// El HTML de un perfil de TikTok trae `followerCount`, `videoCount` y
// `heartCount` (corazones acumulados). Con eso:
//
//     ratio = (corazones / vídeos) / seguidores
//           = cuántos «me gusta» saca por vídeo en relación a su audiencia
//
// Es el mismo concepto que en YouTube —¿su gente le VE, o solo le sigue?— y,
// medido sobre nuestros 65 creadores con TikTok, sale con la MISMA escala: la
// mediana es 0,0503 y el pivote de YouTube es 0,05. No es una coincidencia
// buscada: se comprobó antes de elegir la fórmula, precisamente para no
// inventar una escala paralela que hiciera incomparables a unos y otros.
//
// Por eso se reutiliza la curva tal cual (scripts/ingest-creator-relevance.mjs):
//     score = clamp(72 + 20·log10(ratio / 0.05), 45, 88)
//
// ── LO QUE ESTA MEDIDA NO ES ─────────────────────────────────────
// `heartCount` y `videoCount` son ACUMULADOS de toda la vida del perfil, no de
// las últimas semanas. Así que esto mide el engagement histórico medio, no el
// reciente: alguien que arrasó hace tres años y hoy no publica seguiría
// puntuando bien. La de YouTube, que mira los 10 últimos vídeos, es mejor
// señal — y por eso esta NO la pisa nunca: solo rellena a quien no tiene canal.
//
// Uso:
//   node scripts/ingest-tiktok-engagement.mjs           # DRY RUN
//   node scripts/ingest-tiktok-engagement.mjs --apply
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Faltan claves de Supabase'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const CATEGORIES = ['creadores', 'creadores_wwe', 'periodistas']
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Espejo exacto de ingest-creator-relevance.mjs: misma curva, mismo pivote,
// mismos topes. Si allí cambian, aquí también — o las dos mitades del ranking
// dejarían de ser comparables.
const PIVOT = 0.05
const FLOOR = 45
const CEIL  = 88
const NEUTRAL = 55

// Por debajo de esta audiencia el ratio es ruido: un perfil de 300 seguidores
// con 40 corazones por vídeo saldría por delante de gente con millones.
const MIN_SEGUIDORES = 5000
// Y con cuatro vídeos publicados la media por vídeo no dice nada.
const MIN_VIDEOS = 10

const limpia = (h) => String(h ?? '').trim().replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '').split(/[/?]/)[0]

function ratioAScore(ratio) {
  if (!(ratio > 0)) return null
  const s = 72 + 20 * Math.log10(ratio / PIVOT)
  return Math.round(Math.min(CEIL, Math.max(FLOOR, s)) * 10) / 10
}

async function leePerfil(handle) {
  try {
    const r = await fetch(`https://www.tiktok.com/@${handle}`, { headers: { 'User-Agent': UA } })
    if (!r.ok) return null
    const html = await r.text()
    const n = (re) => Number(html.match(re)?.[1] ?? 0)
    return {
      seguidores: n(/"followerCount":(\d+)/),
      videos: n(/"videoCount":(\d+)/),
      corazones: n(/"heartCount":(\d+)/),
    }
  } catch {
    return null
  }
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Relevancia TikTok = clamp(72 + 20·log10(ratio/${PIVOT}), ${FLOOR}, ${CEIL}) · ratio = corazones/vídeo ÷ seguidores\n`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: ents, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, handles, narrativa_auto')
    .eq('active', true)
    .in('category', CATEGORIES)
    .order('name')
  if (error) throw error

  const { data: met } = await sb.from('creator_raw_metrics').select('creator_id, yt_channel_id, yt_subscribers')
  const yt = new Map((met ?? []).map(m => [m.creator_id, m]))

  // Solo quien NO tiene una relevancia de YouTube utilizable. La de YouTube
  // mira los últimos 10 vídeos y esta la vida entera del perfil: la reciente
  // gana siempre.
  const objetivo = ents.filter(e => {
    if (!limpia(e.handles?.tiktok)) return false
    const m = yt.get(e.id)
    return !m?.yt_channel_id || Number(m.yt_subscribers ?? 0) < 5000
  })
  console.log(`${ents.length} perfiles de contenido · ${objetivo.length} sin relevancia de YouTube y con TikTok\n`)
  if (!objetivo.length) { console.log('Nada que calcular.'); return }

  const resultados = []
  const descartados = []
  for (const e of objetivo) {
    const h = limpia(e.handles.tiktok)
    const p = await leePerfil(h)
    await new Promise(r => setTimeout(r, 700))
    if (!p) { descartados.push(`${e.name} (no se pudo leer)`); continue }
    if (p.seguidores < MIN_SEGUIDORES) { descartados.push(`${e.name} (solo ${p.seguidores} seguidores)`); continue }
    if (p.videos < MIN_VIDEOS) { descartados.push(`${e.name} (solo ${p.videos} vídeos)`); continue }
    if (!p.corazones) { descartados.push(`${e.name} (sin corazones)`); continue }

    const ratio = (p.corazones / p.videos) / p.seguidores
    const score = ratioAScore(ratio)
    if (score === null) { descartados.push(e.name); continue }
    resultados.push({
      id: e.id, category: e.category, name: e.name, handle: h,
      ...p, ratio, score,
      previo: e.narrativa_auto === null ? null : Number(e.narrativa_auto),
    })
  }

  resultados.sort((a, b) => b.score - a.score)
  console.log(`--- Relevancia por engagement de TikTok (${resultados.length}) ---`)
  for (const r of resultados) {
    const previo = r.previo === null ? '   –' : r.previo.toFixed(1).padStart(5)
    console.log(
      `  ${r.name.padEnd(26).slice(0, 26)} @${r.handle.padEnd(20).slice(0, 20)}` +
      ` seg=${String(r.seguidores).padStart(9)} vídeos=${String(r.videos).padStart(5)}` +
      ` ratio=${r.ratio.toFixed(3).padStart(6)}  ${previo} → ${r.score.toFixed(1).padStart(5)}`,
    )
  }
  if (descartados.length) console.log(`\n  Sin datos utilizables (${descartados.length}): ${descartados.join(', ')}`)

  const siguenNeutros = objetivo.length - resultados.length
  console.log(`\n  Pasan de neutro ${NEUTRAL} a medido: ${resultados.filter(r => r.previo === NEUTRAL).length}`)
  console.log(`  Se quedan en neutro: ${siguenNeutros}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const r of resultados) {
    // PK compuesta (id, category): filtrar por las dos.
    const { error: err } = await sb.from('ranking_entries')
      .update({ narrativa_auto: r.score })
      .eq('id', r.id).eq('category', r.category)
    if (err) { fail++; console.error(`FAIL ${r.id}: ${err.message}`) } else ok++
  }
  const { error: errSync } = await sb.rpc('f_sync_creator_scores')
  console.log(errSync ? `  ⚠️  f_sync: ${errSync.message}` : '  ✓ f_sync_creator_scores() recalculado')
  console.log(`\nDone. OK=${ok} FAIL=${fail}`)
}

main().catch(e => { console.error(e); process.exit(1) })
