#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// apply-league-context-cap.mjs
//
// Techo del factor Contexto según el NIVEL DE LA LIGA del equipo del jugador.
//
// ── POR QUÉ ──────────────────────────────────────────────────────
// `ingest-football-context.mjs` calcula el contexto por posición en la tabla,
// pero solo llega a los jugadores que consigue casar con una plantilla de ESPN.
// Al resto les queda el valor que dejó el ingest masivo, sin escalar por nivel
// de competición. Resultado medido (2026-07-28): la Cantera estaba llena de
// juveniles de Macará, Melgar o Independiente del Valle con **contexto 91-95**
// —nivel Premier— cuando esas ligas valen 60-74 en el modelo de clubes. Dylan
// Borso y Emerson Pata salían por delante de casi todos los cracks reales.
//
// Es el mismo problema que ya se corrigió en los jugadores latinos y en los
// clubes: sin nivel de competición, ganar en una liga modesta puntúa igual que
// ganar en la Premier.
//
// ── POR QUÉ UN TECHO Y NO UN CÁLCULO ─────────────────────────────
// Un techo solo puede BAJAR. Si el script de contexto ya hizo bien su trabajo
// (jugador de LaLiga con 88 por ir segundo), el techo de LaLiga es 92 y no le
// toca. Si nadie lo calculó y arrastra un 95 de Ecuador, lo corrige. No inventa
// dato donde no lo hay: a quien no se le localiza el equipo, no se le toca.
//
// El nivel de cada liga es el MISMO que en ingest-club-performance.mjs.
//
// Uso:
//   node scripts/apply-league-context-cap.mjs           # DRY RUN
//   node scripts/apply-league-context-cap.mjs --apply
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

// Nivel por competición = techo del contexto de sus jugadores.
const COMPETICIONES = [
  { slug: 'esp.1',    nombre: 'LaLiga',            techo: 92 },
  { slug: 'eng.1',    nombre: 'Premier League',    techo: 92 },
  { slug: 'ger.1',    nombre: 'Bundesliga',        techo: 92 },
  { slug: 'ita.1',    nombre: 'Serie A',           techo: 92 },
  { slug: 'fra.1',    nombre: 'Ligue 1',           techo: 90 },
  { slug: 'ned.1',    nombre: 'Eredivisie',        techo: 78 },
  { slug: 'por.1',    nombre: 'Liga Portugal',     techo: 78 },
  { slug: 'bra.1',    nombre: 'Brasileirão',       techo: 78 },
  { slug: 'arg.1',    nombre: 'Liga Profesional',  techo: 76 },
  { slug: 'mex.1',    nombre: 'Liga MX',           techo: 74 },
  { slug: 'usa.1',    nombre: 'MLS',               techo: 68 },
  { slug: 'col.1',    nombre: 'Primera A Colombia',techo: 64 },
  { slug: 'chi.1',    nombre: 'Primera Chile',     techo: 62 },
  // Ligas que no cubría ningún script y de donde salían los contextos inflados
  { slug: 'ecu.1',    nombre: 'Liga Pro Ecuador',  techo: 62 },
  { slug: 'per.1',    nombre: 'Liga 1 Perú',       techo: 60 },
  { slug: 'uru.1',    nombre: 'Primera Uruguay',   techo: 64 },
  { slug: 'par.1',    nombre: 'Primera Paraguay',  techo: 60 },
  { slug: 'bol.1',    nombre: 'Primera Bolivia',   techo: 58 },
  { slug: 'ven.1',    nombre: 'Liga FUTVE',        techo: 58 },
  // Femenino, por su propia jerarquía
  { slug: 'eng.w.1',  nombre: 'WSL',               techo: 92 },
  { slug: 'esp.w.1',  nombre: 'Liga F',            techo: 92 },
  { slug: 'usa.nwsl', nombre: 'NWSL',              techo: 88 },
  { slug: 'fra.w.1',  nombre: 'D1 Féminine',       techo: 86 },
  { slug: 'ger.w.1',  nombre: 'Frauen-Bundesliga', techo: 86 },
]

const norm = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\b(fc|cf|ac|sc|cd|ud|rc|club|afc|sd|de|del)\b/g, '')
  .replace(/[^a-z0-9]/g, '')

const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null)
  if (!r?.ok) return null
  return r.json().catch(() => null)
}

async function equiposDe(slug) {
  const base = `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`
  for (const url of [base, `${base}?season=${new Date().getFullYear() - 1}`]) {
    const d = await getJson(url)
    const entries = [
      ...(d?.children ?? []).flatMap(c => c?.standings?.entries ?? []),
      ...(d?.standings?.entries ?? []),
    ]
    const nombres = entries.map(e => e.team?.displayName).filter(Boolean)
    if (nombres.length) return nombres
  }
  return []
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Equipo → techo. Si un equipo aparece en dos competiciones gana el techo más
  // alto: es la mejor en la que compite.
  const techoDe = new Map()
  for (const c of COMPETICIONES) {
    const nombres = await equiposDe(c.slug)
    for (const n of nombres) {
      const k = norm(n)
      if (!k) continue
      if (!techoDe.has(k) || c.techo > techoDe.get(k).techo) techoDe.set(k, { techo: c.techo, comp: c.nombre })
    }
    console.log(`  ${c.nombre.padEnd(22)} ${String(nombres.length).padStart(3)} equipos`)
  }
  console.log(`\n  ${techoDe.size} equipos con nivel conocido`)

  let entries = [], page = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, name, category, subtitle, contexto_auto')
      .eq('active', true).eq('sport', 'futbol')
      .in('category', ['jugadores', 'jugadoras', 'sub21', 'latam', 'concacaf'])
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) throw error
    entries = entries.concat(data)
    if (data.length < 1000) break
    page++
  }

  const bajadas = [], sinEquipo = []
  for (const e of entries) {
    // El equipo va al principio del subtítulo: «Macará · Delantero».
    const equipo = (e.subtitle ?? '').split('·')[0]?.trim()
    const hit = equipo ? techoDe.get(norm(equipo)) : null
    if (!hit) { sinEquipo.push(e); continue }
    const ctx = e.contexto_auto === null ? null : Number(e.contexto_auto)
    if (ctx === null || ctx <= hit.techo) continue
    bajadas.push({ ...e, equipo, techo: hit.techo, comp: hit.comp, antes: ctx })
  }

  bajadas.sort((a, b) => (b.antes - b.techo) - (a.antes - a.techo))
  console.log(`\n  ${bajadas.length} jugadores por encima del techo de su liga · ${sinEquipo.length} sin equipo localizable (no se tocan)\n`)
  for (const b of (VERBOSE ? bajadas : bajadas.slice(0, 25))) {
    console.log(`  ${b.name.padEnd(26).slice(0, 26)} ${b.equipo.padEnd(24).slice(0, 24)} ${b.comp.padEnd(20)} ctx ${String(b.antes).padStart(5)} → ${b.techo}`)
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  // Agrupado por (categoría, techo): pocas escrituras en vez de una por jugador.
  const buckets = new Map()
  for (const b of bajadas) {
    const k = `${b.category}|${b.techo}`
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(b.id)
  }
  let ok = 0, fail = 0
  for (const [k, ids] of buckets) {
    const cut = k.lastIndexOf('|')
    const [category, techo] = [k.slice(0, cut), Number(k.slice(cut + 1))]
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500)
      const { error: err } = await sb.from('ranking_entries')
        .update({ contexto_auto: techo })
        .in('id', batch).eq('category', category)   // la PK es (id, category)
      if (err) { fail += batch.length; console.error(`FAIL ${category}: ${err.message}`) } else ok += batch.length
    }
  }
  console.log(`\nDone. OK=${ok} FAIL=${fail} (${buckets.size} escrituras agrupadas)`)
}

main().catch(err => { console.error(err); process.exit(1) })
