// Onces guardados — server-backed (sincroniza web↔app).
//   GET    → lista tus onces guardados (recientes primero).
//   POST   → guarda/actualiza un once { id, name, formation, slots, createdAt?,
//            challengeId?, challengeTitle? }. El id lo genera el cliente, así el
//            mismo once es idéntico en local y servidor.
//   DELETE ?id=… → borra uno tuyo.
//
// Tope de 12 por usuario garantizado por trigger en la BD (migr. 089).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { readJson, apiError } from '@/lib/api-utils'
import { captureException } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'

const FORMATIONS = new Set(['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'])

function configured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

// Un once real tiene 11 huecos (slotId → playerId). Acotamos forma y tamaño
// para que un cliente abusivo no almacene jsonb gigante en sus propias filas.
function slotsValid(slots: Record<string, unknown>): slots is Record<string, string> {
  const keys = Object.keys(slots)
  if (keys.length > 16) return false
  for (const k of keys) {
    if (k.length > 24) return false
    const v = slots[k]
    if (typeof v !== 'string' || v.length > 64) return false
  }
  return true
}

export async function GET(req: NextRequest) {
  if (!configured()) return NextResponse.json({ lineups: [], authed: false })
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ lineups: [], authed: false })
  const { data, error } = await sb
    .from('user_mionce_lineups')
    .select('id, name, formation, slots, created_at, challenge_id, challenge_title')
    .order('created_at', { ascending: false })
  if (error) {
    captureException(error, { route: 'mionce/saved:GET' })
    return apiError('server_error', 500)
  }
  const lineups = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    formation: r.formation as string,
    slots: (r.slots as Record<string, string>) ?? {},
    createdAt: r.created_at as string,
    challengeId: (r.challenge_id as string | null) ?? undefined,
    challengeTitle: (r.challenge_title as string | null) ?? undefined,
  }))
  return NextResponse.json({ lineups, authed: true })
}

interface SaveBody {
  id?: string
  name?: string
  formation?: string
  slots?: Record<string, string>
  createdAt?: string
  challengeId?: string
  challengeTitle?: string
}

export async function POST(req: NextRequest) {
  const parsed = await readJson<SaveBody>(req)
  if ('error' in parsed) return parsed.error
  const b = parsed.data
  try {
    if (!configured()) return apiError('not_configured', 503)
    const { supabase: sb, user } = await supabaseForRequest(req)
    if (!user) return apiError('auth_required', 401)

    if (!b.id || typeof b.id !== 'string' || b.id.length > 64) return apiError('missing_id', 400)
    if (!b.formation || !FORMATIONS.has(b.formation)) return apiError('invalid_formation', 400)
    if (!b.slots || typeof b.slots !== 'object' || Array.isArray(b.slots) || !slotsValid(b.slots))
      return apiError('invalid_slots', 400)

    const name = (typeof b.name === 'string' ? b.name : '').trim().slice(0, 40) || 'Mi once'
    const createdAt =
      typeof b.createdAt === 'string' && !Number.isNaN(new Date(b.createdAt).getTime())
        ? new Date(b.createdAt).toISOString()
        : new Date().toISOString()

    const { error } = await sb.from('user_mionce_lineups').upsert(
      {
        user_id: user.id,
        id: b.id,
        name,
        formation: b.formation,
        slots: b.slots,
        created_at: createdAt,
        challenge_id: b.challengeId ?? null,
        challenge_title: b.challengeTitle ?? null,
      },
      { onConflict: 'user_id,id' },
    )
    if (error) {
      captureException(error, { route: 'mionce/saved:POST' })
      return apiError('server_error', 500)
    }
    return NextResponse.json({ ok: true, id: b.id })
  } catch (e) {
    captureException(e, { route: 'mionce/saved:POST' })
    return apiError('server_error', 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!configured()) return apiError('not_configured', 503)
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return apiError('missing_id', 400)
    const { supabase: sb, user } = await supabaseForRequest(req)
    if (!user) return apiError('auth_required', 401)
    const { error } = await sb.from('user_mionce_lineups').delete().eq('id', id)
    if (error) {
      captureException(error, { route: 'mionce/saved:DELETE' })
      return apiError('server_error', 500)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    captureException(e, { route: 'mionce/saved:DELETE' })
    return apiError('server_error', 500)
  }
}
