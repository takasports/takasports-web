// GET /api/ranked/events?sport=mundial&status=open
//
// Devuelve ranked_events filtrados por sport. Cierra automáticamente
// los eventos ya iniciados antes de responder.
// No requiere auth — los eventos son públicos.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function hasEnv() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(req: NextRequest) {
  if (!hasEnv()) return NextResponse.json({ events: [] })

  const { searchParams } = new URL(req.url)
  const sport  = searchParams.get('sport') ?? 'mundial'
  const status = searchParams.get('status')   // 'open' | 'closed' | 'resolved' | null (all)

  const sb = await createServerSupabaseClient()

  // Cierra automáticamente partidos ya iniciados hace > 60 min
  try { await sb.rpc('close_started_ranked_events') } catch { /* no-op */ }

  let q = sb
    .from('ranked_events')
    .select('id, sport, competition, event_date, team_home, team_away, fighter_a, fighter_b, featured, status, result, meta')
    .eq('sport', sport)
    .order('event_date', { ascending: true })
    .limit(200)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sin Cache-Control: esta ruta llama a close_started_ranked_events() en cada
  // request. Si Vercel CDN cacheara la respuesta, las peticiones servidas desde
  // caché no ejecutarían el cierre automático, dejando partidos abiertos más tiempo.
  return NextResponse.json({ events: data ?? [] })
}
