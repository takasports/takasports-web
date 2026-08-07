// GET /api/ranked/football/live
//
// Marcadores EN VIVO de los partidos de Ranked Fútbol que están en juego,
// indexados por el id de ranked_events (`fb-espn-<id>`) para que el cliente los
// cruce con sus Fechas. Cacheado 30 s en la CDN: el polling de todos los
// usuarios colapsa en el borde y no machaca a ESPN.
//
// A diferencia del equivalente del Mundial —que interrogaba UN scoreboard fijo,
// el del torneo—, aquí los partidos vivos pueden estar repartidos por varias
// ligas. Se consulta primero la base de datos para saber QUÉ ligas tienen algo
// en juego ahora mismo y solo se piden esas: en una tarde normal son una o dos,
// no las diecinueve del catálogo.

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { RANKED_FOOTBALL_SPORT } from '@/lib/football-ranked'

interface EspnCompetitor { homeAway: string; score?: string | { value: number } }
interface EspnEvent {
  id: string
  competitions?: {
    competitors?: EspnCompetitor[]
    status?: {
      displayClock?: string
      type?: { name?: string; state?: string; shortDetail?: string }
    }
  }[]
}

type EspnStatus = NonNullable<NonNullable<EspnEvent['competitions']>[number]['status']>

function scoreToInt(s: string | { value: number } | undefined): number | null {
  if (s == null) return null
  if (typeof s === 'object' && 'value' in s) return s.value
  const n = parseInt(String(s), 10)
  return Number.isNaN(n) ? null : n
}

function clockLabel(status: EspnStatus | undefined): string | null {
  if (status?.type?.name === 'STATUS_HALFTIME') return 'Descanso'
  return status?.displayClock || status?.type?.shortDetail || null
}

const CACHE_OK   = 'public, s-maxage=30, stale-while-revalidate=60'
const CACHE_FAIL = 'public, s-maxage=15'

function empty(cache = CACHE_FAIL) {
  return NextResponse.json({ live: {} }, { headers: { 'Cache-Control': cache } })
}

export async function GET() {
  const admin = adminSupabase()
  if (!admin) return empty()

  // Ventana de "puede estar jugándose": desde 3 h antes (un partido dura ~2 h
  // con descuento y descanso) hasta 15 min en el futuro.
  const now  = Date.now()
  const from = new Date(now - 3 * 3_600_000).toISOString()
  const to   = new Date(now + 15 * 60_000).toISOString()

  const { data, error } = await admin
    .from('ranked_events')
    .select('meta')
    .eq('sport', RANKED_FOOTBALL_SPORT)
    .neq('status', 'resolved')
    .gte('event_date', from)
    .lte('event_date', to)

  if (error || !data || data.length === 0) return empty(CACHE_OK)

  const slugs = [...new Set(
    data
      .map(r => (r as { meta?: { league_slug?: string } }).meta?.league_slug)
      .filter((s): s is string => !!s),
  )]
  if (slugs.length === 0) return empty(CACHE_OK)

  const today = new Date(now).toISOString().slice(0, 10).replace(/-/g, '')
  const live: Record<string, { home: number | null; away: number | null; clock: string | null }> = {}

  const results = await Promise.allSettled(slugs.map(async slug => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${slug}/scoreboard?dates=${today}&limit=100`
    const res = await fetch(url, { next: { revalidate: 30 }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return [] as EspnEvent[]
    const json = await res.json() as { events?: EspnEvent[] }
    return json.events ?? []
  }))

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const ev of r.value) {
      const comp = ev.competitions?.[0]
      if (comp?.status?.type?.state !== 'in') continue   // solo en curso
      const home = comp.competitors?.find(c => c.homeAway === 'home')
      const away = comp.competitors?.find(c => c.homeAway === 'away')
      live[`fb-espn-${ev.id}`] = {
        home:  scoreToInt(home?.score),
        away:  scoreToInt(away?.score),
        clock: clockLabel(comp.status),
      }
    }
  }

  return NextResponse.json({ live }, { headers: { 'Cache-Control': CACHE_OK } })
}
