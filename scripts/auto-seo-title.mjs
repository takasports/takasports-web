#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// auto-seo-title.mjs — el TÍTULO SEO de cada artículo
//
// ── POR QUÉ ESTÁ AQUÍ Y NO EN ~/.taka ────────────────────────────
// Vivía suelto en el home, sin versionar y sin que NINGÚN repo lo
// mencionara — mismo caso que weekly-rankings.mjs. Y no es accesorio:
// el pipeline de noticias (WF-07/WF-08 de taka-system) no escribe
// `seoTitle` en ningún momento, así que los 2.647 artículos publicados
// deben su título de Google a este script y a nada más. Si el Mac se
// apaga o Docker no levanta, el 100% de los títulos SEO dejan de
// generarse y no salta ningún aviso.
// `~/.taka/auto-seo-title.mjs` queda como shim que ejecuta este.
//
// Lo lanza cron cada 15 min vía ~/.taka/run-seo.sh, que saca los tokens
// del contenedor n8n en marcha. Log en ~/.taka/seo.log.
//
// Autónomo (sin dependencias): rellena/optimiza el seoTitle de artículos de Sanity.
// Lee SANITY_TOKEN y OPENAI_API_KEY del entorno. NO toca el H1 (headline).
//
// Modos:
//   (normal)   solo artículos SIN seoTitle  → cron horario.
//   --regen    TODOS (sobrescribe), salvo los curados a mano (KEEP).
//   --dry      no escribe.  --limit=N  procesa solo N.
//
// Calidad: título ORIGINAL = reformulación con estructura/enfoque propios usando los MISMOS
// nombres y cifras de la noticia (no copia el titular ni el de otros medios, no inventa).
// 3 niveles: 1) reformulación original  2) compresión fiel  3) recorte limpio del titular.
// Cerrojo anti-invención: descarta cualquier título que meta un nombre/cifra que no esté en
// la noticia (titular+meta+tldr).

const PROJECT = '43g1qwh9', DATASET = 'production', APIV = 'v2024-01-01'
const MODEL = 'gpt-4o-mini', MAXLEN = 58, CONC = 4
const QURL = `https://${PROJECT}.api.sanity.io/${APIV}/data/query/${DATASET}`
const MURL = `https://${PROJECT}.api.sanity.io/${APIV}/data/mutate/${DATASET}`
const SANITY_TOKEN = process.env.SANITY_TOKEN, OPENAI_API_KEY = process.env.OPENAI_API_KEY
const DRY = process.argv.includes('--dry')
const REGEN = process.argv.includes('--regen')
const limRaw = (process.argv.find(a => a.startsWith('--limit')) || '').split('=')[1]
const LIMIT = limRaw && Number.isFinite(+limRaw) ? +limRaw : Infinity
if (!SANITY_TOKEN || !OPENAI_API_KEY) { console.error('Falta SANITY_TOKEN u OPENAI_API_KEY'); process.exit(1) }

// Títulos curados a mano (set-seo-title.mjs) — NO se sobrescriben en --regen.
const KEEP = new Set([
  'red-bull-lanza-crocs-de-95-con-diseno-inspirado-en-f1',
  'la-decision-clave-que-debe-tomar-bielsa-en-uruguay-para-el-mundial-tras-confirmarse-la-lesion-de',
  'el-ex-del-villarreal-guille-franco-inicia-una-nueva-etapa-como-director-de-futbol-de-san-lorenzo',
  'el-orgullo-de-laliga-la-gran-representacion-del-atletico-de-madrid-en-el-mundial-2026',
  'terremoto-electoral-en-el-real-madrid-haaland-vs-el-fichaje-mas-caro-de-la-historia',
  'la-copa-del-mundo-2026-esta-a-la-vuelta-de-la-esquina-y-lego-lanza-su-coleccion',
  'la-seleccion-de-noruega-presenta-su-plantilla-al-mundial-con-tematica-vikinga',
  'horarios-y-donde-ver-los-libres-del-gp-de-monaco-2026-con-alonso-y-sainz',
  'mercado-de-fichajes-altas-y-bajas-de-laliga-premier-serie-a-y-bundesliga',
  'el-real-madrid-presenta-su-nueva-camiseta-para-la-temporada-2026-2027',
  'el-mundial-con-menos-sevillistas-desde-2006',
  'los-jugadores-de-iran-reciben-visados-para-entrar-en-estados-unidos-para-el-mundial',
  'ancelotti-detalla-los-motivos-de-la-convocatoria-de-neymar-para-el-mundial',
  'zverev-derrota-a-mensik-y-se-acerca-a-su-primera-final-de-grand-slam',
  'espana-se-enfrenta-a-inglaterra-en-un-partido-clave-para-el-mundial-femenino-2027',
  'portugal-se-perfila-como-serio-candidato-a-ganar-el-mundial-2026',
  'arsenal-la-unica-opcion-real-para-julian-alvarez-pero-el-jugador-prefiere-barcelona',
  'arne-slot-despedido-tras-polemicas-criticas-a-sus-jugadores-en-liverpool',
  'fifa-cancela-entradas-del-mundial-otorgadas-por-error-a-60-aficionados',
  'revolucion-en-los-banquillos-de-laliga-todos-los-cambios-de-entrenador-para-la-nueva-temporada',
  'lando-norris-descarta-seguir-en-formula-1-en-sus-cuarenta-y-quiere-formar-una-familia',
  'antony-ver-llorando-a-isco-que-ha-ganado-la-champions-cinco-veces-me-emociono-mucho',
  'florentino-perez-y-su-fichaje-misterioso-de-150-millones-para-el-real-madrid',
  'luis-de-la-fuente-apunta-a-mikel-merino-tras-el-tropiezo-de-la-seleccion-espanola-ante-irak',
  'isco-alarcon-el-termometro-emocional-del-betis-en-su-regreso-a-la-champions',
  'graham-potter-de-las-sombras-a-la-gloria-con-suecia-en-el-mundial',
])

const fold = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const tldrText = t => Array.isArray(t) ? t.filter(x => typeof x === 'string').join(' ') : (typeof t === 'string' ? t : '')
const stripBrand = t => t.replace(/\s*[|\-–—·]\s*taka\s*sports.*$/i, '').replace(/\s*[|\-–—·]\s*$/, '').replace(/^["'«»]+|["'«»]+$/g, '').trim()
// Palabras que no pueden quedar las últimas: dejan la frase colgando.
// OJO con el orden y con `un`: la versión anterior ponía `unos?|unas?|una`, que
// NO casa con «un» a secas, y por eso se publicó «UFC 330: Makhachev y Garry se
// preparan para un». `un(o|os|a|as)?` los cubre todos.
const COLA = /\s+(por|en|el|la|lo|los|las|de|del|al?|que|y|e|o|u|ni|si|con|sin|para|sus?|un(o|os|a|as)?|tras|ante|sobre|entre|hasta|desde|hacia|contra|durante|segun|según|como|mas|más|su|mi|tu)$/i

// Si el recorte parte una cita, la comilla se queda abierta y el título se lee
// roto: «Cody Rhodes lamenta su tatuaje en el cuello: 'El mayor». Se corta
// ANTES de la comilla que abrió.
//
// Solo se consideran comillas de APERTURA (a principio o tras espacio/dos
// puntos/coma) para no destrozar apóstrofos dentro de un nombre — «Tony
// D'Angelo» debe sobrevivir intacto.
// Si cortar en la comilla dejaría un título ridículo —«Flick: "Julián Álvarez
// es el delantero…» se quedaba en «Flick», 5 caracteres— no se corta: se quita
// solo la comilla huérfana y el texto sigue, leyéndose como paráfrasis.
const MIN_TRAS_CORTE = 30

function closeQuotes(s) {
  const CIERRE = { '«': '»', '“': '”', '"': '"', "'": "'" }
  let corte = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (!(ch in CIERRE)) continue
    const abre = i === 0 || /[\s:,(¿¡—–-]/.test(s[i - 1])
    if (!abre) continue
    if (!s.slice(i + 1).includes(CIERRE[ch])) { corte = i; break }
  }
  if (corte === -1) return s
  const cortado = s.slice(0, corte).trim()
  return cortado.length >= MIN_TRAS_CORTE
    ? cortado
    : s.slice(0, corte) + s.slice(corte + 1)   // sin la comilla suelta
}

function cleanTrim(s) {
  let r = s
  if (r.length > MAXLEN) { const c = r.slice(0, MAXLEN), i = c.lastIndexOf(' '); r = (i > 20 ? c.slice(0, i) : c) }
  // Las comillas NO entran en la limpieza de puntuación: quitar la de cierre
  // deja huérfana la de apertura, que es justo el defecto que se quería quitar.
  const limpia = (x) => { for (let k = 0; k < 5; k++) x = x.replace(/[\s,;:.\-–—]+$/, '').replace(COLA, ''); return x }
  // Y el equilibrado va DESPUÉS de limpiar: si se hace antes, la cadena todavía
  // está cerrada y el corte no se detecta.
  r = limpia(r)
  const eq = closeQuotes(r)
  return (eq === r ? r : limpia(eq)).trim()
}
function grounded(t, src) {
  const f = fold(src)
  for (const n of (t.match(/\d+/g) || [])) if (!f.includes(n)) return false
  const w = t.split(/\s+/)
  for (let k = 1; k < w.length; k++) { const x = w[k].replace(/[^\p{L}\p{N}]/gu, ''); if (x.length >= 4 && /^[A-ZÁÉÍÓÚÑ]/.test(x) && !f.includes(fold(x))) return false }
  return true
}
const pOriginal = (h, ctx, sport) => `Eres editor SEO de un medio deportivo español. Escribe un TÍTULO SEO para Google que MAXIMICE los clics.
Reglas:
- ORIGINAL: estructura y enfoque propios, NO copies el titular tal cual ni titulares de otros medios.
- Empieza por la ENTIDAD o KEYWORD que la gente busca (nombre, equipo, competición).
- Si la noticia lo contiene, PRIORIZA los elementos con más intención de búsqueda: cifras y datos concretos, horario ("a qué hora"), "dónde ver", alineaciones o convocatoria, fichaje, lesión, marcador/resultado, competición y temporada.
- Usa EXACTAMENTE los mismos nombres propios y cifras de la noticia. NUNCA añadas ni inventes datos que no estén en ella; si no hay cifras/horarios, no los pongas.
- Español periodístico, concreto y natural, sin clickbait ni Mayúsculas Inglesas. Máx 57 caracteres.
- Sin "TakaSports" ni " | ...". Devuelve SOLO el título.

Deporte: ${sport || '-'}
Titular: ${h}
Contexto: ${ctx}
Título SEO:`
const pCompress = (h, sport) => `Acorta este titular deportivo a un TÍTULO SEO de máximo 57 caracteres, en español, gramatical y fiel.
No inventes ni añadas nombres o cifras; usa solo los del titular. Sin "TakaSports". Devuelve SOLO el título.

Titular: ${h}
Título corto:`
async function ask(content, temp) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` }, body: JSON.stringify({ model: MODEL, temperature: temp, max_tokens: 32, messages: [{ role: 'user', content }] }) })
  if (!r.ok) throw new Error('OpenAI ' + r.status)
  return stripBrand(((await r.json()).choices?.[0]?.message?.content || '').trim())
}
const valid = (t, src) => t && t.length <= MAXLEN && grounded(t, src)
async function decide(a) {
  const ctx = `${a.metaDescription || ''} ${tldrText(a.tldr)}`.trim().slice(0, 400)
  const src = `${a.headline} ${a.metaDescription || ''} ${tldrText(a.tldr)}`
  try { const t = await ask(pOriginal(a.headline, ctx, a.sport), 0.45); if (valid(t, src) && fold(t) !== fold(a.headline)) return { seoTitle: t, via: 'IA' } } catch {}
  try { const t = await ask(pCompress(a.headline, a.sport), 0.2); if (valid(t, src)) return { seoTitle: t, via: 'IA2' } } catch {}
  return { seoTitle: cleanTrim(stripBrand(a.headline)), via: 'rec' }
}
async function patch(id, seoTitle) {
  const r = await fetch(MURL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SANITY_TOKEN}` }, body: JSON.stringify({ mutations: [{ patch: { id, set: { seoTitle } } }] }) })
  if (!r.ok) throw new Error('Sanity mutate ' + r.status + ' ' + (await r.text()).slice(0, 160))
}

const filter = REGEN ? 'defined(headline)' : 'defined(headline) && !defined(seoTitle)'
const q = encodeURIComponent(`*[_type=="article" && ${filter}] | order(publishedAt desc){_id,"slug":slug.current,headline,metaDescription,tldr,sport}`)
const resp = await fetch(`${QURL}?query=${q}`, { headers: { Authorization: `Bearer ${SANITY_TOKEN}` } })
if (!resp.ok) { console.error(`${new Date().toISOString()} ERROR query ${resp.status}`); process.exit(1) }
let arts = (await resp.json()).result || []
if (REGEN) arts = arts.filter(a => !KEEP.has(a.slug))
arts = arts.slice(0, LIMIT)
console.log(`${new Date().toISOString()} ${REGEN ? 'REGEN' : 'normal'} · ${arts.length} a procesar${DRY ? ' (DRY)' : ''}`)
let ia = 0, ia2 = 0, rec = 0, err = 0
for (let i = 0; i < arts.length; i += CONC) {
  await Promise.all(arts.slice(i, i + CONC).map(async a => {
    try {
      const { seoTitle, via } = await decide(a)
      if (via === 'IA') ia++; else if (via === 'IA2') ia2++; else rec++
      if (DRY) console.log(`  [${via.padEnd(3)}] ${(a.headline || '').slice(0, 30).padEnd(30)} → ${seoTitle}`)
      else await patch(a._id, seoTitle)
    } catch (e) { err++; console.error('  ERROR ' + a._id + ': ' + e.message) }
  }))
}
console.log(`${new Date().toISOString()} hecho original=${ia} compresion=${ia2} recorte=${rec} err=${err}${DRY ? ' (DRY)' : ''}`)
