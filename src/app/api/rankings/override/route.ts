// Override editorial del Índice Taka — el editor mueve a placer cualquier campo.
//
// Auth: cabecera `x-admin-token` debe coincidir con env RANKINGS_ADMIN_TOKEN.
//
// Validación nueva (v2):
//   · Cualquier cambio sobre campos SUBJETIVOS (narrativa_manual,
//     editorial_boost, score_manual, rank_manual) exige `editorialNote`
//     no vacío en el mismo POST. Otros campos (insight, badge, locked…)
//     no lo requieren.
//   · Todo cambio se registra en `ranking_edits` (migración 017) con
//     valor previo, nuevo, razón, hash del token.
//
// Operaciones soportadas:
//
//   POST /api/rankings/override
//     body: { id, category, overrides: { rank?, score?, insight?, …, editorialNote? } }
//
//   DELETE /api/rankings/override?id=…&category=…&field=…
//     Limpia un override concreto (vuelve al valor auto).
//
// Tras cada cambio, revalida /rankings y /rankings/[id].

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createHash } from 'crypto'
import { adminSupabase } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/admin-auth'
import { apiError } from '@/lib/api-utils'

async function checkAuth(req: NextRequest): Promise<boolean> {
  return isAdminRequest(req, {
    headerName: 'x-admin-token',
    tokenEnv: process.env.RANKINGS_ADMIN_TOKEN,
  })
}

function tokenHash(req: NextRequest): string | null {
  const token = req.headers.get('x-admin-token')
  if (!token) return null
  return createHash('sha256').update(token).digest('hex').slice(0, 12)
}

// CSRF: las mutaciones por sesión (cookie) deben venir del propio sitio. Las
// llamadas server-to-server con x-admin-token no llevan Origin y las cubre la
// auth por token, así que se permiten.
function sameOriginOk(req: NextRequest): boolean {
  if (req.headers.get('x-admin-token')) return true
  const origin = req.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === req.headers.get('host') } catch { return false }
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

// Campos cuyo cambio requiere editorialNote no vacío
const SUBJECTIVE_FIELDS = new Set<string>([
  'narrativa_manual',
  'editorial_boost',
  'score_manual',
  'rank_manual',
])

async function logEdits(
  sb: ReturnType<typeof adminSupabase>,
  entryId: string,
  category: string,
  update: Record<string, unknown>,
  prev: Record<string, unknown> | null,
  reason: string | null,
  editor: string | null,
): Promise<void> {
  if (!sb) return
  const rows = Object.entries(update).map(([field, newValue]) => ({
    entry_id:  entryId,
    category,
    field,
    old_value: prev ? (prev[field] ?? null) : null,
    new_value: newValue ?? null,
    reason,
    edited_by: editor,
  }))
  if (rows.length === 0) return
  // Insert silencioso: si la tabla no existe (migración 017 sin aplicar)
  // no rompemos el override.
  const { error } = await sb.from('ranking_edits').insert(rows)
  if (error && process.env.NODE_ENV !== 'production') {
    console.warn('[override] audit log skipped:', error.message)
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!sameOriginOk(req)) return NextResponse.json({ error: 'bad origin' }, { status: 403 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  let body: { id?: string; category?: string; overrides?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { id, category, overrides } = body ?? {}
  if (!id || !category || !overrides || typeof overrides !== 'object') {
    return NextResponse.json({ error: 'missing id/category/overrides' }, { status: 400 })
  }

  // Mapea API → columnas DB
  const update: Record<string, unknown> = {}
  if ('rank' in overrides)             update.rank_manual            = overrides.rank
  if ('score' in overrides)            update.score_manual           = overrides.score
  if ('insight' in overrides)          update.insight_manual         = overrides.insight
  if ('trendReason' in overrides)      update.trend_reason_manual    = overrides.trendReason
  if ('badge' in overrides)            update.badge_manual           = overrides.badge
  if ('trend' in overrides)            update.trend_manual           = overrides.trend
  if ('editorialBoost' in overrides)   update.editorial_boost        = overrides.editorialBoost
  if ('editorialNote' in overrides)    update.editorial_note         = overrides.editorialNote
  if ('locked' in overrides)           update.editorial_locked       = overrides.locked
  const f = overrides.factors as Record<string, unknown> | undefined
  if (f && typeof f === 'object') {
    if ('rendimiento' in f) update.rendimiento_manual = f.rendimiento
    if ('contexto'    in f) update.contexto_manual    = f.contexto
    if ('mediatico'   in f) update.mediatico_manual   = f.mediatico
    if ('narrativa'   in f) update.narrativa_manual   = f.narrativa
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no override fields' }, { status: 400 })
  }

  // Si toca un campo subjetivo, exige editorialNote (en este POST o ya en DB)
  const touchesSubjective = Object.keys(update).some(k => SUBJECTIVE_FIELDS.has(k))
  const reason = typeof overrides.editorialNote === 'string'
    ? overrides.editorialNote.trim()
    : ''
  if (touchesSubjective && !reason) {
    return NextResponse.json({
      error: 'editorialNote required when editing narrativa, score, rank or editorial_boost',
      touchedSubjective: Object.keys(update).filter(k => SUBJECTIVE_FIELDS.has(k)),
    }, { status: 400 })
  }

  // Lee estado previo (para audit diff)
  const { data: prevRow } = await sb
    .from('ranking_entries')
    .select(OVERRIDE_FIELDS.join(','))
    .eq('id', id)
    .eq('category', category)
    .maybeSingle()

  const { data, error } = await sb
    .from('ranking_entries')
    .update(update)
    .eq('id', id)
    .eq('category', category)
    .select()
    .single()

  if (error) return apiError('server_error', 500)

  // Audit log (fire-and-forget; no falla el override si la tabla no existe)
  const editor = tokenHash(req)
  await logEdits(
    sb,
    id,
    category,
    update,
    (prevRow as Record<string, unknown> | null) ?? null,
    reason || null,
    editor,
  )

  revalidatePath('/rankings')
  revalidatePath(`/rankings/${id}`)
  // Refresca la foto materializada ranking_view → el cambio del admin se ve ya.
  const { error: refErr } = await sb.rpc('refresh_ranking_view')
  if (refErr) console.error('[override] refresh_ranking_view falló:', refErr.message)
  return NextResponse.json({ ok: true, entry: data })
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAuth(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!sameOriginOk(req)) return NextResponse.json({ error: 'bad origin' }, { status: 403 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const category = url.searchParams.get('category')
  const field = url.searchParams.get('field') ?? 'all'
  const reason = url.searchParams.get('reason') ?? null

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

  // Audit diff
  const { data: prevRow } = await sb
    .from('ranking_entries')
    .select(OVERRIDE_FIELDS.join(','))
    .eq('id', id)
    .eq('category', category)
    .maybeSingle()

  const { error } = await sb
    .from('ranking_entries')
    .update(update)
    .eq('id', id)
    .eq('category', category)

  if (error) return apiError('server_error', 500)

  const editor = tokenHash(req)
  await logEdits(
    sb,
    id,
    category,
    update,
    (prevRow as Record<string, unknown> | null) ?? null,
    reason,
    editor,
  )

  revalidatePath('/rankings')
  revalidatePath(`/rankings/${id}`)
  // Refresca la foto materializada ranking_view → el cambio del admin se ve ya.
  const { error: refErr } = await sb.rpc('refresh_ranking_view')
  if (refErr) console.error('[override] refresh_ranking_view falló:', refErr.message)
  return NextResponse.json({ ok: true, cleared: field })
}
