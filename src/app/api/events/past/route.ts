// GET /api/events/past
// Búsqueda paginada de resultados pasados (Supabase).
// Si Supabase no está configurado, hace fallback a ESPN (últimos N días) filtrando en memoria.

import { NextResponse } from 'next/server'
import { searchPastEvents, pastEventsConfigured } from '@/lib/past-events'
import { conTopeValor } from '@/lib/enriquecer-con-tope'
import { fetchEspnPastEvents } from '@/lib/espn'
import type { SportEvent } from '@/lib/types'

export const revalidate = 300

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from   = searchParams.get('from')   || undefined
  const to     = searchParams.get('to')     || undefined
  const sport  = searchParams.get('sport')  || undefined
  const comp   = searchParams.get('comp')   || undefined
  const q      = searchParams.get('q')      || undefined
  const cursor = searchParams.get('cursor') || undefined
  const limit  = Math.min(parseInt(searchParams.get('limit') || '60', 10) || 60, 200)
  // ?live=1 → fuerza la rama ESPN en vivo (incluye tenis y ganador F1/UFC),
  // saltando Supabase. Lo usa el calendario para el rango "10 días".
  const live   = searchParams.get('live') === '1'

  if (!live && pastEventsConfigured()) {
    // Con tope: si Supabase no contesta, se cae a ESPN SIN esperar los 19,4 s que
    // tarda en fallar cuando está caído (06/09/2026). La alternativa ya existía;
    // lo que no existía era llegar a ella a tiempo.
    const result = await conTopeValor(
      'past_events',
      searchPastEvents({ from, to, sport, comp, q, cursor, limit }),
    )
    if (result) {
      return NextResponse.json(result, {
        // ⚠️ La ventana era corta (600-900 s) y, pasada, la caché caducaba del todo: el
        // siguiente en llegar ESPERABA la respuesta fría entera —20-21 s medidos—. La
        // app se rinde a los 15 s y degrada a lista vacía, y por eso el 06/09/2026 no
        // cargaban ni el inicio ni el calendario. Con un día ya nadie espera; lo
        // mantiene fresco el cron `warm-events`.
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' },
      })
    }
    // result === null → tabla no existe o error; caemos al fallback ESPN.
  }

  // Fallback ESPN — solo cubre los últimos ~10 días, sin paginación.
  const all = await fetchEspnPastEvents()
  const term = q?.trim().toLowerCase() ?? ''
  const filtered = all.filter((e: SportEvent) => {
    if (sport && sport !== 'Todo' && e.sport !== sport) return false
    if (comp && e.comp !== comp) return false
    if (from && e.isoDate && e.isoDate < from) return false
    if (to   && e.isoDate && e.isoDate >= to) return false
    if (term) {
      const hay = `${e.home} ${e.away ?? ''} ${e.comp}`.toLowerCase()
      if (!hay.includes(term)) return false
    }
    return true
  })
  return NextResponse.json({ events: filtered.slice(0, limit), nextCursor: null }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' },
  })
}
