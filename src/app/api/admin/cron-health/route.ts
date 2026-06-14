// /api/admin/cron-health
// Devuelve estado de cada snapshot Supabase (cuándo fue el último cron OK,
// edad en horas, alarma si lleva > 8d sin actualizarse).
//
// Además, sección `crons`: frescura de la cadena semanal de rankings que se
// enchufó en F7.1 (snapshot-history / recompute-badges / resolve-predictions).
// `ok` mantiene su significado histórico (solo stat-blocks, para no romper
// monitores existentes); `allOk` agrega blocks + crons.
//
// Auth: misma CRON_SECRET. Llamada típica:
//   curl -H "x-cron-secret: XXX" https://takasportsmedia.com/api/admin/cron-health
//   o con Authorization: Bearer XXX (cron de Vercel).
// `?secret=` quedó deprecado (filtra en logs/referer) — ya no se acepta.
//
// Esperable: todos los blocks con ageHours < 168h (1 semana) excepto los
// snapshots editoriales raros. Si algún score es 'red', un cron rompió
// silenciosamente y hay que mirar el scraper.

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

interface BlockHealth {
  blockId: string
  source: string
  asOf: string | null
  updatedAt: string
  ageHours: number
  status: 'green' | 'yellow' | 'red'
}

// Umbrales por tipo de cron (en horas).
const THRESHOLDS: Record<string, { yellow: number; red: number }> = {
  // crons semanales (UFC + MotoGP): yellow > 8 días, red > 14 días
  'motogp-pilotos':       { yellow: 192, red: 336 },
  'motogp-constructores': { yellow: 192, red: 336 },
  'ufc-p4p':              { yellow: 192, red: 336 },
  'ufc-campeones':        { yellow: 192, red: 336 },
  // cron diario Elo: yellow > 36h, red > 72h
  'ranking-fifa':         { yellow: 36,  red: 72 },
}
// Default para divisiones UFC y otros (semanales)
const DEFAULT_THRESHOLD = { yellow: 192, red: 336 }

function classify(blockId: string, ageH: number): BlockHealth['status'] {
  const t = THRESHOLDS[blockId] ?? DEFAULT_THRESHOLD
  if (ageH > t.red) return 'red'
  if (ageH > t.yellow) return 'yellow'
  return 'green'
}

// ── Salud de la cadena semanal de rankings (crons enchufados en F7.1) ──
// Mira la frescura de la SALIDA de cada cron, no el cron en sí: si el dato
// más reciente es viejo, el cron (o su ingesta upstream) dejó de correr.
interface CronHealth {
  job: string
  detail: string
  lastAt: string | null
  ageHours: number | null
  status: 'green' | 'yellow' | 'red'
}

// Crons semanales (lunes): verde < 8 días, rojo > 14 días.
const WEEKLY = { yellow: 192, red: 336 }

function ageHours(ts: string | null, now: number): number | null {
  if (!ts) return null
  return Math.round(((now - new Date(ts).getTime()) / 3600_000) * 10) / 10
}

function classifyAge(age: number | null, t: { yellow: number; red: number }): CronHealth['status'] {
  if (age == null) return 'red'
  if (age > t.red) return 'red'
  if (age > t.yellow) return 'yellow'
  return 'green'
}

// Lunes (UTC) de la semana actual en YYYY-MM-DD (= date_trunc('week', now())).
function currentWeekMonday(now: number): string {
  const d = new Date(now)
  const dow = (d.getUTCDay() + 6) % 7 // 0 = lunes
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow))
  return mon.toISOString().slice(0, 10)
}

type SB = NonNullable<ReturnType<typeof adminSupabase>>

async function cronChecks(sb: SB, now: number): Promise<CronHealth[]> {
  const out: CronHealth[] = []

  // snapshot-history → ranking_score_history (lun 10:00)
  try {
    const { data } = await sb
      .from('ranking_score_history')
      .select('captured_at')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const last = (data?.captured_at as string | undefined) ?? null
    const a = ageHours(last, now)
    out.push({
      job: 'snapshot-history',
      detail: 'Foto semanal del histórico de rankings (lun 10:00)',
      lastAt: last,
      ageHours: a,
      status: classifyAge(a, WEEKLY),
    })
  } catch (e) {
    out.push({ job: 'snapshot-history', detail: `error: ${String(e)}`, lastAt: null, ageHours: null, status: 'red' })
  }

  // recompute-badges + award-achievements → entry_badges (lun 10:05 / día 1)
  try {
    const { data } = await sb
      .from('entry_badges')
      .select('awarded_at')
      .order('awarded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const last = (data?.awarded_at as string | undefined) ?? null
    const a = ageHours(last, now)
    out.push({
      job: 'recompute-badges',
      detail: 'Insignias del Índice recalculadas (lun 10:05)',
      lastAt: last,
      ageHours: a,
      status: classifyAge(a, WEEKLY),
    })
  } catch (e) {
    out.push({ job: 'recompute-badges', detail: `error: ${String(e)}`, lastAt: null, ageHours: null, status: 'red' })
  }

  // resolve-predictions → predicciones de semanas YA cerradas sin resolver (lun 10:15)
  try {
    const monday = currentWeekMonday(now)
    const { count } = await sb
      .from('index_predictions')
      .select('*', { count: 'exact', head: true })
      .is('is_correct', null)
      .lt('week_start', monday)
    const stale = count ?? 0
    out.push({
      job: 'resolve-predictions',
      detail: `${stale} predicción(es) de semanas pasadas sin resolver`,
      lastAt: null,
      ageHours: null,
      status: stale === 0 ? 'green' : stale > 50 ? 'red' : 'yellow',
    })
  } catch (e) {
    out.push({ job: 'resolve-predictions', detail: `error: ${String(e)}`, lastAt: null, ageHours: null, status: 'red' })
  }

  return out
}

async function handle(req: Request) {
  // CRON_SECRET es obligatorio: si no está configurado, el endpoint queda cerrado.
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 })

  const { data, error } = await sb
    .from('stat_block_snapshots')
    .select('block_id, source, as_of, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const now = Date.now()
  const blocks: BlockHealth[] = (data ?? []).map(r => {
    const updatedAt = new Date(r.updated_at as string)
    const ageHours = Math.round((now - updatedAt.getTime()) / 3600_000 * 10) / 10
    return {
      blockId: r.block_id as string,
      source: r.source as string,
      asOf: r.as_of as string | null,
      updatedAt: r.updated_at as string,
      ageHours,
      status: classify(r.block_id as string, ageHours),
    }
  })

  const summary = {
    total: blocks.length,
    green: blocks.filter(b => b.status === 'green').length,
    yellow: blocks.filter(b => b.status === 'yellow').length,
    red: blocks.filter(b => b.status === 'red').length,
  }
  const allHealthy = summary.red === 0 && summary.yellow === 0

  // Sección crons: frescura de la cadena semanal de rankings (F7.1).
  // Se añade APARTE para no cambiar el significado del `ok` histórico
  // (que mide solo los snapshots editoriales y lo consume algún monitor).
  const crons = await cronChecks(sb, now)
  const cronsSummary = {
    total: crons.length,
    green: crons.filter(c => c.status === 'green').length,
    yellow: crons.filter(c => c.status === 'yellow').length,
    red: crons.filter(c => c.status === 'red').length,
  }

  return NextResponse.json({
    ok: allHealthy, // histórico: solo stat-blocks (no rompe monitores existentes)
    allOk: allHealthy && cronsSummary.red === 0 && cronsSummary.yellow === 0,
    summary,
    blocks: blocks.sort((a, b) => b.ageHours - a.ageHours), // más viejo primero
    cronsSummary,
    crons,
  })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
