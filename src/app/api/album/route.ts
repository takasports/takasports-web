// Álbum de cracks — server-backed (sincroniza web↔app).
//   GET  → lista el álbum del usuario logueado (vacío si no hay sesión).
//   POST → ficha una aparición de un jugador { playerId, source }.
//
// Auth: cookie (web) o Bearer (app), vía supabaseForRequest. La escritura
// va por el RPC `album_collect` (atómico, RLS lo acota al propio usuario).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { readJson, apiError } from '@/lib/api-utils'
import { captureException } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'

function configured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

export async function GET(req: NextRequest) {
  if (!configured()) return NextResponse.json({ entries: [], authed: false })
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ entries: [], authed: false })
  const { data, error } = await sb
    .from('user_album')
    .select('player_id, first_seen, count, sources')
  if (error) {
    captureException(error, { route: 'album:GET' })
    return apiError('server_error', 500)
  }
  const entries = (data ?? []).map((r) => ({
    playerId: r.player_id as string,
    firstSeen: r.first_seen as string,
    count: r.count as number,
    sources: (r.sources as string[]) ?? [],
  }))
  return NextResponse.json({ entries, authed: true })
}

export async function POST(req: NextRequest) {
  const parsed = await readJson<{ playerId?: string; source?: string }>(req)
  if ('error' in parsed) return parsed.error
  const { playerId, source } = parsed.data
  if (!playerId || !source) return apiError('missing_fields', 400)
  try {
    if (!configured()) return apiError('not_configured', 503)
    const { supabase: sb, user } = await supabaseForRequest(req)
    if (!user) return apiError('auth_required', 401)
    const { error } = await sb.rpc('album_collect', { p_player_id: playerId, p_source: source })
    if (error) {
      captureException(error, { route: 'album:POST' })
      return apiError('server_error', 500)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    captureException(e, { route: 'album:POST' })
    return apiError('server_error', 500)
  }
}
