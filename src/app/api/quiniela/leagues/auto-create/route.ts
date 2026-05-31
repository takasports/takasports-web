// POST /api/quiniela/leagues/auto-create
//
// Onboarding helper: si el user autenticado NO está en ninguna liga
// privada, crea automáticamente una llamada "Mi liga · {nombre}" para
// la jornada activa y se autoinscribe como owner. Devuelve `created:true`
// y los datos de la liga (id + name) para que el cliente pueda surfacear
// el flujo de invitación.
//
// Idempotente: si el user YA tiene al menos una liga, devuelve
// `created:false` con la primera que encuentra. No spamea.
//
// Sin auth → 401. Sin Supabase → 503 (no hace nada en memoria — el
// fallback in-memory de /leagues no tiene sentido para onboarding real).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getQuinielaData } from '../../route'

interface LeagueIdRow { league_id: string }
interface LeagueNameRow { id: string; name: string | null }

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function userDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const md = user.user_metadata ?? {}
  const full = typeof md.full_name === 'string' ? md.full_name : ''
  const display = typeof md.display_name === 'string' ? md.display_name : ''
  const handle = (full || display).trim().split(/\s+/)[0]
  if (handle) return handle.slice(0, 16)
  const emailPart = user.email?.split('@')[0] ?? ''
  return (emailPart || 'jugador').slice(0, 16)
}

export async function POST() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'auth required' }, { status: 401 })
  }

  // 1. ¿Ya tiene liga?
  const { data: existingMember } = await sb
    .from('quiniela_league_members')
    .select('league_id')
    .eq('user_id', user.id)
    .limit(1)
  const existingId = (existingMember as LeagueIdRow[] | null)?.[0]?.league_id
  if (existingId) {
    const { data: leagueRow } = await sb
      .from('quiniela_leagues')
      .select('id, name')
      .eq('id', existingId)
      .maybeSingle<LeagueNameRow>()
    return NextResponse.json({
      created: false,
      league: {
        id: existingId,
        name: leagueRow?.name ?? existingId,
      },
    })
  }

  // 2. Necesitamos la jornada activa y sus match_keys.
  let jornada: string
  let matchKeys: Array<{ home: string; away: string; isoDate?: string; espnId?: string }>
  try {
    const data = await getQuinielaData()
    jornada = data.jornada
    matchKeys = (data.matches ?? []).map((m) => ({
      home: m.home,
      away: m.away,
      isoDate: m.isoDate,
      espnId: m.espnId,
    }))
  } catch {
    return NextResponse.json({ error: 'no active jornada' }, { status: 503 })
  }
  if (matchKeys.length === 0) {
    return NextResponse.json({ error: 'no matches in jornada' }, { status: 503 })
  }

  // 3. Generar ID no colisionado (best-effort, 10 intentos).
  let id = ''
  for (let i = 0; i < 10; i++) {
    const c = genCode()
    const { data: clash } = await sb
      .from('quiniela_leagues')
      .select('id')
      .eq('id', c)
      .maybeSingle()
    if (!clash) { id = c; break }
  }
  if (!id) return NextResponse.json({ error: 'code collision' }, { status: 500 })

  // 4. Crear liga.
  const handle = userDisplayName(user)
  const leagueName = `Liga de ${handle}`
  const { error: leagueErr } = await sb.from('quiniela_leagues').insert({
    id,
    name: leagueName,
    jornada,
    match_keys: matchKeys,
    owner_id: user.id,
  })
  if (leagueErr) {
    return NextResponse.json({ error: leagueErr.message }, { status: 500 })
  }

  // 5. Autoinscribir al owner.
  const { error: memberErr } = await sb.from('quiniela_league_members').insert({
    league_id: id,
    user_id: user.id,
    nickname: handle,
    picks: {},
  })
  if (memberErr) {
    // Rollback best-effort: borra la liga huérfana para no dejar basura.
    await sb.from('quiniela_leagues').delete().eq('id', id)
    return NextResponse.json({ error: memberErr.message }, { status: 500 })
  }

  return NextResponse.json({
    created: true,
    league: { id, name: leagueName },
  })
}
