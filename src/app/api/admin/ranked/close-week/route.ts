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
//
// NOTA de datos: point_transactions NO tiene FK a profiles, así que NO se puede
// usar el embed PostgREST `profiles!inner(...)`. Los nombres se traen aparte.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { awardBadges } from '@/lib/badge-awards'
import { sendTelegram } from '@/lib/telegram'

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

/** Suma de puntos por usuario en la ventana (amount>0, source ranked_prediction). */
async function weeklyTotals(
  admin: AdminClient,
  sport: string,
  weekStartIso: string,
  weekEndIso: string,
): Promise<{ error?: string; totals: Map<string, number> }> {
  const { data: rows, error } = await admin
    .from('point_transactions')
    .select('user_id, amount')
    .eq('sport', sport)
    .eq('source', 'ranked_prediction')
    .gt('amount', 0)
    .gte('created_at', weekStartIso)
    .lte('created_at', weekEndIso)

  if (error) return { error: error.message, totals: new Map() }

  const totals = new Map<string, number>()
  for (const r of (rows as unknown as Array<{ user_id: string; amount: number }>) ?? []) {
    totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.amount)
  }
  return { totals }
}

/** Nombres de display por id (consulta aparte: no hay FK para embed). */
async function fetchNames(admin: AdminClient, ids: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  if (ids.length === 0) return map
  const { data } = await admin.from('profiles').select('id, display_name').in('id', ids)
  for (const r of (data as unknown as Array<{ id: string; display_name: string | null }>) ?? []) {
    map.set(r.id, r.display_name)
  }
  return map
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
  const { error, totals } = await weeklyTotals(admin, sport, weekStartIso, weekEndIso)
  if (error) {
    // Cron semanal de premios (Mundial): si el cómputo falla, AVISAR — antes el
    // error solo iba al JSON de respuesta y el podio se quedaba sin repartir.
    await sendTelegram(
      `⚠️ close-week (${sport}): el cómputo semanal falló — ${String(typeof error === 'string' ? error : JSON.stringify(error)).slice(0, 200).replace(/[<>]/g, '')}`,
    )
    return { status: 500, body: { ok: false, error } }
  }

  if (totals.size === 0) {
    return {
      status: 200,
      body: { ok: true, sport, week_start: weekStartIso, note: 'no_activity_this_week', awarded: [] },
    }
  }

  // Top-3 por puntos
  const top3 = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const names = await fetchNames(admin, top3.map(([uid]) => uid))
  const ranked: RankRow[] = top3.map(([uid, total], i) => ({
    user_id:      uid,
    display_name: names.get(uid) ?? null,
    total_week:   total,
    rank:         i + 1,
  }))

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

  // ── Dry-run / preview (sin award, top-10) ─────────────────────────
  const { error, totals } = await weeklyTotals(admin, sport, weekStart, weekEnd)
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 })

  const topEntries = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const names = await fetchNames(admin, topEntries.map(([uid]) => uid))
  const top = topEntries.map(([uid, total], i) => ({
    rank:         i + 1,
    user_id:      uid,
    display_name: names.get(uid) ?? null,
    total,
  }))

  return NextResponse.json({ ok: true, sport, week_start: weekStart, week_end: weekEnd, top, dry_run: true })
}
