#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// seed-club-roster.mjs
//
// Da de alta los equipos que faltan de las competiciones principales.
//
// ── POR QUÉ ──────────────────────────────────────────────────────
// Auditado 2026-07-28: la pestaña Equipos tenía 16 clubes de las cinco grandes
// ligas europeas (LaLiga 3, Ligue 1 solo el PSG) frente a ~40 de LatAm y MLS.
// El ranking se veía incompleto por arriba: faltaba medio fútbol europeo.
//
// El alta NO siembra nada a mano: el rendimiento sale de la clasificación real
// y el contexto del nivel de la competición, exactamente igual que en
// ingest-club-performance.mjs, que es de donde se importan ambas cosas.
//
// Se añade el TOP-N de cada competición, no la tabla entera: el colista de una
// liga no aporta a un ranking, y el objetivo es cubrir el hueco de arriba sin
// inflar la lista.
//
// Uso:
//   node scripts/seed-club-roster.mjs           # DRY RUN
//   node scripts/seed-club-roster.mjs --apply
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
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

// Competiciones a cubrir: cuántos equipos de cada una y con qué nivel.
// El nivel es el MISMO que en ingest-club-performance.mjs — si se cambia allí,
// cambiarlo aquí.
const COMPETICIONES = [
  { slug: 'esp.1',   nombre: 'LaLiga',         pais: 'España',     liga: 'laliga',     nivel: 92, top: 12 },
  { slug: 'eng.1',   nombre: 'Premier League', pais: 'Inglaterra', liga: 'premier',    nivel: 92, top: 12 },
  { slug: 'ger.1',   nombre: 'Bundesliga',     pais: 'Alemania',   liga: 'bundesliga', nivel: 92, top: 10 },
  { slug: 'ita.1',   nombre: 'Serie A',        pais: 'Italia',     liga: 'seriea',     nivel: 92, top: 10 },
  { slug: 'fra.1',   nombre: 'Ligue 1',        pais: 'Francia',    liga: 'ligue1',     nivel: 90, top: 8  },
  { slug: 'eng.w.1', nombre: 'WSL',            pais: 'Inglaterra', liga: 'wsl',        nivel: 92, top: 8, fem: true },
  { slug: 'esp.w.1', nombre: 'Liga F',         pais: 'España',     liga: 'ligaf',      nivel: 92, top: 8, fem: true },
]

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v * 10) / 10))

// Misma normalización que curate-active-entries.mjs: el género ya va aparte, así
// que el sufijo femenino se quita para no crear un duplicado del mismo club.
const norm = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\b(femenino|femenina|feminin[eo]|women|womens|fem)\b/g, '')
  .replace(/\b(fc|cf|ac|sc|cd|ud|rc|club|afc|sd)\b/g, '')
  .replace(/[^a-z0-9]/g, '')

const slugify = (s) => (s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null)
  if (!r?.ok) return null
  return r.json().catch(() => null)
}

function rendimiento({ points, gamesPlayed, goalDiff }) {
  if (!gamesPlayed) return null
  return clamp(38 + (points / gamesPlayed) * 22 + ((goalDiff ?? 0) / gamesPlayed) * 3, 40, 96)
}

async function tabla(slug) {
  const base = `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`
  for (const url of [base, `${base}?season=${new Date().getFullYear() - 1}`]) {
    const d = await getJson(url)
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
        espnId: e.team?.id ?? null,
        rank: st.rank ?? 99,
        rend: rendimiento({ points: st.points ?? 0, gamesPlayed: st.gamesPlayed, goalDiff: st.pointDifferential ?? st.goalDifference ?? 0 }),
      })
    }
    if (out.length) return out.sort((a, b) => a.rank - b.rank)
  }
  return []
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Se mira TODO el histórico, no solo lo activo: si un club existe desactivado
  // hay que reactivarlo, no crear un gemelo.
  const { data: existentes, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, active, suppressed')
    .in('category', ['clubes', 'clubes_femenino'])
  if (error) throw error

  const porClave = new Map()
  for (const e of existentes) porClave.set(`${norm(e.name)}|${e.category}`, e)

  const nuevos = [], reactivar = [], yaEstan = []
  for (const c of COMPETICIONES) {
    const filas = (await tabla(c.slug)).slice(0, c.top)
    const cat = c.fem ? 'clubes_femenino' : 'clubes'
    for (const f of filas) {
      if (f.rend == null) continue
      const prev = porClave.get(`${norm(f.nombre)}|${cat}`)
      if (prev?.suppressed) continue                    // retirado a mano: se respeta
      if (prev?.active) { yaEstan.push(f.nombre); continue }
      if (prev) { reactivar.push({ ...prev, ...c, ...f }); continue }
      nuevos.push({
        id: `${slugify(f.nombre)}${c.fem ? '-fem' : ''}`,
        category: cat,
        name: c.fem && !/femenino|women/i.test(f.nombre) ? `${f.nombre} Femenino` : f.nombre,
        sport: 'futbol',
        gender: c.fem ? 'f' : null,
        league: c.liga,
        subtitle: `${c.nombre} · ${c.pais}`,
        position: 'club',
        rendimiento_auto: f.rend,
        contexto_auto: c.nivel,
        narrativa_auto: 75,                             // Forma neutra hasta tener histórico
        comp: c.nombre,
      })
    }
    console.log(`  ${c.nombre.padEnd(16)} top ${String(c.top).padStart(2)} → ${filas.length} leídos`)
  }

  console.log(`\n  Ya estaban: ${yaEstan.length} · A reactivar: ${reactivar.length} · Altas nuevas: ${nuevos.length}`)
  if (reactivar.length) console.log(`  Reactivar: ${reactivar.map(r => r.name).join(', ')}`)
  console.log('')
  for (const n of nuevos) {
    console.log(`  + ${n.name.padEnd(28).slice(0, 28)} ${n.comp.padEnd(16)} rend ${String(n.rendimiento_auto).padStart(5)} · ctx ${n.contexto_auto}`)
  }

  if (!APPLY) { console.log('\nDRY RUN.'); return }

  let ok = 0, fail = 0
  for (const n of nuevos) {
    const { comp, ...fila } = n
    const { error: err } = await sb.from('ranking_entries').insert({ ...fila, active: true })
    if (err) { fail++; console.error(`FAIL ${n.id}: ${err.message}`) } else ok++
  }
  for (const r of reactivar) {
    const { error: err } = await sb.from('ranking_entries')
      .update({ active: true, rendimiento_auto: r.rend, contexto_auto: r.nivel })
      .eq('id', r.id).eq('category', r.category)        // la PK es (id, category)
    if (err) fail++; else ok++
  }
  console.log(`\nDone. altas+reactivaciones=${ok} FAIL=${fail}`)
}

main().catch(err => { console.error(err); process.exit(1) })
