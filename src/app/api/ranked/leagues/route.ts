// GET  /api/ranked/leagues        → ligas donde soy miembro (o dueño)
// POST /api/ranked/leagues        → crear liga privada
//
// Requiere sesión en ambos métodos.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { apiError } from '@/lib/api-utils'
/** Genera un ID aleatorio URL-safe sin dependencias externas */
function genId(len = 10): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len)
}

export const dynamic = 'force-dynamic'

function hasEnv() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

// 'global' NO es un deporte de liga privada: el CreateModal lo filtra (la UI no
// lo ofrece), así que el POST tampoco debe aceptarlo (antes un POST directo
// creaba una "Liga Total" inaccesible desde la interfaz). Solo se usa en el POST.
const VALID_SPORTS = new Set(['mundial', 'ufc', 'futbol'])

// ── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!hasEnv()) return NextResponse.json({ leagues: [] })

  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ leagues: [], reason: 'no_session' })

  // Ligas donde el user es miembro (incluye las que creó, ya que al crear se añade como miembro)
  const { data: memberships } = await sb
    .from('ranked_league_members')
    .select('league_id')
    .eq('user_id', user.id)

  const leagueIds = (memberships ?? []).map((m: { league_id: string }) => m.league_id)
  if (leagueIds.length === 0) return NextResponse.json({ leagues: [] })

  const { data: leagues, error } = await sb
    .from('ranked_leagues')
    .select('id, name, sport, type, owner_id, max_members, invite_code, created_at')
    .in('id', leagueIds)
    .eq('type', 'private')
    .order('created_at', { ascending: false })

  if (error) return apiError('server_error', 500)

  // Para cada liga, contar miembros
  const admin = adminSupabase()
  const leaguesWithCount = await Promise.all(
    (leagues ?? []).map(async (l: Record<string, unknown>) => {
      let memberCount = 0
      if (admin) {
        const { count } = await admin
          .from('ranked_league_members')
          .select('user_id', { count: 'exact', head: true })
          .eq('league_id', l.id)
        memberCount = count ?? 0
      }
      // No exponer owner_id crudo (UUID auth de terceros) — is_owner ya basta.
      const { owner_id, ...rest } = l as { owner_id?: string } & Record<string, unknown>
      return {
        ...rest,
        member_count: memberCount,
        is_owner: owner_id === user.id,
      }
    })
  )

  return NextResponse.json({ leagues: leaguesWithCount })
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!hasEnv()) return NextResponse.json({ error: 'no_config' }, { status: 503 })

  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  let body: { name?: unknown; sport?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const name  = typeof body.name  === 'string' ? body.name.trim()  : ''
  const sport = typeof body.sport === 'string' ? body.sport.trim() : ''

  if (!name || name.length < 3 || name.length > 40) {
    return NextResponse.json({ error: 'invalid_name', message: 'El nombre debe tener entre 3 y 40 caracteres.' }, { status: 400 })
  }
  if (!VALID_SPORTS.has(sport)) {
    return NextResponse.json({ error: 'invalid_sport' }, { status: 400 })
  }

  // Límite: máx 5 ligas activas por user
  const admin = adminSupabase()
  if (admin) {
    const { data: owned } = await admin
      .from('ranked_leagues')
      .select('id', { count: 'exact', head: false })
      .eq('owner_id', user.id)
      .eq('type', 'private')
    if ((owned ?? []).length >= 5) {
      return NextResponse.json({ error: 'league_limit', message: 'Puedes tener como máximo 5 ligas activas.' }, { status: 409 })
    }
  }

  const leagueId   = `rl_${genId(10)}`
  const inviteCode = genId(8).toUpperCase()

  const { data: league, error: createErr } = await sb
    .from('ranked_leagues')
    .insert({
      id:          leagueId,
      name,
      sport,
      type:        'private',
      owner_id:    user.id,
      max_members: 15,
      invite_code: inviteCode,
    })
    .select()
    .single()

  if (createErr) return apiError('server_error', 500)

  // El creador se añade como primer miembro
  await sb.from('ranked_league_members').insert({ league_id: leagueId, user_id: user.id })

  // No exponer owner_id crudo en la respuesta (es el propio user, pero por consistencia).
  const leagueSafe: Record<string, unknown> = { ...league }
  delete leagueSafe.owner_id
  return NextResponse.json({ league: { ...leagueSafe, member_count: 1, is_owner: true } }, { status: 201 })
}
