#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-nba-context.mjs
//
// Actualiza `contexto_auto` de los jugadores NBA con la posición
// de su equipo en la conferencia (playoff seed).
//
// Escala:
//   Seeds 1-2:  88  (top de conferencia)
//   Seeds 3-4:  84
//   Seeds 5-6:  80  (playoffs directos)
//   Seeds 7-10: 74  (play-in)
//   Seeds 11-15: 62  (lotería)
//
// Fuentes:
//   Standings: ESPN site API (nba/standings)
//   Player→Team: ESPN Core API athletes/{id} (30 llamadas de roster)
//
// Uso:
//   node scripts/ingest-nba-context.mjs           # DRY RUN
//   node scripts/ingest-nba-context.mjs --apply
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

function seedToScore(seed) {
  if (seed <= 2)  return 88
  if (seed <= 4)  return 84
  if (seed <= 6)  return 80
  if (seed <= 10) return 74
  return 62
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchStandingsRaw(season) {
  const url = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings' + (season ? `?season=${season}` : '')
  const r = await fetch(url)
  if (!r.ok) throw new Error(`ESPN standings HTTP ${r.status}`)
  return r.json()
}

/** Clasificación por equipo: teamId → { seed, teamName, score }.
 *
 *  En PRETEMPORADA la temporada nueva viene con todos los equipos a 0-0 y ESPN
 *  les pone a todos el puesto 1: el 01/10/2026 los 30 equipos salían con
 *  contexto 88, el de los dos primeros de conferencia. Mientras nadie haya
 *  jugado, manda la clasificación FINAL de la temporada anterior. */
async function fetchNBAStandings() {
  const leer = (d) => {
    const map = new Map()
    let jugados = 0
    for (const conf of d.children ?? []) {
      for (const e of conf.standings?.entries ?? []) {
        const teamId = e.team?.id
        const stats = Object.fromEntries((e.stats ?? []).map(s => [s.name, s.value ?? s.displayValue]))
        jugados += (Number(stats.wins) || 0) + (Number(stats.losses) || 0)
        const seed = Number(stats.playoffSeed ?? stats.rank) || 15
        if (teamId) map.set(teamId, { seed, teamName: e.team?.displayName, score: seedToScore(seed) })
      }
    }
    return { map, jugados }
  }
  const actual = await fetchStandingsRaw()
  const { map, jugados } = leer(actual)
  if (jugados > 0) return map
  const anterior = (Number(actual.season?.year) || new Date().getFullYear()) - 1
  console.log(`  Pretemporada (0 partidos jugados): uso la clasificación final de ${anterior - 1}-${String(anterior).slice(2)}`)
  return leer(await fetchStandingsRaw(anterior)).map
}

/** Nombre comparable: sin acentos, mayúsculas ni signos («Dončić» = «Doncic»). */
function claveNombre(n) {
  return (n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function fetchTeamRoster(teamId) {
  const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`)
  if (!r.ok) return []
  const d = await r.json()
  return (d.athletes ?? []).map(a => ({
    athleteId: String(a.id),
    name: a.fullName ?? a.displayName ?? '',
  }))
}

async function fetchNBATeams() {
  const r = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams')
  if (!r.ok) throw new Error(`ESPN teams HTTP ${r.status}`)
  const d = await r.json()
  return (d.sports?.[0]?.leagues?.[0]?.teams ?? []).map(t => ({
    id: t.team?.id,
    name: t.team?.displayName,
  })).filter(t => t.id)
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  console.log('\nLoading DB NBA entries...')
  const { data: entries, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, contexto_auto')
    .eq('sport', 'baloncesto')
    .eq('category', 'jugadores')
  if (error) throw error
  console.log(`  ${entries.length} entradas NBA`)

  // Índice por ESPN athlete ID. Las fichas CURADAS (`jokic`, `sga`, `lebron`…)
  // no llevan el id de ESPN en su id, y son justo las que se enseñan en el
  // ranking: hasta el 02/10/2026 se quedaban con contexto 0 y perdían ~18
  // puntos de nota (Jokić 63,9 con 83,9 en su gemela de ESPN). Se emparejan
  // por NOMBRE con la plantilla, solo si el nombre es único en la liga.
  const byAthleteId = new Map()
  const sinId = []
  for (const e of entries) {
    const m = /^espn-nba-(\d+)$/.exec(e.id)
    if (m) byAthleteId.set(m[1], [e])
    else sinId.push(e)
  }
  console.log(`  ${byAthleteId.size} con ID ESPN reconocido, ${sinId.length} curadas`)

  console.log('\nFetching standings...')
  const standings = await fetchNBAStandings()
  console.log(`  ${standings.size} equipos`)

  console.log('Fetching team rosters (30 teams)...')
  const teams = await fetchNBATeams()
  // athleteId → { teamId, teamName, seed, score }
  const athleteTeam = new Map()
  const idPorNombre = new Map()   // claveNombre → athleteId (null si se repite)
  for (const team of teams) {
    const standing = standings.get(team.id)
    if (!standing) continue
    const roster = await fetchTeamRoster(team.id)
    for (const player of roster) {
      athleteTeam.set(player.athleteId, {
        teamName: standing.teamName,
        seed: standing.seed,
        score: standing.score,
      })
      const k = claveNombre(player.name)
      if (k) idPorNombre.set(k, idPorNombre.has(k) ? null : player.athleteId)
    }
    await sleep(200)
  }
  console.log(`  ${athleteTeam.size} jugadores mapeados a equipo`)

  let porNombre = 0
  for (const e of sinId) {
    const athleteId = idPorNombre.get(claveNombre(e.name))
    if (!athleteId) continue
    const lista = byAthleteId.get(athleteId) ?? []
    lista.push(e)
    byAthleteId.set(athleteId, lista)
    porNombre++
  }
  console.log(`  ${porNombre} curadas emparejadas por nombre`)

  const updates = []
  for (const [athleteId, lista] of byAthleteId) {
    const team = athleteTeam.get(athleteId)
    if (!team) continue
    for (const e of lista) {
      updates.push({
        entryId: e.id, category: e.category, name: e.name,
        teamName: team.teamName, seed: team.seed, newScore: team.score,
        prev: e.contexto_auto !== null ? Number(e.contexto_auto) : null,
      })
    }
  }

  updates.sort((a, b) => b.newScore - a.newScore)

  console.log(`\n--- NBA contexto ---`)
  updates.slice(0, 20).forEach(u => {
    const prev = u.prev !== null ? u.prev.toFixed(1).padStart(5) : '    -'
    const delta = u.prev !== null ? u.newScore - u.prev : null
    const dlt = delta !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}` : 'NEW'
    console.log(`  seed=${String(u.seed).padStart(2)}  ${u.teamName.padEnd(30)} ${prev} → ${u.newScore.toFixed(1).padStart(5)} (${dlt})  ${u.name}`)
  })

  console.log(`\nMatched: ${updates.length} / ${entries.length}`)

  // --dump=<fichero>: vuelca los cambios previstos (para simular el efecto en
  // la nota sin escribir nada).
  const dump = process.argv.find(a => a.startsWith('--dump='))
  if (dump) {
    const { writeFileSync } = await import('fs')
    writeFileSync(dump.slice(7), JSON.stringify(updates.map(u => ({ id: u.entryId, category: u.category, contexto: u.newScore }))))
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
