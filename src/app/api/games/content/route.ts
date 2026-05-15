// GET /api/games/content?game=...&period=...
//
// Devuelve el contenido publicado del juego para el periodo solicitado.
// Lectura pública. Cache 60s en CDN.
//
// Si no hay fila publicada, devuelve { payload: null } — el caller (el
// propio juego) debe caer a su catálogo hardcoded como fallback. Esto
// garantiza zero-downtime: el sistema admin es opt-in por juego.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const GAME_IDS = ['quiniela', 'crackquiz', 'mionce', 'sopacracks', 'takagrid', 'strikerrush'] as const
type GameId = typeof GAME_IDS[number]

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const game   = url.searchParams.get('game')
  const period = url.searchParams.get('period')
  if (!game || !period) {
    return NextResponse.json({ error: 'game and period required' }, { status: 400 })
  }
  if (!GAME_IDS.includes(game as GameId)) {
    return NextResponse.json({ error: 'invalid game_id' }, { status: 400 })
  }
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ payload: null, status: 'unconfigured' })
  }

  const sb = await createServerSupabaseClient()
  const { data, error } = await sb
    .from('game_content')
    .select('payload, updated_at')
    .eq('game_id', game)
    .eq('period', period)
    .eq('status', 'published')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    { payload: data?.payload ?? null, updated_at: data?.updated_at ?? null },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  )
}
