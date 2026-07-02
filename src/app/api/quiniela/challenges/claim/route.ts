// POST /api/quiniela/challenges/claim
//
// Reclama el premio de un desafío completado. El user debe tener
// una fila en quiniela_challenge_completions con claimed_at=null.
//
// Acciones:
//   1. Verifica que existe completion sin claimed_at.
//   2. Acredita el premio como PUNTOS Taka vía award_points (si > 0).
//   3. Otorga el badge (awardBadges — idempotente).
//   4. Marca claimed_at = now() y coins_awarded (= puntos otorgados).
//
// Body: { badgeId: string, jornada: string }
//
// Respuesta: { ok, coinsAwarded, badgeId, badgeName, badgeEmoji }
//
// Modelo SIN monedas: el premio del reto (columna coin_bonus, escala
// vieja de "monedas") se acredita como PUNTOS en escala baja = coin_bonus/10
// (mín. 1) — antes iba a add_coins (moneda muerta) mientras la UI decía "pts".

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { awardBadges } from '@/lib/badge-awards'

interface ClaimBody {
  badgeId: string
  jornada: string
}

export async function POST(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  let body: ClaimBody
  try { body = await req.json() as ClaimBody } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (!body.badgeId || !body.jornada) {
    return NextResponse.json({ error: 'badgeId y jornada requeridos' }, { status: 400 })
  }

  // 1. Verificar completion pendiente
  const { data: completion } = await sb
    .from('quiniela_challenge_completions')
    .select('claimed_at, coins_awarded')
    .eq('user_id', user.id)
    .eq('badge_id', body.badgeId)
    .eq('jornada', body.jornada)
    .maybeSingle()

  if (!completion) {
    return NextResponse.json(
      { error: 'no_completion', reason: 'No completaste este desafío en esta jornada' },
      { status: 409 },
    )
  }
  // Idempotente: si ya reclamó, devolver lo guardado
  if (completion.claimed_at) {
    return NextResponse.json({
      ok: true,
      alreadyClaimed: true,
      coinsAwarded: completion.coins_awarded ?? 0,
    })
  }

  // 2. Leer badge metadata para coin_bonus
  const admin = adminSupabase()
  const { data: spBadge } = await admin!
    .from('quiniela_special_badges')
    .select('name, emoji, coin_bonus')
    .eq('badge_id', body.badgeId)
    .maybeSingle()
  if (!spBadge) {
    return NextResponse.json({ error: 'badge no encontrado' }, { status: 404 })
  }

  const coinBonus = (spBadge.coin_bonus as number) ?? 0
  // Escala baja: el coin_bonus (escala vieja) → puntos = /10, mínimo 1.
  const points = coinBonus > 0 ? Math.max(1, Math.round(coinBonus / 10)) : 0

  // 3. CLAIM ATÓMICO: marcar claimed SOLO si seguía sin reclamar. El UPDATE
  //    condicional (claimed_at IS NULL) es el cerrojo real — dos peticiones
  //    concurrentes leían ambas claimed_at=null arriba y acreditaban las dos
  //    (doble crédito). Ahora solo una gana este UPDATE; la otra ve 0 filas.
  const { data: claimedRows, error: claimErr } = await admin!
    .from('quiniela_challenge_completions')
    .update({ claimed_at: new Date().toISOString(), coins_awarded: points })
    .eq('user_id', user.id)
    .eq('badge_id', body.badgeId)
    .eq('jornada', body.jornada)
    .is('claimed_at', null)
    .select('badge_id')
  if (claimErr) {
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }
  if (!claimedRows || claimedRows.length === 0) {
    // Otra petición concurrente ya reclamó → idempotente, no re-acreditamos.
    return NextResponse.json({ ok: true, alreadyClaimed: true, coinsAwarded: points })
  }

  // 4. Solo el GANADOR del cerrojo acredita los puntos.
  if (points > 0) {
    const { error: creditErr } = await admin!.rpc('award_points', {
      p_user_id: user.id,
      p_amount:  points,
      p_sport:   'futbol',
      p_source:  'quiniela_challenge',
      p_reason:  `Desafío completado: ${spBadge.name}`,
      p_context: {
        badge_id:   body.badgeId,
        jornada:    body.jornada,
        coin_bonus: coinBonus,
      },
    })
    if (creditErr) {
      // Rollback del cerrojo para poder reintentar (no dejar "reclamado" sin pagar).
      await admin!
        .from('quiniela_challenge_completions')
        .update({ claimed_at: null, coins_awarded: null })
        .eq('user_id', user.id)
        .eq('badge_id', body.badgeId)
        .eq('jornada', body.jornada)
      return NextResponse.json({ error: 'credit_failed' }, { status: 500 })
    }
  }

  // 5. Otorgar badge (awardBadges maneja special badges también — idempotente).
  const admin2 = adminSupabase()
  if (admin2) {
    await awardBadges(admin2, user.id, [body.badgeId])
  }

  return NextResponse.json({
    ok: true,
    coinsAwarded: points,
    badgeId: body.badgeId,
    badgeName: spBadge.name as string,
    badgeEmoji: spBadge.emoji as string,
  })
}
