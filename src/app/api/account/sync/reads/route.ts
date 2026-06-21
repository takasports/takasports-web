// POST /api/account/sync/reads — sincroniza el historial de artículos leídos
// entre el navegador (localStorage `ts_recently_read`) y la cuenta (tabla
// read_history). Sube los items que manda el cliente (merge invitado→cuenta) y
// devuelve la lista fusionada del usuario para que el cliente la refleje.
//
// Mismo candado que el resto de /api/account: autentica por cookie; sin sesión
// devuelve 401 (best-effort para invitados). Escribe con service_role (la RLS
// de read_history solo permite SELECT desde cliente), siempre filtrando por el
// user.id autenticado → nunca toca filas de terceros.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

interface ReadItem {
  slug: string
  title: string
  sport?: string
  category?: string
  publishedAt?: string
  imageUrl?: string
}

const MAX_UPLOAD = 50  // items aceptados por petición
const MAX_RETURN = 50  // items devueltos (el cliente recorta para la UI)

function isoOrNull(v: unknown): string | null {
  return typeof v === 'string' && !isNaN(Date.parse(v)) ? v : null
}

export async function POST(req: NextRequest) {
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 })
  }

  const rl = await checkRateLimit({
    bucket: 'sync_reads',
    key: `${getClientIp(req)}:${user.id}`,
    windowSeconds: 60,
    max: 60,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const admin = adminSupabase()
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  // 1) Subir lo que manda el cliente (si trae algo válido).
  const body = await req.json().catch(() => null)
  const incoming: unknown[] = Array.isArray(body?.items) ? body.items : []
  const nowIso = new Date().toISOString()
  const rows = incoming
    .filter((it): it is ReadItem => !!it && typeof (it as ReadItem).slug === 'string' && (it as ReadItem).slug.length > 0)
    .slice(0, MAX_UPLOAD)
    .map((it) => ({
      user_id:      user.id,
      slug:         it.slug,
      title:        typeof it.title === 'string' ? it.title : null,
      sport:        typeof it.sport === 'string' ? it.sport : null,
      category:     typeof it.category === 'string' ? it.category : null,
      published_at: isoOrNull(it.publishedAt),
      image_url:    typeof it.imageUrl === 'string' ? it.imageUrl : null,
      read_at:      nowIso,
    }))

  if (rows.length > 0) {
    await admin.from('read_history').upsert(rows, { onConflict: 'user_id,slug' })
  }

  // 2) Devolver la lista fusionada (lo más reciente primero).
  const { data } = await admin
    .from('read_history')
    .select('slug,title,sport,category,published_at,image_url,read_at')
    .eq('user_id', user.id)
    .order('read_at', { ascending: false })
    .limit(MAX_RETURN)

  const items: ReadItem[] = (data ?? []).map((r) => ({
    slug:        r.slug as string,
    title:       (r.title as string) ?? '',
    sport:       (r.sport as string) ?? undefined,
    category:    (r.category as string) ?? undefined,
    publishedAt: (r.published_at as string) ?? undefined,
    imageUrl:    (r.image_url as string) ?? undefined,
  }))

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
}
