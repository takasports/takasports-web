// GET / POST /api/cron/data-freshness
//
// Vigila que los datos clave NO se queden viejos EN SILENCIO. El recompute
// semanal del Índice Taka corre FUERA de Vercel (launchd en el Mac del dueño):
// si ese equipo está apagado o el script falla, los rankings se quedarían viejos
// sin que nadie se entere. Esta alarma lo detecta mirando la BD directamente —
// pase lo que pase con la máquina que lanza el recompute.
//
// Manda ⚠️ a Telegram SOLO cuando algún dato excede su SLA (silencioso si todo
// está fresco, para no generar ruido). Auth: x-cron-secret / Bearer CRON_SECRET.
//   ?dry=1 → devuelve el informe JSON sin enviar Telegram.

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { sendTelegram } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// SLA por dato: días que puede pasar sin actualizarse antes de avisar.
//   · Resultados pasados (sync DIARIO) → 2 días = 1 de cadencia + 1 de gracia.
//   · Pipeline de noticias (ingesta CONTINUA) → 2 días: el pipeline crea
//     content_items cada pocos minutos; 2 días sin un solo item nuevo = caído
//     (o pausado a propósito vía Telegram, en cuyo caso el aviso es informativo).
// El Índice Taka se vigila APARTE, POR CATEGORÍA (ver más abajo).
const CHECKS: ReadonlyArray<{ table: string; column: string; slaDays: number; label: string }> = [
  { table: 'past_events',   column: 'updated_at', slaDays: 2, label: 'Resultados pasados (sync diario)' },
  { table: 'content_items', column: 'created_at', slaDays: 2, label: 'Pipeline de noticias (ingesta)' },
]

// Índice Taka (recompute SEMANAL) → 9 días = 7 de cadencia + 2 de gracia.
// Se vigila POR CATEGORÍA (no con un máximo global): así un parón PARCIAL de una
// sola categoría no queda enmascarado por otra que sí se actualizó.
const RANKING_SLA_DAYS = 9
// Categorías SIN fuente automática (se curan SOLO a mano): exentas de la alarma
// para no generar ruido recurrente. Hoy NINGUNA: UFC femenino se actualiza vía
// ingest-ufc-rankings.mjs (ufc.com), que ahora sella last_auto_update, así que
// se vigila como las demás. Si en el futuro una categoría pasa a curarse solo a
// mano, añádela aquí.
const STATIC_CATEGORIES = new Set<string>([])

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'admin_unavailable' }, { status: 503 })

  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const now = Date.now()
  const checks: Array<Record<string, unknown>> = []
  const stale: string[] = []

  for (const c of CHECKS) {
    // Fila con el valor MÁS reciente de la columna (nulls al final).
    const { data, error } = await admin
      .from(c.table)
      .select(c.column)
      .order(c.column, { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      checks.push({ table: c.table, column: c.column, ok: false, note: error.message })
      stale.push(`• <b>${c.label}</b>: error al consultar (${error.message})`)
      continue
    }

    const last = data ? ((data as unknown as Record<string, string | null>)[c.column] ?? null) : null
    const ageDays = last ? (now - new Date(last).getTime()) / 86_400_000 : Infinity
    const ok = ageDays <= c.slaDays
    checks.push({
      table: c.table,
      column: c.column,
      last,
      ageDays: Number.isFinite(ageDays) ? Math.round(ageDays * 10) / 10 : null,
      slaDays: c.slaDays,
      ok,
    })
    if (!ok) {
      const ageTxt = Number.isFinite(ageDays) ? `${ageDays.toFixed(1)} días` : 'sin datos'
      stale.push(`• <b>${c.label}</b>: ${ageTxt} sin actualizarse (límite ${c.slaDays}d). Última: ${last ?? '—'}`)
    }
  }

  // Índice Taka POR CATEGORÍA: detecta paros PARCIALES (una categoría vieja
  // mientras otras siguen frescas) que el antiguo máximo global ocultaba.
  // Las categorías estáticas (STATIC_CATEGORIES) se omiten.
  const { data: cats, error: catErr } = await admin.rpc('f_ranking_category_freshness')
  if (catErr) {
    checks.push({ source: 'Índice Taka (por categoría)', ok: false, note: catErr.message })
    stale.push(`• <b>Índice Taka</b>: error al consultar frescura por categoría (${catErr.message})`)
  } else {
    const rows = (cats ?? []) as Array<{ category: string; last_update: string | null; age_days: number | string | null }>
    for (const row of rows) {
      if (STATIC_CATEGORIES.has(row.category)) continue
      const ageDays = row.age_days != null ? Number(row.age_days) : Infinity
      const ok = ageDays <= RANKING_SLA_DAYS
      checks.push({
        source: `Índice · ${row.category}`,
        last: row.last_update,
        ageDays: Number.isFinite(ageDays) ? ageDays : null,
        slaDays: RANKING_SLA_DAYS,
        ok,
      })
      if (!ok) {
        const ageTxt = Number.isFinite(ageDays) ? `${ageDays.toFixed(1)} días` : 'sin datos'
        stale.push(`• <b>Índice Taka · ${row.category}</b>: ${ageTxt} sin actualizarse (límite ${RANKING_SLA_DAYS}d). Última: ${row.last_update ?? '—'}`)
      }
    }
  }

  let telegram: { sent: boolean; note?: string } = { sent: false, note: 'sin alertas' }
  if (stale.length > 0) {
    if (dry) {
      telegram = { sent: false, note: 'dry-run: no enviado' }
    } else {
      const msg =
        `⚠️ <b>TakaSports — datos viejos</b>\n\n${stale.join('\n')}\n\n` +
        `Revisa el recompute semanal (launchd en el Mac) o el cron de sync correspondiente.`
      telegram = await sendTelegram(msg)
    }
  }

  return NextResponse.json({ ok: true, stale: stale.length > 0, checks, telegram })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
