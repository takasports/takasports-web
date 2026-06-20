// GET / POST /api/admin/ranked/close-week
// Cierra la semana del ranking Ranked: lee el top de la semana y otorga
// badges champion_weekly (#1) y top_3_weekly (#2 y #3).
//
// Protegido por CRON_SECRET (mismo mecanismo que los crons).
//
// Params (query o body, todos opcionales):
//   sport?: string        — default 'mundial'
//   week_start?: string   — ISO del lunes (default: lunes anterior)
//   award=1               — FUERZA el reparto de badges desde un GET (lo usa el cron)
//
// Uso manual (POST SIEMPRE premia):
//   curl -X POST https://takasportsmedia.com/api/admin/ranked/close-week \
//     -H "x-cron-secret: <SECRET>" -H "content-type: application/json" \
//     -d '{"sport":"mundial"}'
//
// Cron de Vercel — OJO: los crons de Vercel SIEMPRE hacen GET. Por eso el cron
// debe llevar ?award=1, si no el GET se queda en dry-run y NUNCA reparte premios.
//   GET /api/admin/ranked/close-week?sport=mundial&award=1

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { awardBadges } from '@/lib/badge-awards'

export const dynamic = 'force-dynamic'

type AdminClient = NonNullable<ReturnType<typeof adminSupabase>>

/** Devuelve el ISO del lunes 00:00 UTC de la semana N días atrás. */
function lastMonday(offsetDays = 0): string {
  const now = new Date()
  const day = now.getUTCDay()                         // 0=dom, 1=lun … 6=sáb
  const daysToMon = day === 0 ? 6 : day - 1          // distancia al lunes
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysToMon - offsetDays)
  monday.setUTCHours(0, 0, 0, 0)
  return monday.toISOString()
}

interface RankRow {
  user_id:      string
  display_name: string | null
  total_week:   number
  rank:         number
}

// ── Núcleo compartido ───────────────────────────────────────────────
// Lee el leaderboard semanal y OTORGA los badges del top-3. Lo usan el
// POST (disparo manual) y el GET con ?award=1 (cron semanal de Vercel).
async function closeWeek(
  admin: AdminClient,
  sport: string,
  weekStartIso: string,
  weekEndIso: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  // Suma de puntos ganados (amount > 0) en ranked_predictions para el
  // deporte y la ventana de tiempo especificados.
  const { data: rows, error } = await admin
    .from('point_transactions')
    .select(`
      user_id,
      profiles!inner(display_name),
      amount
    `)
    .eq('sport', sport)
    .eq('source', 'ranked_prediction')
    .gt('amount', 0)
    .gte('created_at', weekStartIso)
    .lte('created_at', weekEndIso)

  if (error) return { status: 500, body: { ok: false, error: error.message } }

  if (!rows || rows.length === 0) {
    return {
      status: 200,
      body: { ok: true, sport, week_start: weekStartIso, note: 'no_activity_this_week', awarded: [] },
    }
  }

  // Agrupa por user_id
  interface UserTotal { user_id: string; display_name: string | null; total: number }
  const totals = new Map<string, UserTotal>()
  for (const r of rows as unknown as Array<{ user_id: string; profiles: { display_name: string | null } | null; amount: number }>) {
    const prev = totals.get(r.user_id) ?? {
      user_id:      r.user_id,
      display_name: r.profiles?.display_name ?? null,
      total:        0,
    }
    prev.total += r.amount
    totals.set(r.user_id, prev)
  }

  // Ordena desc y toma TOP 3
  const ranked: RankRow[] = [...totals.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((u, i) => ({ ...u, total_week: u.total, rank: i + 1 }))

  // ── Award badges ──────────────────────────────────────────────────
  const awarded: Array<{ user_id: string; display_name: string | null; rank: number; badges: string[] }> = []
  for (const entry of ranked) {
    const badges: string[] = []
    // TOP 1 → champion_weekly (incluye top_3_weekly); TOP 2 y 3 → solo top_3_weekly
    if (entry.rank === 1) badges.push('champion_weekly')
    badges.push('top_3_weekly')

    const result = await awardBadges(admin, entry.user_id, badges)
    awarded.push({
      user_id:      entry.user_id,
      display_name: entry.display_name,
      rank:         entry.rank,
      badges:       result.awarded,
    })
  }

  return {
    status: 200,
    body: {
      ok:         true,
      sport,
      week_start: weekStartIso,
      week_end:   weekEndIso,
      top3:       ranked.map(r => ({
        rank:         r.rank,
        user_id:      r.user_id,
        display_name: r.display_name,
        total_week:   r.total_week,
      })),
      awarded,
    },
  }
}

export async function POST(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = adminSupabase()
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'admin_unavailable' }, { status: 503 })
  }

  // Leer body o query params
  let sport    = new URL(req.url).searchParams.get('sport') ?? 'mundial'
  let weekStart: string | null = null
  try {
    const body = await req.json() as { sport?: string; week_start?: string }
    if (body.sport)      sport     = body.sport
    if (body.week_start) weekStart = body.week_start
  } catch { /* body vacío — ok */ }

  // Semana: de week_start hasta week_start + 7 días.
  // Default: lunes anterior a las 00:00 UTC hasta ahora.
  const weekStartIso = weekStart ?? lastMonday()
  const weekEndIso   = weekStart
    ? new Date(new Date(weekStart).getTime() + 7 * 86_400_000).toISOString()
    : new Date().toISOString()  // hasta "ahora" si es la semana en curso

  const { status, body } = await closeWeek(admin, sport, weekStartIso, weekEndIso)
  return NextResponse.json(body, { status })
}

// GET — por defecto dry-run / preview (top-10, NO escribe nada).
// Con ?award=1 reparte los badges de verdad (lo usa el cron semanal de Vercel,
// que solo puede hacer GET).
export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_unavailable' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const sport      = searchParams.get('sport') ?? 'mundial'
  const weekStart  = searchParams.get('week_start') ?? lastMonday()
  const weekEnd    = searchParams.get('week_end') ?? new Date().toISOString()

  // El cron de Vercel SIEMPRE hace GET → con ?award=1 reparte los badges de verdad.
  if (searchParams.get('award') === '1') {
    const { status, body } = await closeWeek(admin, sport, weekStart, weekEnd)
    return NextResponse.json(body, { status })
  }

  // ── Dry-run / preview (sin award) ─────────────────────────────────
  const { data: rows, error } = await admin
    .from('point_transactions')
    .select('user_id, profiles!inner(display_name), amount')
    .eq('sport', sport)
    .eq('source', 'ranked_prediction')
    .gt('amount', 0)
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const totals = new Map<string, { display_name: string | null; total: number }>()
  for (const r of (rows as unknown as Array<{ user_id: string; profiles: { display_name: string | null } | null; amount: number }>) ?? []) {
    const prev = totals.get(r.user_id) ?? { display_name: r.profiles?.display_name ?? null, total: 0 }
    prev.total += r.amount
    totals.set(r.user_id, prev)
  }

  const top = [...totals.entries()]
    .map(([uid, v]) => ({ user_id: uid, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((u, i) => ({ rank: i + 1, ...u }))

  return NextResponse.json({ ok: true, sport, week_start: weekStart, week_end: weekEnd, top, dry_run: true })
}
