// GET /api/rankings/[id]/badges — badges computados (streak / mover / debut)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 1800

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ badges: [] })
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data } = await sb.from('entry_badges').select('code, data, awarded_at').eq('entry_id', id)
  return NextResponse.json({ badges: data ?? [] })
}
