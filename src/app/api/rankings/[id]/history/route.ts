// GET /api/rankings/[id]/history?category=jugadores&weeks=12
//
// Devuelve los últimos N snapshots semanales del Índice Taka para una entrada.
// Si Supabase no está configurado o la tabla `ranking_snapshots` aún no existe
// (migración 016 sin aplicar), devuelve [] sin error — el componente cliente
// renderiza solo el sparkline prev→now en ese caso.
//
// Cache HTTP 1h: el dato cambia como mucho una vez por semana tras el ingest.

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
    .from('ranking_snapshots')
    .select('week_start, score, rank, rendimiento, contexto, mediatico, narrativa, editorial_boost')
    .eq('entry_id', id)
    .order('week_start', { ascending: false })
    .limit(weeks)
  if (category) q = q.eq('category', category)

  const { data, error } = await q
  if (error) {
    // Migración no aplicada o RLS — degradar silenciosamente
    return NextResponse.json({ points: [], warning: error.message })
  }

  // Devolver en orden cronológico ascendente para que el chart lo dibuje izquierda→derecha
  const points = (data ?? []).slice().reverse().map(row => ({
    week: row.week_start,
    score: Number(row.score),
    rank: row.rank,
    factors: {
      rendimiento: row.rendimiento !== null ? Number(row.rendimiento) : null,
      contexto:    row.contexto    !== null ? Number(row.contexto)    : null,
      mediatico:   row.mediatico   !== null ? Number(row.mediatico)   : null,
      narrativa:   row.narrativa   !== null ? Number(row.narrativa)   : null,
    },
    editorialBoost: row.editorial_boost !== null ? Number(row.editorial_boost) : null,
  }))

  return NextResponse.json({ points })
}
