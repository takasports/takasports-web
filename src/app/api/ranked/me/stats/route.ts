// GET /api/ranked/me/stats — estadísticas de predicciones Ranked del usuario autenticado.
//
// Devuelve:
//   { total, correct, accuracy, bySport: { [sport]: { total, correct } } }
//
// Requiere sesión activa (401 si no la hay).
// is_correct puede ser null (partido aún no resuelto) — solo contamos los resueltos.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { apiError } from '@/lib/api-utils'

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET(req: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ total: 0, correct: 0, accuracy: 0, bySport: {} })
  }

  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // ranked_predictions NO tiene columna `sport` (el deporte vive en
  // ranked_events). Traemos las predicciones del user y resolvemos el
  // sport por event_id con una segunda query. Antes se hacía
  // .select('sport, …') → 400 (columna inexistente) → el endpoint
  // entero fallaba y el bloque de stats del perfil salía vacío.
  const { data, error } = await sb
    .from('ranked_predictions')
    .select('event_id, is_correct')
    .eq('user_id', user.id)

  if (error) return apiError('server_error', 500)

  const rows = (data ?? []) as { event_id: string; is_correct: boolean | null }[]

  // Mapa event_id → sport (solo de los eventos realmente referenciados).
  const eventIds = [...new Set(rows.map(r => r.event_id))]
  const sportByEvent = new Map<string, string>()
  if (eventIds.length > 0) {
    const { data: events } = await sb
      .from('ranked_events')
      .select('id, sport')
      .in('id', eventIds)
    for (const e of (events ?? []) as { id: string; sport: string | null }[]) {
      sportByEvent.set(e.id, e.sport ?? 'otro')
    }
  }

  // Solo cuentan las predicciones YA RESUELTAS (is_correct != null): meter las
  // pendientes en el denominador infla la precisión A LA BAJA y diverge del perfil
  // público, que solo cuenta las resueltas.
  const resolved = rows.filter(r => r.is_correct !== null)
  const total   = resolved.length
  const correct = resolved.filter(r => r.is_correct === true).length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  const bySport: Record<string, { total: number; correct: number }> = {}
  for (const row of resolved) {
    const sport = sportByEvent.get(row.event_id) ?? 'otro'
    if (!bySport[sport]) bySport[sport] = { total: 0, correct: 0 }
    bySport[sport].total++
    if (row.is_correct === true) bySport[sport].correct++
  }

  return NextResponse.json({ total, correct, accuracy, bySport })
}
