// GET /api/ranked/me/stats — estadísticas de predicciones Ranked del usuario autenticado.
//
// Devuelve:
//   { total, correct, accuracy, bySport: { [sport]: { total, correct } } }
//
// Requiere sesión activa (401 si no la hay).
// is_correct puede ser null (partido aún no resuelto) — solo contamos los resueltos.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ total: 0, correct: 0, accuracy: 0, bySport: {} })
  }

  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data, error } = await sb
    .from('ranked_predictions')
    .select('sport, is_correct')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as { sport: string; is_correct: boolean | null }[]

  const total   = rows.length
  const correct = rows.filter(r => r.is_correct === true).length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  const bySport: Record<string, { total: number; correct: number }> = {}
  for (const row of rows) {
    const sport = row.sport ?? 'otro'
    if (!bySport[sport]) bySport[sport] = { total: 0, correct: 0 }
    bySport[sport].total++
    if (row.is_correct === true) bySport[sport].correct++
  }

  return NextResponse.json({ total, correct, accuracy, bySport })
}
