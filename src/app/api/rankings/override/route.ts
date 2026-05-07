// Override editorial del Índice Taka — el editor mueve a placer cualquier campo.
//
// Auth: cabecera `x-admin-token` debe coincidir con env RANKINGS_ADMIN_TOKEN.
//
// Operaciones soportadas:
//
//   POST /api/rankings/override
//     body: {
//       id: 'haaland',
//       category: 'jugadores',
//       overrides: {
//         rank?: number,           // mover en el ranking
//         score?: number,
//         insight?: string,
//         trendReason?: string,
//         factors?: { rendimiento?, contexto?, mediatico?, narrativa? },
//         badge?: string,
//         editorialBoost?: number,
//         editorialNote?: string,
//         locked?: boolean,        // bloquea la entrada del cron
//       }
//     }
//
//   DELETE /api/rankings/override?id=haaland&category=jugadores&field=rank
//     Limpia un override concreto (vuelve a usar el valor auto).
//     field=all → limpia todos los overrides de la entrada.
//
// Tras cada cambio, dispara revalidate('/rankings').

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminSupabase } from '@/lib/supabase-admin'

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token')
  const expected = process.env.RANKINGS_ADMIN_TOKEN
  return Boolean(expected && token === expected)
}

const OVERRIDE_FIELDS = [
  'rank_manual',
  'score_manual',
  'insight_manual',
  'trend_reason_manual',
  'rendimiento_manual',
  'contexto_manual',
  'mediatico_manual',
  'narrativa_manual',
  'badge_manual',
  'trend_manual',
  'editorial_boost',
  'editorial_note',
  'editorial_locked',
] as const

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { id, category, overrides } = body ?? {}
  if (!id || !category || !overrides || typeof overrides !== 'object') {
    return NextResponse.json({ error: 'missing id/category/overrides' }, { status: 400 })
  }

  // Mapea API → columnas DB
  const update: Record<string, any> = {}
  if ('rank' in overrides)             update.rank_manual            = overrides.rank
  if ('score' in overrides)            update.score_manual           = overrides.score
  if ('insight' in overrides)          update.insight_manual         = overrides.insight
  if ('trendReason' in overrides)      update.trend_reason_manual    = overrides.trendReason
  if ('badge' in overrides)            update.badge_manual           = overrides.badge
  if ('trend' in overrides)            update.trend_manual           = overrides.trend
  if ('editorialBoost' in overrides)   update.editorial_boost        = overrides.editorialBoost
  if ('editorialNote' in overrides)    update.editorial_note         = overrides.editorialNote
  if ('locked' in overrides)           update.editorial_locked       = overrides.locked
  if (overrides.factors && typeof overrides.factors === 'object') {
    if ('rendimiento' in overrides.factors) update.rendimiento_manual = overrides.factors.rendimiento
    if ('contexto'    in overrides.factors) update.contexto_manual    = overrides.factors.contexto
    if ('mediatico'   in overrides.factors) update.mediatico_manual   = overrides.factors.mediatico
    if ('narrativa'   in overrides.factors) update.narrativa_manual   = overrides.factors.narrativa
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no override fields' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('ranking_entries')
    .update(update)
    .eq('id', id)
    .eq('category', category)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/rankings')
  return NextResponse.json({ ok: true, entry: data })
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const category = url.searchParams.get('category')
  const field = url.searchParams.get('field') ?? 'all'

  if (!id || !category) {
    return NextResponse.json({ error: 'missing id or category' }, { status: 400 })
  }

  const update: Record<string, null> = {}
  if (field === 'all') {
    for (const f of OVERRIDE_FIELDS) update[f] = null
  } else {
    const map: Record<string, string> = {
      rank: 'rank_manual', score: 'score_manual', insight: 'insight_manual',
      trendReason: 'trend_reason_manual', badge: 'badge_manual', trend: 'trend_manual',
      editorialBoost: 'editorial_boost', editorialNote: 'editorial_note',
      locked: 'editorial_locked',
      'factors.rendimiento': 'rendimiento_manual',
      'factors.contexto':    'contexto_manual',
      'factors.mediatico':   'mediatico_manual',
      'factors.narrativa':   'narrativa_manual',
    }
    const col = map[field]
    if (!col) return NextResponse.json({ error: `unknown field: ${field}` }, { status: 400 })
    update[col] = null
  }

  const { error } = await sb
    .from('ranking_entries')
    .update(update)
    .eq('id', id)
    .eq('category', category)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/rankings')
  return NextResponse.json({ ok: true, cleared: field })
}
