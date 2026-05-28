// POST /api/quiniela/challenges/claim
//
// Reclama el premio de un desafío completado. El user debe tener
// una fila en quiniela_challenge_completions con claimed_at=null.
//
// Acciones:
//   1. Verifica que existe completion sin claimed_at.
//   2. Acredita coin_bonus vía add_coins (si > 0).
//   3. Otorga el badge (awardBadges — idempotente).
//   4. Marca claimed_at = now() y coins_awarded.
//
// Body: { badgeId: string, jornada: string }
//
// Respuesta: { ok, coinsAwarded, badgeId, badgeName, badgeEmoji }

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { awardBadges } from '@/lib/badge-awards'

interface ClaimBody {
  badgeId: string
  jornada: string
}

export async function POST(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
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

  // 3. Acreditar coins si hay bonus
  if (coinBonus > 0) {
    const { error: creditErr } = await admin!.rpc('add_coins', {
      p_amount: coinBonus,
      p_reason: `Desafío completado: ${spBadge.name}`,
      p_context: {
        source: 'challenge_claim',
        badge_id: body.badgeId,
        jornada: body.jornada,
        coin_bonus: coinBonus,
      },
      p_user_id: user.id,
    })
    if (creditErr) {
      return NextResponse.json({ error: 'credit_failed', detail: creditErr.message }, { status: 500 })
    }
  }

  // 4. Otorgar badge (awardBadges maneja special badges también —
  //    inserta en quiniela_badges con el badge_id del special badge)
  const admin2 = adminSupabase()
  if (admin2) {
    await awardBadges(admin2, user.id, [body.badgeId])
  }

  // 5. Marcar como claimed
  await sb
    .from('quiniela_challenge_completions')
    .update({ claimed_at: new Date().toISOString(), coins_awarded: coinBonus })
    .eq('user_id', user.id)
    .eq('badge_id', body.badgeId)
    .eq('jornada', body.jornada)

  return NextResponse.json({
    ok: true,
    coinsAwarded: coinBonus,
    badgeId: body.badgeId,
    badgeName: spBadge.name as string,
    badgeEmoji: spBadge.emoji as string,
  })
}
