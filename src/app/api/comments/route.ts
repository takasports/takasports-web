// /api/comments
//   GET  ?slug=ARTICLE_SLUG[&limit=50]  → lista (público)
//   POST { slug, body }                  → crear (requiere sesión Supabase)
//
// Rate-limit: máximo 5 comentarios por usuario en la última hora.
// Sanitización: el body se trim y limita a 1000 chars. NO permitimos HTML
// (el cliente renderiza como texto plano + linkify).

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { adminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_LEN = 1000
const RATE_LIMIT_PER_HOUR = 5

function supaForRoute(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll() { /* no-op: este route no setea cookies */ },
      },
    },
  )
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim() ?? ''
  const limitParam = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50

  if (!slug) {
    return NextResponse.json({ ok: false, error: 'slug_required' }, { status: 400 })
  }

  const supa = adminSupabase()
  if (!supa) return NextResponse.json({ ok: true, comments: [] })

  const { data, error } = await supa
    .from('article_comments')
    .select('id, user_name, user_avatar, body, created_at, flagged_count')
    .eq('article_slug', slug)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[comments GET]', error)
    return NextResponse.json({ ok: false, error: 'fetch_failed' }, { status: 500 })
  }

  // Ocultamos comentarios con muchos flags (auto-shadow ≥ 5 reports).
  const filtered = (data ?? []).filter(c => (c.flagged_count ?? 0) < 5)

  return NextResponse.json({ ok: true, comments: filtered })
}

export async function POST(req: NextRequest) {
  let body: { slug?: unknown; body?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const text = typeof body.body === 'string' ? body.body.trim() : ''

  if (!slug) return NextResponse.json({ ok: false, error: 'slug_required' }, { status: 400 })
  if (text.length === 0 || text.length > MAX_BODY_LEN) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // Sesión Supabase (cookies)
  const userClient = supaForRoute(req)
  const { data: userRes, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userRes?.user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }
  const user = userRes.user

  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })

  // Rate-limit: cuenta inserts del usuario en la última hora
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await admin
    .from('article_comments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', oneHourAgo)

  if ((recentCount ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfter: 3600 },
      { status: 429 },
    )
  }

  // Denormalizamos nombre y avatar del user para no joinar en cada lectura.
  const meta = user.user_metadata as { name?: string; full_name?: string; avatar_url?: string } | undefined
  const userName = (meta?.name || meta?.full_name || user.email?.split('@')[0] || 'Usuario').slice(0, 64)
  const userAvatar = typeof meta?.avatar_url === 'string' ? meta.avatar_url.slice(0, 500) : null

  const { data: inserted, error: insertErr } = await admin
    .from('article_comments')
    .insert({
      article_slug: slug,
      user_id: user.id,
      user_name: userName,
      user_avatar: userAvatar,
      body: text,
    })
    .select('id, user_name, user_avatar, body, created_at, flagged_count')
    .single()

  if (insertErr) {
    console.error('[comments POST]', insertErr)
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, comment: inserted })
}
