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
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, rendimiento_auto')
    .eq('sport', 'futbol')
  if (error) throw error
  console.log(`  ${entries.length} entradas de fútbol`)

  // Índice DB por nombre normalizado (todas las variantes)
  const byNorm = new Map()
  for (const e of entries) {
    const key = normalize(e.name)
    if (!byNorm.has(key)) byNorm.set(key, [])
    byNorm.get(key).push(e)
  }

  // Primera liga que matchea un entry gana (evita doble update de transferidos)
  const bestByEntry = new Map()
  console.log('\nFetching Understat leagues...')

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
      const nineties = minutes / 90
      const xg  = parseFloat(p.xG) || 0
      const xga = parseFloat(p.xA) || 0
      const xgi90 = (xg + xga) / nineties

      for (const variant of nameVariants(p.player_name)) {
        const matched = byNorm.get(variant) ?? []
        for (const e of matched) {
          if (bestByEntry.has(e.id)) continue
          bestByEntry.set(e.id, {
            entryId: e.id, category: e.category, name: e.name,
            ustName: p.player_name, league: league.name,
            position: p.position, minutes,
            xg, xga, xgi90,
            prev: e.rendimiento_auto !== null ? Number(e.rendimiento_auto) : null,
            newScore: xgiToScore(xgi90),
          })
        }
      }
    }

    await sleep(800)
  }

  // Filtrar defensas/porteros con xGI muy bajo y sin historial relevante
  const updates = []
  const skipped = []
  for (const u of bestByEntry.values()) {
    const pos = (u.position ?? '').toUpperCase()
    const isDefensive = pos.startsWith('D') || pos === 'GK'
    if (isDefensive && u.xgi90 < 0.08 && (u.prev === null || u.prev < MIN_PREV_REND)) {
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
