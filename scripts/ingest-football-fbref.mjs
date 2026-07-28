#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-football-fbref.mjs  (fuente: understat.com)
//
// Mejora el factor `rendimiento_auto` de los jugadores de fútbol
// usando xG + xA de Understat a través de su API interna.
//
// Score basado en xGI90 = (xG + xA) / (minutos / 90):
//   xGI90 ≥ 0.80 → 92-99  (élite: Mbappé, Salah, Haaland)
//   xGI90 ≥ 0.60 → 85-92  (All-Star ofensivo)
//   xGI90 ≥ 0.45 → 78-85  (muy bueno)
//   xGI90 ≥ 0.30 → 68-78  (buen mediocampista/extremo)
//   xGI90 ≥ 0.18 → 57-68  (rotación)
//   xGI90 ≥ 0.08 → 45-57  (suplente / CDM)
//   xGI90 <  0.08 → 35-45 (defensa/portero — omitido si sin historial)
//
// Ligas: LaLiga, Premier, Bundesliga, Serie A, Ligue 1
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

const MIN_MINUTES = 450   // ~5 partidos completos
const MIN_PREV_REND = 65  // umbral para actualizar defensas/GK de bajo xGI

// Temporada: agosto comienza nueva temporada. En mayo 2026 → temporada 2025 (2025-26)
const SEASON = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1

const LEAGUES = [
  { name: 'LaLiga',         slug: 'La_liga'    },
  { name: 'Premier League', slug: 'EPL'        },
  { name: 'Bundesliga',     slug: 'Bundesliga' },
  { name: 'Serie A',        slug: 'Serie_A'    },
  { name: 'Ligue 1',        slug: 'Ligue_1'    },
]

// Understat usa nombres legales completos que pueden diferir del apodo conocido.
// Este mapa cubre los casos más comunes.
const NAME_ALIASES = {
  'kylianbappelottin': 'kylianmbappe',
  'kylianbapppelottin': 'kylianmbappe',
  'viniciusjunior': 'vinicius',
  'viniciusjr': 'vinicius',
  'rodrygogoesdenascimento': 'rodrygo',
  'rodrygosilvadenascimento': 'rodrygo',
  'ferrantoressans': 'ferrantorres',
  'luisalbertomorantelopez': 'luisalberto',
  'anthonyelanga': 'elanga',
  'pedrorodriguezledesma': 'pedri',
  'gallenopedro': 'pedro',
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
           .toLowerCase().replace(/[^a-z]/g, '')
}

// Genera variantes de búsqueda para un nombre de Understat:
// 1. Nombre completo normalizado
// 2. Primeros dos tokens (cubre apellidos compuestos con guión)
function nameVariants(rawName) {
  const full = normalize(rawName)
  const alias = NAME_ALIASES[full]
  const tokens = rawName.split(/[\s-]+/).filter(Boolean)
  const twoToken = tokens.length >= 2 ? normalize(tokens[0] + tokens[1]) : full
  const variants = [...new Set([full, twoToken, ...(alias ? [alias] : [])])]
  return variants
}

// ── PERCENTIL POR POSICIÓN ───────────────────────────────────────
// El xGI90 en bruto mide producción ofensiva, así que comparaba a un
// centrocampista con un delantero centro y hundía a quien juega para que otro
// marque: Pedri 71,6 · Declan Rice 70,9 · Trent 62 — con Haaland en 99. Ahora
// cada jugador se compara con los de SU posición: se ordena a toda la población
// de las 5 grandes (≥450 min) dentro de su grupo y su percentil se mapea a un
// rango. Verificado: Pedri 85,8 · Bellingham 91,7 · De Bruyne 92,5, y los
// delanteros de élite se quedan donde estaban (Haaland 95,4 · Yamal 95,6).
//
// Understat lista las posiciones jugadas en orden D→F ("D M S", "F M S"), así
// que la PRIMERA letra es la más defensiva = su puesto de referencia. Un lateral
// ("D M S") va a DEF y no compite contra los mediapuntas.
//
// Los porteros quedan fuera: su xGI no significa nada y no hay paradas en esta
// fuente, así que se conserva el valor que ya tuvieran.
const POSITION_RANGES = {
  FWD: [50, 96],   // el techo lo iguala apply-score-caps.mjs
  MID: [48, 94],
  DEF: [44, 90],
}

function positionBucket(pos) {
  const c = (pos ?? '').trim().toUpperCase()[0]
  if (c === 'G') return 'GK'
  if (c === 'D') return 'DEF'
  if (c === 'F') return 'FWD'
  return 'MID'
}

// Minutos de "confianza": por debajo de esto, el dato se mezcla con la media de
// su posición. Un por-90 sobre 450 minutos es ruido — Kai Havertz salía 94,9 con
// 4,9 goles en media temporada lesionado, por delante de quien jugó 3.000
// minutos. Con K=900 (~10 partidos), el que juega una temporada entera manda su
// dato casi entero y el de media temporada tira hacia la media de su puesto.
const SHRINK_MINUTES = 1350

// Percentil (0..1) de cada jugador dentro de su grupo → score del rango.
function scoreByPercentile(players) {
  const groups = new Map()
  for (const p of players) {
    const b = positionBucket(p.position)
    if (!groups.has(b)) groups.set(b, [])
    groups.get(b).push(p)
  }
  const scores = new Map()
  for (const [bucket, group] of groups) {
    const range = POSITION_RANGES[bucket]
    if (!range) continue                       // GK: sin dato útil, no se toca

    // Media del grupo ponderada por minutos (el jugador de 3.000 min pesa más
    // que el de 450 al definir qué es "normal" en esa posición).
    const totalMin = group.reduce((s, p) => s + p.minutes, 0) || 1
    const mean = group.reduce((s, p) => s + p.xgi90 * p.minutes, 0) / totalMin

    for (const p of group) {
      p.xgi90adj = (p.xgi90 * p.minutes + mean * SHRINK_MINUTES) / (p.minutes + SHRINK_MINUTES)
    }
    group.sort((a, b) => a.xgi90adj - b.xgi90adj)
    const last = Math.max(group.length - 1, 1)
    group.forEach((p, i) => {
      const pct = group.length < 2 ? 0.5 : i / last
      scores.set(p, Math.round((range[0] + (range[1] - range[0]) * pct) * 10) / 10)
    })
  }
  return scores
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchLeague(league) {
  const res = await fetch('https://understat.com/main/getPlayersStats/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': `https://understat.com/league/${league.slug}/${SEASON}`,
    },
    body: `league=${league.slug}&season=${SEASON}`,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error('API returned success:false')
  const players = (json.players ?? []).filter(p => parseInt(p.time) >= MIN_MINUTES)
  console.log(`  ${league.name}: ${players.length} jugadores (≥${MIN_MINUTES} min) de ${(json.players ?? []).length} totales`)
  return players
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} · Temporada ${SEASON}-${SEASON + 1}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading DB football entries...')
  // Paginado y solo activas: sin `range` PostgREST corta en 1.000 filas EN
  // SILENCIO — había 4.238 filas de fútbol y se leían las 1.000 primeras, así
  // que a media plantilla no le llegaba nunca el rendimiento real.
  let entries = [], page = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, name, category, rendimiento_auto')
      .eq('sport', 'futbol')
      .eq('active', true)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) throw error
    entries = entries.concat(data)
    if (data.length < 1000) break
    page++
  }
  console.log(`  ${entries.length} entradas de fútbol activas`)

  // Índice DB por nombre normalizado (todas las variantes)
  const byNorm = new Map()
  for (const e of entries) {
    const key = normalize(e.name)
    if (!byNorm.has(key)) byNorm.set(key, [])
    byNorm.get(key).push(e)
  }

  // El percentil necesita la población COMPLETA, así que primero se descargan
  // todas las ligas y solo después se puntúa.
  console.log('\nFetching Understat leagues...')
  const allPlayers = []
  for (const league of LEAGUES) {
    let players
    try {
      players = await fetchLeague(league)
    } catch (err) {
      console.error(`  ERROR ${league.name}: ${err.message}`)
      players = []
    }
    for (const p of players) {
      const minutes = parseInt(p.time) || 0
      if (minutes < MIN_MINUTES) continue
      const xg  = parseFloat(p.xG) || 0
      const xga = parseFloat(p.xA) || 0
      allPlayers.push({
        ustName: p.player_name, league: league.name, position: p.position,
        minutes, xg, xga, xgi90: (xg + xga) / (minutes / 90),
      })
    }
    await sleep(800)
  }

  const percentileScores = scoreByPercentile(allPlayers)
  const byBucket = {}
  for (const p of allPlayers) byBucket[positionBucket(p.position)] = (byBucket[positionBucket(p.position)] ?? 0) + 1
  console.log(`  población: ${Object.entries(byBucket).map(([b, n]) => `${b} ${n}`).join(' · ')}`)

  // Primera liga que matchea un entry gana (evita doble update de transferidos)
  const bestByEntry = new Map()
  for (const p of allPlayers) {
    const newScore = percentileScores.get(p)
    if (newScore === undefined) continue          // portero: no se toca
    for (const variant of nameVariants(p.ustName)) {
      const matched = byNorm.get(variant) ?? []
      for (const e of matched) {
        if (bestByEntry.has(e.id)) continue
        bestByEntry.set(e.id, {
          entryId: e.id, category: e.category, name: e.name,
          ustName: p.ustName, league: p.league,
          position: p.position, minutes: p.minutes,
          xg: p.xg, xga: p.xga, xgi90: p.xgi90,
          prev: e.rendimiento_auto !== null ? Number(e.rendimiento_auto) : null,
          newScore,
        })
      }
    }
  }

  // Ya no hace falta apartar a los defensas de xGI bajo: compiten entre ellos,
  // así que un central sin goles cae al suelo de SU grupo, no al de todos.
  // Los porteros ni llegan aquí (scoreByPercentile no los puntúa).
  const updates = [...bestByEntry.values()]
  const skipped = []

  updates.sort((a, b) => b.newScore - a.newScore)

  console.log(`\n--- Top 25 fútbol por percentil de posición ---`)
  updates.slice(0, 25).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    console.log(
      `  xGI=${u.xgi90.toFixed(3)} (${u.xg.toFixed(1)}g+${u.xga.toFixed(1)}a)` +
      `  ${u.ustName.padEnd(26)} [${(u.position ?? '??').padEnd(4)}]` +
      `  ${(u.league ?? '').padEnd(14)} ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})`
    )
  })

  if (skipped.length > 0 && VERBOSE) {
    console.log(`\nSkipped (defensivos bajo xGI sin historial relevante):`)
    skipped.forEach(s => console.log(`  ${s.ustName.padEnd(28)} ${(s.position ?? '??').padEnd(4)} xGI90=${s.xgi90.toFixed(3)} prev=${s.prev ?? '?'}`))
  }

  const totalMatched = updates.length + skipped.length
  console.log(`\nMatched: ${totalMatched} (updates: ${updates.length}, skipped: ${skipped.length})`)
  console.log(`Sin datos FBref: ${entries.length - totalMatched}`)

  if (VERBOSE) {
    const matched = new Set([...updates, ...skipped].map(u => u.entryId))
    const unm = entries.filter(e => !matched.has(e.id))
    if (unm.length > 0) {
      console.log('\nNo matcheados (primeros 40):', unm.slice(0, 40).map(e => `${e.name} [${e.category}]`).join(', '))
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
