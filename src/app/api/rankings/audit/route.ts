// GET /api/rankings/audit
//   ?entry=<id>           — filtra por entry específico
//   &category=<cat>       — filtra por categoría
//   &field=<col>          — filtra por columna editada (narrativa_manual, editorial_boost, …)
//   &outliers=1           — solo cambios de narrativa/boost con delta >=5
//   &limit=50             — máximo 200
//
// Lectura pública (transparencia). Si la migración 017 no se aplicó aún,
// devuelve [] sin error.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ edits: [] })
  }
  const url = new URL(req.url)
  const entry = url.searchParams.get('entry')
  const category = url.searchParams.get('category')
  const field = url.searchParams.get('field')
  const outliers = url.searchParams.get('outliers') === '1'
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  if (outliers) {
    const { data, error } = await sb
      .from('ranking_edits_narrative_outliers')
      .select('*')
      .limit(limit)
    if (error) return NextResponse.json({ edits: [], warning: error.message })
    return NextResponse.json({ edits: data ?? [] })
  }

  let q = sb
    .from('ranking_edits')
    .select('id, entry_id, category, field, old_value, new_value, reason, edited_by, edited_at')
    .order('edited_at', { ascending: false })
    .limit(limit)
  if (entry)    q = q.eq('entry_id', entry)
  if (category) q = q.eq('category', category)
  if (field)    q = q.eq('field', field)

  const { data, error } = await q
  if (error) return NextResponse.json({ edits: [], warning: error.message })
  return NextResponse.json({ edits: data ?? [] })
}
