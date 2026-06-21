// POST /api/cosmetics/sport-pick
//
// Otorga al user logueado el avatar_frame correspondiente al deporte
// elegido. Idempotente — llamarlo N veces con el mismo deporte solo
// otorga el cosmetic la primera vez.
//
// Body: { sport: 'futbol'|'baloncesto'|'formula1'|'ufc'|'tenis'|'rugby'|'wwe' }
//
// La UI todavía no llama a este endpoint — está pensada para un
// futuro "Elige tu deporte favorito" en /perfil o un onboarding.
// Por ahora se puede invocar manualmente desde admin si hace falta.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { unlockCosmeticsForSport } from '@/lib/cosmetics'

const VALID_SPORTS = [
  'futbol', 'baloncesto', 'formula1', 'ufc', 'tenis', 'rugby', 'wwe',
] as const
type ValidSport = typeof VALID_SPORTS[number]

interface Body {
  sport?: string
}

export async function POST(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })

  let body: Body
  try { body = await req.json() as Body } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!body.sport || !VALID_SPORTS.includes(body.sport as ValidSport)) {
    return NextResponse.json({
      error: 'sport debe ser uno de: ' + VALID_SPORTS.join(', '),
    }, { status: 400 })
  }

  // Necesitamos admin para escribir en user_cosmetic_unlocks
  const admin = adminSupabase()
  if (!admin) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const newCosmetics = await unlockCosmeticsForSport(admin, user.id, body.sport)

  return NextResponse.json({
    ok: true,
    sport: body.sport,
    awarded: newCosmetics,
  })
}
