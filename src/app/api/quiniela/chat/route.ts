// Chat de ligas — mensajes sencillos por liga.
// GET    /api/quiniela/chat?liga=XXXX&limit=30   → últimos N mensajes
// POST   /api/quiniela/chat                       → enviar mensaje (rate-limited)
// DELETE /api/quiniela/chat?id=...                → borrar mensaje (autor o owner liga)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { apiError, readJson, sanitizeNickname } from '@/lib/api-utils'
import { captureException } from '@/lib/monitoring'

// Fallback in-memory si Supabase no está disponible o la tabla no existe
const memChat = new Map<string, Array<{ id: string; nickname: string; message: string; created_at: string; user_id?: string | null }>>()

// ── Rate limit en memoria (ventana móvil) ───────────────────────
// Single-instance: suficiente para Vercel free tier; multi-region
// requeriría Redis. Cap por key (user_id o IP cuando no hay auth).
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 8
const RATE_MIN_GAP_MS = 4_000
const rateBuckets = new Map<string, number[]>()
function rateLimit(key: string): { ok: true } | { ok: false; retryMs: number; reason: 'gap' | 'burst' } {
  const now = Date.now()
  const arr = (rateBuckets.get(key) ?? []).filter(t => now - t < RATE_WINDOW_MS)
  if (arr.length > 0 && now - arr[arr.length - 1] < RATE_MIN_GAP_MS) {
    return { ok: false, retryMs: RATE_MIN_GAP_MS - (now - arr[arr.length - 1]), reason: 'gap' }
  }
  if (arr.length >= RATE_MAX) {
    return { ok: false, retryMs: RATE_WINDOW_MS - (now - arr[0]), reason: 'burst' }
  }
  arr.push(now)
  rateBuckets.set(key, arr)
  return { ok: true }
}
function clientKey(req: NextRequest, userId: string | null): string {
  if (userId) return `u:${userId}`
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return `ip:${fwd ?? 'unknown'}`
}

// Detecta errores que significan "la tabla quiniela_league_chat no existe":
// - 42P01: Postgres "undefined_table"
// - PGRST200/PGRST205: PostgREST schema cache (común al desplegar antes de la migración)
// - PGRST106: PostgREST nominal "table not found"
function isMissingTable(err: { code?: string | null; message?: string } | null): boolean {
  if (!err) return false
  const code = err.code ?? ''
  if (code === '42P01' || code.startsWith('PGRST')) return true
  return /(could not find the table|relation .* does not exist|schema cache)/i.test(err.message ?? '')
}

export async function GET(req: NextRequest) {
  const liga  = req.nextUrl.searchParams.get('liga')?.toUpperCase()
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10), 100)
  if (!liga) return NextResponse.json({ error: 'liga required' }, { status: 400 })

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Autenticado por cookie (web) O Bearer (app): el chat es de ligas PRIVADAS
    // y la RLS solo deja leer a miembros/owner. Un no-miembro recibe lista vacía.
    const { supabase: sb } = await supabaseForRequest(req)
    const { data, error } = await sb
      .from('quiniela_league_chat')
      .select('id, nickname, message, created_at')
      .eq('league_id', liga)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      // Si la tabla no existe (migración no aplicada), fallback a memoria
      if (isMissingTable(error)) {
        return NextResponse.json((memChat.get(liga) ?? []).slice(-limit))
      }
      return apiError('server_error', 500)
    }
    return NextResponse.json((data ?? []).reverse())
  }

  return NextResponse.json((memChat.get(liga) ?? []).slice(-limit))
}

export async function POST(req: NextRequest) {
  const parsed = await readJson<{ liga?: string; message?: string; nickname?: string }>(req)
  if ('error' in parsed) return parsed.error
  const { liga, message, nickname: rawNick } = parsed.data
  try {
    const ligaId = liga?.toUpperCase()
    const msg = String(message ?? '').trim().slice(0, 280)
    if (!ligaId || !msg) return NextResponse.json({ error: 'liga and message required' }, { status: 400 })

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { supabase: sb, user } = await supabaseForRequest(req)
      // Postear en una liga privada exige sesión (la RLS exige membership). Antes
      // se admitían mensajes anónimos (user_id NULL) en cualquier liga.
      if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
      const rl = rateLimit(`${clientKey(req, user?.id ?? null)}:${ligaId}`)
      if (!rl.ok) {
        return NextResponse.json(
          { error: rl.reason === 'gap' ? 'demasiado rápido — espera unos segundos' : 'demasiados mensajes — calma', retryMs: rl.retryMs },
          { status: 429, headers: { 'retry-after': String(Math.ceil(rl.retryMs / 1000)) } },
        )
      }
      const nickname = sanitizeNickname(rawNick) || sanitizeNickname(user?.email?.split('@')[0]) || 'Anon'
      const { error } = await sb.from('quiniela_league_chat').insert({
        league_id: ligaId,
        user_id: user?.id ?? null,
        nickname,
        message: msg,
      })
      if (error) {
        if (isMissingTable(error)) {
          // tabla no creada aún, usar memoria
        } else {
          return apiError('server_error', 500)
        }
      } else {
        return NextResponse.json({ ok: true })
      }
    }

    // Fallback in-memory
    const rl = rateLimit(`${clientKey(req, null)}:${ligaId}`)
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'demasiado rápido — espera unos segundos', retryMs: rl.retryMs },
        { status: 429, headers: { 'retry-after': String(Math.ceil(rl.retryMs / 1000)) } },
      )
    }
    const nickname = sanitizeNickname(rawNick) || 'Anon'
    const msgs = memChat.get(ligaId) ?? []
    msgs.push({ id: Date.now().toString(), nickname, message: msg, created_at: new Date().toISOString() })
    if (msgs.length > 200) msgs.splice(0, msgs.length - 200)
    memChat.set(ligaId, msgs)
    return NextResponse.json({ ok: true })
  } catch (e) {
    captureException(e, { route: 'quiniela/chat' })
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { supabase: sb, user } = await supabaseForRequest(req)
    if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 })
    // RLS hace el control: solo autor del mensaje o owner de la liga puede borrar.
    const { error, count } = await sb
      .from('quiniela_league_chat')
      .delete({ count: 'exact' })
      .eq('id', id)
    if (error) return apiError('server_error', 500)
    if ((count ?? 0) === 0) return NextResponse.json({ error: 'forbidden or not found' }, { status: 403 })
    return NextResponse.json({ ok: true })
  }

  // Fallback in-memory: cualquiera puede borrar (no hay auth) — solo dev/local
  for (const [liga, msgs] of memChat) {
    const idx = msgs.findIndex(m => m.id === id)
    if (idx >= 0) {
      msgs.splice(idx, 1)
      memChat.set(liga, msgs)
      return NextResponse.json({ ok: true })
    }
  }
  return NextResponse.json({ error: 'not found' }, { status: 404 })
}
