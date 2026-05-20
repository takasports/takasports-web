// GET /api/quiniela/health
// Salud operativa de la caché de cuotas: no consume cupo de
// the-odds-api (solo lee Supabase). Pensado para abrir en el navegador
// o pinchar desde un cron de Vercel / UptimeRobot.
//
// HTTP 200 con JSON { status, ... }
//   status === 'healthy'   → todas las filas frescas (<3h) y con datos
//   status === 'degraded'  → algo viejo (>3h) o sirviendo stale
//   status === 'empty'     → caché vacía (post-deploy o reset; rellena al primer hit OK)
//   status === 'down'      → Supabase no responde / tabla no existe

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Espejo local de isMundialMode del route principal (no exportado allá).
const WORLD_CUP_START = Date.UTC(2026, 5, 11)
const WORLD_CUP_END   = Date.UTC(2026, 6, 20)
function isMundialMode(now = Date.now()): boolean {
  const flag = process.env.QUINIELA_MUNDIAL?.toLowerCase()
  if (flag === 'on')  return true
  if (flag === 'off') return false
  return now >= WORLD_CUP_START && now < WORLD_CUP_END
}

const FRESH_MS = 3 * 3_600_000   // <3h = fresca
const STALE_MS = 24 * 3_600_000  // <24h = stale aceptable (stale-on-failure tira de esto)

interface OddsRow { odds_key: string; ts: string; empty: boolean; events: unknown[] }

export async function GET() {
  const now = Date.now()
  const sb = adminSupabase()
  if (!sb) {
    return NextResponse.json({
      status: 'down',
      reason: 'supabase service role no configurada',
      generatedAt: new Date(now).toISOString(),
    })
  }

  const { data, error } = await sb
    .from('quiniela_odds_cache')
    .select('odds_key, ts, empty, events')

  if (error) {
    return NextResponse.json({
      status: 'down',
      reason: `tabla quiniela_odds_cache no accesible: ${error.message}`,
      hint: 'Aplica supabase/migrations/026_quiniela_odds_cache.sql',
      generatedAt: new Date(now).toISOString(),
    })
  }

  const rows = (data ?? []) as OddsRow[]
  const detail = rows.map(r => {
    const age = now - new Date(r.ts).getTime()
    const ageMin = Math.round(age / 60_000)
    const events = Array.isArray(r.events) ? r.events.length : 0
    let s: 'fresh' | 'stale' | 'very_stale' | 'empty'
    if (events === 0 || r.empty) s = 'empty'
    else if (age < FRESH_MS) s = 'fresh'
    else if (age < STALE_MS) s = 'stale'
    else s = 'very_stale'
    return { odds_key: r.odds_key, ageMin, events, status: s }
  })

  // Agregado: si no hay filas → empty. Si alguna fresh y con eventos → healthy.
  // Si todas stale/empty → degraded.
  let overall: 'healthy' | 'degraded' | 'empty' = 'empty'
  if (rows.length === 0) overall = 'empty'
  else if (detail.some(d => d.status === 'fresh' && d.events > 0)) overall = 'healthy'
  else overall = 'degraded'

  return NextResponse.json({
    status: overall,
    mundialMode: isMundialMode(now),
    rows: detail,
    advice:
      overall === 'healthy' ? 'Todo OK.'
      : overall === 'empty' ? 'Caché vacía. Abre /api/quiniela una vez para poblarla cuando the-odds-api tenga cupo.'
      : 'Datos viejos. the-odds-api podría estar fallando o sin cupo — el stale-on-failure protege al usuario, pero conviene revisar.',
    generatedAt: new Date(now).toISOString(),
  })
}
