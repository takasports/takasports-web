import { NextResponse } from 'next/server'
import { matchCompetition, getBroadcastRows } from '@/lib/broadcast'

// GET /api/broadcast?competition=LaLiga
//
// Devuelve las filas "dónde verlo" de una competición, ya verificadas y vigentes.
// El parámetro es texto libre (el mismo que trae matchKickoff.competition), así que
// vale tanto "LaLiga" como "UEFA Champions League" o "Premier League".
//
// La consume la app móvil, que es cliente delgado de esta API. La web no pasa por
// aquí: su página de noticia lee la tabla directamente en el Server Component.
export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('competition') ?? ''
  if (!q.trim()) {
    return NextResponse.json({ error: 'Falta el parámetro competition' }, { status: 400 })
  }

  const key = matchCompetition(q)
  if (!key) {
    // No es un error: esa competición simplemente no está cubierta todavía.
    return NextResponse.json({ competition: null, rows: [] })
  }

  try {
    const rows = await getBroadcastRows(key)
    return NextResponse.json(
      { competition: key, rows },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    )
  } catch {
    return NextResponse.json({ competition: key, rows: [] })
  }
}
