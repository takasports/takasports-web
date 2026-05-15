#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-football-context.mjs
//
// Actualiza `contexto_auto` de los jugadores de fútbol a partir de
// la posición de su equipo en la tabla de cada liga.
//
// Estrategia por grupo de ligas:
//   Top-5 europeas (hombres) → Understat API (ya parsea equipo)
//   Ligas femeninas          → ESPN standings + ESPN roster
//   LATAM / CONCACAF / MLS   → ESPN standings + ESPN roster
//
// Escala por prestige del campeonato:
//   Top-5 (hombres):   score = 60 + (1 - posRel) * 30  → 60-90
//   Ligas A (rango 2): score = 55 + (1 - posRel) * 25  → 55-80
//   Ligas B (rango 3): score = 50 + (1 - posRel) * 22  → 50-72
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

// Tier 1: top-5 men's — use Understat for player→team (more accurate)
const LEAGUES_UNDERSTAT = [
  { name: 'LaLiga',         ustSlug: 'La_liga',    espnSlug: 'esp.1',  tier: 1 },
  { name: 'Premier League', ustSlug: 'EPL',        espnSlug: 'eng.1',  tier: 1 },
  { name: 'Bundesliga',     ustSlug: 'Bundesliga', espnSlug: 'ger.1',  tier: 1 },
  { name: 'Serie A',        ustSlug: 'Serie_A',    espnSlug: 'ita.1',  tier: 1 },
  { name: 'Ligue 1',        ustSlug: 'Ligue_1',    espnSlug: 'fra.1',  tier: 1 },
]

// Tier 2-3: use ESPN standings + ESPN roster for player→team
const LEAGUES_ESPN = [
  // Women's top
  { name: "Women's Super League", espnSlug: 'eng.w.1',  tier: 2 },
  { name: 'Division 1 Féminine', espnSlug: 'fra.w.1',  tier: 2 },
  { name: 'Liga F',               espnSlug: 'esp.w.1',  tier: 2 },
  { name: 'NWSL',                 espnSlug: 'usa.nwsl', tier: 2 },
  // LATAM / CONCACAF
  { name: 'Liga MX',              espnSlug: 'mex.1',    tier: 2 },
  { name: 'Argentine Primera',    espnSlug: 'arg.1',    tier: 2 },
  { name: 'Série A Brasil',       espnSlug: 'bra.1',    tier: 2 },
  { name: 'Liga BetPlay Colombia',espnSlug: 'col.1',    tier: 3 },
  { name: 'Primera Chile',        espnSlug: 'chi.1',    tier: 3 },
  { name: 'MLS',                  espnSlug: 'usa.1',    tier: 3 },
  // Other European
  { name: 'Eredivisie',           espnSlug: 'ned.1',    tier: 2 },
  { name: 'Liga Portugal',        espnSlug: 'por.1',    tier: 2 },
  { name: 'Primera Federación',   espnSlug: 'esp.2',    tier: 3 },
]

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
}

function normTeam(s) {
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  return TEAM_ALIASES[n] ?? n
}

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')
}

function contextoScore(rank, total, tier) {
  const posRel = (rank - 1) / Math.max(total - 1, 1)
  if (tier === 1) return Math.round((60 + (1 - posRel) * 30) * 10) / 10
  if (tier === 2) return Math.round((55 + (1 - posRel) * 25) * 10) / 10
  return Math.round((50 + (1 - posRel) * 22) * 10) / 10  // tier 3
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

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

async function fetchStandings(espnSlug) {
  const r = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${espnSlug}/standings`)
  if (!r.ok) return null
  const d = await r.json()
  const entries = d?.children?.[0]?.standings?.entries ?? d?.standings?.entries ?? []
  if (!entries.length) return null
  const total = entries.length
  const map = new Map()
  for (const e of entries) {
    const name = normTeam(e.team?.displayName ?? '')
    const teamId = e.team?.id
    const stats = Object.fromEntries((e.stats ?? []).map(s => [s.name, s.value ?? s.displayValue]))
    const rank = Number(stats.rank) || 0
    if (name && rank && teamId) map.set(teamId, { name, rank, total })
  }
  return map
}

async function fetchTeamList(espnSlug) {
  const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnSlug}/teams`)
  if (!r.ok) return []
  const d = await r.json()
  return (d.sports?.[0]?.leagues?.[0]?.teams ?? [])
    .map(t => ({ id: t.team?.id, name: t.team?.displayName }))
    .filter(t => t.id)
}

async function fetchRoster(espnSlug, teamId) {
  const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnSlug}/teams/${teamId}/roster`)
  if (!r.ok) return []
  const d = await r.json()
  const athletes = d.athletes ?? []
  // ESPN soccer rosters can be flat or grouped by position
  if (athletes.length && athletes[0].items) {
    return athletes.flatMap(g => g.items ?? []).map(a => a.displayName ?? a.fullName ?? '')
  }
  return athletes.map(a => a.displayName ?? a.fullName ?? '')
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

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} · Temporada ${SEASON}-${SEASON + 1}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading DB football entries...')
  let allEntries = []
  let page = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, name, category, contexto_auto')
      .eq('sport', 'futbol')
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) throw error
    allEntries = allEntries.concat(data)
    if (data.length < 1000) break
    page++
  }
  console.log(`  ${allEntries.length} entradas`)

  const byNorm = new Map()
  for (const e of allEntries) {
    for (const v of nameVariants(e.name)) {
      if (!byNorm.has(v)) byNorm.set(v, [])
      byNorm.get(v).push(e)
    }
  }

  const bestByEntry = new Map()

  // ── Top-5 men via Understat ────────────────────────────────────
  console.log('\n[1/2] Understat (top-5 hombres)...')
  for (const league of LEAGUES_UNDERSTAT) {
    let standings, players
    try {
      const [s, p] = await Promise.all([
        fetchStandings(league.espnSlug),
        fetchUnderstatPlayers(league.ustSlug),
      ])
      standings = s
      players = p
      if (!standings || !players.length) { console.error(`  SKIP ${league.name}`); continue }
      console.log(`  ${league.name}: ${standings.size} equipos, ${players.length} jugadores`)
    } catch (err) {
      console.error(`  ERROR ${league.name}: ${err.message}`)
      await sleep(1200)
      continue
    }

    // Build teamId map from Understat team names → standings
    // standings is keyed by teamId; we need to match by normalized display name
    const teamByNorm = new Map()
    for (const [tid, s] of standings) teamByNorm.set(s.name, { ...s, teamId: tid })

    for (const p of players) {
      const teamNorm = normTeam(p.team_title ?? '')
      const standing = teamByNorm.get(teamNorm)
      if (!standing) continue
      const newScore = contextoScore(standing.rank, standing.total, league.tier)

      for (const variant of nameVariants(p.player_name)) {
        const matched = byNorm.get(variant) ?? []
        for (const e of matched) {
          if (bestByEntry.has(e.id)) continue
          bestByEntry.set(e.id, {
            entryId: e.id, category: e.category, name: e.name,
            league: league.name, team: p.team_title,
            rank: standing.rank, total: standing.total, tier: league.tier,
            newScore,
            prev: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
          })
        }
      }
    }
    await sleep(1200)
  }
  console.log(`  → ${bestByEntry.size} matches tras top-5`)

  // ── Additional leagues via ESPN roster ─────────────────────────
  console.log('\n[2/2] ESPN rosters (mujeres, LATAM, otros)...')
  for (const league of LEAGUES_ESPN) {
    let standings, teams
    try {
      standings = await fetchStandings(league.espnSlug)
      if (!standings || standings.size === 0) {
        if (VERBOSE) console.log(`  SKIP ${league.name} (no standings)`)
        await sleep(400)
        continue
      }
      teams = await fetchTeamList(league.espnSlug)
      console.log(`  ${league.name}: ${standings.size} equipos`)
    } catch (err) {
      console.error(`  ERROR ${league.name}: ${err.message}`)
      continue
    }

    for (const team of teams) {
      const standing = standings.get(team.id)
      if (!standing) continue
      const newScore = contextoScore(standing.rank, standing.total, league.tier)

      let roster
      try { roster = await fetchRoster(league.espnSlug, team.id) } catch { roster = [] }
      await sleep(120)

      for (const playerName of roster) {
        if (!playerName) continue
        for (const variant of nameVariants(playerName)) {
          const matched = byNorm.get(variant) ?? []
          for (const e of matched) {
            if (bestByEntry.has(e.id)) continue
            bestByEntry.set(e.id, {
              entryId: e.id, category: e.category, name: e.name,
              league: league.name, team: team.name,
              rank: standing.rank, total: standing.total, tier: league.tier,
              newScore,
              prev: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
            })
          }
        }
      }
    }
  }

  const updates = [...bestByEntry.values()].sort((a, b) => b.newScore - a.newScore)

  console.log(`\n--- Top 25 contexto ---`)
  updates.slice(0, 25).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    console.log(`  t${u.tier} ${String(u.rank).padStart(2)}/${u.total}  ${(u.league).padEnd(20)}  ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})  ${u.name}`)
  })

  console.log(`\nMatched: ${updates.length} / ${allEntries.length}`)

  if (VERBOSE) {
    const matched = new Set(updates.map(u => u.entryId))
    const cats = {}
    for (const e of allEntries) {
      if (matched.has(e.id)) continue
      cats[e.category] = (cats[e.category] ?? 0) + 1
    }
    console.log('Sin match por categoría:', JSON.stringify(cats))
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ contexto_auto: u.newScore })
      .eq('id', u.entryId).eq('category', u.category)
    if (err) { fail++; if (VERBOSE) console.error(`FAIL ${u.entryId}: ${err.message}`) } else ok++
  }
  console.log(`Done. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
