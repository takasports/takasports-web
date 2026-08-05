#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// mine-handles-from-youtube.mjs
//
// Saca los perfiles de Instagram, TikTok, X y Twitch de la descripción del
// canal de YouTube de cada creador.
//
// ── POR QUÉ ──────────────────────────────────────────────────────
// Quedan cifras de seguidores en el ranking que nadie puede comprobar porque no
// sabemos a qué perfil corresponden: 15,8 millones repartidos en 49 casillas.
// No se pueden verificar sin el nombre de usuario, y adivinarlo por el nombre
// de la persona sale mal — probado: dio @UFC para «UFC & Boxeo En Español».
//
// Pero casi todos los creadores escriben sus redes en la descripción de su
// canal («Sígueme en Instagram: @loquesea»), y esa descripción la da la API de
// YouTube gratis. Es una fuente que declara el propio interesado, así que vale
// tanto como Wikidata y bastante más que una corazonada.
//
// Cuesta 1 unidad de cuota por cada 50 canales, no las 100 de una búsqueda: se
// puede correr aunque la cuota de búsquedas esté agotada.
//
// NO pisa handles que ya existan: solo rellena huecos. Y no guarda cifras —
// eso lo hacen después verify-creator-handles (Instagram, con navegador) y
// resolve-tiktok-handles (TikTok, por HTTP).
//
// Uso:
//   node scripts/mine-handles-from-youtube.mjs
//   node scripts/mine-handles-from-youtube.mjs --apply
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const YT_KEY = process.env.YOUTUBE_API_KEY
if (!SUPABASE_URL || !SUPABASE_KEY || !YT_KEY) { console.error('Faltan claves'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const CATEGORIES = ['creadores', 'creadores_wwe', 'periodistas']

// Enlaces tal y como los escribe la gente en la descripción de su canal.
// Se aceptan solo URLs completas: un «@algo» suelto en mitad de un texto es
// casi siempre una mención a otra persona, no su propio perfil.
const PATRONES = {
  instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})/gi,
  tiktok:    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([A-Za-z0-9._]{2,30})/gi,
  twitter:   /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{2,20})/gi,
  twitch:    /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([A-Za-z0-9_]{2,30})/gi,
}
// Rutas que no son perfiles de nadie.
const NO_PERFIL = new Set(['p', 'reel', 'reels', 'explore', 'tv', 'stories', 'accounts', 'home', 'i', 'intent', 'share', 'hashtag', 'directory', 'videos'])

function extrae(texto) {
  const out = {}
  for (const [red, re] of Object.entries(PATRONES)) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(texto)) !== null) {
      const h = m[1]
      if (NO_PERFIL.has(h.toLowerCase())) continue
      // El primero que aparece es casi siempre el suyo; los siguientes suelen
      // ser de colaboradores o del programa.
      if (!out[red]) out[red] = h
    }
  }
  return out
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: ents, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, handles')
    .eq('active', true)
    .in('category', CATEGORIES)
    .order('name')
  if (error) throw error

  const { data: met } = await sb.from('creator_raw_metrics').select('creator_id, yt_channel_id')
  const canal = new Map((met ?? []).map(m => [m.creator_id, m.yt_channel_id]).filter(([, c]) => c))

  // Solo quien tiene canal conocido y le falta alguna red.
  const objetivo = ents.filter(e => {
    const cid = canal.get(e.id) ?? (/^UC[\w-]{20,}$/.test(String(e.handles?.youtube ?? '')) ? e.handles.youtube : null)
    if (!cid) return false
    return ['instagram', 'tiktok', 'twitter', 'twitch'].some(r => !e.handles?.[r])
  })
  console.log(`${ents.length} perfiles · ${objetivo.length} con canal conocido y alguna red por rellenar\n`)
  if (!objetivo.length) return

  // Descripciones en lotes de 50 (1 unidad de cuota por lote).
  const idDe = (e) => canal.get(e.id) ?? e.handles.youtube
  const descripciones = new Map()
  for (let i = 0; i < objetivo.length; i += 50) {
    const lote = objetivo.slice(i, i + 50)
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet&maxResults=50&id=${lote.map(idDe).join(',')}&key=${YT_KEY}`
    const r = await fetch(url)
    if (!r.ok) { console.error(`  lote ${i / 50 + 1}: HTTP ${r.status}`); continue }
    const j = await r.json()
    for (const c of j.items ?? []) descripciones.set(c.id, c.snippet?.description ?? '')
  }
  console.log(`Descripciones obtenidas: ${descripciones.size}\n`)

  let conHallazgo = 0, totalRedes = 0
  for (const e of objetivo) {
    const desc = descripciones.get(idDe(e))
    if (!desc) continue
    const encontrados = extrae(desc)
    // Solo lo que falta: nunca se pisa un handle ya corroborado.
    const nuevos = Object.fromEntries(
      Object.entries(encontrados).filter(([red]) => !e.handles?.[red]),
    )
    if (!Object.keys(nuevos).length) continue
    conHallazgo++
    totalRedes += Object.keys(nuevos).length
    console.log(`  ${e.name.padEnd(28).slice(0, 28)} ${Object.entries(nuevos).map(([r, h]) => `${r}:@${h}`).join('  ')}`)
    if (APPLY) {
      // PK compuesta (id, category): filtrar por las dos.
      const { error: err } = await sb.from('ranking_entries')
        .update({ handles: { ...(e.handles ?? {}), ...nuevos } })
        .eq('id', e.id).eq('category', e.category)
      if (err) console.error(`     ⚠️  ${err.message}`)
    }
  }

  console.log(`\n${conHallazgo} creadores con redes nuevas · ${totalRedes} perfiles encontrados${APPLY ? ' (aplicados)' : ' (simulación, usa --apply)'}`)
  if (APPLY && totalRedes) {
    console.log('\nSiguiente paso: resolve-tiktok-handles y verify-creator-handles para medirlos.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
