#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// ingest-club-performance.mjs
//
// Rendimiento y contexto OBJETIVOS para el track Equipos.
//
// ── POR QUÉ ──────────────────────────────────────────────────────
// Auditado 2026-07-28: los clubes eran el último track con los factores
// puestos a mano. Ningún script del pipeline los calculaba —
// `ingest-wikipedia-views.mjs` los excluye explícitamente— así que vivían del
// catálogo de taka-system con valores literales (`rB:92, mB:95` para el Real
// Madrid). Exactamente el estado del que salieron los deportistas.
//
// ── EL MODELO ────────────────────────────────────────────────────
// Para un club, rendimiento y contexto tienen que medir cosas distintas:
//
//   RENDIMIENTO = lo que está haciendo esta temporada.
//     · Fútbol: puntos por partido + diferencia de goles por partido.
//     · NBA: porcentaje de victorias.
//     · F1: puntos del Mundial de Constructores sobre el líder.
//
//   CONTEXTO = el nivel de la competición en la que lo hace.
//     Liderar la Premier no es liderar la Primera de Chile. Sin esto, un
//     campeón de liga débil empata con el Bayern — que es justo lo que
//     pasaba (Colo Colo y América de Cali por encima de 80).
//
// Cada club se mide dentro de SU universo: las ligas femeninas se valoran por
// su propia jerarquía, no como una división inferior del fútbol masculino.
//
// ⚠️ La tabla de niveles es un juicio editorial explícito, no un dato. Está
// aquí arriba y a la vista precisamente para poder discutirla.
//
// Uso:
//   node scripts/ingest-club-performance.mjs           # DRY RUN
//   node scripts/ingest-club-performance.mjs --apply
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
const VERBOSE = process.argv.includes('--verbose')
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

// Competiciones: slug de ESPN + nivel (contexto). El nivel es el juicio
// editorial; el rendimiento sale del dato.
const COMPETICIONES = [
  // Fútbol masculino — élite europea
  { slug: 'esp.1',     nombre: 'LaLiga',              nivel: 92 },
  { slug: 'eng.1',     nombre: 'Premier League',      nivel: 92 },
  { slug: 'ger.1',     nombre: 'Bundesliga',          nivel: 92 },
  { slug: 'ita.1',     nombre: 'Serie A',             nivel: 92 },
  { slug: 'fra.1',     nombre: 'Ligue 1',             nivel: 90 },
  // Fútbol masculino — segundo escalón
  { slug: 'ned.1',     nombre: 'Eredivisie',          nivel: 78 },
  { slug: 'por.1',     nombre: 'Liga Portugal',       nivel: 78 },
  { slug: 'bra.1',     nombre: 'Brasileirão',         nivel: 78 },
  { slug: 'arg.1',     nombre: 'Liga Profesional',    nivel: 76 },
  { slug: 'mex.1',     nombre: 'Liga MX',             nivel: 74 },
  // Fútbol masculino — tercer escalón
  { slug: 'usa.1',     nombre: 'MLS',                 nivel: 68 },
  { slug: 'col.1',     nombre: 'Primera A Colombia',  nivel: 64 },
  { slug: 'chi.1',     nombre: 'Primera Chile',       nivel: 62 },
  // Fútbol femenino — se valora por su PROPIA jerarquía, no como categoría
  // inferior del masculino.
  { slug: 'eng.w.1',   nombre: 'WSL',                 nivel: 92, fem: true },
  { slug: 'esp.w.1',   nombre: 'Liga F',              nivel: 92, fem: true },
  { slug: 'usa.nwsl',  nombre: 'NWSL',                nivel: 88, fem: true },
  { slug: 'fra.w.1',   nombre: 'D1 Féminine',         nivel: 86, fem: true },
  { slug: 'ger.w.1',   nombre: 'Frauen-Bundesliga',   nivel: 86, fem: true },
]
const NIVEL_NBA = 92
const NIVEL_F1  = 92

// La BD y ESPN no escriben igual todos los nombres.
const ALIAS = {
  'okcthunder': 'oklahomacitythunder',
  'lalakers': 'losangeleslakers',
  'psg': 'parissaintgermain',
  'interdemilan': 'intermilan',
  'redbullracing': 'redbull',
  'olympiquelyon': 'olympiquelyonnais',
  'ollyonnes': 'olympiquelyonnais',
  'lafc': 'losangelesfc',
  'lagalaxy': 'losangelesgalaxy',
  'riverplate': 'river',
}

const norm = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\b(fc|cf|ac|sc|cd|ud|rc|club|afc|sd|women|femenino|femenina)\b/g, '')
  .replace(/[^a-z0-9]/g, '')

const key = (s) => { const k = norm(s); return ALIAS[k] ?? k }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v * 10) / 10))

const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null)
  if (!r?.ok) return null
  return r.json().catch(() => null)
}

// Puntos por partido + diferencia de goles → 40..96.
// Calibrado: 2,5 pts/partido con +1,8 de diferencia → 96 (campeón claro);
// 1,3 y 0 → 67 (media tabla); 0,7 y −1 → 50 (descenso).
function futbolRendimiento({ points, gamesPlayed, goalDiff }) {
  if (!gamesPlayed) return null
  const ppg = points / gamesPlayed
  const gdg = (goalDiff ?? 0) / gamesPlayed
  return clamp(38 + ppg * 22 + gdg * 3, 40, 96)
}

// Igual que en deportistas: la clasificación de la temporada en curso está
// vacía en pretemporada, así que se cae a la del año anterior.
async function standingsFutbol(slug) {
  const base = `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`
  for (const url of [base, `${base}?season=${new Date().getFullYear() - 1}`]) {
    const d = await getJson(url)
    // Las ligas por conferencias (MLS, Liga MX…) reparten los equipos en varios
    // `children`. Leer solo el primero dejaba fuera media liga: de MLS llegaban
    // 15 de 29.
    const entries = [
      ...(d?.children ?? []).flatMap(c => c?.standings?.entries ?? []),
      ...(d?.standings?.entries ?? []),
    ]
    const out = []
    for (const e of entries) {
      const st = Object.fromEntries((e.stats ?? []).map(s => [s.name, Number(s.value ?? s.displayValue)]))
      if (!st.gamesPlayed) continue
      out.push({
        nombre: e.team?.displayName ?? '',
        points: st.points ?? 0, gamesPlayed: st.gamesPlayed,
        goalDiff: st.pointDifferential ?? st.goalDifference ?? 0,
      })
    }
    if (out.length) return out
  }
  return []
}

async function standingsNba() {
  const d = await getJson('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings')
  const out = []
  for (const conf of d?.children ?? []) {
    for (const e of conf?.standings?.entries ?? []) {
      const st = Object.fromEntries((e.stats ?? []).map(s => [s.name, Number(s.value ?? s.displayValue)]))
      const gp = st.gamesPlayed || (st.wins ?? 0) + (st.losses ?? 0)
      if (!gp) continue
      out.push({ nombre: e.team?.displayName ?? '', pct: (st.wins ?? 0) / gp })
    }
  }
  return out
}

async function standingsF1() {
  const d = await getJson('https://api.jolpi.ca/ergast/f1/current/constructorStandings.json')
  const lista = d?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? []
  const max = Math.max(...lista.map(c => parseFloat(c.points) || 0), 1)
  return lista.map(c => ({ nombre: c.Constructor?.name ?? '', share: (parseFloat(c.points) || 0) / max }))
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: clubs, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, sport, league, subtitle, rendimiento_auto, contexto_auto')
    .eq('active', true)
    .in('category', ['clubes', 'clubes_femenino'])
  if (error) throw error
  console.log(`  ${clubs.length} equipos activos`)

  // Un índice global nombre→(rendimiento, nivel). Si un club aparece en dos
  // competiciones gana la de más nivel: es la que define su contexto real.
  // Índices SEPARADOS por género: `norm` quita «Women/Femenino» del nombre, así
  // que con un solo índice el Arsenal femenino cogía los datos de la Premier
  // masculina. Cada equipo se mide en su propia competición.
  const idxM = new Map(), idxF = new Map()
  const anota = (nombre, rend, nivel, comp, fem = false) => {
    if (rend == null) return
    const k = key(nombre)
    if (!k) return
    const idx = fem ? idxF : idxM
    const prev = idx.get(k)
    if (!prev || nivel > prev.nivel) idx.set(k, { rend, nivel, comp })
  }

  console.log('\nDescargando clasificaciones...')
  for (const c of COMPETICIONES) {
    const filas = await standingsFutbol(c.slug)
    for (const f of filas) anota(f.nombre, futbolRendimiento(f), c.nivel, c.nombre, c.fem === true)
    console.log(`  ${c.nombre.padEnd(22)} ${String(filas.length).padStart(3)} equipos`)
  }
  const nba = await standingsNba()
  for (const t of nba) anota(t.nombre, clamp(40 + t.pct * 60, 40, 96), NIVEL_NBA, 'NBA')
  console.log(`  ${'NBA'.padEnd(22)} ${String(nba.length).padStart(3)} equipos`)
  const f1 = await standingsF1()
  for (const t of f1) anota(t.nombre, clamp(45 + t.share * 51, 40, 96), NIVEL_F1, 'F1')
  console.log(`  ${'F1 (constructores)'.padEnd(22)} ${String(f1.length).padStart(3)} equipos`)

  const updates = [], sinDato = []
  for (const club of clubs) {
    const esFem = club.category === 'clubes_femenino'
    const idx = esFem ? idxF : idxM
    const k = key(club.name)
    // Exacto primero; si no, por contención («Alavés» ↔ «Deportivo Alavés»),
    // exigiendo 5+ caracteres para no casar «Inter» con cualquier cosa.
    let hit = idx.get(k)
    if (!hit && k.length >= 5) {
      for (const [ik, v] of idx) {
        if (ik.length >= 5 && (ik.includes(k) || k.includes(ik))) { hit = v; break }
      }
    }
    if (!hit) { sinDato.push(club); continue }
    updates.push({
      ...club, rend: hit.rend, ctx: hit.nivel, comp: hit.comp,
      prevRend: club.rendimiento_auto === null ? null : Number(club.rendimiento_auto),
      prevCtx: club.contexto_auto === null ? null : Number(club.contexto_auto),
    })
  }

  updates.sort((a, b) => (b.rend * 0.45 + b.ctx * 0.2) - (a.rend * 0.45 + a.ctx * 0.2))
  console.log(`\n--- ${updates.length} equipos con dato objetivo ---`)
  for (const u of (VERBOSE ? updates : updates.slice(0, 25))) {
    console.log(
      `  ${u.name.padEnd(26).slice(0, 26)} ${u.comp.padEnd(20)}` +
      ` rend ${String(u.prevRend ?? '–').padStart(5)} → ${String(u.rend).padStart(5)}` +
      ` · ctx ${String(u.prevCtx ?? '–').padStart(5)} → ${String(u.ctx).padStart(5)}`,
    )
  }
  if (sinDato.length) {
    console.log(`\n  Sin clasificación localizada (${sinDato.length}): ${sinDato.map(c => c.name).join(', ')}`)
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const u of updates) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ rendimiento_auto: u.rend, contexto_auto: u.ctx })
      .eq('id', u.id).eq('category', u.category)   // la PK es (id, category)
    if (err) { fail++; console.error(`FAIL ${u.id}: ${err.message}`) } else ok++
  }
  console.log(`\nDone. OK=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
