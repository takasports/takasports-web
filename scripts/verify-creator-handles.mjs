#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// verify-creator-handles.mjs
//
// Comprueba UNO POR UNO que los perfiles sociales anclados a cada creador
// existen y son de quien decimos que son.
//
// ── POR QUÉ HACE FALTA UN NAVEGADOR ──────────────────────────────
// Instagram y TikTok devuelven HTTP 200 y una página casi idéntica tanto para
// un perfil real como para uno inventado (muro de login + render por JS), así
// que un `fetch` no distingue nada. Con un navegador de verdad sí:
//   · IG real      → título «Nombre (@handle) • Fotos y vídeos de Instagram»
//   · IG inventado → «Profile no disponible • Instagram»
//   · TikTok       → «Esta cuenta no se encuentra» cuando no existe
// De paso, Instagram da el número REAL de seguidores en la meta description,
// que es justo el dato que hasta ahora era una estimación puesta a mano.
//
// YouTube no se comprueba aquí: ya lo verifica anchor-creator-youtube.mjs
// contra la API oficial, que es más fiable.
//
// Salida: informe por consola + JSON en scripts/data/handle-report.json.
// NO escribe en la base de datos: primero se mira, luego se decide.
//
// Uso:
//   node scripts/verify-creator-handles.mjs
//   node scripts/verify-creator-handles.mjs --red instagram
//   node scripts/verify-creator-handles.mjs --limit 20
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

const argOf = (flag) => { const i = process.argv.indexOf(flag); return i !== -1 ? process.argv[i + 1] : null }
const ONLY_NET = argOf('--red')
const LIMIT = Number(argOf('--limit')) || 0

const NETS = ['instagram', 'tiktok', 'twitter']
const URL_OF = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  tiktok:    (h) => `https://www.tiktok.com/@${h}`,
  twitter:   (h) => `https://x.com/${h}`,
}

const clean = (h) => String(h || '').trim().replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '').split(/[/?]/)[0]

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

// ¿El nombre del perfil se parece al del creador? Se usa para AVISAR, nunca para
// borrar: un creador puede llamarse distinto en cada red.
function looksLikeSamePerson(profileName, creatorName, handle) {
  const [p, c, h] = [norm(profileName), norm(creatorName), norm(handle)]
  if (!p || !c) return false
  if (p.includes(c) || c.includes(p)) return true
  if (h && (p.includes(h) || h.includes(p))) return true
  const words = creatorName.split(/\s+/).map(norm).filter(w => w.length >= 4)
  return words.length > 0 && words.some(w => p.includes(w))
}

// "516M seguidores, 373 siguiendo" → 516000000
function parseFollowers(text) {
  const m = String(text || '').match(/([\d.,]+)\s*([MKmk])?\s*(seguidores|followers|Followers)/)
  if (!m) return null
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const mult = /m/i.test(m[2] ?? '') ? 1e6 : /k/i.test(m[2] ?? '') ? 1e3 : 1
  return Math.round(n * mult)
}

async function checkProfile(page, net, handle) {
  const url = URL_OF[net](handle)
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2200)
    const title = (await page.title()) || ''
    const desc = await page.evaluate(() => document.querySelector('meta[name="description"]')?.content ?? '')

    if (net === 'instagram') {
      if (/no disponible|not available|Página no encontrada|Page Not Found/i.test(title)) return { estado: 'ROTO', motivo: 'perfil no disponible' }
      const nombre = title.match(/^(.*?)\s*\(@/)?.[1]?.trim() ?? null
      if (!nombre) return { estado: 'DUDOSO', motivo: `título inesperado: ${title.slice(0, 60)}` }
      return { estado: 'OK', nombre, seguidores: parseFollowers(desc) }
    }

    if (net === 'tiktok') {
      const txt = `${title} ${desc}`
      if (/no se encuentra|couldn't find this account|Watch the latest video from/i.test(txt) && /no se encuentra|couldn't find/i.test(txt)) {
        return { estado: 'ROTO', motivo: 'cuenta no encontrada' }
      }
      const nombre = desc.match(/^(.*?)\s*\(@/)?.[1]?.trim() ?? title.match(/^(.*?)\s*\(@/)?.[1]?.trim() ?? null
      return { estado: nombre ? 'OK' : 'DUDOSO', nombre, seguidores: parseFollowers(desc), motivo: nombre ? undefined : `sin nombre legible: ${title.slice(0, 50)}` }
    }

    // x.com: casi siempre exige sesión; se reporta como no verificable salvo
    // que el título traiga el nombre.
    if (/cuenta suspendida|account suspended/i.test(title)) return { estado: 'ROTO', motivo: 'cuenta suspendida' }
    const nombre = title.match(/^(.*?)\s*\(@/)?.[1]?.trim() ?? null
    if (nombre) return { estado: 'OK', nombre }
    return { estado: 'NO_VERIFICABLE', motivo: 'X exige sesión' }
  } catch (e) {
    return { estado: 'NO_VERIFICABLE', motivo: e.message.slice(0, 60) }
  }
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const { data: creators, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, handles')
    .eq('active', true)
    .in('category', ['creadores', 'creadores_wwe'])
    .order('score_auto', { ascending: false, nullsFirst: false })
  if (error) throw error

  const jobs = []
  for (const c of creators) {
    for (const net of NETS) {
      if (ONLY_NET && net !== ONLY_NET) continue
      const h = clean(c.handles?.[net])
      if (h) jobs.push({ id: c.id, name: c.name, net, handle: h })
    }
  }
  const work = LIMIT ? jobs.slice(0, LIMIT) : jobs
  console.log(`${creators.length} creadores · ${work.length} perfiles a comprobar${ONLY_NET ? ` (${ONLY_NET})` : ''}\n`)

  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'es-ES', viewport: { width: 1280, height: 900 },
  })
  const page = await ctx.newPage()

  const report = []
  for (const [i, j] of work.entries()) {
    const res = await checkProfile(page, j.net, j.handle)
    const coincide = res.nombre ? looksLikeSamePerson(res.nombre, j.name, j.handle) : null
    const estado = res.estado === 'OK' && coincide === false ? 'DUDOSO' : res.estado
    const row = { ...j, ...res, estado, coincide }
    report.push(row)
    const mark = { OK: '✓', ROTO: '✗', DUDOSO: '?', NO_VERIFICABLE: '·' }[estado]
    console.log(
      `${String(i + 1).padStart(3)}/${work.length} ${mark} ${j.name.padEnd(24).slice(0, 24)} ${j.net.padEnd(9)} @${j.handle.padEnd(22).slice(0, 22)}` +
      `${res.nombre ? ` → «${res.nombre}»` : ''}${res.seguidores ? ` (${res.seguidores.toLocaleString('es-ES')})` : ''}${res.motivo ? ` — ${res.motivo}` : ''}`,
    )
    await page.waitForTimeout(900)
  }
  await browser.close()

  const by = (e) => report.filter(r => r.estado === e)
  console.log(`\n─── Resumen ───`)
  console.log(`  ✓ OK             ${by('OK').length}`)
  console.log(`  ✗ ROTO           ${by('ROTO').length}`)
  console.log(`  ? DUDOSO         ${by('DUDOSO').length}`)
  console.log(`  · NO VERIFICABLE ${by('NO_VERIFICABLE').length}`)

  const out = path.join(__dirname, 'data', 'handle-report.json')
  writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(`\nInforme en ${out}`)
}

main().catch(err => { console.error(err); process.exit(1) })
