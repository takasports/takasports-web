#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-tiktok-engagement.mjs  →  RELEVANCIA y CRECIMIENTO de quien vive en TikTok
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
// ── Y EL CRECIMIENTO, POR RESTA ──────────────────────────────────
// El Crecimiento (otro 25%) sale de los vídeos publicados en 30 días, y TikTok
// solo publica el TOTAL de toda la vida del perfil. Pero restando dos fotos sí
// sale: si el lunes tenía 590 vídeos y el jueves 598, publicó 8 en tres días.
//
// Por eso cada pasada guarda una foto en `creator_platform_snapshots`
// (migración 121) y, si hay una anterior de hace 3 días o más, calcula el ritmo
// y lo extrapola a 30. La primera vez no hay con qué comparar y solo se
// guarda — el dato aparece en la segunda pasada.
//
// Se exigen 3 días como mínimo porque con uno el ruido manda: quien sube dos
// vídeos un martes saldría publicando 60 al mes.
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

// Ventana para el crecimiento por resta.
const MIN_DIAS_VENTANA = 3    // menos que esto es ruido
const MAX_DIAS_VENTANA = 45   // más viejo que esto ya no describe el presente

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

  // Se visita a TODO el que tenga TikTok: la foto de seguidores y vídeos vale
  // para el histórico aunque su nota la mande YouTube. Una sola petición por
  // perfil sirve para las dos cosas.
  const conTikTok = ents.filter(e => limpia(e.handles?.tiktok))
  // Pero la NOTA solo se escribe a quien no tiene una relevancia de YouTube
  // utilizable: la de YouTube mira los últimos 10 vídeos y esta la vida entera
  // del perfil, así que la reciente gana siempre.
  const mandaYouTube = (id) => {
    const m = yt.get(id)
    return Boolean(m?.yt_channel_id) && Number(m.yt_subscribers ?? 0) >= 5000
  }
  const objetivo = conTikTok.filter(e => !mandaYouTube(e.id))
  console.log(`${ents.length} perfiles de contenido · ${conTikTok.length} con TikTok · ${objetivo.length} sin relevancia de YouTube\n`)
  if (!conTikTok.length) { console.log('Nada que calcular.'); return }

  // Foto anterior de cada perfil, para el crecimiento por resta.
  const desdeMax = new Date(Date.now() - MAX_DIAS_VENTANA * 86400000).toISOString()
  const { data: fotos } = await sb
    .from('creator_platform_snapshots')
    .select('creator_id, videos, captured_at')
    .eq('red', 'tiktok')
    .gte('captured_at', desdeMax)
    .order('captured_at', { ascending: false })
  const anterior = new Map()
  for (const f of fotos ?? []) if (!anterior.has(f.creator_id)) anterior.set(f.creator_id, f)

  const resultados = []
  const descartados = []
  const nuevasFotos = []
  const crecimientos = []
  for (const e of conTikTok) {
    const h = limpia(e.handles.tiktok)
    const p = await leePerfil(h)
    await new Promise(r => setTimeout(r, 700))
    if (!p) { if (!mandaYouTube(e.id)) descartados.push(`${e.name} (no se pudo leer)`); continue }

    // 1) La foto se guarda siempre que haya datos, mande quien mande la nota.
    if (p.videos || p.seguidores) {
      nuevasFotos.push({ creator_id: e.id, red: 'tiktok', seguidores: p.seguidores || null, videos: p.videos || null })
    }

    // 2) Crecimiento por resta, solo para quien no tiene YouTube que lo mida.
    const prev = anterior.get(e.id)
    if (!mandaYouTube(e.id) && prev?.videos && p.videos) {
      const dias = (Date.now() - new Date(prev.captured_at).getTime()) / 86400000
      const nuevos = p.videos - prev.videos
      // Un total que BAJA significa vídeos borrados, no actividad negativa.
      if (dias >= MIN_DIAS_VENTANA && nuevos >= 0) {
        crecimientos.push({
          id: e.id, name: e.name, dias: Math.round(dias), nuevos,
          videos30d: Math.round((nuevos / dias) * 30),
        })
      }
    }

    if (mandaYouTube(e.id)) continue
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

  console.log(`\n--- Crecimiento por resta de fotos (${crecimientos.length}) ---`)
  if (!crecimientos.length) {
    const yaHay = anterior.size
    console.log(yaHay
      ? `  Ninguna foto anterior llega a los ${MIN_DIAS_VENTANA} días de antigüedad todavía.`
      : `  Primera pasada: no hay foto anterior con la que comparar. El dato aparece en la siguiente.`)
  }
  for (const c of crecimientos.sort((a, b) => b.videos30d - a.videos30d)) {
    console.log(`  ${c.name.padEnd(26).slice(0, 26)} +${String(c.nuevos).padStart(4)} vídeos en ${String(c.dias).padStart(2)} días → ${String(c.videos30d).padStart(3)}/30d`)
  }
  console.log(`\n  Fotos a guardar: ${nuevasFotos.length}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const r of resultados) {
    // PK compuesta (id, category): filtrar por las dos.
    const { error: err } = await sb.from('ranking_entries')
      .update({ narrativa_auto: r.score })
      .eq('id', r.id).eq('category', r.category)
    if (err) { fail++; console.error(`FAIL ${r.id}: ${err.message}`) } else ok++
  }
  // Las fotos. El índice único es por EXPRESIÓN (la fecha en UTC), y a un índice
  // por expresión no se le puede apuntar con `onConflict`, así que en vez de
  // upsert se borra la foto de hoy y se reinserta: relanzar el pipeline el mismo
  // día deja el mismo resultado en vez de duplicar o de reventar el lote entero
  // por una sola fila repetida.
  const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0)
  await sb.from('creator_platform_snapshots')
    .delete().eq('red', 'tiktok').gte('captured_at', hoy.toISOString())
  for (let i = 0; i < nuevasFotos.length; i += 200) {
    const { error: err } = await sb.from('creator_platform_snapshots').insert(nuevasFotos.slice(i, i + 200))
    if (err) console.error(`  ⚠️  fotos: ${err.message}`)
  }

  for (const c of crecimientos) {
    const { error: err } = await sb.from('creator_raw_metrics')
      .update({ videos_last_30d: c.videos30d })
      .eq('creator_id', c.id)
    if (err) { fail++; console.error(`FAIL crecimiento ${c.id}: ${err.message}`) }
  }

  const { error: errSync } = await sb.rpc('f_sync_creator_scores')
  console.log(errSync ? `  ⚠️  f_sync: ${errSync.message}` : '  ✓ f_sync_creator_scores() recalculado')
  console.log(`\nDone. OK=${ok} FAIL=${fail}`)
}

main().catch(e => { console.error(e); process.exit(1) })
