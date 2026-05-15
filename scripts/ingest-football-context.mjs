#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-football-context.mjs
//
// Actualiza `contexto_auto` de los jugadores de fútbol a partir de
// la posición de su equipo en la tabla de cada liga.
//
// Factor contexto (20% del Índice Taka):
//   - Equipo 1º →  90  (líderes absolutos)
//   - Equipo 10º → 75  (mitad de tabla)
//   - Equipo 20º → 60  (último — pero sigue en liga top-5)
//   Fórmula: 60 + (1 - (rank-1)/(total-1)) * 30
//
// Fuentes:
//   Standings: ESPN Soccer API (esp.1 / eng.1 / ger.1 / ita.1 / fra.1)
//   Equipo por jugador: Understat getPlayersStats (mismo endpoint que rendimiento)
//
// Uso:
//   node scripts/ingest-football-context.mjs           # DRY RUN
//   node scripts/ingest-football-context.mjs --apply
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

const SEASON = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1

const LEAGUES = [
  { name: 'LaLiga',         ustSlug: 'La_liga',    espnSlug: 'esp.1' },
  { name: 'Premier League', ustSlug: 'EPL',        espnSlug: 'eng.1' },
  { name: 'Bundesliga',     ustSlug: 'Bundesliga', espnSlug: 'ger.1' },
  { name: 'Serie A',        ustSlug: 'Serie_A',    espnSlug: 'ita.1' },
  { name: 'Ligue 1',        ustSlug: 'Ligue_1',    espnSlug: 'fra.1' },
]

// Normalizaciones de nombres de equipo Understat → ESPN
const TEAM_ALIASES = {
  'internazionale': 'inter milan',
  'atletico madrid': 'atletico de madrid',
  'athletic club': 'athletic bilbao',
  'bayer leverkusen': 'bayer 04 leverkusen',
  'rb leipzig': 'rasenballsport leipzig',
  'eintracht frankfurt': 'eintr frankfurt',
  'brighton': 'brighton & hove albion',
  'wolves': 'wolverhampton wanderers',
  'nottingham forest': "nott'm forest",
  'stade de reims': 'reims',
  'le havre ac': 'le havre',
  'ajax': 'ajax amsterdam',
}

function normTeam(s) {
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  return TEAM_ALIASES[n] ?? n
}

function contextoScore(rank, total) {
  return Math.round((60 + (1 - (rank - 1) / Math.max(total - 1, 1)) * 30) * 10) / 10
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchStandings(espnSlug) {
  const r = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${espnSlug}/standings`)
  if (!r.ok) throw new Error(`ESPN standings ${espnSlug} HTTP ${r.status}`)
  const d = await r.json()
  const entries = d?.children?.[0]?.standings?.entries ?? []
  const total = entries.length
  const map = new Map()
  for (const e of entries) {
    const name = normTeam(e.team?.displayName ?? '')
    const stats = Object.fromEntries((e.stats ?? []).map(s => [s.name, s.value ?? s.displayValue]))
    const rank = Number(stats.rank) || 0
    if (name && rank) map.set(name, { rank, total, score: contextoScore(rank, total) })
  }
  return map
}

async function fetchUnderstatPlayers(slug) {
  const r = await fetch('https://understat.com/main/getPlayersStats/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': `https://understat.com/league/${slug}/${SEASON}`,
    },
    body: `league=${slug}&season=${SEASON}`,
  })
  if (!r.ok) throw new Error(`Understat ${slug} HTTP ${r.status}`)
  const json = await r.json()
  return json.players ?? []
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

const NAME_ALIASES = {
  'kylianbappelottin': 'kylianmbappe',
  'viniciusjunior': 'vinicius',
  'rodrygogoesdenascimento': 'rodrygo',
  'rodrygosilvadenascimento': 'rodrygo',
  'ferrantoressans': 'ferrantorres',
}

function nameVariants(rawName) {
  const full = normalize(rawName)
  const tokens = rawName.split(/[\s-]+/).filter(Boolean)
  const two   = tokens.length >= 2 ? normalize(tokens[0] + tokens[1]) : full
  const alias = NAME_ALIASES[full]
  return [...new Set([full, two, ...(alias ? [alias] : [])])]
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} · Temporada ${SEASON}-${SEASON + 1}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading DB football entries...')
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, contexto_auto')
    .eq('sport', 'futbol')
  if (error) throw error
  console.log(`  ${entries.length} entradas`)

  const byNorm = new Map()
  for (const e of entries) {
    const key = normalize(e.name)
    if (!byNorm.has(key)) byNorm.set(key, [])
    byNorm.get(key).push(e)
  }

  const bestByEntry = new Map()

  console.log('\nFetching standings + Understat...')
  for (const league of LEAGUES) {
    let standings, players
    try {
      [standings, players] = await Promise.all([
        fetchStandings(league.espnSlug),
        fetchUnderstatPlayers(league.ustSlug),
      ])
      console.log(`  ${league.name}: ${standings.size} equipos, ${players.length} jugadores`)
    } catch (err) {
      console.error(`  ERROR ${league.name}: ${err.message}`)
      await sleep(1200)
      continue
    }

    for (const p of players) {
      const teamNorm = normTeam(p.team_title ?? '')
      const standing = standings.get(teamNorm)
      if (!standing) continue

      for (const variant of nameVariants(p.player_name)) {
        const matched = byNorm.get(variant) ?? []
        for (const e of matched) {
          if (bestByEntry.has(e.id)) continue
          bestByEntry.set(e.id, {
            entryId: e.id, category: e.category, name: e.name,
            ustName: p.player_name, team: p.team_title,
            rank: standing.rank, total: standing.total,
            newScore: standing.score,
            prev: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
          })
        }
      }
    }
    await sleep(1200)
  }

  const updates = [...bestByEntry.values()].sort((a, b) => b.newScore - a.newScore)

  console.log(`\n--- Top 20 contexto ---`)
  updates.slice(0, 20).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    console.log(`  ${String(u.rank).padStart(2)}/${u.total}  ${u.team.padEnd(26)}  ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})  ${u.name}`)
  })

  console.log(`\nMatched: ${updates.length} / ${entries.length}`)

  if (VERBOSE) {
    const matched = new Set(updates.map(u => u.entryId))
    const unm = entries.filter(e => !matched.has(e.id))
    if (unm.length) console.log('No matcheados (30):', unm.slice(0, 30).map(e => e.name).join(', '))
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ contexto_auto: u.newScore })
      .eq('id', u.entryId).eq('category', u.category)
    if (err) { fail++; console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
