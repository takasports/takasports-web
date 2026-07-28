#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// weekly-rankings.mjs — ORQUESTADOR del Índice Taka
//
// Fuente de verdad del scoring. Lo dispara launchd
// (com.taka.weekly-rankings-update) domingos y miércoles a las 23:45.
// `~/.taka/weekly-rankings.mjs` es solo un shim que ejecuta este.
//
// ── POR QUÉ ESTÁ AQUÍ Y NO EN ~/.taka ────────────────────────────
// Vivía suelto en el home, sin versionar y sin que ningún repo lo
// mencionara. Resultado: durante semanas se dio por hecho que el
// scoring lo calculaba taka-system, cuando en realidad este pipeline
// corría 1h45 después y SOBRESCRIBÍA los cuatro factores. Documentado
// y versionado, eso no vuelve a pasar.
//
// ── ORDEN ────────────────────────────────────────────────────────
//   1. Rendimiento y contexto por deporte (fuentes públicas, €0)
//   2. Mediático (Wikipedia EN×ES) y Forma (momentum del histórico)
//   3. Techos cross-deporte → nadie gana por escala
//   4. Snapshot histórico (alimenta la Forma de la semana que viene)
//   5. Limpieza: retiradas editoriales + curación de `active`
//
// Reglas: cada paso corre con --apply y NO aborta a los demás si falla.
// Al final avisa por Telegram y deja registro en `ranking_ingest_runs`.
//
// GUARDARRAÍL: si entre el inicio y el final el score medio se mueve
// más de 15 puntos sobre ≥30 entradas, los datos son sospechosos (un
// pull vacío colapsa factores en cadena) → NO se cura `active` y se
// avisa. Mejor un ranking desactualizado que uno vaciado.
//
// Uso:
//   node scripts/weekly-rankings.mjs            # todo el pipeline
//   node scripts/weekly-rankings.mjs --dry-run  # sin --apply en los pasos
// ─────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(__dirname, '..')
config({ path: path.join(PROJECT, '.env.local') })

const NODE = process.execPath
const DRY  = process.argv.includes('--dry-run')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const GUARDRAIL_MAX_DELTA = 15
const GUARDRAIL_MIN_ROWS  = 30

const STEPS = [
  ['Tenis — Elo (rendimiento)',              'ingest-tennis-elo.mjs'],
  ['F1 — DPC (rendimiento)',                 'ingest-f1-dpc.mjs'],
  ['NBA — PER (rendimiento)',                'ingest-nba-per.mjs'],
  ['Fútbol — xG+xA FBref (rendimiento)',     'ingest-football-fbref.mjs'],
  ['Fútbol fem. — xG+xA FBref (rend.)',      'ingest-football-women-rendimiento.mjs'],
  ['Fútbol — posición liga (contexto)',      'ingest-football-context.mjs'],
  ['NBA — seed conferencia (contexto)',      'ingest-nba-context.mjs'],
  ['Tenis — ranking ATP/WTA (contexto)',     'ingest-tennis-context.mjs'],
  ['F1 — posición campeonato (contexto)',    'ingest-f1-context.mjs'],
  ['UFC — rankings división (rend+ctx)',     'ingest-ufc-rankings.mjs'],
  ['Periodistas — social reach (rend+ctx)',  'ingest-creator-social.mjs'],
  ['Creadores — relevancia (engagement YT)', 'ingest-creator-relevance.mjs'],
  ['Wikipedia EN×ES (mediático)',            'ingest-wikipedia-views.mjs'],
  ['Forma (momentum del histórico)',         'ingest-narrativa-decay.mjs'],
  ['Techos cross-deporte (96/95)',           'apply-score-caps.mjs'],
  ['Snapshot histórico',                     'capture-score-snapshot.mjs'],
  ['Retiradas editoriales',                  'fix-duplicates-and-categories.mjs'],
]
// Va aparte: es el dueño de `active` y solo corre si el guardarraíl pasa.
const CURATE_STEP = ['Curación de active entries', 'curate-active-entries.mjs']

const sb = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null

async function loadScores() {
  if (!sb) return new Map()
  const map = new Map()
  let page = 0
  while (true) {
    const { data, error } = await sb
      .from('ranking_entries')
      .select('id, category, score_auto')
      .eq('active', true)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (error) return map
    for (const r of data) if (r.score_auto != null) map.set(`${r.id}|${r.category}`, Number(r.score_auto))
    if (data.length < 1000) break
    page++
  }
  return map
}

function meanDelta(before, after) {
  let sum = 0, n = 0
  for (const [k, v] of after) {
    const prev = before.get(k)
    if (prev == null) continue
    sum += Math.abs(v - prev); n++
  }
  return { mean: n ? sum / n : 0, compared: n }
}

async function logRun(fields) {
  if (!sb) return null
  const { data, error } = await sb.from('ranking_ingest_runs').insert(fields).select('id').single()
  if (error) { console.error(`[log] ${error.message}`); return null }
  return data?.id ?? null
}

async function closeRun(id, fields) {
  if (!sb || !id) return
  await sb.from('ranking_ingest_runs').update(fields).eq('id', id)
}

// Lee credenciales de Telegram de .env.local SIN volcarlas.
async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) { console.error('[telegram] sin credenciales — no se envía'); return }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
    if (!res.ok) console.error(`[telegram] HTTP ${res.status}`)
  } catch (e) {
    console.error(`[telegram] error: ${e?.message || e}`)
  }
}

function runStep([label, script], incidencias) {
  const p = path.join(__dirname, script)
  if (!existsSync(p)) {
    console.error(`⏭  ${label}: NO existe ${script}`)
    incidencias.push(`⏭ ${label} (falta ${script})`)
    return 'skip'
  }
  console.log(`\n▶ ${label}...`)
  try {
    // 25 min por paso: el mediático de Wikipedia tarda ~19 con la caché
    // caliente (cientos de artículos × 2 idiomas, con el rate-limit de
    // Wikimedia). Con el límite anterior de 15 se perdía entero cada semana.
    execFileSync(NODE, DRY ? [p] : [p, '--apply'], { cwd: PROJECT, stdio: 'inherit', timeout: 25 * 60 * 1000 })
    console.log('  → ok')
    return 'ok'
  } catch (e) {
    console.error(`  → fallo: ${e.message || e}`)
    incidencias.push(`❌ ${label}`)
    return 'fail'
  }
}

console.log('================================================')
console.log(`  Índice Taka — recompute semanal${DRY ? ' (DRY RUN)' : ''}`)
console.log(`  Node: ${NODE} (${process.version})`)
console.log('================================================')

const runId = DRY ? null : await logRun({ status: 'running', source: 'weekly-rankings' })
const scoresBefore = await loadScores()
console.log(`\nScores de partida: ${scoresBefore.size} entradas activas`)

let ok = 0, fail = 0, skip = 0
const incidencias = []
for (const step of STEPS) {
  const r = runStep(step, incidencias)
  if (r === 'ok') ok++; else if (r === 'fail') fail++; else skip++
}

// ── Guardarraíl antes de tocar `active` ──────────────────────────
const scoresAfter = await loadScores()
const { mean, compared } = meanDelta(scoresBefore, scoresAfter)
console.log(`\nGuardarraíl: Δ medio ${mean.toFixed(1)} pts sobre ${compared} entradas`)

let curated = false
if (compared >= GUARDRAIL_MIN_ROWS && mean > GUARDRAIL_MAX_DELTA) {
  const msg = `guardarraíl: Δ medio ${mean.toFixed(1)} pts (>${GUARDRAIL_MAX_DELTA}) sobre ${compared} entradas — datos sospechosos, curación abortada`
  console.error(`⛔ ${msg}`)
  incidencias.push(`⛔ Curación ABORTADA — ${msg}`)
  fail++
} else {
  const r = runStep(CURATE_STEP, incidencias)
  if (r === 'ok') { ok++; curated = true } else if (r === 'fail') fail++; else skip++
}

const total = STEPS.length + 1
const summary = `ok=${ok} fail=${fail} skip=${skip} (de ${total} pasos)`
console.log(`\n[weekly-rankings] done ${summary}`)

if (!DRY) {
  await closeRun(runId, {
    status: fail > 0 ? 'error' : 'ok',
    finished_at: new Date().toISOString(),
    entries_fetched: scoresBefore.size,
    entries_updated: scoresAfter.size,
    entries_skipped: skip,
    errors: incidencias.length ? incidencias : null,   // columna jsonb
    notes: `Δ medio ${mean.toFixed(1)} pts sobre ${compared} · curación ${curated ? 'aplicada' : 'NO aplicada'}`,
  })

  const detalle = incidencias.length ? `\n\n${incidencias.join('\n')}` : ''
  await notifyTelegram(
    (fail > 0 || skip > 0)
      ? `⚠️ <b>Índice Taka — recompute con incidencias</b>\n${summary}${detalle}\n\nLogs en /tmp/com.taka.weekly-rankings-update.{out,err}.`
      : `✅ <b>Índice Taka — recompute OK</b>\n${summary}\nΔ medio ${mean.toFixed(1)} pts · ${scoresAfter.size} entradas activas`
  )
}

process.exit(fail > 0 ? 1 : 0)
