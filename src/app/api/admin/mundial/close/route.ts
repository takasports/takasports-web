// POST /api/admin/mundial/close
//
// Cierre del Mundial 2026 — endpoint admin "dormido" hasta que el
// torneo termine (19 jul 2026). Acciones:
//   · Lee participantes (users con ≥1 jornada Mundial sellada).
//   · Otorga badge "mundialista_2026" a todos (idempotente).
//   · Computa ranking acumulado, otorga "top3_mundial_2026" al podio.
//   · NO toca el wallet — los premios físicos (camisetas) son offline.
//
// Seguridad:
//   · X-Admin-Secret obligatorio (PUSH_BROADCAST_SECRET reusado).
//   · Por defecto requiere que la fecha actual sea ≥ MUNDIAL_CLOSE_DATE.
//   · Override con body.force=true (para testing manual del admin).
//
// Idempotente: re-ejecuciones devuelven badgesAwarded=0 y alreadyClosed=true.
//
// GET (dry-run): mismo cómputo pero sin awardBadges, para preview.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { closeMundial2026, MUNDIAL_CLOSE_DATE } from '@/lib/mundial-closure'
import { safeEqual } from '@/lib/auth-utils'

function checkAuth(req: NextRequest): NextResponse | null {
  const required = process.env.PUSH_BROADCAST_SECRET
  if (!required) {
    return NextResponse.json({ error: 'admin endpoint not configured' }, { status: 503 })
  }
  const provided = req.headers.get('x-admin-secret') ?? ''
  if (!safeEqual(provided, required)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(req: NextRequest) {
  // Solo header x-admin-secret. Query string eliminado: filtraría el secret en logs de Vercel.
  const auth = checkAuth(req)
  if (auth) return auth

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'no_supabase' }, { status: 503 })

  // Dry-run: forzamos siempre y vemos qué pasaría, sin escribir badges.
  // Hack: clonamos la lógica leyendo los mismos datos pero sin awardBadges.
  const { data: rows } = await admin
    .from('quiniela_picks')
    .select('user_id, jornada, picks')
    .ilike('jornada', 'Mundial%')
  const staked = (rows ?? []).filter(r => (r.picks as { staked?: boolean } | null)?.staked === true)
  const byUser = new Map<string, { coins: number; jornadas: number }>()
  for (const r of staked) {
    const coins = (r.picks as { breakdown?: { totalCoins?: number } } | null)?.breakdown?.totalCoins ?? 0
    const prev = byUser.get(r.user_id as string) ?? { coins: 0, jornadas: 0 }
    prev.coins += coins
    prev.jornadas += 1
    byUser.set(r.user_id as string, prev)
  }
  const ranked = [...byUser.entries()]
    .map(([uid, agg]) => ({ userId: uid, ...agg }))
    .sort((a, b) => b.coins - a.coins || b.jornadas - a.jornadas)

  return NextResponse.json({
    dryRun: true,
    closeDate: MUNDIAL_CLOSE_DATE.toISOString(),
    today: new Date().toISOString(),
    willCloseNow: new Date() >= MUNDIAL_CLOSE_DATE,
    participantsCount: byUser.size,
    podiumPreview: ranked.slice(0, 3),
  })
}

export async function POST(req: NextRequest) {
  // adminSecret en body eliminado: solo header x-admin-secret.
  const auth = checkAuth(req)
  if (auth) return auth

  let body: { force?: boolean } = {}
  try { body = await req.json() } catch { /* empty body permitido */ }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'no_supabase' }, { status: 503 })

  const result = await closeMundial2026(admin, { force: body.force === true })
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}
