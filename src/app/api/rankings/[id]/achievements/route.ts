import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 1800

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ achievements: [] })
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data } = await sb.from('entry_achievements')
    .select('achievement_code, period, category, data, awarded_at')
    .eq('entry_id', id)
    .order('period', { ascending: false })
  return NextResponse.json({ achievements: data ?? [] })
}
