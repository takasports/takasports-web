#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// fix-score-auto-bulk.mjs
//
// Recalcula `score_auto` cuando se ha quedado desincronizado de sus
// factores. Recuperación, no cálculo: el que calcula es el trigger
// `f_recompute_score_auto` (migración 110), que es la ÚNICA fuente de
// verdad de la fórmula.
//
// ── POR QUÉ NO TIENE FÓRMULA PROPIA ──────────────────────────────
// La tenía, y era una bomba. Implementaba 40/20/25/15 —la v6— cuando
// la vigente es 45/20/15/20 con Forma, y aplicaba esa misma a los
// creadores, que puntúan con otra (50/25/25). Además escribía
// `score_auto` DIRECTAMENTE, saltándose el trigger. En seco el
// 14/08/2026 proponía 11.357 cambios: correr esto con --apply habría
// reescrito casi todo el ranking con la ponderación vieja.
//
// Ahora no calcula nada: toca una columna de factores, lo que hace
// saltar el trigger (`BEFORE UPDATE OF rendimiento_auto, …`), y es el
// trigger quien recalcula. Si la fórmula cambia, este script no se
// entera y sigue siendo correcto — que es justo el punto.
//
// ── CUÁNDO HACE FALTA ────────────────────────────────────────────
// El trigger solo salta si el UPDATE incluye alguna columna de
// factores. Un script que escriba `score_auto` a pelo, o que meta los
// factores antes de que el trigger existiera, deja la fila
// descuadrada y así se queda. El 14/08/2026 había 36 entradas activas
// clavadas en 50,0 —el valor que sale con todos los factores nulos—
// mientras sus factores decían 62-86: Roman Reigns aparecía 430º con
// un 50 cuando le tocaba un 85,8, y con él De Bruyne, Luis Díaz,
// Rory McIlroy o Rhea Ripley.
//
// Uso:
//   node scripts/fix-score-auto-bulk.mjs            # DRY RUN, solo activas
//   node scripts/fix-score-auto-bulk.mjs --apply
//   node scripts/fix-score-auto-bulk.mjs --todas    # incluye inactivas
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY  = process.argv.includes('--apply')
const TODAS  = process.argv.includes('--todas')

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

async function cargar() {
  const filas = []
  for (let page = 0; ; page++) {
    let q = sb.from('ranking_entries')
      .select('id, category, name, score_auto, rendimiento_auto, contexto_auto, mediatico_auto, narrativa_auto')
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (!TODAS) q = q.eq('active', true)
    const { data, error } = await q
    if (error) throw error
    if (!data?.length) break
    filas.push(...data)
    if (data.length < 1000) break
  }
  return filas
}

// Sin factores no hay nada que recalcular: su score ES el neutro por
// definición, así que tocarlas sería ruido.
const tieneFactores = (e) =>
  e.rendimiento_auto !== null || e.contexto_auto !== null ||
  e.mediatico_auto !== null   || e.narrativa_auto !== null

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} · alcance: ${TODAS ? 'todas' : 'solo activas'}`)

  const filas = (await cargar()).filter(tieneFactores)
  // El 50,0 exacto con factores presentes es la firma del descuadre: es lo
  // que devuelve la fórmula cuando TODOS los factores son nulos, así que una
  // fila con factores reales no debería valer eso salvo por casualidad.
  const sospechosas = filas.filter(e => Number(e.score_auto) === 50)

  console.log(`\n${filas.length} entradas con factores · ${sospechosas.length} clavadas en 50,0`)
  if (sospechosas.length) {
    console.log('\nSospechosas (se recalcularán):')
    for (const e of sospechosas.slice(0, 15)) {
      console.log(`  ${e.name?.slice(0, 28).padEnd(28)} ${e.id}/${e.category}` +
        `  rend=${e.rendimiento_auto ?? '–'} ctx=${e.contexto_auto ?? '–'}`)
    }
    if (sospechosas.length > 15) console.log(`  … y ${sospechosas.length - 15} más`)
  }

  if (!sospechosas.length) { console.log('\nNada que recalcular.') ; return }
  if (!APPLY) { console.log(`\nDRY RUN. ${sospechosas.length} filas a recalcular.`); return }

  // Reescribir el factor con su MISMO valor basta: el trigger va por columnas
  // tocadas, no por valores cambiados, así que salta igual y recalcula.
  let ok = 0, fail = 0
  for (const e of sospechosas) {
    const { error } = await sb.from('ranking_entries')
      .update({ rendimiento_auto: e.rendimiento_auto })
      .eq('id', e.id).eq('category', e.category)   // la PK es (id, category)
    if (error) { fail++; console.error(`FAIL ${e.id}: ${error.message}`) } else ok++
  }
  console.log(`\nDone. recalculadas=${ok} FAIL=${fail}`)
  console.log('Recuerda: SELECT refresh_ranking_view() para que llegue a la web.')
}

main().catch(err => { console.error(err); process.exit(1) })
