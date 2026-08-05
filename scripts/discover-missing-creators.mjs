#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// discover-missing-creators.mjs
//
// Busca creadores de contenido deportivo en español que NO estén en el ranking.
//
// ── POR QUÉ ASÍ ──────────────────────────────────────────────────
// El roster se fue sembrando a mano, y una lista hecha de memoria tiene el
// sesgo de quien la escribe: sobran españoles de fútbol y faltan mexicanos de
// box o argentinos de básquet. Preguntarle a YouTube quita ese sesgo y además
// devuelve el dato que decide — suscriptores reales — en vez de una impresión.
//
// No añade nada a la base de datos: entrar en el ranking es una decisión
// editorial. Deja un informe ordenado por tamaño para revisarlo.
//
// Coste: API de YouTube, cuota gratuita. Cada búsqueda son 100 unidades y el
// detalle de canales 1 por lote de 50, así que una pasada completa ronda las
// 3.000 de las 10.000 diarias.
//
// Uso:
//   node scripts/discover-missing-creators.mjs
//   node scripts/discover-missing-creators.mjs --min 50000
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const YT_KEY = process.env.YOUTUBE_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!YT_KEY || !SUPABASE_URL || !SUPABASE_KEY) { console.error('Faltan YOUTUBE_API_KEY o claves de Supabase'); process.exit(1) }

const argOf = (f) => { const i = process.argv.indexOf(f); return i !== -1 ? process.argv[i + 1] : null }
const MIN_SUBS = Number(argOf('--min')) || 100000

// Búsquedas por deporte × mercado. Los mercados importan: «análisis NBA» en
// España y en México devuelve canales distintos, y el ranking es panhispano.
// Solo los seis deportes que el sitio cubre: un candidato de boxeo o de MLB no
// tendría dónde caer en el ranking.
const BUSQUEDAS = [
  ['futbol', 'análisis táctico fútbol', ['ES', 'MX', 'AR', 'CO', 'CL', 'PE']],
  ['futbol', 'opinión fútbol podcast', ['ES', 'MX', 'AR']],
  ['futbol', 'fútbol femenino análisis', ['ES', 'MX']],
  ['futbol', 'reacciones fútbol streamer', ['ES', 'MX', 'AR', 'CO']],
  ['baloncesto', 'NBA análisis en español', ['ES', 'MX', 'AR']],
  ['baloncesto', 'baloncesto ACB podcast', ['ES', 'AR']],
  ['tenis', 'tenis análisis en español', ['ES', 'AR']],
  ['formula1', 'Fórmula 1 análisis en español', ['ES', 'MX', 'AR']],
  ['ufc', 'UFC MMA análisis en español', ['ES', 'MX', 'AR']],
  ['wwe', 'WWE lucha libre en español', ['MX', 'ES', 'PE']],
]

// Cadenas y medios: el ranking es de CREADORES, no de emisoras. Se marcan para
// que se vean aparte, no se descartan en silencio.
const MEDIO_RE = /\b(espn|dazn|movistar|directv|tudn|fox sports|tnt sports|sky sports|bein|marca|diario as|mundo deportivo|sport\.es|ole|record|el universal|telemundo|univision|caracol|rcn|win sports|gol tv|laliga|liga f|liga femenil|nba|wnba|acb|euroleague|uefa|fifa|conmebol|liga mx|premier league|formula 1|f1 tv|tennis tv|atp tour|wta|mlb|nfl|wwe|ufc|aew)\b/i
// «Canal oficial de…» delata a la competición o al club aunque el nombre no lo
// diga. Es la marca, no un creador.
const OFICIAL_RE = /canal oficial|official youtube channel|the official channel|cuenta oficial/i

// Los resultados vienen mezclados con canales en inglés e italiano, que no
// pintan nada en un ranking panhispano. Sin campo de idioma fiable en la API,
// se mira si el texto trae palabras funcionales del español — un canal en
// español no escribe cien caracteres sin una de estas.
const ES_RE = /\b(el|la|los|las|de|del|con|para|por|que|una|más|así|aquí|donde|todos|cada|sobre|análisis|fútbol|béisbol|noticias|semana|mejores|canal)\b/i
function pareceEspanol(titulo, desc) {
  const texto = `${titulo} ${desc}`
  if (!ES_RE.test(texto)) return false
  // Filtro barato de falsos positivos: «la», «de» y «con» existen en italiano.
  if (/\b(the|and|your|our|we|with|from|this)\b/i.test(desc) && !/[áéíóúñ¿¡]/i.test(texto)) return false
  return true
}

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

async function yt(endpoint, params) {
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${new URLSearchParams({ ...params, key: YT_KEY })}`
  const r = await fetch(url)
  if (!r.ok) {
    const t = await r.text()
    // La cuota diaria se agota en silencio si no se mira: mejor parar y decirlo.
    if (r.status === 403 && /quota/i.test(t)) { console.error('\n⚠️  Cuota de YouTube agotada — el informe queda incompleto.'); return null }
    console.error(`  ${endpoint} HTTP ${r.status}`)
    return null
  }
  return r.json()
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Roster actual: canales anclados + nombres, para no proponer lo que ya está.
  // Incluye a los `suppressed`: si se retiraron a propósito, no deben volver
  // colados por la puerta de atrás.
  const { data: rows, error } = await sb
    .from('ranking_entries')
    .select('name, handles, suppressed')
    .in('category', ['creadores', 'creadores_wwe', 'periodistas'])
  if (error) throw error

  const canalesConocidos = new Set()
  const nombresConocidos = new Set()
  for (const r of rows) {
    nombresConocidos.add(norm(r.name))
    const y = r.handles?.youtube
    if (y) canalesConocidos.add(String(y).replace(/^@/, '').toLowerCase())
  }
  console.log(`Roster actual: ${rows.length} fichas · ${canalesConocidos.size} canales anclados\n`)

  const vistos = new Map()
  for (const [deporte, q, mercados] of BUSQUEDAS) {
    for (const region of mercados) {
      const j = await yt('search', {
        part: 'snippet', type: 'channel', q, maxResults: '25',
        relevanceLanguage: 'es', regionCode: region,
      })
      if (j === null) { console.error('Se interrumpe la búsqueda.'); break }
      for (const it of j.items ?? []) {
        const id = it.snippet?.channelId ?? it.id?.channelId
        if (!id) continue
        if (!vistos.has(id)) vistos.set(id, { id, deportes: new Set(), mercados: new Set() })
        vistos.get(id).deportes.add(deporte)
        vistos.get(id).mercados.add(region)
      }
      process.stdout.write(`  ${deporte}/${region} · acumulados ${vistos.size}\r`)
    }
  }
  console.log(`\n\n${vistos.size} canales distintos encontrados. Pidiendo detalle...\n`)

  // Detalle en lotes de 50 (1 unidad de cuota por lote).
  const ids = [...vistos.keys()]
  const detalle = []
  for (let i = 0; i < ids.length; i += 50) {
    const j = await yt('channels', { part: 'snippet,statistics', id: ids.slice(i, i + 50).join(',') })
    for (const c of j?.items ?? []) detalle.push(c)
  }

  const candidatos = []
  for (const c of detalle) {
    const subs = Number(c.statistics?.subscriberCount ?? 0)
    if (subs < MIN_SUBS) continue
    const titulo = c.snippet?.title ?? ''
    const handle = (c.snippet?.customUrl ?? '').replace(/^@/, '').toLowerCase()
    if (canalesConocidos.has(c.id.toLowerCase()) || (handle && canalesConocidos.has(handle))) continue
    if (nombresConocidos.has(norm(titulo))) continue
    const meta = vistos.get(c.id)
    candidatos.push({
      canal: c.id, titulo, handle: c.snippet?.customUrl ?? '', subs,
      videos: Number(c.statistics?.videoCount ?? 0),
      vistas: Number(c.statistics?.viewCount ?? 0),
      pais: c.snippet?.country ?? '—',
      deportes: [...(meta?.deportes ?? [])],
      mercados: [...(meta?.mercados ?? [])],
      esMedio: MEDIO_RE.test(titulo) || OFICIAL_RE.test(c.snippet?.description ?? ''),
      desc: (c.snippet?.description ?? '').replace(/\s+/g, ' ').slice(0, 110),
    })
  }
  candidatos.sort((a, b) => b.subs - a.subs)

  const creadores = candidatos.filter(c => !c.esMedio && pareceEspanol(c.titulo, c.desc))
  const medios = candidatos.filter(c => c.esMedio)
  const otroIdioma = candidatos.filter(c => !c.esMedio && !pareceEspanol(c.titulo, c.desc))

  console.log(`─── CREADORES QUE FALTAN (≥ ${MIN_SUBS.toLocaleString('es-ES')} suscriptores) ───\n`)
  for (const c of creadores) {
    console.log(`${String(c.subs).padStart(9)}  ${c.titulo.padEnd(30).slice(0, 30)} ${c.handle.padEnd(24).slice(0, 24)} ${c.pais.padEnd(3)} ${c.deportes.join('/')}`)
    console.log(`           ${c.desc}`)
  }
  console.log(`\n─── Medios y cadenas (no son creadores, se listan aparte) ───`)
  for (const c of medios) console.log(`${String(c.subs).padStart(9)}  ${c.titulo.slice(0, 40).padEnd(40)} ${c.pais}`)

  console.log(`\nTotal: ${creadores.length} creadores candidatos · ${medios.length} medios · ${otroIdioma.length} descartados por idioma`)
  const out = path.join(__dirname, 'data', 'missing-creators.json')
  writeFileSync(out, JSON.stringify({ min_subs: MIN_SUBS, creadores, medios }, null, 2))
  console.log(`Informe en ${out}`)
}

main().catch(e => { console.error(e); process.exit(1) })
