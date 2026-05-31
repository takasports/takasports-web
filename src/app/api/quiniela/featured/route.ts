// GET  /api/quiniela/featured
//   Devuelve el partido destacado de la jornada actual (el de mayor
//   matchScore, marcado con isFeatured en /api/quiniela), su roster
//   de candidatos a goleador, el pick del usuario autenticado (si
//   tiene), y — si el partido está FINAL y la pick no estaba resuelta —
//   ejecuta la resolución lazy: cuenta los goles del jugador elegido
//   y acredita las monedas correspondientes en el wallet único.
//
// POST /api/quiniela/featured
//   Body: { espnId, playerId, playerName, teamSide }
//   Requiere auth. Valida: kickoff no pasado, espnId coincide con el
//   featured actual, playerId existe en el roster. Upsert por
//   (user_id, jornada). Idempotente.
//
// Sin Supabase configurado / sin sesión → GET devuelve {userPick:null},
// POST devuelve 401. UI cae a modo invitado limpiamente.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import {
  fetchFeaturedMatch, fetchSummary,
  extractRoster, extractScorers, coinsForGoals, lineupCandidates,
  type FeaturedMatchInfo, type FeaturedRoster,
} from '@/lib/featured-goalscorer'

interface UserPickRow {
  espn_id: string
  league_slug: string
  player_id: string
  player_name: string
  player_team_side: 'home' | 'away'
  resolved: boolean
  goals_scored: number
  awarded_coins: number
  created_at: string
  computed_at: string | null
}

interface FeaturedResponse {
  match: FeaturedMatchInfo | null
  candidates: FeaturedRoster | null
  userPick: UserPickRow | null
  // Solo presente si acabamos de resolver en este request
  justResolved?: { goals: number; awarded: number }
}

// ── GET ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin

  const match = await fetchFeaturedMatch(origin)
  if (!match) {
    return NextResponse.json({ match: null, candidates: null, userPick: null } satisfies FeaturedResponse)
  }

  // Roster + status del partido. Si el summary falla (red, ESPN caído),
  // devolvemos match sin candidatos — la UI mostrará «pendientes».
  const summary = await fetchSummary(match.leagueSlug, match.espnId)
  const candidates = summary ? extractRoster(summary) : null

  // Sin auth/Supabase → modo invitado: solo mostrar match + candidatos.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ match, candidates, userPick: null } satisfies FeaturedResponse)
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ match, candidates, userPick: null } satisfies FeaturedResponse)
  }

  // Lee pick del usuario para esta jornada
  const { data: pick } = await sb
    .from('quiniela_featured_picks')
    .select('espn_id, league_slug, player_id, player_name, player_team_side, resolved, goals_scored, awarded_coins, created_at, computed_at')
    .eq('user_id', user.id)
    .eq('jornada', match.jornada)
    .maybeSingle()

  // Resolución lazy: si partido FINAL, hay pick, y aún no se resolvió.
  let justResolved: { goals: number; awarded: number } | undefined
  if (
    pick && !pick.resolved &&
    candidates?.status === 'final' &&
    summary
  ) {
    justResolved = await resolvePickLazy(user.id, match.jornada, pick as UserPickRow, summary)
    // Re-leer la pick post-resolución (resolved=true, goals_scored, awarded_coins actualizados)
    const { data: refreshed } = await sb
      .from('quiniela_featured_picks')
      .select('espn_id, league_slug, player_id, player_name, player_team_side, resolved, goals_scored, awarded_coins, created_at, computed_at')
      .eq('user_id', user.id)
      .eq('jornada', match.jornada)
      .maybeSingle()
    return NextResponse.json({
      match, candidates,
      userPick: (refreshed ?? pick) as UserPickRow,
      justResolved,
    } satisfies FeaturedResponse)
  }

  return NextResponse.json({
    match, candidates,
    userPick: pick as UserPickRow | null,
  } satisfies FeaturedResponse)
}

// ── Resolución lazy ──────────────────────────────────────────────
async function resolvePickLazy(
  userId: string,
  jornada: string,
  pick: UserPickRow,
  summary: Record<string, unknown>,
): Promise<{ goals: number; awarded: number }> {
  const admin = adminSupabase()
  if (!admin) return { goals: 0, awarded: 0 }

  // Defensa en profundidad anti-doble crédito: aunque pick.resolved=false,
  // si ya existe una txn con source=featured_goalscorer + esta jornada
  // para este user, NO acreditamos otra vez. Cubre la rara race condition
  // de dos GETs concurrentes en el mismo segundo.
  const { data: existingTxn } = await admin
    .from('quiniela_coin_txns')
    .select('id')
    .eq('user_id', userId)
    .eq('context->>source', 'featured_goalscorer')
    .eq('context->>jornada', jornada)
    .maybeSingle()

  const scorers = extractScorers(summary)
  const myGoals = scorers.get(pick.player_id)?.goals ?? 0
  const awarded = existingTxn ? 0 : coinsForGoals(myGoals)

  if (awarded > 0) {
    await admin.from('quiniela_coin_txns').insert({
      user_id: userId,
      amount: awarded,
      reason: `Goleador destacado · ${pick.player_name} (${myGoals} ${myGoals === 1 ? 'gol' : 'goles'})`,
      context: {
        source: 'featured_goalscorer',
        jornada,
        espn_id: pick.espn_id,
        player_id: pick.player_id,
        player_name: pick.player_name,
        goals: myGoals,
      },
    })
  }

  await admin
    .from('quiniela_featured_picks')
    .update({
      resolved: true,
      goals_scored: myGoals,
      awarded_coins: awarded,
      computed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('jornada', jornada)

  // Push notification fire-and-forget — solo si ganó algo y NO había
  // sido pagado antes (existingTxn null). El push es one-time porque
  // el flag `resolved` previene re-resolución.
  if (awarded > 0 && !existingTxn) {
    const title = myGoals >= 3
      ? `⚽ ¡HAT-TRICK! +${awarded} pts`
      : myGoals === 2
        ? `⚽ Doblete · +${awarded} pts`
        : `⚽ ¡Tu goleador marcó! +${awarded} pts`
    const pushBody = `${pick.player_name} hizo ${myGoals} ${myGoals === 1 ? 'gol' : 'goles'} · partido destacado de ${jornada}`
    import('@/lib/push-helper').then(({ sendPushToUser }) =>
      sendPushToUser(userId, {
        title,
        body: pushBody,
        url: '/quiniela',
        tag: `quiniela-goalscorer-${jornada}`,
      }),
    ).catch(() => { /* silent: push best-effort */ })
  }

  return { goals: myGoals, awarded }
}

// ── POST ─────────────────────────────────────────────────────────
interface PostBody {
  espnId: string
  playerId: string
  playerName: string
  teamSide: 'home' | 'away'
}

const MAX_NAME_LEN = 80
const MAX_ID_LEN = 24
// Margen de gracia: el kickoff es la hora oficial, pero permitimos
// guardar hasta 60s antes para no rechazar picks por desync de reloj.
const KICKOFF_GRACE_MS = -60_000

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'supabase not configured' }, { status: 503 })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  let body: PostBody
  try { body = await req.json() as PostBody } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body?.espnId || typeof body.espnId !== 'string' || body.espnId.length > MAX_ID_LEN) {
    return NextResponse.json({ error: 'invalid espnId' }, { status: 400 })
  }
  if (!body?.playerId || typeof body.playerId !== 'string' || body.playerId.length > MAX_ID_LEN) {
    return NextResponse.json({ error: 'invalid playerId' }, { status: 400 })
  }
  if (!body?.playerName || typeof body.playerName !== 'string' || body.playerName.length === 0 || body.playerName.length > MAX_NAME_LEN) {
    return NextResponse.json({ error: 'invalid playerName' }, { status: 400 })
  }
  if (body.teamSide !== 'home' && body.teamSide !== 'away') {
    return NextResponse.json({ error: 'invalid teamSide' }, { status: 400 })
  }

  // Validar contra el featured match actual + roster.
  const origin = new URL(req.url).origin
  const match = await fetchFeaturedMatch(origin)
  if (!match) return NextResponse.json({ error: 'no featured match' }, { status: 409 })
  if (match.espnId !== body.espnId) {
    return NextResponse.json({ error: 'espnId mismatch with current featured' }, { status: 409 })
  }

  // Kickoff no pasado (con margen de gracia)
  const kickoffMs = new Date(match.isoDate).getTime()
  if (!Number.isNaN(kickoffMs) && kickoffMs + KICKOFF_GRACE_MS <= Date.now()) {
    return NextResponse.json({ error: 'match already started' }, { status: 410 })
  }

  // Validar player_id contra el roster real (titulares + banquillo)
  const summary = await fetchSummary(match.leagueSlug, match.espnId)
  if (!summary) return NextResponse.json({ error: 'roster unavailable' }, { status: 503 })
  const roster = extractRoster(summary)
  const allCandidates = [
    ...lineupCandidates(roster.home),
    ...lineupCandidates(roster.away),
  ]
  const matchedCandidate = allCandidates.find(c => c.id === body.playerId)
  if (!matchedCandidate) {
    return NextResponse.json({ error: 'player not in roster' }, { status: 400 })
  }
  if (matchedCandidate.teamSide !== body.teamSide) {
    return NextResponse.json({ error: 'teamSide mismatch' }, { status: 400 })
  }

  // Si ya existe pick resuelta para esta jornada, no permitir cambio.
  const { data: existing } = await sb
    .from('quiniela_featured_picks')
    .select('resolved')
    .eq('user_id', user.id)
    .eq('jornada', match.jornada)
    .maybeSingle()
  if (existing?.resolved) {
    return NextResponse.json({ error: 'pick already resolved' }, { status: 410 })
  }

  // Upsert
  const { error } = await sb.from('quiniela_featured_picks').upsert({
    user_id:           user.id,
    jornada:           match.jornada,
    espn_id:           match.espnId,
    league_slug:       match.leagueSlug,
    player_id:         body.playerId,
    player_name:       matchedCandidate.name,           // canónico desde roster, no input del usuario
    player_team_side:  matchedCandidate.teamSide,
    resolved:          false,
    goals_scored:      0,
    awarded_coins:     0,
  }, { onConflict: 'user_id,jornada' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
