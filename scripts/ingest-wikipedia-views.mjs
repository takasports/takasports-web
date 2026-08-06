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
// Atletas (resueltos por Wikidata en taka-system) + clubes (resueltos por
// gen-club-wiki-titles.mjs). Van juntos porque se buscan igual: por id de entry.
const WIKI_TITLES_EN = { ...readTitles('wiki-titles.json'), ...readTitles('wiki-titles-clubs.json') }
const WIKI_TITLES_ES = { ...readTitles('wiki-titles-es.json'), ...readTitles('wiki-titles-clubs-es.json') }

// Caché de títulos resueltos por búsqueda difusa (id → título, o null si no hay
// artículo). Sin ella, cada corrida semanal repetía ~660 búsquedas por nombre;
// Wikimedia respondía con 429 y el paso se comía el timeout de 15 min del
// orquestador. Con caché, la corrida normal solo pide pageviews.
// Ids generados por los ingests masivos (los curados se sirven de wiki-titles).
const INGESTED_ID_RE = /^(espn-|f1-|atp-|wta-|ufc-|wwe-|coach-)/
const NO_ARTICLE_SCORE = 50

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
const SOLO_CLUBES = process.argv.includes('--clubes')
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

// El 429 de Wikimedia no se arregla insistiendo rápido: hay que esperar de
// verdad. Con 3 intentos y esperas de 3/6/9 s fallaba la mitad de la tanda —
// 68 de 130 clubes en una prueba. Cuatro intentos con 5/15/30/60 s dan tiempo
// a que se abra la ventana, y como el paso ya va por tandas, ese rato extra
// cabe de sobra en el presupuesto de 25 minutos.
const ESPERA_429 = [5000, 15000, 30000, 60000]

async function fetchWithRetry(url, opts = {}, retries = ESPERA_429.length - 1) {
  for (let i = 0; i <= retries; i++) {
    // Timeout duro por intento (15 s): una conexión colgada bloqueaba el cron
    // semanal entero hasta el límite de 15 min de execFileSync → ETIMEDOUT y
    // pérdida del paso. Con AbortController abortamos, reintentamos con backoff
    // y, si se agota, devolvemos null (los llamadores ya tratan el null).
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 15000)
    try {
      const r = await fetch(url, { ...opts, signal: ac.signal })
      if (r.status === 429) { await sleep(ESPERA_429[Math.min(i, ESPERA_429.length - 1)]); continue }
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

function nameTokens(s) {
  return (s || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')          // "Rodri (footballer, born 1996)" → "Rodri"
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(Boolean)
}

// ¿El artículo encontrado es DE ESA persona?
// opensearch siempre devuelve algo: para un jugador sin artículo caía en el
// primer resultado parecido y le asignábamos las visitas de un desconocido —
// así había suplentes de la NWSL por encima de Bonmatí. Se exige que el
// apellido aparezca en el título y que coincida la mayoría del nombre.
function titleMatchesName(title, name) {
  const t = nameTokens(title), n = nameTokens(name)
  if (!t.length || !n.length) return false
  if (!t.includes(n[n.length - 1])) return false
  const hits = n.filter(x => t.includes(x)).length
  return hits >= Math.max(1, Math.ceil(n.length * 0.6))
}

// Busca el artículo de Wikipedia más relevante para un nombre de persona
async function searchWikiTitle(name) {
  const q = encodeURIComponent(name)
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${q}&limit=3&namespace=0&format=json`
  const r = await fetchWithRetry(url, { headers: { 'User-Agent': 'takasports-rankings/1.0' } })
  if (!r?.ok) return null
  const [, titles] = await r.json()
  return (titles ?? []).find(t => titleMatchesName(t, name)) ?? null
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
  // Solo lo que se ve: sin el filtro `active` recorría las ~16.000 filas de la
  // tabla (la mayoría inactivas), a 2-3 peticiones cada una, y el paso se comía
  // el timeout de 15 min del orquestador semanal. Y paginado, porque sin
  // `range` PostgREST corta en 1.000 filas SIN AVISAR (hay ~1.170 activas).
  let entries = [], page = 0
  while (true) {
    const query = sb.from('ranking_entries')
      .select('id, name, category, sport, mediatico_auto')
      .eq('active', true)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (SPORT_FILTER) query.eq('sport', SPORT_FILTER)
    const { data, error } = await query
    if (error) throw error
    entries = entries.concat(data)
    if (data.length < 1000) break
    page++
  }
  // Los CLUBES sí entran (desde 2026-07-28): eran el último track con el
  // mediático puesto a mano precisamente porque este script los excluía, y un
  // club tiene artículo de Wikipedia igual que un deportista.
  // Siguen fuera los creadores: en ellos `mediatico_auto` es la AUDIENCIA
  // (seguidores) que calcula f_sync_creator_scores(), no fama en Wikipedia.
  const SKIP = new Set(['creadores', 'creadores_wwe'])
  const CLUBES = new Set(['clubes', 'clubes_femenino'])
  let people = entries.filter(e => !SKIP.has(e.category) && (!SOLO_CLUBES || CLUBES.has(e.category)))
  console.log(`  ${people.length} entradas a medir (de ${entries.length} activas)`)

  const { start, end } = dateRange()
  console.log(`  Rango: ${start} → ${end}`)

  // ── POR QUÉ SE MIDE POR TANDAS ───────────────────────────────────
  // Wikimedia limita por ráfaga aunque el cliente vaya identificado, y con los
  // reintentos el ritmo real cae a ~0,45 entradas por segundo: las 1.517 activas
  // tardan CASI UNA HORA. El orquestador mata cada paso a los 25 minutos, así
  // que este NUNCA terminaba — el registro `ranking_ingest_runs` lo venía
  // diciendo desde el 2 de agosto («❌ Wikipedia EN×ES») y nadie lo miraba.
  // Consecuencia: 158 de 214 clubes llevaban semanas con el mediático en el
  // suelo, no porque no tuvieran artículo, sino porque nunca les llegó el turno.
  //
  // La solución no es correr más —eso empeora el 429— sino medir por tandas y
  // rotar: cada pasada mide a los que hace más tiempo que no se miden, y en dos
  // o tres pasadas están todos. El mediático se mueve despacio; refrescarlo cada
  // semana y media es de sobra. Mejor un factor completo con una semana de
  // retraso que uno que no se calcula nunca.
  // Cuántas entradas caben en una tanda NO se puede fijar de antemano: depende
  // del humor de Wikimedia ese día. En una prueba fallaron 68 de 130 por límite
  // de peticiones y en la siguiente, con menos paralelismo, 9 de 120 — el mismo
  // número de entradas tardó menos de la mitad.
  //
  // Así que el tope real es de TIEMPO, no de cantidad: se procesa hasta agotar
  // el presupuesto y se guarda lo hecho. El orquestador mata cada paso a los 25
  // minutos, así que 18 deja margen para escribir resultados y cerrar. La
  // cantidad queda como tope de seguridad por si un día todo va rapidísimo.
  const POR_TANDA = Number(process.argv[process.argv.indexOf('--tanda') + 1]) || 700
  const MINUTOS = Number(process.argv[process.argv.indexOf('--minutos') + 1]) || 18
  const LIMITE_MS = MINUTOS * 60000
  const ARRANQUE = Date.now()
  const MEDIDOS_PATH = path.join(__dirname, 'data', 'wiki-views-last-measured.json')
  let MEDIDOS = {}
  try { MEDIDOS = JSON.parse(readFileSync(MEDIDOS_PATH, 'utf8')) } catch {}

  // Primero quien no se ha medido nunca, luego el más antiguo.
  const porAntiguedad = [...people].sort((a, b) => {
    const ta = MEDIDOS[`${a.id}|${a.category}`] ?? ''
    const tb = MEDIDOS[`${b.id}|${b.category}`] ?? ''
    return ta.localeCompare(tb)
  })
  const nuncaMedidos = porAntiguedad.filter(e => !MEDIDOS[`${e.id}|${e.category}`]).length
  people = porAntiguedad.slice(0, POR_TANDA)
  console.log(`  tanda de ${people.length} (de ${porAntiguedad.length}) · sin medir nunca: ${nuncaMedidos}`)

  const results = []
  const erroresPorEntrada = []
  let searched = 0, notFound = 0, errors = 0

  console.log('\nProcessing Wikipedia lookups...')
  let bakedUsed = 0

  // En serie esto eran ~1,2 s por persona × ~950 = 19 min, y el orquestador
  // semanal mata cada paso a los 15 → el mediático se perdía entero cada
  // semana. Wikimedia admite de sobra esta concurrencia para un cliente
  // identificado por User-Agent.
  // Seis en paralelo era lo que disparaba el 429: bajando a tres el ritmo real
  // SUBE, porque se pierde menos tiempo en esperas de castigo. Se puede ajustar
  // con --conc para experimentar sin tocar el fichero.
  const CONCURRENCY = Number(process.argv[process.argv.indexOf('--conc') + 1]) || 3

  async function processOne(e) {
    // Título horneado por Wikidata > caché de búsquedas previas > búsqueda difusa.
    let titleEn = WIKI_TITLES_EN[e.id]
    if (titleEn) bakedUsed++
    else if (e.id in TITLE_CACHE) {
      titleEn = TITLE_CACHE[e.id]
      // La caché se llenó antes de validar los títulos: se revisan al leerlos.
      if (titleEn && !titleMatchesName(titleEn, e.name)) {
        titleEn = null
        TITLE_CACHE[e.id] = null
        cacheDirty = true
      }
    }
    else {
      titleEn = await searchWikiTitle(e.name).catch(() => null)
      TITLE_CACHE[e.id] = titleEn        // se cachea también el null: no volver a buscarlo
      cacheDirty = true
    }
    if (!titleEn) {
      notFound++
      // Sin artículo propio = sin repercusión medible. A las filas ingestadas de
      // ESPN se les baja a 50 para que no arrastren un valor heredado o de un
      // homónimo: había suplentes con mediático 82 por delante de Bonmatí. Las
      // curadas no se tocan (tienen título horneado; si no lo tienen, es que
      // falta resolverlo a mano, no que no exista).
      if (INGESTED_ID_RE.test(e.id) && Number(e.mediatico_auto) > NO_ARTICLE_SCORE) {
        results.push({
          entryId: e.id, category: e.category, name: e.name, sport: e.sport,
          wikiTitle: null, enViews: 0, esViews: 0, views: 0,
          newScore: NO_ARTICLE_SCORE, bilingual: false,
          prev: e.mediatico_auto !== null ? Number(e.mediatico_auto) : null,
        })
      }
      return
    }

    const enViews = await fetchPageviews(titleEn, start, end, 'en.wikipedia').catch(() => null)
    if (enViews === null) { errors++; erroresPorEntrada.push(`${e.id}|${e.category}`); return }

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

  let procesados = 0
  for (let i = 0; i < people.length; i += CONCURRENCY) {
    if (Date.now() - ARRANQUE > LIMITE_MS) {
      console.log(`  ⏱  presupuesto de ${MINUTOS} min agotado en ${i}/${people.length} — el resto va en la próxima pasada`)
      people = people.slice(0, i)   // los no mirados NO se marcan como medidos
      break
    }
    await Promise.all(people.slice(i, i + CONCURRENCY).map(processOne))
    procesados = i + CONCURRENCY
    await sleep(120)
    if (i % (CONCURRENCY * 20) === 0 && i > 0) {
      const min = ((Date.now() - ARRANQUE) / 60000).toFixed(1)
      console.log(`  ${i}/${people.length} procesados (${min} min)...`)
      saveCache()   // guardado incremental: si esto se corta, no se pierde lo resuelto
    }
  }
  void procesados
  saveCache()
  // Se anota a quien SÍ se pudo mirar, incluidos los que no tienen artículo —
  // si no, los irresolubles volverían a encabezar la cola cada semana y la
  // rotación no avanzaría nunca.
  //
  // Pero NO a quien falló por límite de peticiones: ese no se ha medido, solo
  // se le ha rebotado. Marcarlo lo mandaba al final de la cola y su factor se
  // quedaba en el suelo otra semana más, que es justo el agujero que esto viene
  // a tapar. En la primera tanda de clubes fallaron así 94 de 214.
  const ahora = new Date().toISOString()
  const fallidos = new Set(erroresPorEntrada)
  for (const e of people) {
    if (fallidos.has(`${e.id}|${e.category}`)) continue
    MEDIDOS[`${e.id}|${e.category}`] = ahora
  }
  if (fallidos.size) console.log(`  ${fallidos.size} sin medir por límite de peticiones — siguen los primeros de la cola`)
  if (APPLY) writeFileSync(MEDIDOS_PATH, JSON.stringify(MEDIDOS, null, 0))
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

  // En serie eran ~660 peticiones de una en una, un par de minutos de reloj que
  // sumaban al timeout del orquestador. Cada score es distinto, así que no se
  // pueden agrupar por valor: se lanzan de 8 en 8.
  let ok = 0, fail = 0
  const WRITE_CONCURRENCY = 8
  for (let i = 0; i < results.length; i += WRITE_CONCURRENCY) {
    await Promise.all(results.slice(i, i + WRITE_CONCURRENCY).map(async (u) => {
      const { error: err } = await sb.from('ranking_entries')
        .update({ mediatico_auto: u.newScore })
        .eq('id', u.entryId).eq('category', u.category)   // la PK es (id, category)
      if (err) { fail++; if (VERBOSE) console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
    }))
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
