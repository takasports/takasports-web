#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-football-fbref.mjs
//
// Mejora el factor `rendimiento_auto` de los jugadores de fútbol
// usando xG (expected goals) + xA (expected assists) de FBref —
// las métricas de calidad de tiro/pase más fiables disponibles.
//
// Score basado en xGI90 = (xG + xA) / 90s jugados:
//   xGI90 ≥ 0.80 → 92-99  (élite ofensiva: Mbappé, Salah, Haaland)
//   xGI90 ≥ 0.60 → 85-92  (All-Star ofensivo)
//   xGI90 ≥ 0.45 → 78-85  (muy bueno)
//   xGI90 ≥ 0.30 → 68-78  (buen mediocampista/extremo)
//   xGI90 ≥ 0.18 → 57-68  (rotación)
//   xGI90 ≥ 0.08 → 45-57  (suplente / centrocampista defensivo)
//   xGI90 <  0.08 → 35-45 (defensa/portero — se omite si < MIN_MINUTES)
//
// Fuente: fbref.com — pública, sin auth, actualizada semanalmente.
// Ligas hombres: LaLiga·12, Premier·9, Bundesliga·20, Serie A·11, Ligue 1·13
// Ligas mujeres: WSL·189, Liga F·230, D1 Arkema·193, Frauen-BL·183, SAF·208
//
// IDs DB: slugs tipo 'yamal', 'mbappe', 'salah' (no IDs ESPN)
// Matching: nombre normalizado (sin tildes, minúsculas, sin espacios)
//
// Uso:
//   node scripts/ingest-football-fbref.mjs              # DRY RUN
//   node scripts/ingest-football-fbref.mjs --apply
//   node scripts/ingest-football-fbref.mjs --apply --verbose
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

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE keys in .env.local')
  process.exit(1)
}

const USER_AGENT = 'takasports-rankings/1.0 (+https://takasportsmedia.com)'
const MIN_MINUTES = 450  // ~5 partidos completos

const MEN_LEAGUES = [
  { name: 'LaLiga',         compId: 12  },
  { name: 'Premier League', compId: 9   },
  { name: 'Bundesliga',     compId: 20  },
  { name: 'Serie A',        compId: 11  },
  { name: 'Ligue 1',        compId: 13  },
]

const WOMEN_LEAGUES = [
  { name: 'WSL',             compId: 189 },
  { name: 'Liga F',          compId: 230 },
  { name: 'D1 Arkema',       compId: 193 },
  { name: 'Frauen-Bundesliga', compId: 183 },
  { name: 'Serie A Femm.',   compId: 208 },
]

// xGI90 → rendimiento score 0-100
function xgiToScore(xgi90) {
  let s
  if      (xgi90 >= 0.80) s = 92 + Math.min(7, (xgi90 - 0.80) * 35)
  else if (xgi90 >= 0.60) s = 85 + (xgi90 - 0.60) / 0.20 * 7
  else if (xgi90 >= 0.45) s = 78 + (xgi90 - 0.45) / 0.15 * 7
  else if (xgi90 >= 0.30) s = 68 + (xgi90 - 0.30) / 0.15 * 10
  else if (xgi90 >= 0.18) s = 57 + (xgi90 - 0.18) / 0.12 * 11
  else if (xgi90 >= 0.08) s = 45 + (xgi90 - 0.08) / 0.10 * 12
  else                    s = Math.max(35, 45 - (0.08 - xgi90) * 50)
  return Math.round(Math.min(99, Math.max(0, s)) * 10) / 10
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
           .toLowerCase().replace(/[^a-z]/g, '')
}

// Extrae el bloque HTML que contiene la tabla stats_standard_{compId}.
// FBref a veces la envuelve en un comentario HTML para carga diferida JS.
function findTableSection(html, compId) {
  const needle = `id="stats_standard_${compId}"`
  if (html.includes(needle)) return html

  let pos = 0
  while (true) {
    const start = html.indexOf('<!--', pos)
    if (start === -1) break
    const end = html.indexOf('-->', start + 4)
    if (end === -1) break
    const chunk = html.slice(start + 4, end)
    if (chunk.includes(needle)) return chunk
    pos = end + 3
  }
  return null
}

function parsePlayerRow(rowHtml) {
  // Solo filas con link de jugador (no cabeceras ni totales de equipo)
  const playerM = /data-stat="player"[^>]*><a href="(\/en\/players\/([a-f0-9]+)\/[^"]*)"[^>]*>([^<]+)<\/a>/.exec(rowHtml)
  if (!playerM) return null

  const name  = playerM[3].replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
  const fbrefId = playerM[2]

  const getVal = (stat) => {
    const m = new RegExp(`data-stat="${stat}"[^>]*>([^<]*)`, 'i').exec(rowHtml)
    return m ? m[1].trim() : ''
  }

  const minutes  = parseInt(getVal('minutes').replace(/,/g, '')) || 0
  const xg       = parseFloat(getVal('xg'))       || 0
  const xga      = parseFloat(getVal('xg_assist')) || 0
  const position = getVal('position')
  const nineties = minutes / 90

  return { name, fbrefId, position, minutes, nineties, xg, xga }
}

function parseTable(sectionHtml) {
  const players = []
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let m
  while ((m = rowRe.exec(sectionHtml)) !== null) {
    const p = parsePlayerRow(m[1])
    if (p && p.minutes >= MIN_MINUTES) players.push(p)
  }
  return players
}

async function fetchLeague(compId, leagueName) {
  const url = `https://fbref.com/en/comps/${compId}/stats/`
  const r = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  })
  if (!r.ok) throw new Error(`FBref ${leagueName} → HTTP ${r.status}`)
  const html = await r.text()
  const section = findTableSection(html, compId)
  if (!section) {
    console.warn(`  ⚠ tabla stats_standard_${compId} no encontrada en ${leagueName}`)
    return []
  }
  const rows = parseTable(section)
  console.log(`  ${leagueName}: ${rows.length} jugadores (≥${MIN_MINUTES} min)`)
  return rows
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Cargar todas las entradas de fútbol de la DB
  console.log('\nLoading DB football entries...')
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, rendimiento_auto')
    .eq('sport', 'futbol')
  if (error) throw error
  console.log(`  ${entries.length} entradas de fútbol`)

  // Índice por nombre normalizado (múltiples categorías → mismo nombre posible)
  const byNorm = new Map()
  for (const e of entries) {
    const key = normalize(e.name)
    if (!byNorm.has(key)) byNorm.set(key, [])
    byNorm.get(key).push(e)
  }

  // Índice para evitar duplicados: una sola actualización por entry_id
  // (si el jugador aparece en dos ligas, la primera gana)
  const bestByEntry = new Map()  // entry.id → { fbref_player, score }

  // Fetch leagues — hombres primero, luego mujeres
  const allLeagues = [...MEN_LEAGUES, ...WOMEN_LEAGUES]
  console.log('\nFetching FBref leagues...')
  for (const league of allLeagues) {
    let players
    try {
      players = await fetchLeague(league.compId, league.name)
    } catch (err) {
      console.error(`  ERROR ${league.name}: ${err.message}`)
      players = []
    }

    for (const p of players) {
      if (p.nineties < 1) continue
      const xgi90 = (p.xg + p.xga) / p.nineties
      const score = xgiToScore(xgi90)

      // Para DF/GK con xGI muy bajo, solo actualizar si tienen historial relevante
      // (el filtro real se aplica en el loop de updates más abajo)
      const key = normalize(p.name)
      const matched = byNorm.get(key) ?? []
      for (const e of matched) {
        if (bestByEntry.has(e.id)) continue  // primera liga gana
        bestByEntry.set(e.id, {
          entryId: e.id, category: e.category, name: e.name,
          fbrefName: p.name, league: league.name,
          position: p.position, minutes: p.minutes,
          xg: p.xg, xga: p.xga, xgi90,
          prev: e.rendimiento_auto !== null ? Number(e.rendimiento_auto) : null,
          newScore: score,
        })
      }
    }

    // Respetar límite FBref: ~1 req/s
    await sleep(1200)
  }

  // Separar actualizaciones: defensas/porteros puros con xGI muy bajo
  // solo se actualiza si tienen historial relevante (≥65) — evita bajar score
  // a CB que no generan xG pero tienen buen contexto/narrativa.
  const updates = []
  const skipped = []
  for (const u of bestByEntry.values()) {
    const isDefensive = /^(DF|GK)/.test(u.position ?? '')
    if (isDefensive && u.xgi90 < 0.08 && (u.prev === null || u.prev < 65)) {
      skipped.push(u)
      continue
    }
    updates.push(u)
  }

  updates.sort((a, b) => b.xgi90 - a.xgi90)

  console.log(`\n--- Top 25 fútbol por xGI90 ---`)
  updates.slice(0, 25).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    console.log(
      `  xGI90=${u.xgi90.toFixed(3)} xG=${u.xg.toFixed(1)} xA=${u.xga.toFixed(1)}` +
      `  ${u.fbrefName.padEnd(26)} [${(u.position ?? '??').padEnd(4)}] ` +
      `${(u.league ?? '').padEnd(15)} rend: ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})`
    )
  })

  if (skipped.length > 0 && VERBOSE) {
    console.log(`\nSkipped defensivos con xGI90 bajo:`)
    skipped.forEach(s => console.log(`  ${s.fbrefName.padEnd(28)} ${s.position} xGI90=${s.xgi90.toFixed(3)} prev=${s.prev ?? '?'}`))
  }

  console.log(`\nMatched: ${updates.length + skipped.length} (updates: ${updates.length}, skipped: ${skipped.length})`)
  console.log(`Unmatched DB entries: ${entries.length - (updates.length + skipped.length)}`)

  if (VERBOSE) {
    const matchedIds = new Set([...updates, ...skipped].map(u => u.entryId))
    const unmatched = entries.filter(e => !matchedIds.has(e.id))
    if (unmatched.length > 0) {
      console.log('Unmatched (primeros 30):', unmatched.slice(0, 30).map(e => `${e.name} [${e.category}]`).join(', '))
    }
  }

  if (!APPLY) {
    console.log('\nDRY RUN. Pasa --apply para escribir.')
    return
  }

  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb
      .from('ranking_entries')
      .update({ rendimiento_auto: u.newScore })
      .eq('id', u.entryId)
      .eq('category', u.category)
    if (err) { fail++; console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
