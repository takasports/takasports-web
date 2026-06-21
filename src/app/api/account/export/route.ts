// GET /api/account/export — entrega al usuario autenticado una copia de TODOS
// sus datos en un único JSON descargable (RGPD art. 20, portabilidad).
//
// Mismo candado que el borrado de cuenta: autentica por la sesión de cookie y,
// una vez identificado, lee con el cliente de servicio (service_role) SOLO las
// filas de ese usuario en cada tabla. Nunca expone datos de terceros.

import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// Tablas con datos del usuario y la columna que lo identifica.
// (Excluida a propósito: push_subscriptions = tokens técnicos del dispositivo,
//  sensibles y sin valor de portabilidad para la persona.)
const USER_TABLES: { table: string; col: 'user_id' | 'owner_id' }[] = [
  { table: 'article_comments',              col: 'user_id'  },
  { table: 'game_events',                   col: 'user_id'  },
  { table: 'game_plays',                    col: 'user_id'  },
  { table: 'game_streaks',                  col: 'user_id'  },
  { table: 'index_predictions',             col: 'user_id'  },
  { table: 'point_transactions',            col: 'user_id'  },
  { table: 'quiniela_badges',               col: 'user_id'  },
  { table: 'quiniela_challenge_completions', col: 'user_id' },
  { table: 'quiniela_league_chat',          col: 'user_id'  },
  { table: 'quiniela_league_member_scores', col: 'user_id'  },
  { table: 'quiniela_league_members',       col: 'user_id'  },
  { table: 'quiniela_leagues',              col: 'owner_id' },
  { table: 'quiniela_picks',                col: 'user_id'  },
  { table: 'quiniela_season_predictions',   col: 'user_id'  },
  { table: 'quiniela_user_equipment',       col: 'user_id'  },
  { table: 'ranked_league_members',         col: 'user_id'  },
  { table: 'ranked_leagues',                col: 'owner_id' },
  { table: 'ranked_predictions',            col: 'user_id'  },
  { table: 'read_history',                  col: 'user_id'  },
  { table: 'reminders',                     col: 'user_id'  },
  { table: 'user_cosmetic_unlocks',         col: 'user_id'  },
  { table: 'user_favorites',                col: 'user_id'  },
  { table: 'weekly_votes',                  col: 'user_id'  },
]

const PAGE = 1000

// Lee TODAS las filas de una tabla para un usuario, paginando (supabase-js
// limita a 1000 por defecto), para que la exportación sea completa.
async function fetchAll(
  admin: SupabaseClient,
  table: string,
  col: string,
  id: string,
): Promise<unknown[] | { error: string }> {
  const all: unknown[] = []
  let from = 0
  for (;;) {
    const { data, error } = await admin.from(table).select('*').eq(col, id).range(from, from + PAGE - 1)
    if (error) return { error: error.message }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export async function GET(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 })
  }

  // Freno anti-abuso: pocas exportaciones por minuto por IP+usuario.
  const rl = await checkRateLimit({
    bucket: 'account_export',
    key: `${getClientIp(req)}:${user.id}`,
    windowSeconds: 60,
    max: 5,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const admin = adminSupabase()
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  const data: Record<string, unknown> = {}

  // profiles usa la columna `id` (= auth uid), no user_id.
  data['profiles'] = await fetchAll(admin, 'profiles', 'id', user.id)

  for (const { table, col } of USER_TABLES) {
    data[table] = await fetchAll(admin, table, col, user.id)
  }

  const now = new Date()
  const payload = {
    export_format: 'takasports-user-data-v1',
    exported_at: now.toISOString(),
    account: { id: user.id, email: user.email ?? null, created_at: user.created_at },
    note: 'Copia de tus datos en TakaSports (RGPD art. 20). No incluye tokens técnicos de notificaciones push.',
    data,
  }

  const filename = `takasports-mis-datos-${now.toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
