// POST/GET /api/cron/snapshot-player-stats
//
// Snapshot semanal del rendimiento de cada jugador sembrado en sport_entities. Acumula el
// histórico con el que luego se calculará el "Valor Taka" (y que ya habilita gráficos de
// evolución de estadísticas). Guarda los stats crudos; el modelo se aplica después.
//
// Va por lotes e idempotente por (jugador, semana): se puede llamar muchas veces dentro de
// la misma semana y solo rellena a los que aún faltan; una vez cubiertos, es no-op hasta el
// siguiente lunes. Programado varias veces (ver vercel.json) porque un solo run no cubre a
// los ~450 dentro del límite de 60 s de la función.
//
// Auth: header `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`.

import { NextResponse } from 'next/server'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { listEntitiesNeedingSnapshot, sportEntitiesConfigured } from '@/lib/sport-entities'
import { currentWeekStart, fetchPlayerStatLine, persistSnapshot } from '@/lib/player-snapshots'

export const dynamic = 'force-dynamic'

/** Cada snapshot es 1 llamada a ESPN Core (~rápida). 20 caben de sobra en 60 s. */
const BATCH = 20

/** Cortesía entre llamadas a ESPN para no ráfaguear su API. */
const COURTESY_MS = 150

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function handle(req: Request) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!sportEntitiesConfigured()) {
    return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 })
  }

  const week = currentWeekStart()
  const pending = await listEntitiesNeedingSnapshot(week, BATCH)

  let written = 0
  let skipped = 0    // fallo transitorio de ESPN → se reintenta en la próxima pasada
  for (const [index, entity] of pending.entries()) {
    if (index > 0) await sleep(COURTESY_MS)
    const line = await fetchPlayerStatLine(entity)
    if (!line) { skipped++; continue }
    if (await persistSnapshot(entity, week, line)) written++
    else skipped++
  }

  return NextResponse.json({ ok: true, week, batch: pending.length, written, skipped })
}

export async function GET(req: Request) {
  return handle(req)
}
export async function POST(req: Request) {
  return handle(req)
}
