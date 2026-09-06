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
import { attachRecentForm } from '@/lib/recent-form-attach'
import { filterFromDay } from '@/lib/calendar-initial-window'

export const revalidate = 300

export async function GET(req: Request) {
  const events = await fetchEspnEvents()
  // Los tres adjuntos van EN PARALELO: cada uno escribe campos distintos del
  // mismo evento (`h2hNote`, `homePhoto`/`awayPhoto`, `homeForm`/`awayForm`) y
  // ninguno lee lo que escriben los otros, así que encadenarlos con `await` solo
  // sumaba esperas. En frío esta ruta tardaba 21 s y la app se rinde a los 15.
  await Promise.all([
    // Historial en una línea para los cruces con motivo de tabla (unas pocas
    // consultas cacheadas). Se hace AQUÍ y no en fetchEspnEvents para que el lib
    // de ESPN no dependa de Supabase; el SSR del calendario llama a lo mismo.
    attachH2HNotes(events),
    // Cara del tenista/luchador desde NUESTRA caché resuelta (Wikimedia): manda
    // sobre el headshot de ESPN y sobre la lista estática.
    attachAthletePhotos(events),
    // Barritas de forma reciente. La web las pinta desde su SSR; por API no salían,
    // así que la app tenía la fila sin ellas. Una consulta agrupada y cacheada.
    attachRecentForm(events),
  ])
  // `?from=YYYY-MM-DD` devuelve solo desde ese día. Lo usa el calendario web,
  // que ya trae los días cercanos pintados en el HTML y solo necesita el resto:
  // sin el corte, la página bajaba de 120 a 69 KB pero el feed entero añadía
  // otros 63 y la sesión acababa descargando MÁS que antes. Sin el parámetro
  // devuelve todo, que es lo que sigue pidiendo la app.
  const from = new URL(req.url).searchParams.get('from')
  const salida = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? filterFromDay(events, from) : events
  return NextResponse.json(
    { events: salida },
    // ⚠️ `stale-while-revalidate` era 600, y por eso el CALENDARIO DE LA APP salía
    // vacío. Con esa ventana, si nadie entraba en 15 minutos la caché caducaba del
    // todo y el siguiente en llegar ESPERABA la respuesta fría entera —21 s
    // medidos— mientras la app se rinde a los 15 y degrada a lista vacía. Con el
    // tráfico actual (unas 3 visitas/hora) esos huecos son constantes de noche.
    // Con un día de ventana ya nadie espera: se sirve lo cacheado al instante y la
    // actualización ocurre por detrás. Lo mantiene fresco el cron de warm-events.
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' } },
  )
}
