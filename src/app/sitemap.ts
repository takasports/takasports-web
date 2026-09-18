import type { MetadataRoute } from 'next'
import { sanityClient, allTagsFlatQuery, MIN_TAG_ARTICLES, isJunkTag } from '@/lib/sanity'
import { SLUG_TO_LABEL } from '@/lib/sports'
import { getAllRankingEntries } from '@/lib/rankings-search'
import { getAllEntryIdsFromDb } from '@/lib/rankings-data'
import { SITE_URL, REPORTAJE_GROQ_FILTER, REPORTAJES_ENABLED } from '@/lib/constants'
import { COMPETITIONS } from '@/lib/calendar-competitions'
import { GLOSARIO_TERMS } from '@/lib/glosario-terms'
import { canonicalPlayerSlug } from '@/lib/player-slug'
import { canonicalTeamSlug } from '@/lib/team-slug'
import { adminSupabase } from '@/lib/supabase-admin'
import { esTagIndexable, normalizarTag } from '@/lib/tag-policy'
import { getArchivedDays } from '@/lib/past-events'
import { isPastDay, sitemapDays } from '@/lib/calendar-day-page'
import { fetchEspnEvents } from '@/lib/espn'
import { isoToLocalDate } from '@/lib/calendar'
import { SOURCE_TZ } from '@/lib/timezone'

const BASE_URL = SITE_URL

// Fechas deterministas por sección. Google ignora <lastmod> cuando ve que cambia
// en cada build sin razón. Bumpear estas constantes solo al hacer cambios reales.
const STATIC_LASTMOD = new Date('2026-05-28T00:00:00Z')
const RANKINGS_LASTMOD = new Date('2026-05-28T00:00:00Z')
const SPORT_HUB_FALLBACK_LASTMOD = new Date('2026-05-28T00:00:00Z')
const TAG_LASTMOD = new Date('2026-05-28T00:00:00Z')

// Días del calendario que entran al sitemap (ver /calendario/dia).
//
// Antes se anunciaban 16 (de ayer a +14) mientras la ruta servía 76, y ahora
// sirve también todo el archivo de resultados. Anunciar menos de lo que existe
// deja el archivo sin descubrir: son las URLs con mejor CTR del sitio (3,6% de
// media, 8,1% la mejor) y hasta hoy Google solo veía dos semanas de ellas.
//
// Un día ya jugado NO cambia, así que su `lastModified` es el propio día y su
// `changeFrequency` es 'yearly': marcarlo como diario invita a Google a
// regastar rastreo en páginas congeladas.
/**
 * Días futuros que de verdad tienen partidos, según el mismo feed que pinta el
 * calendario. Se lee de `fetchEspnEvents` a propósito: si el sitemap usara otra
 * fuente podría anunciar un día que la página enseña vacío, que es exactamente
 * la contradicción que venimos a quitar.
 *
 * El coste extra en el build es casi nulo: `/calendario` ya llama a esta misma
 * función y las peticiones a ESPN van con `revalidate`, así que las comparten.
 * Si falla, devuelve un conjunto vacío y `sitemapDays` no recorta nada.
 */
async function diasConPartidos(): Promise<Set<string>> {
  try {
    const dias = new Set<string>()
    for (const e of await fetchEspnEvents()) {
      if (e.isoDate) dias.add(isoToLocalDate(e.isoDate, SOURCE_TZ))
    }
    return dias
  } catch {
    return new Set()
  }
}

async function calendarDayUrls(): Promise<MetadataRoute.Sitemap> {
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const [archived, conPartidos] = await Promise.all([
    getArchivedDays().catch(() => [] as string[]),
    diasConPartidos(),
  ])

  return sitemapDays(todayIso, archived, conPartidos).map((day) => {
    const past = isPastDay(day, todayIso)
    return {
      url: `${BASE_URL}/calendario/dia/${day}`,
      lastModified: past ? new Date(`${day}T23:59:59Z`) : today,
      changeFrequency: past ? ('yearly' as const) : ('daily' as const),
      priority: day === todayIso ? 0.8 : past ? 0.5 : 0.6,
    }
  })
}

function mostRecent(items: Array<{ publishedAt?: string; _updatedAt?: string }>): Date {
  let max = 0
  for (const a of items) {
    const t = Math.max(
      a._updatedAt ? Date.parse(a._updatedAt) : 0,
      a.publishedAt ? Date.parse(a.publishedAt) : 0,
    )
    if (t > max) max = t
  }
  return max ? new Date(max) : STATIC_LASTMOD
}

// Player/team detail pages (deep, automated stat pages — high SEO value).
async function statRoutes(): Promise<MetadataRoute.Sitemap> {
  try {
    // Timeout de 20s: durante Roland Garros las fetches a /api/stats/* pueden
    // colgarse >60s y romper el build entero. Si tardan, devolvemos sitemap
    // parcial (sin URLs de equipo/jugador) en lugar de bloquear el deploy.
    // Estas URLs ya se descubren vía crawl normal, así que el coste SEO de
    // omitirlas en un build puntual es mínimo. (fix jun 2026)
    const [standRes, playRes] = await Promise.all([
      fetch(`${BASE_URL}/api/stats/standings`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(20000) }),
      fetch(`${BASE_URL}/api/stats/players`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(20000) }),
    ])
    const teamUrls = new Set<string>()
    const playerUrls = new Set<string>()

    if (standRes.ok) {
      const s = await standRes.json()
      // Slug canónico (nombre + teamId). Un club que juega liga + competición europea
      // salía en dos bloques (esp.1 y uefa.champions) → dos URLs; con el slug nuevo
      // ambas producen la misma cadena y el Set las funde en una. Menos duplicación.
      for (const g of s.football ?? []) {
        if (!g.leagueSlug) continue
        for (const r of g.rows ?? []) if (r.teamId)
          teamUrls.add(`${BASE_URL}/equipo/${canonicalTeamSlug(r.name, r.teamId)}`)
      }
      for (const r of [...(s.nbaEast ?? []), ...(s.nbaWest ?? [])])
        if (r.teamId) teamUrls.add(`${BASE_URL}/equipo/${canonicalTeamSlug(r.name, r.teamId)}`)
    }
    if (playRes.ok) {
      const p = await playRes.json()
      // Slug canónico (nombre + id). El sitemap solo lista la URL canónica: el formato
      // histórico sigue resolviendo, pero declara esta como canonical y no queremos
      // sembrar el índice con las dos.
      const push = (arr: { playerId?: string; name?: string }[] | undefined) => {
        for (const x of arr ?? []) if (x.playerId)
          playerUrls.add(`${BASE_URL}/jugador/${canonicalPlayerSlug(x.name, x.playerId)}`)
      }
      for (const lg of p.leagues ?? []) { push(lg.goals); push(lg.assists) }
      for (const k of Object.keys(p.combined ?? {})) push(p.combined[k])
    }

    return [
      ...[...teamUrls].map(url => ({
        url, lastModified: STATIC_LASTMOD, changeFrequency: 'daily' as const, priority: 0.7,
      })),
      ...[...playerUrls].map(url => ({
        url, lastModified: STATIC_LASTMOD, changeFrequency: 'daily' as const, priority: 0.6,
      })),
    ]
  } catch { return [] }
}

/**
 * Las fichas de jugador NO van al sitemap. Se quitaron el 18/09/2026.
 *
 * Entraron el 31/08/2026 con un argumento razonable: el sitio posiciona nombres
 * de persona y la ficha es perenne donde la noticia caduca. Tres semanas de
 * datos dicen que no funciona, y el precio fue alto.
 *
 *   Search Console, 19/08–15/09/2026, solo /jugador/:
 *     7.212 URLs en el sitemap · 4.930 llegaron a aparecer
 *     53.820 impresiones · 30 clics · 0,06 % · posición media 20,8
 *
 * Treinta clics en cuatro semanas, uno por cada 240 páginas. No es un problema
 * de posición que se arregle empujando más: una búsqueda de nombre la responde
 * Google con su propia ficha, y por encima están Transfermarkt, ESPN y
 * Wikipedia. En el mismo tramo de resultados (puestos 5 a 8) una página de
 * /calendario/dia convierte al 2,59 % y una ficha al 0,12 %.
 *
 * Y el coste: ese rastreo golpeaba /api/jugador/[slug], que hasta el 18/09 no
 * tenía caché, y fue una de las dos causas de que Vercel pausara el proyecto el
 * 17/09 por superar el límite de gasto.
 *
 * Las fichas SIGUEN EXISTIENDO y siguen enlazadas desde los artículos, el
 * buscador y las fichas de partido. Esto no las borra ni las desindexa: deja de
 * empujarle a Google 7.212 URLs que no le interesan a nadie.
 *
 * Y no se va TODO: `statRoutes` sigue publicando los goleadores y asistentes de
 * cada liga —459 fichas hoy—, que son las que tienen demanda de verdad. El
 * sitemap pasa de 7.212 fichas a 459: se queda la lista corta y curada, se va
 * el barrido de la base entera.
 *
 * Lo que sí seguimos necesitando de aquí son los NOMBRES, porque la política de
 * etiquetas los usa: una etiqueta que es el nombre de un jugador con ficha no se
 * indexa, para que no compitan entre ellas. Eso no depende del sitemap.
 */
async function playerNamesForTagPolicy(): Promise<Set<string>> {
  const db = adminSupabase()
  if (!db) return new Set()
  try { return await playerNames(db) } catch { return new Set() }
}

async function playerNames(db: NonNullable<ReturnType<typeof adminSupabase>>): Promise<Set<string>> {
  const nombres = new Set<string>()
  const PAGINA = 1000
  for (let desde = 0; desde < 40_000; desde += PAGINA) {
    const { data, error } = await db
      .from('sport_entities')
      .select('name')
      .eq('type', 'player')
      .not('espn_id', 'is', null)
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error || !data || data.length === 0) break
    for (const r of data as Array<{ name: string }>) if (r.name) nombres.add(normalizarTag(r.name))
    if (data.length < PAGINA) break
  }
  return nombres
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, flatTags, dbIds, stats, nombresDeJugador] = await Promise.all([
    sanityClient.fetch<Array<{ slug: string; publishedAt: string; _updatedAt?: string; sport?: string }>>(
      `*[_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))${REPORTAJE_GROQ_FILTER}] | order(publishedAt desc) {
        "slug": slug.current, publishedAt, _updatedAt, sport
      }`
    ).catch(() => []),
    sanityClient.fetch<string[]>(allTagsFlatQuery).catch(() => [] as string[]),
    getAllEntryIdsFromDb(2000).catch(() => [] as string[]),
    statRoutes(),
    playerNamesForTagPolicy(),
  ])

  // Poda de tags: cuenta cuántos artículos lleva cada tag y conserva en el sitemap
  // solo los que superan el umbral y no son slugs basura. Esto saca ~5.000 URLs
  // finas (frases LLM de un solo uso) que diluían el crawl budget. (Fase 0 SEO)
  const tagCounts = new Map<string, number>()
  for (const raw of flatTags) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim()
    if (!tag) continue
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  }
  // Una etiqueta que ES el nombre de un jugador con ficha no se indexa: la ficha
  // responde mejor esa búsqueda y competían entre ellas.
  const tags = [...tagCounts.entries()]
    .filter(([tag, count]) => esTagIndexable(tag, count, nombresDeJugador.has(normalizarTag(tag))))
    .map(([tag]) => tag)

  const hubLastMod = mostRecent(articles)

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: hubLastMod, changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE_URL}/noticias`, lastModified: hubLastMod, changeFrequency: 'hourly', priority: 0.9 },
    // Reportajes: cambia poco (piezas de fondo, no actualidad) pero pesa en la
    // marca, así que va con prioridad alta y frecuencia semanal. Mientras la
    // sección esté en pausa no se anuncia: la ruta redirige al feed.
    ...(REPORTAJES_ENABLED
      ? [{ url: `${BASE_URL}/reportajes`, lastModified: hubLastMod, changeFrequency: 'weekly' as const, priority: 0.85 }]
      : []),
    { url: `${BASE_URL}/calendario`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/estadisticas`, lastModified: STATIC_LASTMOD, changeFrequency: 'hourly', priority: 0.8 },
    // Una entrada por deporte para que Google indexe cada vista por separado
    // (cada una es una ruta de path /estadisticas/[sport] con su propio título,
    // description, OG image dinámica y canonical; cacheable como ISR).
    { url: `${BASE_URL}/estadisticas/futbol`,     lastModified: STATIC_LASTMOD, changeFrequency: 'hourly',  priority: 0.85 },
    { url: `${BASE_URL}/estadisticas/baloncesto`, lastModified: STATIC_LASTMOD, changeFrequency: 'hourly',  priority: 0.8 },
    { url: `${BASE_URL}/estadisticas/f1`,         lastModified: STATIC_LASTMOD, changeFrequency: 'daily',   priority: 0.75 },
    { url: `${BASE_URL}/estadisticas/tenis`,      lastModified: STATIC_LASTMOD, changeFrequency: 'hourly',  priority: 0.7 },
    { url: `${BASE_URL}/estadisticas/motogp`,     lastModified: STATIC_LASTMOD, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE_URL}/estadisticas/ufc`,        lastModified: STATIC_LASTMOD, changeFrequency: 'weekly',  priority: 0.7 },
    // Mundial 2026: terminó el 19/07/2026. Sigue indexado como archivo, pero pedirle
    // rastreo diario a Google gasta presupuesto que este sitio no tiene de sobra.
    { url: `${BASE_URL}/estadisticas/mundial`,    lastModified: STATIC_LASTMOD, changeFrequency: 'yearly',  priority: 0.4 },
    // League hubs: tabla + goleadores + asistencias en una vista. Incluye las ligas
    // Latam (bra/mex/arg): son indexables y de alto valor para la audiencia
    // hispanohablante, pero faltaban en el sitemap y quedaban huérfanas.
    ...['esp.1', 'eng.1', 'ita.1', 'ger.1', 'fra.1', 'bra.1', 'mex.1', 'arg.1'].map(id => ({
      url: `${BASE_URL}/liga/${id}`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: 'hourly' as const,
      priority: 0.85,
    })),
    { url: `${BASE_URL}/rankings`, lastModified: RANKINGS_LASTMOD, changeFrequency: 'weekly', priority: 0.9 },
    // Predicciones (hub) y Mundial (URL de campaña) — faltaban en el sitemap.
    { url: `${BASE_URL}/predicciones`, lastModified: hubLastMod, changeFrequency: 'daily', priority: 0.85 },
    { url: `${BASE_URL}/mundial`, lastModified: hubLastMod, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/mundial/fixture`, lastModified: hubLastMod, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/juegos`, lastModified: STATIC_LASTMOD, changeFrequency: 'weekly', priority: 0.75 },
    { url: `${BASE_URL}/quiniela`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/crackquiz`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.65 },
    { url: `${BASE_URL}/sopa-cracks`, lastModified: STATIC_LASTMOD, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${BASE_URL}/mionce`, lastModified: STATIC_LASTMOD, changeFrequency: 'weekly', priority: 0.65 },
    { url: `${BASE_URL}/takagrid`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.65 },
    { url: `${BASE_URL}/reels`, lastModified: STATIC_LASTMOD, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/sobre`, lastModified: STATIC_LASTMOD, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contacto`, lastModified: STATIC_LASTMOD, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE_URL}/redes`, lastModified: STATIC_LASTMOD, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/politica-editorial`, lastModified: STATIC_LASTMOD, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE_URL}/autor/redaccion`, lastModified: hubLastMod, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/glosario`, lastModified: STATIC_LASTMOD, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/tag`, lastModified: hubLastMod, changeFrequency: 'daily', priority: 0.5 },
    ...GLOSARIO_TERMS.map((t) => ({
      url: `${BASE_URL}/glosario/${t.slug}`,
      lastModified: new Date(t.updatedAt),
      changeFrequency: 'yearly' as const,
      priority: 0.55,
    })),
    ...COMPETITIONS.map((c) => ({
      url: `${BASE_URL}/calendario/${c.slug}`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: 'daily' as const,
      priority: 0.75,
    })),
    // Páginas de día (/calendario/dia/YYYY-MM-DD): la ventana viva más todo el
    // archivo de resultados. Ver calendarDayUrls.
    ...(await calendarDayUrls()),
  ]

  // Combina entradas estáticas curadas + entradas auto-generadas de DB (top 2000)
  const staticIds = new Set(getAllRankingEntries().map(e => e.id))
  const allRankingIds = [
    ...getAllRankingEntries().map(e => e.id),
    ...dbIds.filter(id => !staticIds.has(id)),
  ].filter(id => !id.startsWith('coach-'))  // entrenadores fuera del ranking → no indexar sus fichas
  const rankingDetailRoutes: MetadataRoute.Sitemap = allRankingIds.map(id => ({
    url: `${BASE_URL}/rankings/${id}`,
    lastModified: RANKINGS_LASTMOD,
    changeFrequency: 'weekly' as const,
    priority: staticIds.has(id) ? 0.7 : 0.55,
  }))

  // lastmod del hub de cada deporte = artículo más reciente de ese deporte
  const sportRoutes: MetadataRoute.Sitemap = Object.keys(SLUG_TO_LABEL).map(slug => {
    const sportArticles = articles.filter(a => a.sport === slug)
    return {
      url: `${BASE_URL}/${slug}`,
      lastModified: sportArticles.length > 0 ? mostRecent(sportArticles) : SPORT_HUB_FALLBACK_LASTMOD,
      changeFrequency: 'hourly' as const,
      priority: 0.85,
    }
  })

  const articleRoutes: MetadataRoute.Sitemap = articles
    .filter(a => a.slug)
    .map(a => ({
      url: `${BASE_URL}/noticias/${a.slug}`,
      lastModified: a._updatedAt
        ? new Date(a._updatedAt)
        : a.publishedAt
          ? new Date(a.publishedAt)
          : STATIC_LASTMOD,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // Paginación del hub /noticias: indexable hasta página 20 (ver noticias/pagina/[n]/page.tsx).
  const PAGE_SIZE = 40
  const totalPages = Math.min(Math.ceil(articles.length / PAGE_SIZE), 20)
  const paginatedHubRoutes: MetadataRoute.Sitemap = Array.from(
    { length: Math.max(totalPages - 1, 0) },
    (_, i) => ({
      url: `${BASE_URL}/noticias/pagina/${i + 2}`,
      lastModified: hubLastMod,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }),
  )

  const tagRoutes: MetadataRoute.Sitemap = (tags as string[])
    .filter(Boolean)
    .map(tag => ({
      url: `${BASE_URL}/tag/${encodeURIComponent(tag)}`,
      lastModified: TAG_LASTMOD,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

  // Deduplicado final por URL. Desde el 18/09/2026 las únicas fichas de jugador
  // que entran son las de `statRoutes` (goleadores y asistentes de cada liga);
  // ver el comentario largo de arriba para por qué se fue el resto.
  const todas = [...staticRoutes, ...sportRoutes, ...rankingDetailRoutes, ...articleRoutes,
                 ...paginatedHubRoutes, ...tagRoutes, ...stats]
  const vistas = new Set<string>()
  return todas.filter(r => !vistas.has(r.url) && vistas.add(r.url))
}
