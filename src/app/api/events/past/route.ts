// GET /api/events/past
// Búsqueda paginada de resultados pasados (Supabase).
// Si Supabase no está configurado, hace fallback a ESPN (últimos N días) filtrando en memoria.

import { NextResponse } from 'next/server'
import { searchPastEvents, pastEventsConfigured } from '@/lib/past-events'
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

  if (pastEventsConfigured()) {
    const result = await searchPastEvents({ from, to, sport, comp, q, cursor, limit })
    if (result) {
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
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
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
