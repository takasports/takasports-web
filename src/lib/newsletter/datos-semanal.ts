// ─────────────────────────────────────────────────────────────────────────────
// Newsletter semanal — de DÓNDE sale cada bloque. Aquí está toda la E/S; la
// elección vive en `semanal.ts` (pura, con tests).
//
// Fuentes (todas gratuitas y las mismas que ya usa la web):
//   · Noticias de la semana ........ Sanity (CDN)
//   · Lo más leído / clics ......... Search Console (lib/most-read)
//   · Partidos de la semana ........ ESPN (lib/espn, ventana de 21 días)
//   · Quién sube en el Ranking ..... ranking_view (lib/rankings-data · getTopMovers)
//   · Liga Taka y Jornada .......... RPC get_jornada_leaderboard / get_ranked_leaderboard
//   · Juego de la semana ........... catálogos estáticos de Mi Once / Sopa de Cracks
//
// Cada bloque va con tope y por separado: si una fuente falla, el bloque sale
// vacío y la plantilla no lo pinta. Solo lectura: nada de aquí escribe.
// ─────────────────────────────────────────────────────────────────────────────

import { conTopeValor } from '@/lib/enriquecer-con-tope'
import { REPORTAJE_GROQ_FILTER } from '@/lib/constants'
import { nombrePorDefecto } from '@/lib/nombre-publico'
import {
  conUtm, diaHoraMadrid, edicionSemanal, elegirDestacadas, elegirPartidosGrandes,
  juegoDeLaSemana, nombreVisible, rangoCorto, resumenUtil,
  type ContenidoSemanal, type FilaClasificacion, type MovimientoCorreo,
  type NoticiaCandidata, type NoticiaCorreo, type PartidoCandidato, type PartidoCorreo,
} from './semanal'

const TOPE_MS = 15_000

interface ArticuloSanity {
  slug: string
  title: string
  summary?: string | null
  sport?: string | null
  competition?: string | null
  type?: string | null
  publishedAt: string
  imageUrl?: string | null
  image?: unknown
}

const NOTICIAS_SEMANA = `*[_type == "article"
  && publishedAt >= $desde
  && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))${REPORTAJE_GROQ_FILTER}
] | order(publishedAt desc)[0...200]{
  "slug": slug.current,
  "title": select(defined(headline) => headline, title),
  "summary": select(defined(headline) => metaDescription, short_summary),
  sport,
  "competition": select(defined(headline) => competition, category),
  type,
  publishedAt,
  "imageUrl": select(defined(headline) => imageUrl, null),
  "image": select(defined(headline) => mainImage, image)
}`

async function imagenDe(a: { imageUrl?: string | null; image?: unknown }): Promise<string | null> {
  if (a.imageUrl && /^https:\/\//.test(a.imageUrl)) return a.imageUrl
  if (!a.image) return null
  try {
    const { urlFor } = await import('@/lib/sanity')
    // 1200 de ancho = 2x del hueco de 600 (pantallas retina), en JPEG: Outlook
    // de escritorio no pinta WebP.
    return urlFor(a.image as never).width(1200).fit('max').format('jpg').quality(80).url()
  } catch {
    return null
  }
}

function aNoticiaCorreo(a: NoticiaCandidata, camp: string, bloque: string): NoticiaCorreo {
  return {
    titulo: a.title,
    resumen: resumenUtil(a.title, a.summary),
    deporte: a.sport ?? null,
    competicion: a.competition ?? null,
    url: conUtm(`/noticias/${encodeURIComponent(a.slug)}`, camp, bloque),
    imagen: a.imagen ?? null,
  }
}

export interface CargaSemanal {
  contenido: ContenidoSemanal
  /** Qué fuentes fallaron o vinieron vacías (para el informe del cron). */
  avisos: string[]
}

export async function cargarContenidoSemanal(
  now: Date = new Date(),
  modo: 'envio' | 'vista' = 'envio',
): Promise<CargaSemanal> {
  const edicion = edicionSemanal(now, modo)
  const camp = edicion.clave
  const avisos: string[] = []
  const ahora = now.getTime()

  // Noticias: desde el lunes de la semana que acaba hasta ahora.
  const desdeNoticias = new Date(edicion.desdeMs - 7 * 86400_000).toISOString()

  const [articulos, leidas, eventos, movers, liga] = await Promise.all([
    conTopeValor(
      'newsletter:sanity',
      import('@/lib/sanity').then(({ sanityClient }) =>
        sanityClient.fetch<ArticuloSanity[]>(NOTICIAS_SEMANA, { desde: desdeNoticias })),
      TOPE_MS,
    ),
    conTopeValor('newsletter:search-console', import('@/lib/most-read').then(m => m.fetchMostReadUncached(15)), TOPE_MS),
    conTopeValor('newsletter:espn', import('@/lib/espn').then(m => m.fetchEspnEvents()), 30_000),
    conTopeValor('newsletter:ranking', import('@/lib/rankings-data').then(m => m.getTopMovers(3)), TOPE_MS),
    conTopeValor('newsletter:liga-taka', cargarLigaTaka(edicion.lunesAnterior, edicion.lunes, camp), TOPE_MS),
  ])

  // ── Lo más leído (Search Console) y clics por slug
  const leidasOk = leidas ?? []
  if (!leidas) avisos.push('search_console_sin_respuesta')
  else if (leidasOk.length === 0) avisos.push('search_console_vacio')
  const clics = new Map(leidasOk.map(a => [a.slug, a.clicks]))
  const masLeidasArt = leidasOk.slice(0, 5)
  const masLeidas: NoticiaCorreo[] = masLeidasArt.map(a => aNoticiaCorreo({
    slug: a.slug, title: a.title, sport: a.sport, competition: a.category, publishedAt: '',
  }, camp, 'mas-leidas'))
  const { ventanaMasLeidas } = await import('@/lib/most-read')
  const v = ventanaMasLeidas(now)
  const masLeidasVentana = masLeidas.length ? rangoCorto(v.desde, v.hasta) : null

  // ── Destacadas por deporte
  if (!articulos) avisos.push('sanity_sin_respuesta')
  const candidatas: NoticiaCandidata[] = (articulos ?? [])
    .filter(a => a?.slug && a?.title && a.publishedAt)
    .map(a => ({ ...a, imagen: null }))
  const elegidas = elegirDestacadas(candidatas, {
    clics, excluir: new Set(masLeidasArt.map(a => a.slug)), ahora, n: 5,
  })
  // Solo la apertura lleva foto.
  if (elegidas[0]) {
    const original = (articulos ?? []).find(a => a.slug === elegidas[0].slug)
    elegidas[0] = { ...elegidas[0], imagen: original ? await imagenDe(original) : null }
  }
  const destacadas = elegidas.map(a => aNoticiaCorreo(a, camp, 'destacadas'))

  // ── Partidos grandes de la semana que empieza
  if (!eventos) avisos.push('espn_sin_respuesta')
  const candidatosP: PartidoCandidato[] = (eventos ?? []).map(e => ({
    id: e.id, home: e.home, away: e.away, sport: e.sport, comp: e.comp,
    isoDate: e.isoDate, stage: e.stage, isPast: e.isPast, matchRef: e.matchRef,
    broadcast: e.broadcast,
  }))
  const sinHora = new Set((eventos ?? []).filter(e => e.timeTbd).map(e => e.id))
  const partidos: PartidoCorreo[] = elegirPartidosGrandes(candidatosP, edicion.desdeMs, edicion.hastaMs, 6)
    .map(p => {
      const { dia, hora } = diaHoraMadrid(p.isoDate, sinHora.has(p.id))
      const ruta = p.matchRef
        ? `/partido/${encodeURIComponent(p.matchRef)}`
        : `/calendario/dia/${p.isoDate.slice(0, 10)}`
      return {
        dia, hora, comp: p.comp, sport: p.sport,
        titulo: p.away ? `${p.home} – ${p.away}` : p.home,
        motivo: p.motivo,
        canal: p.broadcast ?? null,
        url: conUtm(ruta, camp, 'partidos'),
      }
    })
  if (eventos && partidos.length === 0) avisos.push('sin_partidos_en_la_semana')

  // ── Ranking Taka
  if (!movers) avisos.push('ranking_sin_respuesta')
  const movimientos: MovimientoCorreo[] = (movers?.movers ?? []).map(m => ({
    nombre: m.name,
    detalle: m.trendReason || m.subtitle || '',
    bandera: m.country ?? null,
    score: m.score,
    delta: m.delta,
    url: conUtm(`/rankings/${encodeURIComponent(m.id)}`, camp, 'ranking'),
  }))

  // ── Liga Taka
  if (!liga) avisos.push('liga_taka_sin_respuesta')
  const ligaTaka = liga ?? {
    jornada: [], jornadaParticipantes: 0, general: [], abierta: null,
  }

  // ── Juego de la semana
  const juego = await cargarJuego(edicion.semanaISO, camp)

  return {
    contenido: {
      edicion,
      generadoEn: now.toISOString(),
      destacadas,
      masLeidas,
      masLeidasVentana,
      partidos,
      movimientos,
      ligaTaka: {
        ...ligaTaka,
        jornadaUrl: conUtm('/predicciones', camp, 'liga-taka'),
        generalUrl: conUtm('/liga-taka', camp, 'liga-taka'),
      },
      juego,
    },
    avisos,
  }
}

interface FilaRpc {
  user_id: string
  display_name: string | null
  total_points: number
  hits?: number
  played?: number
  rank: number
}

async function cargarLigaTaka(semanaAnterior: string, semanaNueva: string, camp: string): Promise<{
  jornada: FilaClasificacion[]
  jornadaParticipantes: number
  general: FilaClasificacion[]
  abierta: { partidos: number; estrella: string | null; url: string } | null
}> {
  const { adminSupabase } = await import('@/lib/supabase-admin')
  const sb = adminSupabase()
  if (!sb) throw new Error('supabase_no_configurado')

  const aFila = (r: FilaRpc): FilaClasificacion => ({
    userId: r.user_id,
    nombre: nombreVisible(r.display_name, nombrePorDefecto(r.user_id)),
    puntos: Number(r.total_points) || 0,
    aciertos: r.hits != null ? Number(r.hits) : undefined,
    jugados: r.played != null ? Number(r.played) : undefined,
    puesto: Number(r.rank),
  })

  const [jornada, general, nueva] = await Promise.all([
    sb.rpc('get_jornada_leaderboard', { p_week_key: semanaAnterior, p_limit: 100 }),
    sb.rpc('get_ranked_leaderboard', { p_sport: null, p_limit: 3 }),
    sb.from('ranked_events')
      .select('team_home,team_away,featured,event_date')
      .eq('sport', 'football')
      .eq('meta->>week_key', semanaNueva)
      .order('event_date', { ascending: true }),
  ])

  const filasJ = ((jornada.data ?? []) as FilaRpc[])
  const filasG = ((general.data ?? []) as FilaRpc[]).filter(r => Number(r.total_points) > 0)
  const partidosNueva = (nueva.data ?? []) as Array<{ team_home: string | null; team_away: string | null; featured: boolean | null }>
  const estrella = partidosNueva.find(p => p.featured) ?? partidosNueva[0]

  return {
    jornada: filasJ.slice(0, 5).map(aFila),
    jornadaParticipantes: filasJ.length,
    general: filasG.slice(0, 3).map(aFila),
    abierta: partidosNueva.length
      ? {
          partidos: partidosNueva.length,
          estrella: estrella?.team_home && estrella?.team_away ? `${estrella.team_home} – ${estrella.team_away}` : null,
          url: conUtm('/predicciones', camp, 'jornada'),
        }
      : null,
  }
}

async function cargarJuego(semanaISO: string, camp: string): Promise<ContenidoSemanal['juego']> {
  const id = juegoDeLaSemana(semanaISO)
  if (id === 'mionce') {
    const { getChallengeForWeek } = await import('@/lib/mionce-challenges')
    const reto = getChallengeForWeek(semanaISO)
    const clubes = reto?.slotTags ? [...new Set(Object.values(reto.slotTags).map(t => t.label))] : []
    const lista = clubes.length > 4 ? `${clubes.slice(0, 4).join(', ')} y ${clubes.length - 4} más` : clubes.join(', ')
    return {
      id,
      nombre: 'Mi Once',
      titulo: reto?.title ?? 'Un once, once clubes',
      descripcion: lista
        ? `Un jugador por puesto, cada uno de un club. Esta semana: ${lista}. ¿Lo completas sin repetir?`
        : (reto?.description ?? 'Arma el once de la semana.'),
      url: conUtm('/mionce', camp, 'juego'),
    }
  }
  const { getWeeklyPuzzle } = await import('@/lib/sopa-puzzles')
  const sopa = getWeeklyPuzzle(semanaISO)
  return {
    id,
    nombre: 'Sopa de Cracks',
    titulo: sopa.title,
    descripcion: `${sopa.subtitle}. ${sopa.words.length} nombres escondidos${sopa.intruder ? ' y un intruso que da puntos extra' : ''}.`,
    url: conUtm('/sopa-cracks', camp, 'juego'),
  }
}
