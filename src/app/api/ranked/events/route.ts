// GET /api/ranked/events?sport=mundial&status=open
//
// Devuelve ranked_events filtrados por sport. Lectura PÚBLICA (sin auth).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function hasEnv() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(req: NextRequest) {
  if (!hasEnv()) return NextResponse.json({ events: [] })

  const { searchParams } = new URL(req.url)
  const sport  = searchParams.get('sport') ?? 'mundial'
  const status = searchParams.get('status')   // 'open' | 'closed' | 'resolved' | null (all)

  // Cliente SIN cookies (los eventos son públicos, iguales para todos) → la
  // respuesta no depende del usuario y se puede cachear en el CDN.
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )

  let q = sb
    .from('ranked_events')
    .select('id, sport, competition, event_date, team_home, team_away, fighter_a, fighter_b, featured, status, result, meta')
    .eq('sport', sport)
    .order('event_date', { ascending: true })
    .limit(200)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // El cierre de eventos ya iniciados (close_started_ranked_events) lo ejecutan
  // YA los crons sync-mundial (cada 30 min jun/jul) y sync-ufc (cada 15 min en
  // finde), así que este GET ya NO lo llama y puede cachearse. s-maxage 5s sobra
  // para el polling del cliente cada 30s; el paso a "cerrado" tarda como mucho lo
  // que el cron, pero los picks ya se bloquean 60 min antes del evento → el
  // estado "cerrado" es cosmético, no afecta a quién puede pronosticar.
  return NextResponse.json(
    { events: data ?? [] },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
        'CDN-Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
      },
    },
  )
}
