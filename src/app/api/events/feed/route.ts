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
import { attachH2HNotes } from '@/lib/h2h-notes'
import { attachAthletePhotos } from '@/lib/athlete-photos-attach'
import { filterFromDay } from '@/lib/calendar-initial-window'

export const revalidate = 300

export async function GET(req: Request) {
  const events = await fetchEspnEvents()
  // Historial en una línea para los cruces con motivo de tabla (unas pocas
  // consultas cacheadas). Se hace AQUÍ y no en fetchEspnEvents para que el lib
  // de ESPN no dependa de Supabase; el SSR del calendario llama a lo mismo.
  await attachH2HNotes(events)
  // Cara del tenista/luchador desde NUESTRA caché resuelta (Wikimedia): manda
  // sobre el headshot de ESPN y sobre la lista estática.
  await attachAthletePhotos(events)
  // `?from=YYYY-MM-DD` devuelve solo desde ese día. Lo usa el calendario web,
  // que ya trae los días cercanos pintados en el HTML y solo necesita el resto:
  // sin el corte, la página bajaba de 120 a 69 KB pero el feed entero añadía
  // otros 63 y la sesión acababa descargando MÁS que antes. Sin el parámetro
  // devuelve todo, que es lo que sigue pidiendo la app.
  const from = new URL(req.url).searchParams.get('from')
  const salida = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? filterFromDay(events, from) : events
  return NextResponse.json(
    { events: salida },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}
