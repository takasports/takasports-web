#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// curate-active-entries.mjs
//
// DUEÑO ÚNICO del flag `active` de las entradas deportivas del ranking.
// Lo lanza el recompute semanal (~/.taka/weekly-rankings.mjs, dom 23:45).
//
// ── POR QUÉ ESTE SCRIPT ES CRÍTICO ───────────────────────────────
// Una persona puede tener VARIAS filas en ranking_entries:
//   · la fila CURADA  (id editorial: `saka`, `rodri`, `wemba`) — la que
//     mantiene el pipeline objetivo de taka-system con datos reales;
//   · su CLON ingestado de ESPN (`espn-12345`) — cobertura masiva;
//   · copias en categorías secundarias (sub21 / latam / concacaf).
// La versión anterior de este script hacía top-N por (sport, category)
// SIN saber que esas filas son la MISMA persona: los clones competían
// entre sí por el mismo cupo y un crack podía quedarse fuera del top-N
// con todas sus filas a la vez → DESAPARECÍA del ranking (le pasó a
// Rodri, Ødegaard, Pedri, De Bruyne, Saka, Wirtz… ~59 cracks).
//
// Además escribía con `.in('id', ids)` SIN filtrar categoría, y la PK es
// (id, category): desactivar `alcaraz-sub21` en jugadores (el futbolista
// del Everton) desactivaba también `alcaraz-sub21` en sub21 (el TENISTA).
//
// ── REGLAS (en este orden) ───────────────────────────────────────
//   0. `suppressed` = retirada editorial permanente → siempre inactiva.
//   1. IDENTIDAD: se agrupa por (nombre normalizado + deporte). De cada
//      persona sobrevive UNA fila, la canónica: curada > categoría
//      principal > con datos > mayor score. El resto se desactiva.
//      Los homónimos conocidos (PROTECTED_HOMONYMS) NO se agrupan.
//      Al colapsar, el superviviente hereda age_group='sub21' si alguna
//      de sus copias venía de la cantera (el filtro Cantera lo usa).
//   2. NÚCLEO CURADO: una fila curada (id no ingestado) con datos reales
//      siempre está activa — no la puede tirar el corte del top-N.
//   3. editorial_boost != 0 → siempre activa (override manual).
//   4. El resto compite por el top-N de su (sport, category).
//
// Uso:
//   node scripts/curate-active-entries.mjs           # DRY RUN
//   node scripts/curate-active-entries.mjs --apply
//   node scripts/curate-active-entries.mjs --verbose
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

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

// Categorías que NO toca este script: las gestiona f_sync_creator_scores()
// (creadores) o son puramente editoriales.
const SKIP_CATEGORIES = ['creadores', 'creadores_wwe', 'periodistas']

// Top-N por sport+category
const LIMITS = {
  'futbol/jugadores':         200,
  'futbol/jugadoras':         100,
  'futbol/sub21':              80,
  'futbol/latam':              80,
  'futbol/concacaf':           50,
  'futbol/entrenadores':       50,
  'futbol/clubes':             50,
  'futbol/clubes_femenino':    50,
  'tenis/jugadores':           60,
  'tenis/jugadoras':           60,
  'formula1/jugadores':        25,
  'ufc/jugadores':             40,
  'ufc/luchadoras_ufc':        30,
  'baloncesto/jugadores':      60,
  'baloncesto/sub21':          30,
  'baloncesto/latam':          30,
  'baloncesto/concacaf':       20,
  'nba/jugadores':             60,
}
const DEFAULT_LIMIT = 30

// Categorías principales: ante la misma persona, la fila de aquí manda sobre
// la de una categoría secundaria (sub21 / latam / concacaf son atributos, no
// personas distintas).
const PRIMARY_CATEGORIES = new Set([
  'jugadores', 'jugadoras', 'clubes', 'clubes_femenino', 'entrenadores', 'luchadoras_ufc',
])

// Categorías CONGELADAS: la web ya no las muestra, pero en la app entran por
// track='deportista'. No se dan altas nuevas — sus scores vienen de ligas
// débiles sin coeficiente de fuerza aplicado, así que promocionar filas nuevas
// las colaría por encima de Vinicius/Yamal. Solo se mantiene lo ya activo y se
// depuran duplicados. Retirarlas del todo es una decisión aparte.
const FROZEN_CATEGORIES = new Set(['latam', 'concacaf'])

// Categorías RETIRADAS del producto: siempre inactivas.
// `entrenadores` se retiró en el rediseño y la web dejó de pintarlos, pero
// `ranking_view` los mapea a track='deportista' y la APP seguía mostrándolos
// mezclados con los futbolistas — Ancelotti salía 6º y Guardiola 12º del
// ranking de deportistas. Un entrenador no compite con un delantero.
const RETIRED_CATEGORIES = new Set(['entrenadores'])

// Mismo deporte con dos etiquetas históricas. Sin esto, `becky` (sport 'wwe') y
// `wwe-becky` (sport 'wrestling') se leen como dos personas y el clon revive.
const SPORT_ALIASES = { wrestling: 'wwe', nba: 'baloncesto', f1: 'formula1' }
const canonicalSport = (s) => SPORT_ALIASES[s ?? ''] ?? (s ?? '')

// Prefijos de id generados por los ingests masivos. Todo lo demás es curado
// (sembrado a mano / catálogo editorial de taka-system).
const INGESTED_ID_RE = /^(espn-|f1-|atp-|wta-|ufc-|wwe-|coach-)/

// Personas DISTINTAS que comparten nombre y deporte. Nunca se fusionan.
// Clave: nombre normalizado + '|' + sport.
const PROTECTED_HOMONYMS = new Set([
  'nicogonzalez|futbol',   // Juventus (delantero) ≠ Manchester City (centrocampista)
  'alvarogarcia|futbol',   // Rayo Vallecano ≠ Alavés
  'idrissagueye|futbol',   // Everton ≠ Udinese
  'pedro|futbol',          // Pedro (Lazio, español) ≠ Pedro (Flamengo, brasileño)
  'carlosalcaraz|futbol',  // el futbolista del Everton (el tenista va por sport='tenis')
])

function normalizeName(s) {
  return (s || '')
    .replace(/[øØ]/g, 'o').replace(/[łŁ]/g, 'l').replace(/[đĐ]/g, 'd')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(jr|junior)$/, '')
}

// Palabras que no identifican a nadie: sufijos de club y partículas.
const NAME_STOPWORDS = new Set(['de','del','la','el','los','las','y','fc','cf','ac','sc','cd','ud','rc','club','afc','sd'])

function nameTokens(s) {
  const t = (s || '')
    .replace(/[øØ]/g, 'o').replace(/[łŁ]/g, 'l').replace(/[đĐ]/g, 'd')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(x => x && !NAME_STOPWORDS.has(x))
  // "Jr." solo se quita como SUFIJO: «Júnior Alonso» se llama Júnior de nombre.
  if (t.length > 1 && (t[t.length - 1] === 'jr' || t[t.length - 1] === 'junior')) t.pop()
  return t
}

// ¿Son dos escrituras del MISMO nombre? Exige que el apellido coincida exacto y
// que cada token del nombre más corto case con uno del largo, por igualdad o por
// prefijo (inicial incluida). Así "Kimi Antonelli", "A. Kimi Antonelli" y
// "Andrea Kimi Antonelli" son la misma persona, y "Gio Reyna" es "Giovanni
// Reyna" — pero "Adrián Pérez" y "Aldahir Pérez" siguen siendo dos personas.
function sameNameVariant(a, b) {
  const [ta, tb] = [nameTokens(a), nameTokens(b)]
  if (!ta.length || !tb.length) return false
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false        // apellido exacto
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  // Conjuntos idénticos: seguro ("FC Barcelona" ≡ "Barcelona").
  if (short.length === long.length && short.join(' ') === long.join(' ')) return true
  // Con un solo token no hay nada que confirme la identidad: el apellido suelto
  // fusionaba «AC Milan» con «Facundo Milán» y «Vinicius Jr.» con «Carlos
  // Vinícius». Hacen falta al menos nombre + apellido en las dos.
  if (short.length < 2) return false
  const pool = [...long]
  for (const t of short) {
    const i = pool.findIndex(u => u === t || u.startsWith(t) || t.startsWith(u))
    if (i === -1) return false
    pool.splice(i, 1)
  }
  return true
}

// El género forma parte de la identidad: el Manchester City femenino no es el
// masculino, y los rankings masculino y femenino son competiciones distintas.
const identityKey = (e) => `${normalizeName(e.name)}|${canonicalSport(e.sport)}${e.gender === 'f' ? '|f' : ''}`
const rowKey      = (e) => `${e.id}|${e.category}`
const isIngested  = (e) => INGESTED_ID_RE.test(e.id ?? '')

function hasRealData(e) {
  return e.rendimiento_auto !== null
    || e.contexto_auto !== null
    || e.mediatico_auto !== null
    || e.narrativa_auto !== null
}

function hasEditorialBoost(e) {
  return e.editorial_boost !== null && e.editorial_boost !== 0
}

// Canónica de un grupo de identidad: curada > categoría principal > con datos
// > mayor score > id estable (desempate determinista, sin azar entre corridas).
function canonicalFirst(a, b) {
  const curated = Number(!isIngested(a)) - Number(!isIngested(b))
  if (curated) return -curated
  const primary = Number(PRIMARY_CATEGORIES.has(a.category)) - Number(PRIMARY_CATEGORIES.has(b.category))
  if (primary) return -primary
  const data = Number(hasRealData(a)) - Number(hasRealData(b))
  if (data) return -data
  const score = (b.score_auto ?? 0) - (a.score_auto ?? 0)
  if (Math.abs(score) > 0.001) return score
  return a.id.localeCompare(b.id)
}

async function loadAll(sb) {
  let all = [], page = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, name, sport, gender, category, active, suppressed, age_group, score_auto, rendimiento_auto, contexto_auto, mediatico_auto, narrativa_auto, editorial_boost')
      .not('category', 'in', `(${SKIP_CATEGORIES.map(c => `"${c}"`).join(',')})`)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) throw error
    all = all.concat(data)
    if (data.length < 1000) break
    page++
  }
  return all
}

// Escribe `active` respetando la PK compuesta (id, category).
async function writeActive(sb, rows, value) {
  const byCategory = new Map()
  for (const e of rows) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, [])
    byCategory.get(e.category).push(e.id)
  }
  let ok = 0, fail = 0
  for (const [category, ids] of byCategory) {
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500)
      const { error } = await sb
        .from('ranking_entries')
        .update({ active: value })
        .in('id', batch)
        .eq('category', category)          // ← sin esto se pisan filas de otra categoría
      if (error) { fail += batch.length; console.error(`FAIL ${value ? 'activate' : 'deactivate'} ${category}: ${error.message}`) }
      else ok += batch.length
    }
  }
  return { ok, fail }
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading all entries...')
  const all = await loadAll(sb)
  console.log(`  ${all.length} entradas (sin ${SKIP_CATEGORIES.join('/')})`)

  const toActivate   = []
  const toDeactivate = []
  const ageGroupFix  = []            // supervivientes que heredan la cantera

  // ── 0. Suprimidas y retiradas: fuera, pase lo que pase ──────────
  const out = all.filter(e => e.suppressed || RETIRED_CATEGORIES.has(e.category))
  for (const e of out) if (e.active) toDeactivate.push(e)
  const pool = all.filter(e => !e.suppressed && !RETIRED_CATEGORIES.has(e.category))
  const nRetired = out.filter(e => !e.suppressed).length
  if (out.length) console.log(`  ${out.length - nRetired} suprimidas + ${nRetired} de categorías retiradas — excluidas`)

  // ── 1. Colapso por IDENTIDAD (una persona = una fila) ───────────
  console.log('\n[1/3] Colapsando identidades (misma persona, varias filas)...')
  const identities = new Map()
  for (const e of pool) {
    const key = identityKey(e)
    // Homónimos protegidos: cada fila es su propia identidad → no se fusionan.
    const groupKey = PROTECTED_HOMONYMS.has(key) ? `${key}#${rowKey(e)}` : key
    if (!identities.has(groupKey)) identities.set(groupKey, [])
    identities.get(groupKey).push(e)
  }

  const survivors = []
  let collapsed = 0, collapsedGroups = 0
  for (const [key, group] of identities) {
    if (group.length === 1) { survivors.push(group[0]); continue }
    group.sort(canonicalFirst)
    const winner = group[0]
    const losers = group.slice(1)
    collapsedGroups++
    collapsed += losers.length
    survivors.push(winner)

    // La cantera es un atributo, no una persona distinta: si alguna copia venía
    // de sub21, el superviviente se queda marcado (lo usa el filtro Cantera).
    const fromCantera = group.some(e => e.category === 'sub21' || e.age_group === 'sub21')
    if (fromCantera && winner.age_group !== 'sub21') ageGroupFix.push(winner)

    for (const e of losers) if (e.active) toDeactivate.push(e)
    if (VERBOSE) {
      console.log(`  IDENT ${key}: keep=${winner.id}/${winner.category}(${winner.score_auto ?? '–'}) drop=${losers.map(e => `${e.id}/${e.category}`).join(', ')}`)
    }
  }
  console.log(`  ${collapsedGroups} personas con filas duplicadas → ${collapsed} filas colapsadas`)
  console.log(`  ${survivors.length} identidades únicas`)

  // ── 1b. Variantes del mismo nombre ──────────────────────────────
  // El paso anterior exige el nombre IDÉNTICO, así que se le escapaban
  // "Kimi Antonelli" / "A. Kimi Antonelli" / "Andrea Kimi Antonelli" (tres
  // filas del mismo piloto en el top-10) o "FC Barcelona" / "Barcelona".
  // Aquí se agrupa por apellido + deporte + género y se fusionan solo las
  // variantes compatibles, y SOLO si una de las dos es una fila curada: las
  // variantes de nombre las generan los seeds hechos a mano; los ingests de
  // ESPN usan siempre la misma grafía. Sin ese requisito, el riesgo de fundir
  // dos personas distintas es real — hay 7 «Martínez» y 3 «González» activos.
  const anchors = new Map()
  for (const e of survivors) {
    if (PROTECTED_HOMONYMS.has(identityKey(e))) continue
    const t = nameTokens(e.name)
    if (!t.length) continue
    const k = `${t[t.length - 1]}|${canonicalSport(e.sport)}${e.gender === 'f' ? '|f' : ''}`
    if (!anchors.has(k)) anchors.set(k, [])
    anchors.get(k).push(e)
  }

  const merged = new Set()
  let variantGroups = 0, variantRows = 0
  for (const [, group] of anchors) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i++) {
      if (merged.has(rowKey(group[i]))) continue
      const cluster = [group[i]]
      for (let j = i + 1; j < group.length; j++) {
        if (merged.has(rowKey(group[j]))) continue
        if (identityKey(group[i]) === identityKey(group[j])) continue   // ya lo vio el paso 1
        if (!sameNameVariant(group[i].name, group[j].name)) continue
        if (isIngested(group[i]) && isIngested(group[j])) continue      // ambas de ingest → no tocar
        cluster.push(group[j])
      }
      if (cluster.length < 2) continue
      cluster.sort(canonicalFirst)
      const winner = cluster[0]
      variantGroups++
      for (const e of cluster.slice(1)) {
        merged.add(rowKey(e))
        variantRows++
        if (e.active) toDeactivate.push(e)
        if ((e.category === 'sub21' || e.age_group === 'sub21') && winner.age_group !== 'sub21') ageGroupFix.push(winner)
      }
      if (VERBOSE) {
        console.log(`  VARIANTE keep="${winner.name}" (${winner.id}/${winner.category}) drop=${cluster.slice(1).map(e => `"${e.name}" (${e.id}/${e.category})`).join(', ')}`)
      }
    }
  }
  const survivors2 = survivors.filter(e => !merged.has(rowKey(e)))
  console.log(`  ${variantGroups} nombres con variantes → ${variantRows} filas más colapsadas`)

  // ── 2. Top-N por (sport, category) sobre los supervivientes ─────
  console.log('\n[2/3] Aplicando top-N por deporte/categoría...')
  const groups = new Map()
  for (const e of survivors2) {
    const key = `${e.sport}/${e.category}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  }

  let pinnedCurated = 0
  const finalActive = new Set()
  for (const [key, entries] of groups) {
    const limit = LIMITS[key] ?? DEFAULT_LIMIT
    const frozen = FROZEN_CATEGORIES.has(entries[0].category)

    // Siempre activas: override editorial + núcleo curado con datos reales.
    // Lo segundo es lo que impide que un crack del catálogo se caiga del
    // ranking por tener un score bajo esa semana.
    const always = entries.filter(e => hasEditorialBoost(e) || (!isIngested(e) && hasRealData(e)))
    const alwaysKeys = new Set(always.map(rowKey))
    pinnedCurated += always.filter(e => !hasEditorialBoost(e)).length

    const candidates = entries.filter(e => !alwaysKeys.has(rowKey(e)) && hasRealData(e))
    const noData     = entries.filter(e => !alwaysKeys.has(rowKey(e)) && !hasRealData(e))

    candidates.sort((a, b) => (b.score_auto ?? 0) - (a.score_auto ?? 0))
    const topN = candidates.slice(0, limit)
    const rest = candidates.slice(limit)

    // Categoría congelada: ni altas ni bajas por score. Se conserva tal cual la
    // población activa de hoy (curada a mano y recalibrada por coeficiente de
    // liga); el top-N no aplica porque el resto de filas no está recalibrado.
    // Las bajas por duplicado o `suppressed` ya se aplicaron antes.
    const keep = frozen ? entries.filter(e => e.active) : [...always, ...topN]
    const drop = frozen ? []                            : [...rest, ...noData]

    for (const e of keep) { finalActive.add(rowKey(e)); if (!e.active) toActivate.push(e) }
    for (const e of drop) if (e.active) toDeactivate.push(e)

    if (VERBOSE) {
      const act = keep.filter(e => !e.active).length
      const deact = drop.filter(e => e.active).length
      if (act || deact) console.log(`  ${key.padEnd(28)} top=${limit}${frozen ? ' [congelada]' : ''} fijas=${always.length} candidatas=${candidates.length}  +${act} -${deact}`)
    }
  }
  console.log(`  ${pinnedCurated} entradas del núcleo curado protegidas del corte`)

  // ── 3. Resumen ──────────────────────────────────────────────────
  // El age_group solo importa en las filas que quedan visibles.
  const ageGroupPending = ageGroupFix.filter(e => finalActive.has(rowKey(e)))
  console.log(`\n[3/3] Total cambios: +${toActivate.length} activar, -${toDeactivate.length} desactivar, ${ageGroupPending.length} age_group`)
  const summarize = (rows) => {
    const s = {}
    for (const e of rows) { const k = `${e.sport}/${e.category}`; s[k] = (s[k] ?? 0) + 1 }
    return Object.entries(s).sort()
  }
  console.log('\n  Activaciones:');   for (const [k, n] of summarize(toActivate))   console.log(`    +${n}  ${k}`)
  console.log('  Desactivaciones:'); for (const [k, n] of summarize(toDeactivate)) console.log(`    -${n}  ${k}`)

  // Quién sale del ranking: lo más caro de un fallo aquí es perder a alguien
  // sin enterarse, así que las bajas se listan una a una.
  if (VERBOSE) {
    console.log('\n  Bajas detalladas:')
    for (const e of [...toDeactivate].sort((a, b) => (b.score_auto ?? 0) - (a.score_auto ?? 0))) {
      console.log(`    -  ${(e.name ?? '').padEnd(28)} ${e.id}/${e.category} ${e.sport} score=${e.score_auto ?? '–'}`)
    }
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  const a = await writeActive(sb, toActivate, true)
  const d = await writeActive(sb, toDeactivate, false)

  let ageOk = 0
  const ageByCategory = new Map()
  for (const e of ageGroupPending) {
    if (!ageByCategory.has(e.category)) ageByCategory.set(e.category, [])
    ageByCategory.get(e.category).push(e.id)
  }
  for (const [category, ids] of ageByCategory) {
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500)
      const { error } = await sb.from('ranking_entries')
        .update({ age_group: 'sub21' }).in('id', batch).eq('category', category)
      if (!error) ageOk += batch.length
      else console.error(`FAIL age_group ${category}: ${error.message}`)
    }
  }

  console.log(`\nDone. activadas=${a.ok} desactivadas=${d.ok} age_group=${ageOk} FAIL=${a.fail + d.fail}`)

  // La vista materializada es la que lee la web y la app.
  const { error: refreshErr } = await sb.rpc('refresh_ranking_view')
  console.log(refreshErr ? `⚠️  refresh_ranking_view: ${refreshErr.message}` : '✓ ranking_view refrescada')
}

main().catch(err => { console.error(err); process.exit(1) })
