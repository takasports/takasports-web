// Heatmap social por slot para Mi Once: % de la comunidad que colocó a
// cada jugador en cada hueco durante la semana actual. Lo consume el
// ResultModal/sidebar para mostrar comparativa colectiva.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

interface PayloadShape {
  slots?: unknown
  formation?: unknown
}

export async function GET(req: NextRequest) {
  const period = new URL(req.url).searchParams.get('period')
  if (!period || !/^\d{4}-W\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'period (YYYY-Www) required' }, { status: 400 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ period, totalPlays: 0, bySlot: {} })

  const { data, error } = await admin
    .from('game_plays')
    .select('payload')
    .eq('game_id', 'mionce')
    .eq('period', period)
    .limit(5000)

  if (error || !data) {
    return NextResponse.json({ period, totalPlays: 0, bySlot: {}, error: error?.message })
  }

  // bySlot[slotId][playerId] = veces
  const bySlot: Record<string, Record<string, number>> = {}
  let totalPlays = 0
  for (const row of data) {
    const p = (row.payload as PayloadShape | null) ?? null
    const slots = p?.slots
    if (!slots || typeof slots !== 'object') continue
    totalPlays += 1
    for (const [slotId, playerIdRaw] of Object.entries(slots as Record<string, unknown>)) {
      if (typeof playerIdRaw !== 'string' || playerIdRaw.length === 0) continue
      if (typeof slotId !== 'string' || slotId.length === 0) continue
      const slot = bySlot[slotId] ?? (bySlot[slotId] = {})
      slot[playerIdRaw] = (slot[playerIdRaw] ?? 0) + 1
    }
  }

  return NextResponse.json(
    { period, totalPlays, bySlot },
    { headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' } },
  )
}
