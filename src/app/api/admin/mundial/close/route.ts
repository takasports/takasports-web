// POST /api/admin/mundial/close
//
// Cierre del Mundial 2026 — endpoint admin "dormido" hasta que el
// torneo termine (19 jul 2026). Acciones:
//   · Computa el podio = puntos del Mundial del ledger point_transactions
//     (source='ranked_prediction', sport='mundial'), donde acredita el RPC
//     score_ranked_prediction al resolver cada partido.
//   · Otorga "top3_mundial_2026" al podio.
//   · Backstop idempotente: re-otorga "mundialista_2026" a los
//     participantes reales (≥1 predicción Mundial).
//   · NO toca el wallet — los premios físicos (camisetas) son offline.
//
// Seguridad:
//   · X-Admin-Secret obligatorio (PUSH_BROADCAST_SECRET reusado).
//   · Por defecto requiere que la fecha actual sea ≥ MUNDIAL_CLOSE_DATE.
//   · Override con body.force=true (para testing manual del admin).
//
// Idempotente: re-ejecuciones devuelven badgesAwarded=0 y alreadyClosed=true.
//
// GET (dry-run): mismo cómputo (computeMundialPodium) sin awardBadges.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { closeMundial2026, computeMundialPodium, MUNDIAL_CLOSE_DATE } from '@/lib/mundial-closure'
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

  // Dry-run: mismo cómputo que el cierre real (computeMundialPodium),
  // sin escribir badges. Así preview y cierre nunca divergen.
  const { participants, ranked } = await computeMundialPodium(admin)

  return NextResponse.json({
    dryRun: true,
    closeDate: MUNDIAL_CLOSE_DATE.toISOString(),
    today: new Date().toISOString(),
    willCloseNow: new Date() >= MUNDIAL_CLOSE_DATE,
    participantsCount: participants.length,
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
