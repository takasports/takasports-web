// /api/admin/cron-health
// Devuelve estado de cada snapshot Supabase (cuándo fue el último cron OK,
// edad en horas, alarma si lleva > 8d sin actualizarse).
//
// Auth: misma CRON_SECRET. Llamada típica:
//   curl -H "x-cron-secret: XXX" https://takasportsmedia.com/api/admin/cron-health
//   o con Authorization: Bearer XXX (cron de Vercel).
// `?secret=` quedó deprecado (filtra en logs/referer) — ya no se acepta.
//
// Esperable: todos los blocks con ageHours < 168h (1 semana) excepto los
// snapshots editoriales raros. Si algún score es 'red', un cron rompió
// silenciosamente y hay que mirar el scraper.

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

interface BlockHealth {
  blockId: string
  source: string
  asOf: string | null
  updatedAt: string
  ageHours: number
  status: 'green' | 'yellow' | 'red'
}

// Umbrales por tipo de cron (en horas).
const THRESHOLDS: Record<string, { yellow: number; red: number }> = {
  // crons semanales (UFC + MotoGP): yellow > 8 días, red > 14 días
  'motogp-pilotos':       { yellow: 192, red: 336 },
  'motogp-constructores': { yellow: 192, red: 336 },
  'ufc-p4p':              { yellow: 192, red: 336 },
  'ufc-campeones':        { yellow: 192, red: 336 },
  // cron diario Elo: yellow > 36h, red > 72h
  'ranking-fifa':         { yellow: 36,  red: 72 },
}
// Default para divisiones UFC y otros (semanales)
const DEFAULT_THRESHOLD = { yellow: 192, red: 336 }

function classify(blockId: string, ageH: number): BlockHealth['status'] {
  const t = THRESHOLDS[blockId] ?? DEFAULT_THRESHOLD
  if (ageH > t.red) return 'red'
  if (ageH > t.yellow) return 'yellow'
  return 'green'
}

async function handle(req: Request) {
  // CRON_SECRET es obligatorio: si no está configurado, el endpoint queda cerrado.
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ ok: false, error: 'supabase_not_configured' }, { status: 503 })

  const { data, error } = await sb
    .from('stat_block_snapshots')
    .select('block_id, source, as_of, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const now = Date.now()
  const blocks: BlockHealth[] = (data ?? []).map(r => {
    const updatedAt = new Date(r.updated_at as string)
    const ageHours = Math.round((now - updatedAt.getTime()) / 3600_000 * 10) / 10
    return {
      blockId: r.block_id as string,
      source: r.source as string,
      asOf: r.as_of as string | null,
      updatedAt: r.updated_at as string,
      ageHours,
      status: classify(r.block_id as string, ageHours),
    }
  })

  const summary = {
    total: blocks.length,
    green: blocks.filter(b => b.status === 'green').length,
    yellow: blocks.filter(b => b.status === 'yellow').length,
    red: blocks.filter(b => b.status === 'red').length,
  }
  const allHealthy = summary.red === 0 && summary.yellow === 0

  return NextResponse.json({
    ok: allHealthy,
    summary,
    blocks: blocks.sort((a, b) => b.ageHours - a.ageHours), // más viejo primero
  })
}

export async function GET(req: Request)  { return handle(req) }
export async function POST(req: Request) { return handle(req) }
