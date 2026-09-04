// ─────────────────────────────────────────────────────────────────────────────
// El TÍTULO SEO de cada artículo — versión que corre en Vercel.
//
// POR QUÉ EXISTE ESTO SI YA ESTABA `scripts/auto-seo-title.mjs`:
// el pipeline de noticias (WF-07/WF-08) NO escribe `seoTitle` en ningún momento,
// así que los ~2.600 artículos publicados deben su <title> de Google a ese script
// y a nada más. Y ese script lo lanza el cron del Mac vía `~/.taka/run-seo.sh`,
// que saca los tokens del contenedor de n8n: **si el Mac o Docker están
// apagados, NINGÚN artículo recibe título y solo se entera un log local**.
//
// Aquí no hay Docker ni Mac: Vercel ya corre 27 crons de este proyecto y las dos
// únicas cosas que hacen falta son `SANITY_TOKEN` y `OPENAI_API_KEY` como
// variables de entorno.
//
// ⚠️ MIENTRAS CONVIVAN LOS DOS, esto y `scripts/auto-seo-title.mjs` tienen que
// decir lo mismo. La parte delicada (el recorte limpio) está fijada con tests en
// `seo-title.test.ts`. En cuanto el cron de Vercel esté verificado, hay que
// APAGAR el del Mac: dos procesos rellenando el mismo campo es justo el tipo de
// duplicación que se ha pasado la sesión arreglando.
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT = '43g1qwh9', DATASET = 'production', APIV = 'v2024-01-01'
const MODEL = 'gpt-4o-mini'
/** Tope del título. Google corta cerca de 60; 58 deja margen. */
export const MAXLEN = 58
const CONC = 4
const QURL = `https://${PROJECT}.api.sanity.io/${APIV}/data/query/${DATASET}`
const MURL = `https://${PROJECT}.api.sanity.io/${APIV}/data/mutate/${DATASET}`

/** Cuántos artículos como mucho por ejecución.
 *
 *  En el Mac no había tope porque una ejecución que tarde de más no molesta a
 *  nadie. Aquí sí: la función tiene 60 s. Medido en el log real del Mac, cada
 *  pasada procesa entre 0 y 2 artículos en 4-6 s, así que 12 es diez veces lo
 *  normal y sigue cabiendo de sobra. Si algún día se acumulan (porque el cron
 *  estuvo caído), se van vaciando a 12 cada cuarto de hora en vez de arriesgar
 *  un tiempo de espera agotado a mitad de escritura. */
export const LIMITE_POR_PASADA = 12

const fold = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const tldrText = (t: unknown) =>
  Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string').join(' ') : (typeof t === 'string' ? t : '')

export const stripBrand = (t: string) =>
  t.replace(/\s*[|\-–—·]\s*taka\s*sports.*$/i, '').replace(/\s*[|\-–—·]\s*$/, '').replace(/^["'«»]+|["'«»]+$/g, '').trim()

// Palabras que no pueden quedar las últimas: dejan la frase colgando.
// OJO con `un`: una versión anterior ponía `unos?|unas?|una`, que NO casa con
// «un» a secas, y por eso se publicó «...se preparan para un».
const COLA = /\s+(por|en|el|la|lo|los|las|de|del|al?|que|y|e|o|u|ni|si|con|sin|para|sus?|un(o|os|a|as)?|tras|ante|sobre|entre|hasta|desde|hacia|contra|durante|segun|según|como|mas|más|su|mi|tu)$/i

const MIN_TRAS_CORTE = 30

/** Si el recorte parte una cita, la comilla queda abierta y el título se lee
 *  roto. Se corta ANTES de la comilla que abrió. Solo comillas de APERTURA, para
 *  no destrozar apóstrofos dentro de un nombre («Tony D'Angelo» sobrevive). Y si
 *  cortar ahí dejaría un título ridículo, se quita solo la comilla huérfana. */
export function closeQuotes(s: string): string {
  const CIERRE: Record<string, string> = { '«': '»', '“': '”', '"': '"', "'": "'" }
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
  return cortado.length >= MIN_TRAS_CORTE ? cortado : s.slice(0, corte) + s.slice(corte + 1)
}

export function cleanTrim(s: string): string {
  let r = s
  if (r.length > MAXLEN) { const c = r.slice(0, MAXLEN), i = c.lastIndexOf(' '); r = (i > 20 ? c.slice(0, i) : c) }
  // Las comillas NO entran en la limpieza de puntuación: quitar la de cierre
  // deja huérfana la de apertura, que es el defecto que se quería quitar.
  const limpia = (x: string) => { for (let k = 0; k < 5; k++) x = x.replace(/[\s,;:.\-–—]+$/, '').replace(COLA, ''); return x }
  // Y el equilibrado va DESPUÉS de limpiar: antes la cadena sigue cerrada y el
  // corte no se detecta.
  r = limpia(r)
  const eq = closeQuotes(r)
  return (eq === r ? r : limpia(eq)).trim()
}

/** Cerrojo anti-invención: descarta un título que meta un nombre o una cifra que
 *  no esté en la noticia. Es lo que impide que el modelo se invente un fichaje. */
export function grounded(t: string, src: string): boolean {
  const f = fold(src)
  for (const n of (t.match(/\d+/g) || [])) if (!f.includes(n)) return false
  const w = t.split(/\s+/)
  for (let k = 1; k < w.length; k++) {
    const x = w[k].replace(/[^\p{L}\p{N}]/gu, '')
    if (x.length >= 4 && /^[A-ZÁÉÍÓÚÑ]/.test(x) && !f.includes(fold(x))) return false
  }
  return true
}

interface Articulo {
  _id: string
  slug?: string
  headline: string
  metaDescription?: string
  tldr?: unknown
  sport?: string
}

const pOriginal = (h: string, ctx: string, sport?: string) => `Eres editor SEO de un medio deportivo español. Escribe un TÍTULO SEO para Google que MAXIMICE los clics.
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

const pCompress = (h: string) => `Acorta este titular deportivo a un TÍTULO SEO de máximo 57 caracteres, en español, gramatical y fiel.
No inventes ni añadas nombres o cifras; usa solo los del titular. Sin "TakaSports". Devuelve SOLO el título.

Titular: ${h}
Título corto:`

async function ask(content: string, temp: number, key: string): Promise<string> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, temperature: temp, max_tokens: 32, messages: [{ role: 'user', content }] }),
  })
  if (!r.ok) throw new Error('OpenAI ' + r.status)
  const j = await r.json()
  return stripBrand((j.choices?.[0]?.message?.content || '').trim())
}

const valid = (t: string, src: string) => !!t && t.length <= MAXLEN && grounded(t, src)

/** Tres niveles, en orden: reformulación original, compresión fiel y —si las dos
 *  fallan o el modelo se inventa algo— recorte limpio del propio titular. El
 *  tercero no llama a nadie, así que siempre hay título. */
async function decide(a: Articulo, key: string): Promise<{ seoTitle: string; via: 'IA' | 'IA2' | 'rec' }> {
  const ctx = `${a.metaDescription || ''} ${tldrText(a.tldr)}`.trim().slice(0, 400)
  const src = `${a.headline} ${a.metaDescription || ''} ${tldrText(a.tldr)}`
  try {
    const t = await ask(pOriginal(a.headline, ctx, a.sport), 0.45, key)
    if (valid(t, src) && fold(t) !== fold(a.headline)) return { seoTitle: t, via: 'IA' }
  } catch { /* se cae al siguiente nivel */ }
  try {
    const t = await ask(pCompress(a.headline), 0.2, key)
    if (valid(t, src)) return { seoTitle: t, via: 'IA2' }
  } catch { /* se cae al recorte */ }
  return { seoTitle: cleanTrim(stripBrand(a.headline)), via: 'rec' }
}

export interface ResultadoSeoTitle {
  procesados: number
  original: number
  compresion: number
  recorte: number
  errores: number
  pendientes: number
  seco: boolean
  ejemplos: { slug?: string; via: string; seoTitle: string }[]
}

/** Rellena el `seoTitle` de los artículos que no lo tienen.
 *  NO toca el `headline` (el H1 visible) en ningún caso. */
export async function rellenarSeoTitles(
  opts: {
    seco?: boolean
    limite?: number
    /** Solo para PROBAR: mira artículos que YA tienen título, para poder
     *  comprobar que la generación funciona cuando no hay ninguno pendiente.
     *  Se ignora si no se pide también `seco`, así que NUNCA puede sobrescribir
     *  un título bueno. */
    ensayoSobreExistentes?: boolean
  } = {},
): Promise<ResultadoSeoTitle> {
  const SANITY_TOKEN = process.env.SANITY_TOKEN
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  if (!SANITY_TOKEN || !OPENAI_API_KEY) throw new Error('Falta SANITY_TOKEN u OPENAI_API_KEY')

  const seco = opts.seco ?? false
  const limite = opts.limite ?? LIMITE_POR_PASADA
  // El ensayo solo existe en seco. Si alguien lo pidiera sin `seco`, se ignora.
  const ensayo = seco && (opts.ensayoSobreExistentes ?? false)

  const filtro = ensayo
    ? 'defined(headline) && defined(seoTitle)'
    : 'defined(headline) && !defined(seoTitle)'
  const q = encodeURIComponent(
    `*[_type=="article" && ${filtro}] | order(publishedAt desc){_id,"slug":slug.current,headline,metaDescription,tldr,sport}`,
  )
  const resp = await fetch(`${QURL}?query=${q}`, { headers: { Authorization: `Bearer ${SANITY_TOKEN}` } })
  if (!resp.ok) throw new Error('Sanity query ' + resp.status)
  const todos: Articulo[] = (await resp.json()).result || []
  const arts = todos.slice(0, limite)

  let ia = 0, ia2 = 0, rec = 0, err = 0
  const ejemplos: ResultadoSeoTitle['ejemplos'] = []

  for (let i = 0; i < arts.length; i += CONC) {
    await Promise.all(arts.slice(i, i + CONC).map(async (a) => {
      try {
        const { seoTitle, via } = await decide(a, OPENAI_API_KEY)
        if (via === 'IA') ia++; else if (via === 'IA2') ia2++; else rec++
        if (ejemplos.length < 5) ejemplos.push({ slug: a.slug, via, seoTitle })
        if (!seco) {
          const r = await fetch(MURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SANITY_TOKEN}` },
            body: JSON.stringify({ mutations: [{ patch: { id: a._id, set: { seoTitle } } }] }),
          })
          if (!r.ok) throw new Error('Sanity mutate ' + r.status + ' ' + (await r.text()).slice(0, 160))
        }
      } catch (e) {
        err++
        console.error('[seo-title] ' + a._id + ': ' + (e as Error).message)
      }
    }))
  }

  return {
    procesados: arts.length,
    original: ia,
    compresion: ia2,
    recorte: rec,
    errores: err,
    pendientes: Math.max(0, todos.length - arts.length),
    seco,
    ejemplos,
  }
}
