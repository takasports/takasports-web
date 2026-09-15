// GET /api/search/matches?q=…
//
// Búsqueda de PARTIDOS por nombre de equipo o competición, para el buscador de
// la app. Hasta el 15/09/2026 el buscador global encontraba noticias, jugadores,
// equipos y fichas del Índice, pero NO partidos — y el calendario es la sección
// con más uso de Taka. La única forma de buscar un partido era entrar a
// Calendario y usar su buscador interno, que solo filtra lo que ya estás viendo.
//
// Mira a los DOS lados del presente:
//   · próximos  → `fetchEspnEvents()`, el mismo feed del calendario (hoy + ~21 días)
//   · pasados   → `searchPastEvents`, que YA aceptaba `q` (lo usa /api/events/past)
//
// Devuelve una lista FLACA a propósito: el feed completo son ~495 KB y aquí solo
// hacen falta los campos de una fila de resultado. Ordena por cercanía a AHORA,
// que es lo que se busca: el partido de esta tarde antes que el de dentro de tres
// semanas, y ese antes que el del mes pasado.

import { NextResponse } from 'next/server'
import { fetchEspnEvents } from '@/lib/espn'
import { searchPastEvents, pastEventsConfigured } from '@/lib/past-events'
import { conTopeValor } from '@/lib/enriquecer-con-tope'
import type { SportEvent } from '@/lib/types'

export const maxDuration = 30
export const revalidate = 300

export interface MatchHit {
  id: string
  /** Ruta de la ficha: `{deporte}_{liga}_{idEspn}`. Sin esto la fila no lleva a ningún sitio. */
  matchRef?: string
  home: string
  away: string | null
  comp: string
  sport: string
  isoDate?: string
  time: string
  homeLogo?: string
  awayLogo?: string
  homeScore?: number | null
  awayScore?: number | null
  /** `true` si ya se jugó: la fila enseña marcador en vez de hora. */
  jugado: boolean
}

function normaliza(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** ¿Alguna palabra del equipo o la competición EMPIEZA por lo buscado?
 *
 *  Misma regla de dos bandas que el buscador de jugadores: buscar «madrid» tiene
 *  que traer Real Madrid y Atlético, no un Colo-Colo cuyo estadio contiene esas
 *  letras por dentro. Se comprueba palabra a palabra para que «real» encuentre
 *  «Real Sociedad» y «bayer» encuentre «Bayer Leverkusen». */
function coincide(e: SportEvent, termino: string): boolean {
  const campos = [e.home, e.away ?? '', e.comp]
  return campos.some((campo) =>
    normaliza(campo)
      .split(/[\s.\-/]+/)
      .some((palabra) => palabra.startsWith(termino)),
  )
}

function aHit(e: SportEvent, jugado: boolean): MatchHit {
  return {
    id: e.id,
    matchRef: e.matchRef,
    home: e.home,
    away: e.away,
    comp: e.comp,
    sport: e.sport,
    isoDate: e.isoDate,
    time: e.time,
    homeLogo: e.homeLogo,
    awayLogo: e.awayLogo,
    homeScore: e.homeScore ?? null,
    awayScore: e.awayScore ?? null,
    jugado,
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ matches: [] })
  const termino = normaliza(q)

  // Las dos fuentes en paralelo. La de pasados va CON TOPE: si Supabase está
  // caído tarda 19,4 s en fallar (medido el 06/09/2026) y el buscador entero se
  // quedaría esperando por una mitad de los resultados.
  const [proximosRes, pasadosRes] = await Promise.allSettled([
    fetchEspnEvents(),
    pastEventsConfigured()
      ? conTopeValor('past_events_search', searchPastEvents({ q, limit: 20 }))
      : Promise.resolve(null),
  ])

  const proximos: MatchHit[] =
    proximosRes.status === 'fulfilled'
      ? proximosRes.value.filter((e) => coincide(e, termino)).map((e) => aHit(e, false))
      : []

  const pasados: MatchHit[] =
    pasadosRes.status === 'fulfilled' && pasadosRes.value
      ? ((pasadosRes.value as { events?: SportEvent[] }).events ?? []).map((e) => aHit(e, true))
      : []

  // Dedupe por matchRef: un partido de HOY que ya terminó puede venir por las dos
  // ramas, y gana la versión pasada porque trae marcador.
  const porRef = new Map<string, MatchHit>()
  for (const m of [...proximos, ...pasados]) {
    const clave = m.matchRef || m.id
    const previo = porRef.get(clave)
    if (!previo || (m.jugado && !previo.jugado)) porRef.set(clave, m)
  }

  const ahora = Date.now()
  const ordenados = [...porRef.values()].sort((a, b) => {
    const ta = a.isoDate ? Math.abs(new Date(a.isoDate).getTime() - ahora) : Number.MAX_SAFE_INTEGER
    const tb = b.isoDate ? Math.abs(new Date(b.isoDate).getTime() - ahora) : Number.MAX_SAFE_INTEGER
    return ta - tb
  })

  return NextResponse.json(
    { matches: ordenados.slice(0, 8) },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' } },
  )
}
