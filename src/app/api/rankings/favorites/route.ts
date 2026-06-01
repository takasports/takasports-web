// Watchlist personal del usuario sobre el Índice Taka.
//
//   GET    → lista de entry_ids que el usuario tiene como favorito.
//   POST   { entry_id } → añade favorito (idempotente).
//   DELETE ?entry_id=... → quita favorito.
//
// Requiere sesión. Sin sesión, GET devuelve [], POST/DELETE devuelven 401.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ favorites: [] })

  const { data, error } = await sb
    .from('user_favorites')
    .select('entry_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ favorites: data ?? [] })
}

export async function POST(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as { entry_id?: string } | null
  const entryId = body?.entry_id?.trim()
  if (!entryId) return NextResponse.json({ error: 'entry_id requerido' }, { status: 400 })

  // Cap por usuario para evitar abuso (ej. 100 favoritos máx)
  const { count } = await sb
    .from('user_favorites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((count ?? 0) >= 100) {
    return NextResponse.json({ error: 'Máximo 100 favoritos. Quita alguno antes.' }, { status: 409 })
  }

  const { error } = await sb
    .from('user_favorites')
    .upsert({ user_id: user.id, entry_id: entryId }, { onConflict: 'user_id,entry_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const entryId = (url.searchParams.get('entry_id') ?? '').trim()
  if (!entryId) return NextResponse.json({ error: 'entry_id requerido' }, { status: 400 })

  const { error } = await sb
    .from('user_favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('entry_id', entryId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
