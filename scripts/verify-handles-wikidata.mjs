#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// verify-handles-wikidata.mjs
//
// Corrobora los perfiles sociales anclados a creadores y periodistas contra
// Wikidata, que guarda el usuario OFICIAL de cada red como propiedad.
//
// ── POR QUÉ HACE FALTA ADEMÁS DE verify-creator-handles ──────────
// Aquel script comprueba que el perfil EXISTE y que su nombre se parece al del
// creador. Eso deja pasar a los okupas y a los homónimos, que son legión en las
// cuentas de gente conocida:
//   · @manololama   → 1 seguidor, 0 publicaciones (cuenta vacía)
//   · @jorgevaldano → privada, 13 seguidores
//   · @misterchip   → un blog ruso de gatos
// Los tres pasaban la comprobación de nombre con sobresaliente. El delator es
// la cifra de seguidores: un periodista de alcance nacional no tiene 13.
//
// Wikidata sí distingue, porque la propiedad cuelga de la PERSONA, no del
// nombre: P2003 Instagram · P2002 X · P7085 TikTok · P2397 canal de YouTube.
//
// Elegir la entidad correcta es la mitad del trabajo: `wbsearchentities`
// devuelve cualquier cosa que se llame parecido, así que se exige que la
// ocupación (P106) o la descripción encajen con «periodista / presentador /
// comentarista / youtuber», y entre las que encajan gana la de más enlaces a
// Wikipedia (el desempate por notoriedad que ya usamos con los clubes).
//
// Uso:
//   node scripts/verify-handles-wikidata.mjs            # solo informa
//   node scripts/verify-handles-wikidata.mjs --apply    # corrige los handles
// ─────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { writeFileSync } from 'fs'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE keys'); process.exit(1) }

const APPLY = process.argv.includes('--apply')
const UA = 'TakaSports/1.0 (https://www.takasportsmedia.com; contactotakasports@gmail.com)'

const PROP = { instagram: 'P2003', twitter: 'P2002', tiktok: 'P7085', youtube: 'P2397' }

// Ocupaciones (P106) compatibles con estar en un ranking de contenido deportivo.
const OCUPACIONES_OK = new Set([
  'Q1930187',  // periodista
  'Q13590141', // periodista deportivo
  'Q2722764',  // presentador de televisión
  'Q947873',   // presentador
  'Q17125263', // youtuber
  'Q245068',   // comediante (varios lo son)
  'Q3286043',  // streamer / creador
  'Q10798782', // actor de televisión
  'Q15265344', // locutor de radio
  'Q4610556',  // modelo/presentador
  'Q1607826',  // comentarista deportivo
  'Q937857',   // futbolista (ex, ahora comentarista)
  'Q628099',   // futbolista asociación
  'Q10833314', // tenista
  'Q10843402', // nadador — por si acaso
  'Q10871364', // piloto de carreras
  'Q11774891', // luchador profesional
])
const DESC_OK = /periodist|presentador|comentarist|locutor|youtuber|streamer|tertulian|narrador|reporter|broadcast|journalist|commentator|sports? (writer|pundit)|creador de contenido|influencer/i

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const clean = (h) => String(h || '').trim().replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '').split(/[/?]/)[0]

// ── Desempate por nacionalidad ───────────────────────────────────
// La ocupación sola no basta: «Ariel Levy» devuelve a una ESCRITORA
// ESTADOUNIDENSE del New Yorker, que también pasa el filtro de periodista y
// tiene más enlaces de Wikipedia que el presentador chileno. El país sí los
// separa. La columna `country` viene en tres formatos (bandera, ISO-2 y nombre
// en español), así que se normaliza todo a ISO-2.
const QID_PAIS = {
  Q29: 'ES', Q414: 'AR', Q96: 'MX', Q298: 'CL', Q739: 'CO', Q30: 'US', Q77: 'UY',
  Q419: 'PE', Q717: 'VE', Q736: 'EC', Q1006: 'GQ', Q228: 'AD', Q155: 'BR',
  Q733: 'PY', Q750: 'BO', Q800: 'CR', Q804: 'PA', Q786: 'DO', Q774: 'GT',
  Q783: 'HN', Q792: 'SV', Q811: 'NI', Q241: 'CU', Q145: 'GB', Q142: 'FR',
  Q183: 'DE', Q38: 'IT', Q45: 'PT', Q16: 'CA',
}
const NOMBRE_PAIS = {
  espana: 'ES', argentina: 'AR', mexico: 'MX', chile: 'CL', colombia: 'CO',
  estadosunidos: 'US', uruguay: 'UY', peru: 'PE', venezuela: 'VE', ecuador: 'EC',
  guineaecuatorial: 'GQ', andorra: 'AD', brasil: 'BR', paraguay: 'PY', bolivia: 'BO',
  costarica: 'CR', panama: 'PA', republicadominicana: 'DO', guatemala: 'GT',
  honduras: 'HN', elsalvador: 'SV', nicaragua: 'NI', cuba: 'CU', reinounido: 'GB',
}
// Bandera emoji → ISO-2: cada símbolo indicador regional es la letra + 0x1F1A5.
function paisISO(valor) {
  const v = String(valor || '').trim()
  if (!v) return null
  const cps = [...v].map(c => c.codePointAt(0))
  if (cps.length === 2 && cps.every(c => c >= 0x1f1e6 && c <= 0x1f1ff)) {
    return cps.map(c => String.fromCharCode(c - 0x1f1a5)).join('')
  }
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase()
  return NOMBRE_PAIS[norm(v)] ?? null
}

// Nacionalizados: Wikidata guarda el país de NACIMIENTO, y Christian Martinoli
// consta como argentino aunque narre en México desde hace 30 años. Descartarlo
// por eso sería peor que el problema que arregla, así que un gentilicio en la
// descripción («narrador deportivo mexicano») vale tanto como P27.
const GENTILICIO = {
  ES: /espanol|espanola/, MX: /mexicano|mexicana/, AR: /argentino|argentina/,
  CL: /chileno|chilena/, CO: /colombiano|colombiana/, US: /estadounidense|norteamericano/,
  UY: /uruguayo|uruguaya/, PE: /peruano|peruana/, VE: /venezolano|venezolana/,
  EC: /ecuatoriano|ecuatoriana/, GQ: /ecuatoguineano|ecuatoguineana/, AD: /andorrano|andorrana/,
  BR: /brasileno|brasilena/, PY: /paraguayo|paraguaya/, BO: /boliviano|boliviana/,
  CR: /costarricense/, PA: /panameno|panamena/, DO: /dominicano|dominicana/,
  GT: /guatemalteco|guatemalteca/, CU: /cubano|cubana/, GB: /britanico|britanica|ingles|inglesa/,
}

// Casos que ninguna señal automática separa y que se dejan a revisión humana:
// el «Jordi Martí» de Wikidata es escritor, periodista Y político, igual de
// compatible con el filtro que el tertuliano culé, y ambos son españoles.
const REVISION_MANUAL = new Set(['jordi-marti'])

async function jsonGet(url) {
  for (let intento = 0; intento < 3; intento++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (r.ok) return r.json()
    // Wikimedia limita por ráfagas: esperar y reintentar en vez de dar el dato
    // por inexistente, que es como se perdieron 95 clubes en la ingesta anterior.
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 1500 * (intento + 1))); continue }
    return null
  }
  return null
}

async function buscarEntidad(nombre, paisEsperado) {
  const candidatos = []
  for (const lang of ['es', 'en']) {
    const j = await jsonGet(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=${lang}&uselang=${lang}&type=item&limit=7&search=${encodeURIComponent(nombre)}`)
    for (const s of j?.search ?? []) if (!candidatos.includes(s.id)) candidatos.push(s.id)
  }
  if (!candidatos.length) return null

  const j = await jsonGet(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${candidatos.join('|')}&props=claims|descriptions|labels|sitelinks`)
  const ents = j?.entities ?? {}

  let mejor = null
  for (const id of candidatos) {
    const e = ents[id]
    if (!e || e.missing !== undefined) continue
    const desc = e.descriptions?.es?.value ?? e.descriptions?.en?.value ?? ''
    const ocupaciones = (e.claims?.P106 ?? []).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean)
    const encaja = ocupaciones.some(o => OCUPACIONES_OK.has(o)) || DESC_OK.test(desc)
    if (!encaja) continue
    // Si sabemos de qué país es el nuestro y Wikidata dice otro, es otra persona.
    // Solo descarta cuando hay contradicción: sin dato, no se penaliza.
    if (paisEsperado) {
      const suyos = (e.claims?.P27 ?? []).map(c => QID_PAIS[c.mainsnak?.datavalue?.value?.id]).filter(Boolean)
      const porGentilicio = GENTILICIO[paisEsperado]?.test(norm(desc)) ?? false
      if (suyos.length && !suyos.includes(paisEsperado) && !porGentilicio) continue
    }
    // Desempate por notoriedad: más enlaces a Wikipedia = la persona conocida,
    // no el homónimo con una ficha de tres líneas.
    const enlaces = Object.keys(e.sitelinks ?? {}).length
    if (!mejor || enlaces > mejor.enlaces) mejor = { id, desc, enlaces, claims: e.claims ?? {}, label: e.labels?.es?.value ?? e.labels?.en?.value ?? '' }
  }
  return mejor
}

const valorDe = (claims, prop) => {
  const v = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value
  return typeof v === 'string' ? v : null
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  const { data: filas, error } = await sb
    .from('ranking_entries')
    .select('id, name, category, country, handles')
    .eq('active', true)
    .in('category', ['creadores', 'creadores_wwe', 'periodistas'])
    .order('name')
  if (error) throw error

  console.log(`${filas.length} perfiles de contenido a corroborar contra Wikidata\n`)

  const informe = []
  let sinFicha = 0, confirmados = 0, corregidos = 0, dudosos = 0

  for (const [i, f] of filas.entries()) {
    const ent = await buscarEntidad(f.name, paisISO(f.country))
    if (!ent) {
      sinFicha++
      informe.push({ id: f.id, category: f.category, name: f.name, estado: 'SIN_FICHA' })
      console.log(`${String(i + 1).padStart(3)}/${filas.length} · ${f.name.padEnd(26).slice(0, 26)} — sin ficha de Wikidata`)
      continue
    }

    const cambios = {}
    const notas = []
    for (const [red, prop] of Object.entries(PROP)) {
      const oficial = valorDe(ent.claims, prop)
      if (!oficial) continue
      const actual = clean(f.handles?.[red])
      // YouTube en Wikidata es el id del canal (UC…); el nuestro es @handle.
      // No son comparables, así que solo se rellena si no había nada.
      if (red === 'youtube') { if (!actual) notas.push(`youtube: canal oficial ${oficial}`); continue }
      if (!actual) { cambios[red] = oficial; notas.push(`${red}: vacío → @${oficial}`) }
      else if (norm(actual) !== norm(oficial)) { cambios[red] = oficial; notas.push(`${red}: @${actual} → @${oficial}`) }
    }

    if (REVISION_MANUAL.has(f.id) && Object.keys(cambios).length) {
      console.log(`${String(i + 1).padStart(3)}/${filas.length} ⚠ ${f.name.padEnd(26).slice(0, 26)} ${ent.id.padEnd(10)} homónimo indistinguible — se deja como está: ${notas.join(' · ')}`)
      informe.push({ id: f.id, category: f.category, name: f.name, wikidata: ent.id, desc: ent.desc, estado: 'REVISION_MANUAL', cambios })
      dudosos++
      continue
    }
    const estado = Object.keys(cambios).length ? 'CORREGIR' : 'OK'
    if (estado === 'OK') confirmados++; else corregidos++
    informe.push({ id: f.id, category: f.category, name: f.name, wikidata: ent.id, desc: ent.desc, estado, cambios })
    const mark = estado === 'OK' ? '✓' : '✎'
    console.log(`${String(i + 1).padStart(3)}/${filas.length} ${mark} ${f.name.padEnd(26).slice(0, 26)} ${ent.id.padEnd(10)} ${notas.join(' · ') || 'coincide'}`)

    if (APPLY && Object.keys(cambios).length) {
      const nuevos = { ...(f.handles ?? {}), ...cambios }
      // PK compuesta (id, category): filtrar por las dos o se pisa a otra persona.
      const { error: err } = await sb.from('ranking_entries').update({ handles: nuevos }).eq('id', f.id).eq('category', f.category)
      if (err) console.error(`    ⚠️  ${err.message}`)
    }
    await new Promise(s => setTimeout(s, 250))
  }

  console.log(`\n─── Resumen ───`)
  console.log(`  ✓ confirmados por Wikidata  ${confirmados}`)
  console.log(`  ✎ con handle corregido      ${corregidos}${APPLY ? ' (aplicados)' : ' (simulación, usa --apply)'}`)
  console.log(`  ⚠ a revisar a mano          ${dudosos}`)
  console.log(`  · sin ficha en Wikidata     ${sinFicha}`)

  const out = path.join(__dirname, 'data', 'wikidata-handle-report.json')
  writeFileSync(out, JSON.stringify(informe, null, 2))
  console.log(`\nInforme en ${out}`)
}

main().catch(err => { console.error(err); process.exit(1) })
