// Consenso real de la quiniela — lee picks agregados desde Supabase.
// Si Supabase no está configurado o no hay datos, devuelve { rows: [] }
// y el cliente cae al fallback heurístico.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { apiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

interface ConsensusRow {
  home: string
  away: string
  p1: number
  px: number
  p2: number
  total: number
}

export async function GET(req: NextRequest) {
  const jornada = new URL(req.url).searchParams.get('jornada')
  if (!jornada) return NextResponse.json({ error: 'jornada required' }, { status: 400 })
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ rows: [] })
  }
  try {
    const sb = await createServerSupabaseClient()
    const { data, error } = await sb.rpc('quiniela_consensus', { p_jornada: jornada })
    if (error) return apiError('request_failed', 200, { rows: [] })
    const rows = (data ?? []) as ConsensusRow[]
    return NextResponse.json({ rows }, {
      headers: { 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (e) {
    return apiError('request_failed', 200, { rows: [] })
  }
}
