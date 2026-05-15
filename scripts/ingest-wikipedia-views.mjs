#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-wikipedia-views.mjs
//
// Actualiza `mediatico_auto` usando pageviews de Wikipedia como
// proxy de atención mediática global.
//
// Wikipedia pageviews correlacionan fuertemente con:
//   - Cobertura mediática internacional
//   - Búsquedas en Google (pero sin rate-limit)
//   - Picos de relevancia (torneos, transferencias, polémicas)
//
// Escala log (media mensual de vistas):
//   ≥ 100K vistas/mes → 95   (superestrellas globales)
//   ≥  50K           → 88
//   ≥  20K           → 80
//   ≥  10K           → 73
//   ≥   5K           → 65
//   ≥   2K           → 57
//   ≥   1K           → 50
//   <   1K           → 42
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
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

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

// Log scale: views/60d → score 35-99
function viewsToScore(views60d) {
  const monthly = views60d / 2
  if (monthly <= 0) return 35
  const s = 30 + 70 * Math.log10(monthly + 1) / Math.log10(150000)
  return Math.round(Math.min(99, Math.max(35, s)) * 10) / 10
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWithRetry(url, opts = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const r = await fetch(url, opts)
    if (r.status === 429) { await sleep(3000 * (i + 1)); continue }
    return r
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

// Obtiene total de pageviews en el rango de fechas
async function fetchPageviews(title, start, end) {
  const enc = encodeURIComponent(title.replace(/ /g, '_'))
  // all-access/all-agents incluye desktop + mobile + bots (más estable para volumen real)
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${enc}/daily/${start}/${end}`
  const r = await fetchWithRetry(url, { headers: { 'User-Agent': 'takasports-rankings/1.0' } })
  if (!r?.ok) return null
  const d = await r.json()
  const items = d?.items ?? []
  return items.reduce((sum, item) => sum + (item.views ?? 0), 0)
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}${SPORT_FILTER ? ` · sport=${SPORT_FILTER}` : ''}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading DB entries...')
  const query = sb.from('ranking_entries')
    .select('id, name, category, sport, mediatico_auto')
  if (SPORT_FILTER) query.eq('sport', SPORT_FILTER)
  const { data: entries, error } = await query
  if (error) throw error
  // Solo personas individuales — excluir clubes
  const people = entries.filter(e => e.category !== 'clubes' && e.category !== 'clubes_femenino')
  console.log(`  ${people.length} personas (de ${entries.length} entradas totales)`)

  const { start, end } = dateRange()
  console.log(`  Rango: ${start} → ${end}`)

  const results = []
  let searched = 0, notFound = 0, errors = 0

  console.log('\nProcessing Wikipedia lookups...')
  for (const e of people) {
    const title = await searchWikiTitle(e.name).catch(() => null)
    await sleep(150)
    if (!title) { notFound++; continue }

    const views = await fetchPageviews(title, start, end).catch(() => null)
    await sleep(150)
    if (views === null) { errors++; continue }

    searched++
    const newScore = viewsToScore(views)
    results.push({
      entryId: e.id, category: e.category, name: e.name, sport: e.sport,
      wikiTitle: title, views60d: views, newScore,
      prev: e.mediatico_auto !== null ? Number(e.mediatico_auto) : null,
    })

    if (searched % 50 === 0) console.log(`  ${searched}/${people.length} procesados...`)
  }

  results.sort((a, b) => b.views60d - a.views60d)

  console.log(`\n--- Top 25 mediático (Wikipedia views) ---`)
  results.slice(0, 25).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    const views = u.views60d >= 1000 ? `${(u.views60d / 1000).toFixed(0)}K` : String(u.views60d)
    console.log(`  ${views.padStart(6)} vistas  ${u.name.padEnd(28)} [${(u.sport ?? '?').padEnd(10)}]  ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})`)
  })

  console.log(`\nResultados: ${results.length} actualizaciones, ${notFound} sin artículo, ${errors} errores`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of results) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ mediatico_auto: u.newScore })
      .eq('id', u.entryId).eq('category', u.category)
    if (err) { fail++; if (VERBOSE) console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
