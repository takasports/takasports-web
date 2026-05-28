// Puzzle destacado de Sopa de Cracks por semana ISO. La redacción puede
// inyectar un puzzle temático sin tocar el repo. Si no hay nada para la
// semana en curso, el cliente cae al pool estático de PUZZLES.
//
//   GET    /api/sopa-cracks/featured?week=YYYY-Www → { puzzle | null }
//   POST   /api/sopa-cracks/featured  (x-admin-token)  → upsert
//   DELETE /api/sopa-cracks/featured?week=…  (x-admin-token)

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

async function isAdmin(req: NextRequest): Promise<boolean> {
  return isAdminRequest(req, {
    headerName: 'x-admin-token',
    tokenEnv: process.env.GAMES_ADMIN_TOKEN,
  })
}

interface FeaturedPuzzle {
  title: string
  subtitle: string
  size: number
  words: string[]
  intruder?: string
}

function assertWeek(s: string | null): s is string {
  return !!s && /^\d{4}-W\d{2}$/.test(s)
}

function sanitizeWord(w: unknown): string | null {
  if (typeof w !== 'string') return null
  const cleaned = w.trim().toUpperCase().replace(/[^A-ZÑ]/g, '')
  if (cleaned.length < 3 || cleaned.length > 16) return null
  return cleaned
}

function validate(body: unknown): FeaturedPuzzle | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const title = typeof b.title === 'string' && b.title.length > 2 ? b.title.slice(0, 80) : null
  const subtitle = typeof b.subtitle === 'string' ? b.subtitle.slice(0, 200) : null
  if (!title || subtitle === null) return null
  const size = typeof b.size === 'number' && b.size >= 10 && b.size <= 16
    ? Math.floor(b.size)
    : 13
  if (!Array.isArray(b.words)) return null
  const words: string[] = []
  for (const w of b.words) {
    const c = sanitizeWord(w)
    if (c) words.push(c)
  }
  if (words.length < 5 || words.length > 14) return null
  const intruder = sanitizeWord(b.intruder) ?? undefined
  return { title, subtitle, size, words, intruder }
}

export async function GET(req: NextRequest) {
  const week = new URL(req.url).searchParams.get('week')
  if (!assertWeek(week)) {
    return NextResponse.json({ error: 'week (YYYY-Www) required' }, { status: 400 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ puzzle: null })

  const { data } = await admin
    .from('sopa_cracks_featured')
    .select('title, subtitle, size, words, intruder')
    .eq('week_iso', week)
    .maybeSingle()

  if (!data) return NextResponse.json({ puzzle: null }, {
    headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
  })

  return NextResponse.json({
    puzzle: {
      title:    data.title,
      subtitle: data.subtitle,
      size:     data.size,
      words:    data.words,
      intruder: data.intruder ?? undefined,
    },
  }, {
    headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300' },
  })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
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
    if (!p) return NextResponse.json({ error: 'invalid puzzle payload' }, { status: 400 })

    const { error } = await admin
      .from('sopa_cracks_featured')
      .upsert({
        week_iso: body.week,
        title:    p.title,
        subtitle: p.subtitle,
        size:     p.size,
        words:    p.words,
        intruder: p.intruder ?? null,
      }, { onConflict: 'week_iso' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, week: body.week })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const week = new URL(req.url).searchParams.get('week')
  if (!assertWeek(week)) {
    return NextResponse.json({ error: 'week (YYYY-Www) required' }, { status: 400 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'admin client unavailable' }, { status: 503 })
  const { error } = await admin.from('sopa_cracks_featured').delete().eq('week_iso', week)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, week })
}
