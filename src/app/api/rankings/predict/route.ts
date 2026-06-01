// Predicciones meta-juego del Índice Taka.
//   GET   ?category=jugadores → { options (top 5), myPick, resolved } para la próxima semana
//   POST  { category, entry_id } → registra la predicción del usuario
//
// La semana objetivo es siempre date_trunc('week', now()) + 7d (próximo lunes).
// El cron lunes 10:30 llama f_resolve_predictions para marcar aciertos.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function pubClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
}

function nextMonday(): string {
  const d = new Date()
  const day = d.getUTCDay()                // 0=dom .. 6=sáb
  const daysToMonday = (8 - day) % 7 || 7  // lunes que viene
  d.setUTCDate(d.getUTCDate() + daysToMonday)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const category = new URL(req.url).searchParams.get('category') ?? 'jugadores'
  const week = nextMonday()

  const sb = pubClient()
  const { data: top } = await sb
    .from('ranking_view')
    .select('id,name,image_url,score')
    .eq('category', category)
    .order('score', { ascending: false })
    .limit(5)

  let myPick: string | null = null
  try {
    const session = await createServerSupabaseClient()
    const { data: { user } } = await session.auth.getUser()
    if (user) {
      const { data } = await session.from('index_predictions')
        .select('predicted_entry_id')
        .eq('user_id', user.id).eq('week_start', week).eq('category', category)
        .maybeSingle()
      myPick = data?.predicted_entry_id ?? null
    }
  } catch { /* anónimo */ }

  return NextResponse.json({ week, category, options: top ?? [], myPick })
}

export async function POST(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión para predecir' }, { status: 401 })

  const body = await req.json().catch(() => null) as { category?: string; entry_id?: string } | null
  const category = body?.category ?? 'jugadores'
  const entryId = body?.entry_id
  if (!entryId) return NextResponse.json({ error: 'entry_id requerido' }, { status: 400 })

  const week = nextMonday()
  const { error } = await sb.from('index_predictions').upsert(
    { user_id: user.id, week_start: week, category, predicted_entry_id: entryId },
    { onConflict: 'user_id,week_start,category' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, week })
}
