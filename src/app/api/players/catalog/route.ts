// GET /api/players/catalog → catálogo de jugadores (deduplicado) para el
// buscador de TakaGrid y Mi Once en la app. Única fuente de la verdad: la app
// NO embebe su propio catálogo, lo descarga de aquí y lo cachea. Los ids casan
// con los de validAnswers / validBySlot de /api/takagrid/today y /api/mionce/today.
//
// El catálogo solo cambia con cada deploy → estático + cache larga.

import { NextResponse } from 'next/server'
import { PLAYERS_DEDUP } from '@/lib/players-catalog'

export const dynamic = 'force-static'

export async function GET() {
  const players = PLAYERS_DEDUP.map(p => ({
    id: p.id,
    name: p.name,
    club: p.club,
    altClubs: p.altClubs ?? [],
    country: p.country,
    position: p.position,
    era: p.era,
  }))

  return NextResponse.json(
    { players, count: players.length },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
  )
}
