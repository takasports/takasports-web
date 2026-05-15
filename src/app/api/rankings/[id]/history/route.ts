// GET /api/rankings/[id]/history?category=jugadores&weeks=12
//
// Devuelve los ultimos N snapshots semanales del Indice Taka para una entrada,
// desde la tabla `ranking_score_history`. Si la migracion no esta aplicada o
// Supabase no esta configurado, devuelve [] sin error.
//
// Cache HTTP 1h.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 3600

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(req.url)
  const category = url.searchParams.get('category') ?? ''
  const weeks = Math.min(52, Math.max(2, Number(url.searchParams.get('weeks') ?? 12)))

  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
  if (!supabaseConfigured()) return NextResponse.json({ points: [] })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  let q = sb
    .from('ranking_score_history')
    .select('week_start, score, rank')
    .eq('entry_id', id)
    .order('week_start', { ascending: false })
    .limit(weeks)
  if (category) q = q.eq('category', category)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ points: [], warning: error.message })
  }

  // Orden cronologico ascendente para el chart (izquierda -> derecha)
  const points = (data ?? []).slice().reverse().map(row => ({
    week: row.week_start,
    score: Number(row.score),
    rank: row.rank,
  }))

  return NextResponse.json({ points })
}
