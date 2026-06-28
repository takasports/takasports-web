// Voto de APOYO de la afición al Ranking Taka. Acepta login web (cookie) y de la
// app (Bearer) vía supabaseForRequest — así el mismo POST vale para web y móvil.
//   GET   ?category=jugadores → { week, category, options (top 5), myPick }
//   POST  { category, entry_id } → registra el apoyo del usuario (1/semana/categoría)
//
// La semana objetivo es siempre date_trunc('week', now()) + 7d (próximo lunes).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
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

  // Apoyo previo del usuario (myPick). Acepta cookie (web) o Bearer (app).
  let myPick: string | null = null
  try {
    const { supabase, user } = await supabaseForRequest(req)
    if (user) {
      const { data } = await supabase.from('index_predictions')
        .select('predicted_entry_id')
        .eq('user_id', user.id).eq('week_start', week).eq('category', category)
        .maybeSingle()
      myPick = data?.predicted_entry_id ?? null
    }
  } catch { /* anónimo */ }

  return NextResponse.json({ week, category, options: top ?? [], myPick })
}

export async function POST(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'Inicia sesión para apoyar' }, { status: 401 })

  const body = await req.json().catch(() => null) as { category?: string; entry_id?: string } | null
  const category = body?.category ?? 'jugadores'
  const entryId = body?.entry_id
  if (!entryId) return NextResponse.json({ error: 'entry_id requerido' }, { status: 400 })

  const week = nextMonday()

  // Solo se puede apoyar a quien está en juego esta semana: entry_id debe estar
  // entre las opciones reales (top-5 de la categoría).
  const { data: top } = await sb
    .from('ranking_view').select('id')
    .eq('category', category)
    .order('score', { ascending: false })
    .limit(5)
  if (!top?.some((t: { id: string }) => t.id === entryId)) {
    return NextResponse.json({ error: 'entry_id no está entre las opciones' }, { status: 400 })
  }

  const { error } = await sb.from('index_predictions').upsert(
    { user_id: user.id, week_start: week, category, predicted_entry_id: entryId },
    { onConflict: 'user_id,week_start,category' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, week })
}
