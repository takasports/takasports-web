// PATCH /api/quiniela/leagues/[id]/settings
//
// Cambia los settings de una liga privada. Hoy solo expone `exactEnabled`
// (AD), pero el endpoint queda preparado para añadir más toggles a futuro.
//
// Validaciones:
//   · Auth: user con sesión (401 si no).
//   · Ownership: el user debe ser owner_id de la liga (403 si no).
//   · No-cambio-en-jornada: si algún miembro de la liga ya selló picks
//     en la jornada activa (quiniela_picks con staked=true), bloqueamos
//     el cambio (409). Evita manipulación mid-torneo.
//
// Body (JSON): { exactEnabled: boolean }
// Response: { ok: true, league: { id, name, exactEnabled } }

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getQuinielaData } from '@/app/api/quiniela/route'

interface PatchBody {
  exactEnabled?: unknown
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const { id: rawId } = await params
  const leagueId = String(rawId ?? '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(leagueId)) {
    return NextResponse.json({ error: 'invalid league id' }, { status: 400 })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  let body: PatchBody
  try { body = await req.json() as PatchBody } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (typeof body.exactEnabled !== 'boolean') {
    return NextResponse.json({ error: 'exactEnabled must be boolean' }, { status: 400 })
  }
  const exactEnabled = body.exactEnabled

  // 1. Cargar la liga + verificar ownership.
  const { data: league } = await sb
    .from('quiniela_leagues')
    .select('id, name, owner_id, exact_enabled')
    .eq('id', leagueId)
    .maybeSingle<{ id: string; name: string | null; owner_id: string | null; exact_enabled: boolean | null }>()
  if (!league) return NextResponse.json({ error: 'league not found' }, { status: 404 })
  if (league.owner_id !== user.id) {
    return NextResponse.json({ error: 'only the owner can change settings' }, { status: 403 })
  }

  // No-op si el valor ya es el actual.
  if (league.exact_enabled === exactEnabled) {
    return NextResponse.json({
      ok: true,
      league: { id: league.id, name: league.name, exactEnabled: league.exact_enabled },
    })
  }

  // 2. ¿Hay jornada activa con picks staked por algún miembro?
  let activeJornada: string | null = null
  try {
    const data = await getQuinielaData()
    activeJornada = data.jornada
  } catch { /* sin jornada activa → permitir cambio */ }

  if (activeJornada) {
    // Cargar miembros de la liga.
    const { data: members } = await sb
      .from('quiniela_league_members')
      .select('user_id')
      .eq('league_id', leagueId)
    const memberIds = (members ?? [])
      .map(r => (r as { user_id?: string }).user_id)
      .filter((id): id is string => !!id)

    if (memberIds.length > 0) {
      // ¿Alguno tiene picks staked en la jornada activa?
      const { data: stakedRows } = await sb
        .from('quiniela_picks')
        .select('user_id', { count: 'exact', head: false })
        .eq('jornada', activeJornada)
        .eq('picks->>staked', 'true')
        .in('user_id', memberIds)
        .limit(1)
      if ((stakedRows ?? []).length > 0) {
        return NextResponse.json(
          {
            error: 'jornada_active',
            detail: 'No se puede cambiar el setting mientras hay miembros con picks sellados en la jornada activa.',
            activeJornada,
          },
          { status: 409 },
        )
      }
    }
  }

  // 3. Aplicar el cambio.
  const { error: updErr } = await sb
    .from('quiniela_leagues')
    .update({ exact_enabled: exactEnabled })
    .eq('id', leagueId)
    .eq('owner_id', user.id) // doble guard contra race con cambio de owner
  if (updErr) {
    return NextResponse.json({ error: 'update_failed', detail: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    league: { id: league.id, name: league.name, exactEnabled },
  })
}
