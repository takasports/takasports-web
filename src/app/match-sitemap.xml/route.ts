import { fetchEspnEvents, fetchEspnPastEvents } from '@/lib/espn'
import { sanityClient } from '@/lib/sanity'
import { SITE_URL } from '@/lib/constants'
import type { SportEvent } from '@/lib/types'

// Sitemap de FICHAS DE PARTIDO Y EVENTO.
//
// Por qué existe (03/09/2026): `/partido/[ref]` y `/evento/[id]` son las páginas
// con más intención de búsqueda del sitio —"X vs Y", "a qué hora juega X"— y no
// estaban en NINGUNO de los cuatro sitemaps. Google solo podía llegar rastreando
// desde `/calendario`, así que las descubría tarde y muchas nunca.
//
// Van en ruta propia, como news/image/video, en vez de dentro de `sitemap.ts`:
// esas URLs caducan (un partido deja de importar a los pocos días), así que
// quieren su propia ventana y su propio `revalidate` corto, sin arrastrar el
// sitemap grande —que ya hace ocho grupos de consultas— a refrescarse igual de
// rápido.
//
// Ventana: la misma de `calendarDayUrls()` en sitemap.ts (ayer → +14 días) más
// los resultados recientes, que es lo que ESPN sirve y lo que la gente busca.

export const runtime = 'nodejs'
export const revalidate = 3600

const MAX_URLS = 2000

// Los matchRef vienen de ESPN con forma `{deporte}_{liga}_{id}` (ver lib/espn.ts),
// así que en la práctica son [a-z0-9_.-]. Aun así escapamos: una sola URL con un
// carácter raro dejaría el XML inválido y con él TODO el sitemap.
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function entry(loc: string, lastmod: string, priority: number, freq: string): string {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`
}

function fechaValida(iso: string | undefined, porDefecto: Date): Date {
  if (!iso) return porDefecto
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? porDefecto : d
}

export async function GET() {
  const ahora = new Date()
  const hoy = ahora.toISOString().slice(0, 10)

  // Cada fuente cae por su cuenta: si ESPN falla no queremos perder los eventos
  // de Sanity, ni al revés. Un sitemap corto es mucho mejor que un 500.
  const [proximos, pasados, eventosSanity] = await Promise.all([
    fetchEspnEvents().catch(() => [] as SportEvent[]),
    fetchEspnPastEvents().catch(() => [] as SportEvent[]),
    sanityClient
      .fetch<Array<{ _id: string; date?: string }>>(
        `*[_type == "event" && status in ["programado", "en_vivo"]]{ _id, date }`,
      )
      .catch(() => [] as Array<{ _id: string; date?: string }>),
  ])

  const vistos = new Set<string>()
  const urls: string[] = []

  for (const ev of [...proximos, ...pasados]) {
    if (!ev.matchRef || vistos.has(ev.matchRef)) continue
    vistos.add(ev.matchRef)

    const cuando = fechaValida(ev.isoDate, ahora)
    const mismoDia = cuando.toISOString().slice(0, 10) === hoy

    // Lo de hoy es lo que se busca ahora mismo; lo ya jugado envejece rápido.
    const prioridad = mismoDia ? 0.9 : ev.isPast ? 0.4 : 0.7
    const frecuencia = mismoDia ? 'hourly' : ev.isPast ? 'monthly' : 'daily'

    urls.push(entry(`${SITE_URL}/partido/${ev.matchRef}`, cuando.toISOString(), prioridad, frecuencia))
    if (urls.length >= MAX_URLS) break
  }

  for (const ev of eventosSanity) {
    if (!ev._id || vistos.has(ev._id) || urls.length >= MAX_URLS) continue
    vistos.add(ev._id)
    const cuando = fechaValida(ev.date, ahora)
    urls.push(entry(`${SITE_URL}/evento/${ev._id}`, cuando.toISOString(), 0.6, 'daily'))
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
