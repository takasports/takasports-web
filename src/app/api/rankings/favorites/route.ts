// Watchlist personal del usuario sobre el Índice Taka.
//
//   GET    → lista de entry_ids que el usuario tiene como favorito.
//   POST   { entry_id } → añade favorito (idempotente).
//   DELETE ?entry_id=... → quita favorito.
//
// Requiere sesión. Sin sesión, GET devuelve [], POST/DELETE devuelven 401.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ favorites: [] })

  const { data, error } = await sb
    .from('user_favorites')
    .select('entry_id, created_at, meta')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ favorites: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as { entry_id?: string; meta?: unknown } | null
  const entryId = body?.entry_id?.trim()
  if (!entryId) return NextResponse.json({ error: 'entry_id requerido' }, { status: 400 })
  if (entryId.length > 200) return NextResponse.json({ error: 'entry_id demasiado largo' }, { status: 400 })

  // `meta` opcional: datos mínimos para que la app pinte el favorito sin
  // re-descargarlo (noticias: título/imagen; equipos/ligas: nombre/escudo). Lo
  // acotamos en tamaño para no abusar del almacenamiento. Las fichas del Índice
  // (Mi Top) no envían meta → se resuelven de ranking_view.
  const meta =
    body?.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) ? body.meta : undefined
  if (meta && JSON.stringify(meta).length > 2000) {
    return NextResponse.json({ error: 'meta demasiado grande' }, { status: 400 })
  }

  // Cap por usuario para evitar abuso. La lista junta fichas del Índice +
  // equipos (team:) + ligas (comp:) del calendario → 200 da margen de sobra.
  const { count } = await sb
    .from('user_favorites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((count ?? 0) >= 200) {
    return NextResponse.json({ error: 'Máximo 200 favoritos. Quita alguno antes.' }, { status: 409 })
  }

  // Solo incluimos `meta` cuando viene: así un re-POST sin meta (p.ej. una ficha
  // del Índice) no pisa el meta que pudiera tener una fila ya existente.
  const row: { user_id: string; entry_id: string; meta?: unknown } = {
    user_id: user.id,
    entry_id: entryId,
  }
  if (meta !== undefined) row.meta = meta

  const { error } = await sb
    .from('user_favorites')
    .upsert(row, { onConflict: 'user_id,entry_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
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
