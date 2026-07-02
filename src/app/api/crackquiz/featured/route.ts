// Pregunta destacada del día para CrackQuiz. Permite que la redacción
// inyecte una pregunta de actualidad sin tocar el repo:
//
//   GET    /api/crackquiz/featured?day=YYYY-MM-DD     → { question | null }
//   POST   /api/crackquiz/featured  (x-admin-token)    → upsert
//   DELETE /api/crackquiz/featured?day=…  (x-admin-token)
//
// El cliente la pide en cada arranque de ronda y, si existe, la coloca
// como primera pregunta del día con un badge "Actualidad".

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/admin-auth'
import { apiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

async function isAdmin(req: NextRequest): Promise<boolean> {
  return isAdminRequest(req, {
    headerName: 'x-admin-token',
    tokenEnv: process.env.GAMES_ADMIN_TOKEN,
  })
}

interface FeaturedQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  category: string
}

function validate(q: unknown): FeaturedQuestion | null {
  if (!q || typeof q !== 'object') return null
  const c = q as Record<string, unknown>
  if (typeof c.id !== 'string' || c.id.length === 0) return null
  if (typeof c.question !== 'string' || c.question.length < 3) return null
  if (!Array.isArray(c.options) || c.options.length !== 4) return null
  if (!c.options.every(o => typeof o === 'string' && o.length > 0)) return null
  if (typeof c.correctIndex !== 'number' || c.correctIndex < 0 || c.correctIndex > 3) return null
  if (typeof c.category !== 'string' || c.category.length === 0) return null
  return c as unknown as FeaturedQuestion
}

function assertDay(day: string | null): day is string {
  return !!day && /^\d{4}-\d{2}-\d{2}$/.test(day)
}

export async function GET(req: NextRequest) {
  const day = new URL(req.url).searchParams.get('day')
  if (!assertDay(day)) {
    return NextResponse.json({ error: 'day (YYYY-MM-DD) required' }, { status: 400 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ question: null })
  const { data } = await admin
    .from('crackquiz_featured')
    .select('question')
    .eq('day_iso', day)
    .maybeSingle()
  return NextResponse.json(
    { question: data?.question ?? null },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } },
  )
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'admin client unavailable' }, { status: 503 })

  try {
    const body = await req.json() as { day?: string; question?: unknown }
    if (!assertDay(body.day ?? null)) {
      return NextResponse.json({ error: 'day (YYYY-MM-DD) required' }, { status: 400 })
    }
    const q = validate(body.question)
    if (!q) return NextResponse.json({ error: 'invalid question payload' }, { status: 400 })

    const { error } = await admin
      .from('crackquiz_featured')
      .upsert({ day_iso: body.day, question: q }, { onConflict: 'day_iso' })
    if (error) return apiError('server_error', 500)
    return NextResponse.json({ ok: true, day: body.day })
  } catch {
    return apiError('request_failed', 400)
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const day = new URL(req.url).searchParams.get('day')
  if (!assertDay(day)) {
    return NextResponse.json({ error: 'day (YYYY-MM-DD) required' }, { status: 400 })
  }
  const admin = adminSupabase()
  if (!admin) return NextResponse.json({ error: 'admin client unavailable' }, { status: 503 })
  const { error } = await admin.from('crackquiz_featured').delete().eq('day_iso', day)
  if (error) return apiError('server_error', 500)
  return NextResponse.json({ ok: true, day })
}
