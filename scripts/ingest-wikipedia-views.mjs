#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-wikipedia-views.mjs
//
// Actualiza `mediatico_auto` usando pageviews de Wikipedia como
// proxy de atención mediática global.
//
// ── BILINGÜE EN×ES (2026-07-28) ──────────────────────────────────
// El score sale de la MEDIA GEOMÉTRICA sqrt(vistas_EN × vistas_ES):
// premia al que es famoso en los dos idiomas y penaliza al mono-idioma.
// Solo-EN inflaba a las estrellas NBA en un sitio hispanohablante
// (Brunson salía 95, por encima de medio LaLiga). Sin artículo en ES,
// se usa EN solo.
//
//   score = clamp(17.5 · log10(vistas) − 13.25, 45, 98)
//   2,4M/mes → 98 · 140K → 77 · 10K → 57
//
// ── TÍTULOS HORNEADOS (anti-homónimo) ────────────────────────────
// Para los ~124 atletas del catálogo, el título de Wikipedia viene de
// `scripts/data/wiki-titles{,-es}.json`, resueltos por Wikidata. La
// búsqueda difusa (opensearch) fallaba justo en los que más pesan:
// Jaylen Brown caía en un artículo de baloncesto en silla de ruedas,
// Donovan Mitchell en un beisbolista, Rodri/Gavi en desambiguaciones.
// El resto de entradas (miles, ingestadas de ESPN) sí usan opensearch.
//
// Fuente: Wikimedia Analytics REST API (gratuita, sin auth)
//
// Uso:
//   node scripts/ingest-wikipedia-views.mjs           # DRY RUN
//   node scripts/ingest-wikipedia-views.mjs --apply
//   node scripts/ingest-wikipedia-views.mjs --apply --sport futbol
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

// Títulos resueltos por Wikidata (id de la entry → título del artículo).
const readTitles = (f) => {
  try { return JSON.parse(readFileSync(path.join(__dirname, 'data', f), 'utf8')) }
  catch { console.warn(`⚠️  ${f} no encontrado — se usará búsqueda difusa para todos`); return {} }
}
const WIKI_TITLES_EN = readTitles('wiki-titles.json')
const WIKI_TITLES_ES = readTitles('wiki-titles-es.json')

// Caché de títulos resueltos por búsqueda difusa (id → título, o null si no hay
// artículo). Sin ella, cada corrida semanal repetía ~660 búsquedas por nombre;
// Wikimedia respondía con 429 y el paso se comía el timeout de 15 min del
// orquestador. Con caché, la corrida normal solo pide pageviews.
const CACHE_PATH = path.join(__dirname, 'data', 'wiki-title-cache.json')
const readCache = () => {
  try { return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) } catch { return {} }
}
const TITLE_CACHE = readCache()
let cacheDirty = false

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY   = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')
const SPORT_FILTER = (() => {
  const i = process.argv.indexOf('--sport')
  return i !== -1 ? process.argv[i + 1] : null
})()

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

// Últimos 60 días → media mensual aproximada
function dateRange() {
  const end = new Date()
  const start = new Date(end - 60 * 24 * 60 * 60 * 1000)
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')
  return { start: fmt(start), end: fmt(end) }
}

// Media mensual de vistas → score. Calibración verificada contra casos reales:
// 2,4M → 98 (Messi) · 140K → 77 · 10K → 57. El suelo 45 significa "sin señal".
function viewsToScore(monthlyViews) {
  if (!(monthlyViews > 0)) return 45
  const s = 17.5 * Math.log10(monthlyViews) - 13.25
  return Math.round(Math.min(98, Math.max(45, s)) * 10) / 10
}

// Combina EN y ES: media geométrica si hay artículo en español con tráfico real,
// EN solo en caso contrario.
function combineViews(enMonthly, esMonthly) {
  return esMonthly > 0 ? Math.sqrt(enMonthly * esMonthly) : enMonthly
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWithRetry(url, opts = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    // Timeout duro por intento (15 s): una conexión colgada bloqueaba el cron
    // semanal entero hasta el límite de 15 min de execFileSync → ETIMEDOUT y
    // pérdida del paso. Con AbortController abortamos, reintentamos con backoff
    // y, si se agota, devolvemos null (los llamadores ya tratan el null).
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 15000)
    try {
      const r = await fetch(url, { ...opts, signal: ac.signal })
      if (r.status === 429) { await sleep(3000 * (i + 1)); continue }
      return r
    } catch {
      if (i === retries) return null
      await sleep(1000 * (i + 1))
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

// Busca el artículo de Wikipedia más relevante para un nombre de persona
async function searchWikiTitle(name) {
  const q = encodeURIComponent(name)
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${q}&limit=3&namespace=0&format=json`
  const r = await fetchWithRetry(url, { headers: { 'User-Agent': 'takasports-rankings/1.0' } })
  if (!r?.ok) return null
  const [, titles] = await r.json()
  return titles?.[0] ?? null
}

// Vistas MENSUALES medias de un artículo en el proyecto indicado.
async function fetchPageviews(title, start, end, project = 'en.wikipedia') {
  const enc = encodeURIComponent(title.replace(/ /g, '_'))
  // all-access/all-agents incluye desktop + mobile + bots (más estable para volumen real)
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/all-agents/${enc}/daily/${start}/${end}`
  const r = await fetchWithRetry(url, { headers: { 'User-Agent': 'takasports-rankings/1.0' } })
  if (!r?.ok) return null
  const d = await r.json()
  const items = d?.items ?? []
  const total = items.reduce((sum, item) => sum + (item.views ?? 0), 0)
  return total / 2      // la ventana es de 60 días → media mensual
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}${SPORT_FILTER ? ` · sport=${SPORT_FILTER}` : ''}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading DB entries...')
  const query = sb.from('ranking_entries')
    .select('id, name, category, sport, mediatico_auto')
    // Solo lo que se ve. Sin este filtro recorría las ~16.000 filas de la tabla
    // (la mayoría inactivas), a 2-3 peticiones cada una: el paso se comía el
    // timeout de 15 min del orquestador semanal y se perdía entero.
    .eq('active', true)
  if (SPORT_FILTER) query.eq('sport', SPORT_FILTER)
  const { data: entries, error } = await query
  if (error) throw error
  // Excluir clubes (no son personas) y creadores: en ellos `mediatico_auto` es la
  // AUDIENCIA (followers) que calcula f_sync_creator_scores(), no fama en Wikipedia.
  const SKIP = new Set(['clubes', 'clubes_femenino', 'creadores', 'creadores_wwe'])
  const people = entries.filter(e => !SKIP.has(e.category))
  console.log(`  ${people.length} personas activas (de ${entries.length} entradas activas)`)

  const { start, end } = dateRange()
  console.log(`  Rango: ${start} → ${end}`)

  const results = []
  let searched = 0, notFound = 0, errors = 0

  console.log('\nProcessing Wikipedia lookups...')
  let bakedUsed = 0

  // En serie esto eran ~1,2 s por persona × ~950 = 19 min, y el orquestador
  // semanal mata cada paso a los 15 → el mediático se perdía entero cada
  // semana. Wikimedia admite de sobra esta concurrencia para un cliente
  // identificado por User-Agent.
  const CONCURRENCY = 6

  async function processOne(e) {
    // Título horneado por Wikidata > caché de búsquedas previas > búsqueda difusa.
    let titleEn = WIKI_TITLES_EN[e.id]
    if (titleEn) bakedUsed++
    else if (e.id in TITLE_CACHE) titleEn = TITLE_CACHE[e.id]
    else {
      titleEn = await searchWikiTitle(e.name).catch(() => null)
      TITLE_CACHE[e.id] = titleEn        // se cachea también el null: no volver a buscarlo
      cacheDirty = true
    }
    if (!titleEn) { notFound++; return }

    const enViews = await fetchPageviews(titleEn, start, end, 'en.wikipedia').catch(() => null)
    if (enViews === null) { errors++; return }

    // Español: título horneado si lo hay; si no, se prueba el MISMO título
    // inglés (la mayoría de artículos de personas se titulan igual en ambas).
    // No se busca por nombre a ciegas: eso reintroduce los homónimos. Si el
    // artículo no existe en es.wikipedia, devuelve 0 y se puntúa solo con EN.
    // Sin este intento solo 62 de 272 salían bilingües y el mediático volvía a
    // inflar a la NBA en un sitio hispanohablante.
    const titleEs = WIKI_TITLES_ES[e.id] ?? titleEn
    const esViews = await fetchPageviews(titleEs, start, end, 'es.wikipedia').catch(() => null) ?? 0

    searched++
    const combined = combineViews(enViews, esViews)
    results.push({
      entryId: e.id, category: e.category, name: e.name, sport: e.sport,
      wikiTitle: titleEn, enViews, esViews, views: combined,
      newScore: viewsToScore(combined),
      bilingual: esViews > 0,
      prev: e.mediatico_auto !== null ? Number(e.mediatico_auto) : null,
    })
  }

  const saveCache = () => {
    if (!cacheDirty) return
    const ordered = Object.fromEntries(Object.entries(TITLE_CACHE).sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(CACHE_PATH, JSON.stringify(ordered, null, 0))
    cacheDirty = false
  }

  for (let i = 0; i < people.length; i += CONCURRENCY) {
    await Promise.all(people.slice(i, i + CONCURRENCY).map(processOne))
    await sleep(120)
    if (i % (CONCURRENCY * 20) === 0 && i > 0) {
      console.log(`  ${i}/${people.length} procesados...`)
      saveCache()   // guardado incremental: si esto se corta, no se pierde lo resuelto
    }
  }
  saveCache()
  console.log(`  caché de títulos: ${Object.keys(TITLE_CACHE).length} entradas`)

  results.sort((a, b) => b.views - a.views)

  console.log(`\n--- Top 25 mediático (Wikipedia EN×ES) ---`)
  results.slice(0, 25).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    const k = (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(Math.round(v))
    const fuente = u.bilingual ? `EN ${k(u.enViews)}×ES ${k(u.esViews)}` : `EN ${k(u.enViews)}`
    console.log(`  ${k(u.views).padStart(6)}  ${u.name.padEnd(26)} [${(u.sport ?? '?').padEnd(10)}] ${fuente.padEnd(22)} ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})`)
  })

  const bil = results.filter(r => r.bilingual).length
  console.log(`\nResultados: ${results.length} actualizaciones (${bil} bilingües, ${bakedUsed} con título horneado), ${notFound} sin artículo, ${errors} errores`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of results) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ mediatico_auto: u.newScore })
      .eq('id', u.entryId).eq('category', u.category)   // la PK es (id, category)
    if (err) { fail++; if (VERBOSE) console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
