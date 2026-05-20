// Once editorial publicado por la redacción para una semana ISO.
//   GET    /api/mionce/editorial?week=YYYY-Www → { editorial | null }
//   POST   /api/mionce/editorial  (x-admin-token)
//   DELETE /api/mionce/editorial?week=…  (x-admin-token)
//
// El cliente lo usa para comparar las picks del usuario contra el canónico
// tras cerrar el once (coincidencias X/11).

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

interface EditorialPayload {
  title: string
  formation: string
  slots: Record<string, string>
  note?: string
}

const ALLOWED_FORMATIONS = new Set(['4-3-3', '4-4-2', '3-5-2', '4-2-3-1'])

function assertWeek(s: string | null): s is string {
  return !!s && /^\d{4}-W\d{2}$/.test(s)
}

function validate(body: unknown): EditorialPayload | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const title = typeof b.title === 'string' && b.title.length > 1 ? b.title.slice(0, 80) : null
  const formation = typeof b.formation === 'string' && ALLOWED_FORMATIONS.has(b.formation) ? b.formation : null
  if (!title || !formation) return null
  if (!b.slots || typeof b.slots !== 'object') return null
  const slotsIn = b.slots as Record<string, unknown>
  const slots: Record<string, string> = {}
  for (const [k, v] of Object.entries(slotsIn)) {
    if (typeof k !== 'string' || k.length === 0) continue
    if (typeof v !== 'string' || v.length === 0) continue
    slots[k.slice(0, 16)] = v.slice(0, 64)
  }
  if (Object.keys(slots).length === 0 || Object.keys(slots).length > 11) return null
  const note = typeof b.note === 'string' ? b.note.slice(0, 240) : undefined
  return { title, formation, slots, note }
}

export async function GET(req: NextRequest) {
  const week = new URL(req.url).searchParams.get('week')
  if (!assertWeek(week)) {
    return NextResponse.json({ error: 'week (YYYY-Www) required' }, { status: 400 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ editorial: null })

  const { data } = await admin
    .from('mionce_editorial')
    .select('title, formation, slots, note')
    .eq('week_iso', week)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ editorial: null }, {
      headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
    })
  }

  return NextResponse.json({
    editorial: {
      title:     data.title,
      formation: data.formation,
      slots:     data.slots ?? {},
      note:      data.note ?? null,
    },
  }, {
    headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
  })
}

export async function POST(req: NextRequest) {
  const expected = process.env.GAMES_ADMIN_TOKEN
  const provided = req.headers.get('x-admin-token') ?? ''
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'admin client unavailable' }, { status: 503 })

  try {
    const body = await req.json() as { week?: string }
    if (!assertWeek(body.week ?? null)) {
      return NextResponse.json({ error: 'week (YYYY-Www) required' }, { status: 400 })
    }
    const p = validate(body)
    if (!p) return NextResponse.json({ error: 'invalid editorial payload' }, { status: 400 })

    const { error } = await admin
      .from('mionce_editorial')
      .upsert({
        week_iso:  body.week,
        title:     p.title,
        formation: p.formation,
        slots:     p.slots,
        note:      p.note ?? null,
      }, { onConflict: 'week_iso' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, week: body.week })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const expected = process.env.GAMES_ADMIN_TOKEN
  const provided = req.headers.get('x-admin-token') ?? ''
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const week = new URL(req.url).searchParams.get('week')
  if (!assertWeek(week)) {
    return NextResponse.json({ error: 'week (YYYY-Www) required' }, { status: 400 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'admin client unavailable' }, { status: 503 })
  const { error } = await admin.from('mionce_editorial').delete().eq('week_iso', week)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, week })
}
