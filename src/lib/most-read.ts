// ─────────────────────────────────────────────────────────────────────────────
// "Lo más leído de la semana" — los artículos con más clics desde Google.
//
// Por qué Search Console y no otra cosa (comprobado el 03/09/2026):
//   · GA4 NO responde desde la web. Faltan `GOOGLE_SA_*` en Vercel y el token
//     OAuth que hay solo tiene el scope de Search Console, así que
//     `getTopContent()` de traffic.ts devuelve [] en silencio.
//   · `read_history` tiene 52 filas de 4 usuarios y 1 lectura en los últimos 7
//     días: un empate a uno entre 46 artículos.
//   · Sanity no guarda popularidad. El campo `priority` sale "destacado" para
//     TODOS los artículos del pipeline, así que no discrimina.
//   · Search Console sí: misma credencial que ya usa el cron de auditoría a
//     diario en Vercel, y 14 de las 15 páginas top son artículos.
//
// Dos honestidades que condicionan el copy:
//   · La ventana termina hace 3 días (Search Console va retrasado), así que el
//     bloque se llama "de la semana" y NO "ahora mismo".
//   · Mide clics desde Google, no directo ni redes. Para este sitio es el canal
//     medible dominante.
//
// Si algo falla, devuelve [] y el componente no se pinta. Nunca un esqueleto.
// ─────────────────────────────────────────────────────────────────────────────

import { unstable_cache } from 'next/cache'
import { getOauthAccessToken, getServiceAccountToken } from './google-auth'
import { REPORTAJE_GROQ_FILTER } from './constants'

const GSC_SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL || 'https://www.takasportsmedia.com/'
const WEBMASTERS_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const TIMEOUT_MS = 8_000

export interface MostReadArticle {
  slug: string
  title: string
  /** URL directa del medio de origen (artículos del pipeline). */
  imageUrl?: string | null
  /** Imagen subida a Sanity. Es el respaldo cuando `imageUrl` viene vacío: sin
   *  esto, los artículos con foto propia salían con el hueco en blanco. */
  image?: unknown
  sport?: string | null
  category?: string | null
  clicks: number
}

function ymd(diasAtras: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - diasAtras)
  return d.toISOString().slice(0, 10)
}

/** Saca el slug de una URL de artículo; null si no lo es. */
export function slugDeUrl(url: string): string | null {
  const m = url.match(/\/noticias\/([^/?#]+)/)
  if (!m) return null
  try { return decodeURIComponent(m[1]) } catch { return m[1] }
}

const ARTICULOS_POR_SLUG = `*[_type == "article"
  && slug.current in $slugs
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))${REPORTAJE_GROQ_FILTER}
]{
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "imageUrl": select(defined(headline) => imageUrl, null),
  image,
  sport,
  "category": select(defined(headline) => competition, category)
}`

async function pedir(limite: number): Promise<MostReadArticle[]> {
  let token: string | null = null
  try {
    token = (await getOauthAccessToken()) ?? (await getServiceAccountToken([WEBMASTERS_SCOPE]))
  } catch { return [] }
  if (!token) return []

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let filas: Array<{ keys?: string[]; clicks: number }> = []
  try {
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ startDate: ymd(9), endDate: ymd(3), dimensions: ['page'], rowLimit: 25 }),
        signal: ctrl.signal,
      },
    )
    if (!res.ok) return []
    filas = ((await res.json()) as { rows?: typeof filas }).rows ?? []
  } catch { return [] } finally { clearTimeout(t) }

  // Orden de Google = orden por clics. Se conserva.
  const porSlug = new Map<string, number>()
  for (const f of filas) {
    const slug = slugDeUrl(f.keys?.[0] ?? '')
    if (slug && !porSlug.has(slug)) porSlug.set(slug, f.clicks)
  }
  if (porSlug.size === 0) return []

  // Resolver contra Sanity: si un artículo se despublicó, desaparece del bloque
  // en vez de dejar un enlace a un 404.
  // Import perezoso: `sanity.ts` crea el cliente al cargarse y exige las
  // variables del proyecto, así que importarlo arriba haría que este módulo no
  // se pueda ni cargar en los tests (ni en cualquier contexto sin esas vars)
  // solo para usar el helper puro de slugs.
  const { sanityClient } = await import('./sanity')
  const docs = await sanityClient
    .fetch<Array<Omit<MostReadArticle, 'clicks'>>>(ARTICULOS_POR_SLUG, { slugs: [...porSlug.keys()] })
    .catch(() => [] as Array<Omit<MostReadArticle, 'clicks'>>)

  const vivos = new Map(docs.filter(d => d?.slug && d?.title).map(d => [d.slug, d]))
  const salida: MostReadArticle[] = []
  for (const [slug, clicks] of porSlug) {
    const doc = vivos.get(slug)
    if (doc) salida.push({ ...doc, clicks })
    if (salida.length >= limite) break
  }
  return salida
}

/**
 * Cacheado 6 h: los datos de Search Console solo cambian una vez al día, y sin
 * caché esto metería una llamada de red de hasta 8 s en el render de páginas
 * que hoy se sirven de CDN.
 */
export const getMostRead = unstable_cache(
  async (limite = 5) => pedir(limite),
  ['mas-leidas-gsc'],
  { revalidate: 21600, tags: ['mas-leidas'] },
)
