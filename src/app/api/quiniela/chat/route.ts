// Chat de ligas — mensajes sencillos por liga.
// GET  /api/quiniela/chat?liga=XXXX&limit=30   → últimos N mensajes
// POST /api/quiniela/chat                       → enviar mensaje

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Fallback in-memory si Supabase no está disponible o la tabla no existe
const memChat = new Map<string, Array<{ id: string; nickname: string; message: string; created_at: string }>>()

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
    const sb = await createServerSupabaseClient()
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json((data ?? []).reverse())
  }

  return NextResponse.json((memChat.get(liga) ?? []).slice(-limit))
}

export async function POST(req: NextRequest) {
  try {
    const { liga, message, nickname: rawNick } = await req.json() as { liga: string; message: string; nickname?: string }
    const ligaId = liga?.toUpperCase()
    const msg = String(message ?? '').trim().slice(0, 280)
    if (!ligaId || !msg) return NextResponse.json({ error: 'liga and message required' }, { status: 400 })

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const sb = await createServerSupabaseClient()
      const { data: { user } } = await sb.auth.getUser()
      const nickname = (rawNick ?? user?.email?.split('@')[0] ?? 'Anon').slice(0, 24)
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
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      } else {
        return NextResponse.json({ ok: true })
      }
    }

    // Fallback in-memory
    const nickname = (rawNick ?? 'Anon').slice(0, 24)
    const msgs = memChat.get(ligaId) ?? []
    msgs.push({ id: Date.now().toString(), nickname, message: msg, created_at: new Date().toISOString() })
    if (msgs.length > 200) msgs.splice(0, msgs.length - 200)
    memChat.set(ligaId, msgs)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
