// /api/comments
//   GET  ?slug=ARTICLE_SLUG[&limit=50]  → lista (público)
//   POST { slug, body }                  → crear (requiere sesión Supabase)
//
// Rate-limit: máximo 5 comentarios por usuario en la última hora.
// Sanitización: el body se trim y limita a 1000 chars. NO permitimos HTML
// (el cliente renderiza como texto plano + linkify).

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { getUserFromRequest } from '@/lib/supabase-server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const MAX_BODY_LEN = 1000
const RATE_LIMIT_PER_HOUR = 5

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim() ?? ''
  const limitParam = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50

  if (!slug) {
    return NextResponse.json({ ok: false, error: 'slug_required' }, { status: 400 })
  }

  const supa = adminSupabase()
  if (!supa) return NextResponse.json({ ok: true, comments: [] })

  // Usuario OPCIONAL (cookie web O Bearer app). Solo sirve para marcar SUS
  // comentarios: leemos user_id en el servidor y devolvemos is_mine, sin exponer
  // nunca el UUID auth al cliente. Sin sesión → is_mine false (anónimo).
  const me = await getUserFromRequest(req).catch(() => null)

  const { data, error } = await supa
    .from('article_comments')
    .select('id, user_id, user_name, user_avatar, body, created_at, flagged_count')
    .eq('article_slug', slug)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[comments GET]', error)
    return NextResponse.json({ ok: false, error: 'fetch_failed' }, { status: 500 })
  }

  // Ocultamos comentarios con muchos flags (auto-shadow ≥ 5 reports). Añadimos
  // is_mine y QUITAMOS user_id de la respuesta (no se expone el id crudo).
  const filtered = (data ?? [])
    .filter((c) => (c.flagged_count ?? 0) < 5)
    .map(({ user_id, ...c }) => ({ ...c, is_mine: !!me && user_id === me.id }))

  // Caché de borde: la respuesta ANÓNIMA no lleva datos por-usuario (is_mine
  // siempre false) → cacheable 60s (la mayoría de lecturas son anónimas). La
  // respuesta AUTENTICADA lleva is_mine propio (lo usa la app por Bearer) →
  // nunca se cachea ni se comparte. `Vary` hace que el CDN particione por
  // credencial, así que una petición con cookie/Bearer nunca recibe la copia
  // anónima cacheada.
  const headers: Record<string, string> = { Vary: 'Authorization, Cookie' }
  if (me) {
    headers['Cache-Control'] = 'private, no-store'
  } else {
    headers['Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=120'
    headers['CDN-Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=120'
  }
  return NextResponse.json({ ok: true, comments: filtered }, { headers })
}

export async function POST(req: NextRequest) {
  // Rate-limit por IP además del rate-limit por user_id existente. Defiende
  // de cuentas creadas en bucle desde el mismo origen: 20 POSTs/hora por IP.
  const rl = await checkRateLimit({
    bucket: 'comments_post',
    key: getClientIp(req),
    windowSeconds: 3600,
    max: 20,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfter: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  let body: { slug?: unknown; body?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const text = typeof body.body === 'string' ? body.body.trim() : ''

  if (!slug) return NextResponse.json({ ok: false, error: 'slug_required' }, { status: 400 })
  // El slug viene del CMS (Sanity): minúsculas, dígitos y - _ . Validamos formato
  // y longitud para no aceptar paths manipulados (../) ni payloads enormes.
  if (slug.length > 200 || !/^[a-z0-9]([a-z0-9-_.]*[a-z0-9])?$/.test(slug)) {
    return NextResponse.json({ ok: false, error: 'invalid_slug' }, { status: 400 })
  }
  if (text.length === 0 || text.length > MAX_BODY_LEN) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  // Sesión Supabase: acepta cookies (web) o Authorization: Bearer (móvil).
  const user = await getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }

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

  // El comentario recién creado es del propio usuario → is_mine: true (mismo
  // shape que el GET; sin exponer user_id).
  return NextResponse.json({ ok: true, comment: { ...inserted, is_mine: true } })
}
