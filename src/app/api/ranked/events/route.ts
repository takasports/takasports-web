// GET /api/ranked/events?sport=futbol&status=open
//
// Devuelve ranked_events filtrados por sport. Lectura PÚBLICA (sin auth).
//
// A diferencia del leaderboard, aquí el deporte es OBLIGATORIO: un listado de
// eventos que mezclara fútbol y UFC no lo sabe pintar ningún cliente. Sin
// deporte reconocible se devuelve vacío, nunca "todo".

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/api-utils'
import { normalizeRankedSport } from '@/lib/ranked-sports'

function hasEnv() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(req: NextRequest) {
  if (!hasEnv()) return NextResponse.json({ events: [] })

  const { searchParams } = new URL(req.url)
  const sport  = normalizeRankedSport(searchParams.get('sport') ?? 'football')
  const status = searchParams.get('status')   // 'open' | 'closed' | 'resolved' | null (all)

  if (!sport) return NextResponse.json({ events: [] })

  // Cliente SIN cookies (los eventos son públicos, iguales para todos) → la
  // respuesta no depende del usuario y se puede cachear en el CDN.
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )

  // ── El tope se aplica por el extremo VIEJO, nunca por el futuro ────────────
  // Antes esto pedía los 200 PRIMEROS por fecha ascendente. Con un torneo
  // cerrado de 104 partidos daba igual, pero `ranked_events` acumula temporada
  // tras temporada: en cuanto un deporte pasa de 200 filas, el tope empieza a
  // recortar por el final —es decir, por los eventos FUTUROS— y desaparecen del
  // cliente mientras el cron los sigue publicando tan campante. Sin error y sin
  // log: la sección simplemente se queda sin nada que pronosticar.
  //
  // Ya estaba ocurriendo: UFC tenía 210 filas y diez combates de UFC 331 y una
  // Fight Night (19-sep a 18-oct) no llegaban a la web. Ranked Fútbol habría
  // caído en lo mismo hacia finales de septiembre.
  //
  // Pidiendo los más RECIENTES y devolviéndolos en orden ascendente, el recorte
  // se lleva historia antigua —que a nadie le bloquea— y jamás lo que queda por
  // jugar. El contrato de la respuesta no cambia: sigue saliendo cronológica.
  const LIMIT = 300

  let q = sb
    .from('ranked_events')
    .select('id, sport, competition, event_date, team_home, team_away, fighter_a, fighter_b, featured, status, result, meta')
    .eq('sport', sport)
    .order('event_date', { ascending: false })
    .limit(LIMIT)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return apiError('server_error', 500)

  const events = (data ?? []).slice().reverse()

  // El cierre de eventos ya iniciados (close_started_ranked_events) lo ejecutan
  // YA los crons sync-mundial (cada 30 min jun/jul) y sync-ufc (cada 15 min en
  // finde), así que este GET ya NO lo llama y puede cachearse. s-maxage 5s sobra
  // para el polling del cliente cada 30s; el paso a "cerrado" tarda como mucho lo
  // que el cron, pero los picks ya se bloquean 60 min antes del evento → el
  // estado "cerrado" es cosmético, no afecta a quién puede pronosticar.
  return NextResponse.json(
    { events },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
        'CDN-Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
      },
    },
  )
}
