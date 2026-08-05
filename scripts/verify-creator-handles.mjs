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
const APPLY = process.argv.includes('--apply')
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

// Cifras de seguidores tal y como las pintan las redes en español:
//   «1,3 M seguidores» · «25,1 mil seguidores» · «805.000 seguidores» · «4.5M Seguidores»
// Con sufijo (M/mil/K) la coma es decimal; sin sufijo, el punto separa millares.
function parseFollowers(text) {
  const m = String(text || '').match(/([\d.,]+)\s*(millones|mill|mil|[MKB])?\s*seguidores/i)
  if (!m) return null
  const raw = m[1]
  const suf = (m[2] ?? '').toLowerCase()
  const mult = suf.startsWith('m') && suf !== 'mil' ? 1e6 : suf === 'mil' || suf === 'k' ? 1e3 : suf === 'b' ? 1e9 : 1
  // Con sufijo conviven los dos formatos: Instagram en español escribe «1,3 M»
  // (coma decimal) y TikTok «4.5M» (punto decimal). Tomar el punto siempre como
  // separador de millares convertía 4,5 M en 45 M.
  const n = mult > 1
    ? parseFloat(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw)
    : parseFloat(raw.replace(/[.,]/g, ''))
  if (!Number.isFinite(n)) return null
  return Math.round(n * mult)
}

// ── Detectar okupas y homónimos ──────────────────────────────────
// Que el perfil exista y se llame igual NO significa que sea el nuestro:
// @manololama tiene 1 seguidor y 0 publicaciones, @jorgevaldano es privado con
// 13 y @clossmariano con 2. Los tres pasaban la comprobación de nombre con
// sobresaliente. Lo que los delata es el perfil vacío o cerrado:
//   · 0 publicaciones            → cuenta ocupada, nunca ha publicado
//   · privado y < 5.000 seguidores → un particular, no la figura pública
// Un perfil pequeño PERO público y con publicaciones sí puede ser real: hay
// cuentas de nicho legítimas con 1.500 seguidores (Cosas del Basket).
const MIN_SEGUIDORES_PRIVADO = 5000
function esOkupa({ publicaciones, privado, seguidores }) {
  if (publicaciones === 0) return 'perfil sin publicaciones'
  if (privado && (seguidores ?? 0) < MIN_SEGUIDORES_PRIVADO) return `perfil privado con ${seguidores ?? 0} seguidores`
  return null
}

// La meta description de Instagram es la fuente limpia: «1.061 seguidores,
// 216 siguiendo, 32 publicaciones - Nombre (@handle) en Instagram».
function parseMetaIG(desc) {
  const n = (t) => { const v = parseFollowers(`${t} seguidores`); return v }
  const seg = desc.match(/([\d.,]+\s*(?:millones|mill|mil|[MKB])?)\s*seguidores/i)?.[1]
  const pub = desc.match(/([\d.,]+\s*(?:millones|mill|mil|[MKB])?)\s*publicaciones/i)?.[1]
  return {
    seguidores: seg ? n(seg) : null,
    publicaciones: pub ? n(pub) : null,
  }
}

async function checkProfile(page, net, handle) {
  const url = URL_OF[net](handle)
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2200)
    const title = (await page.title()) || ''
    const desc = await page.evaluate(() => document.querySelector('meta[name="description"]')?.content ?? '')
    // El cuerpo de la página trae la cifra de seguidores incluso cuando la meta
    // no la incluye (TikTok), así que se mira también ahí.
    const body = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 1200)
    const seguidores = parseFollowers(body) ?? parseFollowers(desc)

    if (net === 'instagram') {
      if (/no disponible|not available|Página no encontrada|Page Not Found/i.test(title)) return { estado: 'ROTO', motivo: 'perfil no disponible' }
      const nombre = title.match(/^(.*?)\s*\(@/)?.[1]?.trim() ?? null
      if (!nombre) return { estado: 'DUDOSO', motivo: `título inesperado: ${title.slice(0, 60)}` }
      const meta = parseMetaIG(desc)
      const privado = /perfil es privado|This account is private/i.test(body)
      const segIG = meta.seguidores ?? seguidores
      const okupa = esOkupa({ publicaciones: meta.publicaciones, privado, seguidores: segIG })
      if (okupa) return { estado: 'OKUPA', nombre, seguidores: segIG, motivo: okupa }
      return { estado: 'OK', nombre, seguidores: segIG, publicaciones: meta.publicaciones }
    }

    if (net === 'tiktok') {
      const txt = `${title} ${desc}`
      if (/no se encuentra|couldn't find this account|Watch the latest video from/i.test(txt) && /no se encuentra|couldn't find/i.test(txt)) {
        return { estado: 'ROTO', motivo: 'cuenta no encontrada' }
      }
      const nombre = desc.match(/^(.*?)\s*\(@/)?.[1]?.trim()
        ?? body.match(/([^·|]{2,40}?)\s+@?[\w.]+\s+\d[\d.,]*\s*[KMB]?\s*Siguiendo/i)?.[1]?.trim()
        ?? null
      return { estado: nombre ? 'OK' : 'DUDOSO', nombre, seguidores, motivo: nombre ? undefined : `sin nombre legible: ${title.slice(0, 50)}` }
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
    .in('category', ['creadores', 'creadores_wwe', 'periodistas'])
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
    const mark = { OK: '✓', ROTO: '✗', DUDOSO: '?', OKUPA: '⛔', NO_VERIFICABLE: '·' }[estado]
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
  console.log(`  ⛔ OKUPA          ${by('OKUPA').length}  (perfil de otra persona — se desancla)`)
  console.log(`  · NO VERIFICABLE ${by('NO_VERIFICABLE').length}`)

  // ── Guardar seguidores REALES ──────────────────────────────────
  // Hasta ahora las cifras de Instagram y TikTok eran estimaciones puestas a
  // mano porque se daba por hecho que esas redes no se podían leer. Sí se
  // pueden con un navegador, así que se sustituyen por el dato verificado.
  if (APPLY) {
    const COL = { instagram: 'instagram_known', tiktok: 'tiktok_known' }
    const porCreador = new Map()
    for (const r of report) {
      if (r.estado !== 'OK' || !r.seguidores || !COL[r.net]) continue
      if (!porCreador.has(r.id)) porCreador.set(r.id, {})
      porCreador.get(r.id)[COL[r.net]] = r.seguidores
    }
    // Desanclar los perfiles okupados: dejar el enlace apuntando a un
    // desconocido es peor que no tener enlace, y su cifra de seguidores
    // envenenaba la nota de audiencia.
    let desanclados = 0
    for (const r of report.filter(x => x.estado === 'OKUPA')) {
      const { data: fila } = await sb.from('ranking_entries').select('handles, category').eq('id', r.id).limit(1).maybeSingle()
      if (!fila) continue
      const h = { ...(fila.handles ?? {}) }
      delete h[r.net]
      // PK compuesta (id, category): filtrar por las dos.
      const { error: err } = await sb.from('ranking_entries').update({ handles: h }).eq('id', r.id).eq('category', fila.category)
      if (!err) { desanclados++; console.log(`  ⛔ ${r.name} — ${r.net} @${r.handle} desanclado (${r.motivo})`) }
    }
    if (desanclados) console.log(`\n  Perfiles desanclados: ${desanclados}`)

    let ok = 0, fail = 0
    for (const [id, cols] of porCreador) {
      const { data: existe } = await sb.from('creator_raw_metrics').select('creator_id').eq('creator_id', id).maybeSingle()
      const payload = existe
        ? { creator_id: id, ...cols, fetched_at: new Date().toISOString() }
        : { creator_id: id, yt_subscribers: 0, twitch_known: 0, tiktok_known: 0, twitter_known: 0, instagram_known: 0, ...cols, fetched_at: new Date().toISOString() }
      const { error: err } = await sb.from('creator_raw_metrics').upsert(payload, { onConflict: 'creator_id' })
      if (err) { fail++; console.error(`FAIL ${id}: ${err.message}`) } else ok++
    }
    console.log(`\n  Seguidores reales guardados: ${ok} creadores (fallos ${fail})`)
    const { error: syncErr } = await sb.rpc('f_sync_creator_scores')
    console.log(syncErr ? `  ⚠️  f_sync: ${syncErr.message}` : '  ✓ f_sync_creator_scores() recalculado')
  }

  const out = path.join(__dirname, 'data', 'handle-report.json')
  writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(`\nInforme en ${out}`)
}

main().catch(err => { console.error(err); process.exit(1) })
