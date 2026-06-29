// GET /api/mundial/bracket
// Cuadro de eliminatorias del Mundial 2026 servido a la web y a la app móvil.
// Lee ranked_events (sport='mundial') con el cliente anon —datos públicos, sin
// cookies, para no forzar render dinámico— y lo transforma con buildBracket en
// la estructura por rondas (16avos → final). Cacheado 5 min en la CDN: los
// datos solo cambian cuando se resuelve un partido.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildBracket, type Bracket, type BracketSourceEvent } from '@/lib/mundial-bracket'

const CACHE_OK = 'public, s-maxage=300, stale-while-revalidate=600'
const EMPTY: Bracket = { rounds: [], resolvedCount: 0, totalCount: 0, hasStarted: false }

export async function GET() {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )
    const { data, error } = await sb
      .from('ranked_events')
      .select('id, event_date, team_home, team_away, status, result')
      .eq('sport', 'mundial')
      .order('event_date', { ascending: true })
      .limit(200)

    if (error || !data) {
      return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'public, s-maxage=30' } })
    }

    const bracket = buildBracket(data as BracketSourceEvent[])
    return NextResponse.json(bracket, { headers: { 'Cache-Control': CACHE_OK } })
  } catch {
    return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'public, s-maxage=30' } })
  }
}
