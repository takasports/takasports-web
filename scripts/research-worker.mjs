#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// research-worker.mjs — vacía la cola de encargos del panel
//
// ── QUÉ HACE Y POR QUÉ EXISTE ────────────────────────────────────
// El panel de rankings da de alta a un creador investigándolo solo, pero hay un
// dato que no puede conseguir: los seguidores de Instagram. Instagram sirve una
// cáscara de JavaScript —un fetch recibe 614 KB sin un solo dato del perfil— y
// su endpoint interno responde 400 sin sesión. Hace falta un navegador de
// verdad, y en Vercel no hay ninguno.
//
// Así que el panel deja el encargo en `ranking_research_jobs` (migración 119) y
// este proceso, que corre en el Mac donde ya vive el pipeline semanal y ya está
// Playwright, lo resuelve.
//
// Aprovecha la misma detección de okupas que verify-creator-handles: un perfil
// sin publicaciones, o privado con menos de 5.000 seguidores, no es la figura
// pública sino un homónimo. En ese caso NO guarda la cifra y desancla el
// perfil, porque dejar el enlace apuntando a un desconocido es peor que no
// tener enlace.
//
// Uso:
//   node scripts/research-worker.mjs             # una pasada y sale
//   node scripts/research-worker.mjs --vigilar   # se queda mirando cada 60 s
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Faltan claves de Supabase'); process.exit(1) }

const VIGILAR = process.argv.includes('--vigilar')
const INTERVALO = 60_000
const MAX_INTENTOS = 3
const MIN_SEGUIDORES_PRIVADO = 5000

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// Mismo criterio que verify-creator-handles.mjs.
function parseFollowers(text) {
  const m = String(text || '').match(/([\d.,]+)\s*(millones|mill|mil|[MKB])?\s*seguidores/i)
  if (!m) return null
  const raw = m[1]
  const suf = (m[2] ?? '').toLowerCase()
  const mult = suf.startsWith('m') && suf !== 'mil' ? 1e6 : suf === 'mil' || suf === 'k' ? 1e3 : suf === 'b' ? 1e9 : 1
  // Instagram en español escribe «1,3 M» (coma decimal) y TikTok «4.5M» (punto).
  const n = mult > 1
    ? parseFloat(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw)
    : parseFloat(raw.replace(/[.,]/g, ''))
  return Number.isFinite(n) ? Math.round(n * mult) : null
}

async function leePerfilIG(page, handle) {
  await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(2200)
  const title = (await page.title()) || ''
  if (/no disponible|not available|Página no encontrada|Page Not Found/i.test(title)) {
    return { estado: 'ROTO', motivo: 'el perfil no existe' }
  }
  const desc = await page.evaluate(() => document.querySelector('meta[name="description"]')?.content ?? '')
  const body = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 1200)

  const nombre = title.match(/^(.*?)\s*\(@/)?.[1]?.trim() ?? null
  const seguidores = parseFollowers(desc) ?? parseFollowers(body)
  const publicaciones = (() => {
    const m = desc.match(/([\d.,]+\s*(?:millones|mill|mil|[MKB])?)\s*publicaciones/i)
    return m ? parseFollowers(`${m[1]} seguidores`) : null
  })()
  const privado = /perfil es privado|This account is private/i.test(body)

  if (publicaciones === 0) return { estado: 'OKUPA', nombre, seguidores, motivo: 'perfil sin publicaciones' }
  if (privado && (seguidores ?? 0) < MIN_SEGUIDORES_PRIVADO) {
    return { estado: 'OKUPA', nombre, seguidores, motivo: `perfil privado con ${seguidores ?? 0} seguidores` }
  }
  if (!seguidores) return { estado: 'SIN_CIFRA', nombre, motivo: 'no se pudo leer el número de seguidores' }
  return { estado: 'OK', nombre, seguidores, publicaciones }
}

async function resuelve(job, page) {
  const res = await leePerfilIG(page, job.handle)

  if (res.estado === 'OK') {
    await sb.from('creator_raw_metrics')
      .update({ instagram_known: res.seguidores, fetched_at: new Date().toISOString() })
      .eq('creator_id', job.entry_id)
    console.log(`  ✓ ${job.entry_id} — @${job.handle}: ${res.seguidores.toLocaleString('es-ES')} seguidores («${res.nombre}»)`)
  } else if (res.estado === 'OKUPA' || res.estado === 'ROTO') {
    // Desanclar: el enlace llevaba a otra persona o a ninguna parte.
    const { data: fila } = await sb.from('ranking_entries')
      .select('handles').eq('id', job.entry_id).eq('category', job.category).maybeSingle()
    if (fila) {
      const h = { ...(fila.handles ?? {}) }
      delete h.instagram
      // PK compuesta (id, category): filtrar por las dos o se pisa a otra persona.
      await sb.from('ranking_entries').update({ handles: h })
        .eq('id', job.entry_id).eq('category', job.category)
    }
    console.log(`  ⛔ ${job.entry_id} — @${job.handle} desanclado: ${res.motivo}`)
  } else {
    console.log(`  ? ${job.entry_id} — @${job.handle}: ${res.motivo}`)
  }

  await sb.from('ranking_research_jobs')
    .update({ estado: 'hecho', resultado: res, resuelto_en: new Date().toISOString() })
    .eq('id', job.id)
  return res
}

async function pasada(page) {
  const { data: jobs, error } = await sb
    .from('ranking_research_jobs')
    .select('id, entry_id, category, red, handle, intentos')
    .eq('estado', 'pendiente')
    .order('creado_en', { ascending: true })
    .limit(25)
  if (error) { console.error(`No se pudo leer la cola: ${error.message}`); return 0 }
  if (!jobs.length) return 0

  console.log(`\n${jobs.length} encargo(s) pendiente(s)`)
  let resueltos = 0
  for (const job of jobs) {
    try {
      await resuelve(job, page)
      resueltos++
    } catch (e) {
      const intentos = (job.intentos ?? 0) + 1
      const agotado = intentos >= MAX_INTENTOS
      // Un encargo que falla tres veces se marca en error en vez de quedarse
      // reintentando para siempre y tapando la cola.
      await sb.from('ranking_research_jobs').update({
        intentos,
        estado: agotado ? 'error' : 'pendiente',
        error: String(e?.message ?? e).slice(0, 300),
        resuelto_en: agotado ? new Date().toISOString() : null,
      }).eq('id', job.id)
      console.error(`  ✗ ${job.entry_id} — intento ${intentos}${agotado ? ' (se abandona)' : ''}: ${e?.message ?? e}`)
    }
    await page.waitForTimeout(900)
  }

  if (resueltos) {
    await sb.rpc('f_sync_creator_scores')
    await sb.rpc('refresh_ranking_view')
    console.log(`  → notas recalculadas`)
  }
  return resueltos
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'es-ES',
    viewport: { width: 1280, height: 900 },
  })
  const page = await ctx.newPage()

  if (!VIGILAR) {
    const n = await pasada(page)
    if (!n) console.log('Cola vacía.')
    await browser.close()
    return
  }

  console.log(`Vigilando la cola cada ${INTERVALO / 1000} s. Ctrl-C para parar.`)
  let parar = false
  process.on('SIGINT', () => { parar = true })
  while (!parar) {
    await pasada(page)
    await new Promise(r => setTimeout(r, INTERVALO))
  }
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
