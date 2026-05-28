// GET /api/quiniela/challenges?jornada=X
//
// Lista los desafíos activos para la jornada dada.
// Visible para todos (incluyendo no-autenticados) — es el hook de
// conversión: el user sin login ve el desafío + premio + botón
// "Iniciá sesión para participar".
//
// Para usuarios autenticados, incluye status por desafío:
//   · 'pending'   → no completado aún
//   · 'completed' → condición cumplida, pendiente de claim
//   · 'claimed'   → ya reclamó el premio
//
// Respuesta:
// {
//   challenges: [{
//     badge_id, name, emoji, color, bg, description,
//     challenge_title, challenge_description, coin_bonus,
//     criteria_type, criteria_value,
//     status: 'pending'|'completed'|'claimed'|null,  // null si no-auth
//     coins_awarded: number  // solo cuando claimed
//   }]
// }

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const jornada = req.nextUrl.searchParams.get('jornada') ?? ''

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ challenges: [] })
  }

  // Leer challenges activos para esta jornada (público, usando admin)
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ challenges: [] })

  const nowIso = new Date().toISOString()
  const { data: badgeRows } = await admin
    .from('quiniela_special_badges')
    .select('badge_id, name, emoji, color, bg, description, challenge_title, challenge_description, coin_bonus, criteria_type, criteria_value, max_grants, granted_count, expires_at')
    .eq('active', true)
    .eq('show_in_sidebar', true)
    .or(`jornada.eq.${jornada},jornada.is.null`)
    .or(`expires_at.gt.${nowIso},expires_at.is.null`)

  if (!badgeRows || badgeRows.length === 0) {
    return NextResponse.json({ challenges: [] })
  }

  // Para auth users, añadir status por challenge
  let statusMap = new Map<string, { status: 'pending' | 'completed' | 'claimed'; coinsAwarded: number }>()
  try {
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user && jornada) {
      const badgeIds = badgeRows.map(r => r.badge_id as string)
      const { data: completions } = await sb
        .from('quiniela_challenge_completions')
        .select('badge_id, claimed_at, coins_awarded')
        .eq('user_id', user.id)
        .eq('jornada', jornada)
        .in('badge_id', badgeIds)
      for (const c of completions ?? []) {
        statusMap.set(c.badge_id as string, {
          status: c.claimed_at ? 'claimed' : 'completed',
          coinsAwarded: c.coins_awarded as number ?? 0,
        })
      }
    }
  } catch { /* silent — status es opcional */ }

  const challenges = badgeRows.map(r => {
    const bid = r.badge_id as string
    const st = statusMap.get(bid)
    const capped = (r.max_grants as number) > 0 && (r.granted_count as number) >= (r.max_grants as number)
    return {
      badge_id: bid,
      name: r.name,
      emoji: r.emoji,
      color: r.color,
      bg: r.bg,
      description: r.description,
      challenge_title: r.challenge_title ?? r.name,
      challenge_description: r.challenge_description ?? r.description,
      coin_bonus: r.coin_bonus ?? 0,
      criteria_type: r.criteria_type,
      criteria_value: r.criteria_value ?? 0,
      capped,
      status: st?.status ?? null,
      coins_awarded: st?.coinsAwarded ?? 0,
    }
  })

  return NextResponse.json({ challenges })
}
