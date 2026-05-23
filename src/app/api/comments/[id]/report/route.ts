// POST /api/comments/[id]/report
// Reportar un comentario (flag). Requiere sesión. Un usuario solo puede
// reportar un comentario una vez (constraint unique en la tabla).
// Cuando se inserta el report, incrementamos flagged_count en el comentario.
// Comentarios con flagged_count >= 5 quedan auto-ocultos en el GET público.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { adminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function supaForRoute(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() { /* no-op */ },
      },
    },
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  let body: { reason?: unknown } = {}
  try { body = await req.json() } catch { /* sin body es válido */ }
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : null

  const userClient = supaForRoute(req)
  const { data: userRes } = await userClient.auth.getUser()
  if (!userRes?.user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }
  const user = userRes.user

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })

  const { error: insertErr } = await admin
    .from('article_comment_reports')
    .insert({ comment_id: id, reporter_id: user.id, reason })

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Ya reportado por este usuario — respondemos amistosamente
      return NextResponse.json({ ok: true, alreadyReported: true })
    }
    if (insertErr.code === '23503') {
      // comment_id no existe
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    }
    console.error('[report POST]', insertErr)
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
  }

  // Incrementa flagged_count. Intentamos primero una RPC atómica; si no
  // existe (instalación nueva sin esa función), hacemos un update best-effort
  // con un read-modify-write — no es atómico pero el riesgo de race aquí es
  // bajo (un usuario solo reporta una vez por comentario).
  const { error: rpcErr } = await admin.rpc('increment_comment_flag', { p_id: id })
  if (rpcErr) {
    const { data: cur } = await admin
      .from('article_comments')
      .select('flagged_count')
      .eq('id', id)
      .single()
    if (cur) {
      await admin
        .from('article_comments')
        .update({ flagged_count: (cur.flagged_count ?? 0) + 1 })
        .eq('id', id)
    }
  }

  return NextResponse.json({ ok: true })
}
