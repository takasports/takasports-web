// GET /api/ranked/leaderboard?sport=mundial&limit=50
// Ranking de usuarios por puntos acumulados en un deporte.
// Público — no requiere auth.
//
// Construye el ranking sumando point_transactions por (user_id, sport).
// Devuelve display_name + avatar_url desde profiles.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return NextResponse.json({ entries: [] })
  }

  const { searchParams } = new URL(req.url)
  const sport  = searchParams.get('sport') ?? 'mundial'
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const sb = await createServerSupabaseClient()

  // Agrupa point_transactions por user_id filtrando por sport
  // y une con profiles para display_name + avatar
  const { data, error } = await sb
    .from('point_transactions')
    .select(`
      user_id,
      amount,
      profiles!point_transactions_user_id_fkey (
        display_name,
        avatar_url
      )
    `)
    .eq('sport', sport)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agregar en JS (Supabase no soporta GROUP BY directamente en el client)
  const totals = new Map<string, { user_id: string; display_name: string | null; avatar_url: string | null; total: number }>()
  for (const row of data ?? []) {
    const r = row as { user_id: string; amount?: number; profiles?: { display_name?: string; avatar_url?: string } | null }
    const existing = totals.get(r.user_id)
    const amount = (r as unknown as { amount: number }).amount ?? 0
    if (existing) {
      existing.total += amount
    } else {
      totals.set(r.user_id, {
        user_id:      r.user_id,
        display_name: r.profiles?.display_name ?? null,
        avatar_url:   r.profiles?.avatar_url   ?? null,
        total:        amount,
      })
    }
  }

  const entries = [...totals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  return NextResponse.json({ entries }, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  })
}
