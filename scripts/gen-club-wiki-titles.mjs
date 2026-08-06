#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// gen-club-wiki-titles.mjs
//
// Resuelve el artículo de Wikipedia de cada CLUB vía Wikidata y lo hornea en
// scripts/data/wiki-titles-clubs{,-es}.json, que es lo que consume
// ingest-wikipedia-views.mjs para calcular su factor mediático.
//
// ── POR QUÉ WIKIDATA Y NO UNA BÚSQUEDA ───────────────────────────
// La búsqueda difusa por nombre es peligrosa con clubes: «Barcelona» casa con
// el artículo de la CIUDAD, que tiene un orden de magnitud más de visitas, y el
// club saldría con un mediático inflado. Wikidata da una DESCRIPCIÓN por
// entidad («club de fútbol», «equipo de baloncesto»), así que se puede exigir
// que lo encontrado sea del tipo correcto antes de fiarse.
//
// La validación por nombre que usa el script de pageviews está pensada para
// personas —exige que el apellido aparezca en el título— y por eso rechazaba a
// los clubes con abreviatura: «PSG» no aparece en «Paris Saint-Germain F.C.».
// De 134 equipos solo resolvía 21.
//
// Los equipos FEMENINOS solo se aceptan si la entidad habla de fútbol femenino:
// enlazarlos al artículo del club masculino inflaría sus visitas con las de
// otro equipo.
//
// Uso:
//   node scripts/gen-club-wiki-titles.mjs            # DRY RUN
//   node scripts/gen-club-wiki-titles.mjs --apply    # escribe los JSON
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const UA = { 'User-Agent': 'TakaSportsRankings/1.0 (https://takasportsmedia.com)' }

// Reintentos con espera creciente ante el 429 de Wikimedia.
//
// Sin esto, un club que pillara el límite de peticiones se daba por
// IRRESOLUBLE para siempre y se quedaba con su factor mediático en el suelo. Y
// pasaba en masa: 41 clubes «sin resolver» incluían a Borussia Dortmund,
// Flamengo, Palmeiras y el PSV — nombres que Wikidata conoce de sobra. No era
// que el filtro los rechazara: es que la API nunca llegó a contestar, porque
// otro paso del pipeline estaba consultándola a la vez.
const getJson = async (url) => {
  for (let intento = 0; intento < 4; intento++) {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) }).catch(() => null)
    if (r?.ok) return r.json().catch(() => null)
    // 429 y 5xx son temporales; el resto (404, 400) no mejora esperando.
    if (r && r.status !== 429 && r.status < 500) return null
    await sleep(2000 * (intento + 1))
  }
  return null
}
// La descripción tiene que decir que es un equipo de ESE deporte.
const ES_DEL_DEPORTE = {
  futbol:     /f[úu]tbol|football|soccer/i,
  baloncesto: /baloncesto|basketball/i,
  formula1:   /f[óo]rmula|formula one|escuder[íi]a|motorsport|racing team|constructor/i,
}
// Señales de que NO es un club: ciudades, regiones, temporadas, estadios…
const NO_ES_CLUB = /\b(ciudad|city in|municipality|municipio|capital|regi[óo]n|province|provincia|season|temporada|stadium|estadio|pel[íi]cula|film|album|[áa]lbum)\b/i
const ES_FEMENINO = /femenin|women|feminine|f[ée]minin/i
// Entidades SECUNDARIAS que también dicen «de fútbol» y contaminan la búsqueda:
// filiales (II, B, reserva), canteras, artículos derivados y homónimos de otro
// deporte. Sin esto, el Bayern acababa en «FC Bayern Munich II» y el Milan en
// un equipo de Superleague Formula que ya no existe.
const ENTIDAD_SECUNDARIA = /\b(ii|iii|b team|reserve|reserves|filial|cantera|academy|youth|sub-?\d+|u-?\d{2}|women'?s? national|national team|selecci[óo]n)\b|\(.*(superleague|esports|futsal|rugby|desambiguaci|disambiguation).*\)|beach|playa|f[úu]tbol sala|indoor|in international football|list of|anexo:|seasons?$|records?$/i

const normLabel = (s) => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\b(fc|cf|ac|sc|cd|ud|rc|club|afc|sd|ssc|de|футбол)\b/g, '')
  .replace(/[^a-z0-9]/g, '')

const limpiaNombre = (s) => (s || '').replace(/\s*(femenino|femenina|women'?s?|f[ée]minines?)\s*$/i, '').trim()

async function resolver(nombre, deporte, esFem) {
  const todos = []
  const patron = ES_DEL_DEPORTE[deporte] ?? ES_DEL_DEPORTE.futbol
  const consultas = esFem
    ? [`${limpiaNombre(nombre)} femenino`, `${limpiaNombre(nombre)} women`, nombre]
    : [nombre, limpiaNombre(nombre)]

  for (const q of consultas) {
    for (const lang of ['es', 'en']) {
      const d = await getJson(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&type=item&limit=6` +
        `&language=${lang}&uselang=${lang}&search=${encodeURIComponent(q)}`,
      )
      await sleep(120)
      // Se puntúan los candidatos en vez de coger el primero: el buscador
      // devuelve antes al filial que al primer equipo con más frecuencia de la
      // deseable.
      const cands = []
      for (const it of d?.search ?? []) {
        const desc = `${it.description ?? ''} ${it.label ?? ''}`
        if (!patron.test(desc)) continue
        if (NO_ES_CLUB.test(it.description ?? '')) continue
        if (ENTIDAD_SECUNDARIA.test(`${it.label ?? ''} ${it.description ?? ''}`)) continue
        // Un equipo femenino solo casa con una entidad femenina, y al revés.
        if (esFem !== ES_FEMENINO.test(desc)) continue
        const l = normLabel(it.label ?? ''), n = normLabel(limpiaNombre(nombre))
        const puntos = l === n ? 3 : l.startsWith(n) || n.startsWith(l) ? 2 : l.includes(n) || n.includes(l) ? 1 : 0
        cands.push({ it, puntos })
      }
      for (const c of cands) {
        if (!todos.some(t => t.it.id === c.it.id)) todos.push(c)
      }
    }
    if (todos.length) break   // con una consulta que da candidatos, basta
  }
  return todos
}

async function titulos(qids) {
  const out = new Map()
  for (let i = 0; i < qids.length; i += 40) {
    const d = await getJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks` +
      `&ids=${qids.slice(i, i + 40).join('|')}`,
    )
    for (const [qid, ent] of Object.entries(d?.entities ?? {})) {
      const sl = ent?.sitelinks ?? {}
      out.set(qid, {
        en: sl.enwiki?.title ?? null,
        es: sl.eswiki?.title ?? null,
        idiomas: Object.keys(sl).length,   // proxy de notoriedad
      })
    }
    await sleep(150)
  }
  return out
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: clubs, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, sport')
    .eq('active', true)
    .in('category', ['clubes', 'clubes_femenino'])
    .order('score_auto', { ascending: false, nullsFirst: false })
  if (error) throw error
  console.log(`  ${clubs.length} equipos activos\n`)

  const candidatos = new Map()   // club.id → [{it, puntos}]
  const sinResolver = []
  for (const c of clubs) {
    const cands = await resolver(c.name, c.sport ?? 'futbol', c.category === 'clubes_femenino')
    if (cands.length) candidatos.set(c.id, cands)
    else sinResolver.push(c)
  }

  // Desempate por NOTORIEDAD: el club de verdad tiene artículo en decenas de
  // idiomas y su homónimo en dos. Sin esto, «FC Barcelona» acababa en el equipo
  // de fútbol playa y «Real Madrid» en un club sudafricano del mismo nombre.
  const todosQids = [...new Set([...candidatos.values()].flat().map(c => c.it.id))]
  const mapa = await titulos(todosQids)

  const encontrados = []
  for (const c of clubs) {
    const cands = candidatos.get(c.id)
    if (!cands) continue
    // El filtro de entidad secundaria mira etiqueta y descripción, pero el
    // artículo puede seguir siendo derivado («PSV Eindhoven in international
    // football»). Se comprueba también el título ya resuelto.
    const limpios = cands.filter(x => {
      const t = mapa.get(x.it.id)
      return !ENTIDAD_SECUNDARIA.test(`${t?.en ?? ''} ${t?.es ?? ''}`)
    })
    const cands2 = limpios.length ? limpios : []
    if (!cands2.length) { sinResolver.push(c); continue }
    cands2.sort((a, b) =>
      (mapa.get(b.it.id)?.idiomas ?? 0) - (mapa.get(a.it.id)?.idiomas ?? 0) ||
      b.puntos - a.puntos ||
      (a.it.label ?? '').length - (b.it.label ?? '').length)
    const g = cands2[0].it
    encontrados.push({ ...c, qid: g.id, desc: g.description ?? '' })
  }

  const EN = {}, ES = {}
  let conArticulo = 0
  for (const e of encontrados) {
    const t = mapa.get(e.qid)
    if (!t?.en && !t?.es) { sinResolver.push(e); continue }
    if (t.en) EN[e.id] = t.en
    if (t.es) ES[e.id] = t.es
    conArticulo++
    console.log(`  ✓ ${e.name.padEnd(30).slice(0, 30)} ${(t.en ?? '—').padEnd(32).slice(0, 32)} ${t.es ?? '—'}`)
  }

  console.log(`\n  Resueltos con artículo: ${conArticulo} · sin resolver: ${sinResolver.length}`)
  if (sinResolver.length) console.log(`  Sin resolver: ${sinResolver.map(c => c.name).join(', ')}`)

  if (!APPLY) { console.log('\nDRY RUN.'); return }
  writeFileSync(path.join(__dirname, 'data', 'wiki-titles-clubs.json'), JSON.stringify(EN, null, 0))
  writeFileSync(path.join(__dirname, 'data', 'wiki-titles-clubs-es.json'), JSON.stringify(ES, null, 0))
  console.log(`\n  Escritos ${Object.keys(EN).length} títulos EN y ${Object.keys(ES).length} ES.`)
}

main().catch(err => { console.error(err); process.exit(1) })
