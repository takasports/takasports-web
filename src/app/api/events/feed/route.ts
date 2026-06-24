// GET /api/events/feed
// Feed de próximos eventos multi-día (hoy + hasta ~21 días vista), mismo origen
// que el calendario web (fetchEspnEvents). Lo consume la APP para poblar sus días
// futuros con scroll infinito: /api/events/upcoming solo cubre el día de hoy
// (ESPN scoreboard sin rango), mientras que este feed pide a ESPN el rango
// completo, así que la app puede mostrar partidos de los próximos días/semanas.
//
// Forma de respuesta { events: SportEvent[] } — idéntica a /api/events/past, para
// que el parser de la app (eventsFrom) y MatchRow rendericen igual que los pasados.

import { NextResponse } from 'next/server'
import { fetchEspnEvents } from '@/lib/espn'

export const revalidate = 300

export async function GET() {
  const events = await fetchEspnEvents()
  return NextResponse.json(
    { events },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}
