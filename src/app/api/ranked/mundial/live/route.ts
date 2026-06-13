// GET /api/ranked/mundial/live
// Marcadores EN VIVO del Mundial 2026 desde ESPN. Devuelve SOLO los partidos
// en curso (status.type.state === 'in'), con el marcador parcial + reloj,
// indexados por el id de ranked_events (wc26-espn-<id>) para que el cliente
// los cruce con sus eventos. Cacheado 30 s en la CDN: el polling de los
// usuarios colapsa en el borde y no machaca a ESPN.

import { NextResponse } from 'next/server'

const WC_START = '20260611'
const WC_END   = '20260726'

interface EspnCompetitor {
  homeAway: string
  score?:   string | { value: number }
}
interface EspnEvent {
  id: string
  competitions?: {
    competitors?: EspnCompetitor[]
    status?: {
      displayClock?: string
      type?: { name?: string; state?: string; shortDetail?: string; detail?: string }
    }
  }[]
}

function scoreToInt(s: string | { value: number } | undefined): number | null {
  if (s == null) return null
  if (typeof s === 'number') return s
  if (typeof s === 'object' && 'value' in s) return s.value
  const n = parseInt(String(s), 10)
  return isNaN(n) ? null : n
}

type EspnStatus = NonNullable<NonNullable<EspnEvent['competitions']>[number]['status']>

// Reloj legible en español: descanso, o el minuto que da ESPN.
function clockLabel(status: EspnStatus | undefined): string | null {
  if (status?.type?.name === 'STATUS_HALFTIME') return 'Descanso'
  return status?.displayClock || status?.type?.shortDetail || null
}

const CACHE_OK = 'public, s-maxage=30, stale-while-revalidate=60'

export async function GET() {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${WC_START}-${WC_END}&limit=200`
  try {
    const res = await fetch(url, { next: { revalidate: 30 }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      return NextResponse.json({ live: {} }, { headers: { 'Cache-Control': 'public, s-maxage=15' } })
    }
    const json = (await res.json()) as { events?: EspnEvent[] }
    const live: Record<string, { home: number | null; away: number | null; clock: string | null }> = {}
    for (const ev of json.events ?? []) {
      const comp = ev.competitions?.[0]
      if (!comp) continue
      if (comp.status?.type?.state !== 'in') continue // solo partidos en curso
      const home = comp.competitors?.find(c => c.homeAway === 'home')
      const away = comp.competitors?.find(c => c.homeAway === 'away')
      live[`wc26-espn-${ev.id}`] = {
        home:  scoreToInt(home?.score),
        away:  scoreToInt(away?.score),
        clock: clockLabel(comp.status),
      }
    }
    return NextResponse.json({ live }, { headers: { 'Cache-Control': CACHE_OK } })
  } catch {
    return NextResponse.json({ live: {} }, { headers: { 'Cache-Control': 'public, s-maxage=15' } })
  }
}
