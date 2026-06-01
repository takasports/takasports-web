// Encuesta semanal del Índice Taka.
//
//   GET    → poll activo + resultados (votos por opción) + el voto del usuario si está logueado.
//   POST   { poll_id, entry_id } → registra voto del usuario (upsert, 1 voto por poll).
//
// Categoría por defecto: jugadores. Pasa ?category=creadores para variantes.

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

async function loadPoll(category: string) {
  const sb = pubClient()
  const { data } = await sb
    .from('weekly_polls')
    .select('*')
    .eq('category', category)
    .order('week_start', { ascending: false })
    .limit(1)
  return data?.[0] ?? null
}

async function loadResults(pollId: number) {
  const sb = pubClient()
  const { data } = await sb
    .from('weekly_poll_results')
    .select('entry_id, votes')
    .eq('poll_id', pollId)
  return data ?? []
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category') ?? 'jugadores'
  const poll = await loadPoll(category)
  if (!poll) return NextResponse.json({ poll: null })

  const results = await loadResults(poll.id)

  let myVote: string | null = null
  try {
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user) {
      const { data } = await sb
        .from('weekly_votes')
        .select('entry_id')
        .eq('poll_id', poll.id)
        .eq('user_id', user.id)
        .maybeSingle()
      myVote = data?.entry_id ?? null
    }
  } catch { /* anónimo */ }

  return NextResponse.json({ poll, results, myVote })
}

export async function POST(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Inicia sesión para votar' }, { status: 401 })

  const body = await req.json().catch(() => null) as { poll_id?: number; entry_id?: string } | null
  if (!body?.poll_id || !body?.entry_id) {
    return NextResponse.json({ error: 'poll_id y entry_id requeridos' }, { status: 400 })
  }

  // Verifica que la opción pertenece al poll
  const { data: poll } = await sb
    .from('weekly_polls')
    .select('id, options, closes_at')
    .eq('id', body.poll_id)
    .maybeSingle()
  if (!poll) return NextResponse.json({ error: 'Poll no existe' }, { status: 404 })
  if (new Date(poll.closes_at) < new Date()) {
    return NextResponse.json({ error: 'Encuesta cerrada' }, { status: 410 })
  }
  const valid = (poll.options as { entry_id: string }[]).some(o => o.entry_id === body.entry_id)
  if (!valid) return NextResponse.json({ error: 'Opción inválida' }, { status: 400 })

  const { error } = await sb
    .from('weekly_votes')
    .upsert(
      { poll_id: body.poll_id, user_id: user.id, entry_id: body.entry_id, voted_at: new Date().toISOString() },
      { onConflict: 'poll_id,user_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
