// Ingesta del Índice Taka — endpoint que llama el cron n8n.
//
// Auth: cabecera `x-admin-token` con env RANKINGS_ADMIN_TOKEN.
//
// Cuerpo:
//   {
//     category: 'jugadores',
//     entries: [
//       {
//         id: 'haaland',
//         name: 'Erling Haaland', subtitle: 'Manchester City · Delantero',
//         sport: 'futbol', emoji: '🇳🇴', country: '🇳🇴',
//         league: 'premier', position: 'delantero', region: 'europa',
//         badge: null,
//         factors: { rendimiento: 84, contexto: 78, mediatico: 88, narrativa: 78 },
//         insight: '...',
//         trendReason: '...',
//       },
//       ...
//     ],
//     promoteSnapshot: true   // al final, llama f_ranking_promote_snapshot
//   }
//
// Comportamiento:
//   · Para cada entry, hace UPSERT respetando editorial_locked.
//   · Si la entrada está locked → no toca NADA, solo cuenta como skipped.
//   · Si no, escribe SOLO los campos *_auto (los _manual quedan intactos).
//   · Calcula score_auto desde factors con la fórmula canónica.
//   · Llama f_ranking_recompute_trends al final.
//   · Si promoteSnapshot=true, congela snapshot y promueve score_auto → score_prev.

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminSupabase } from '@/lib/supabase-admin'

function checkAuth(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token')
  const expected = process.env.RANKINGS_ADMIN_TOKEN
  return Boolean(expected && token === expected)
}

// Fórmula canónica del Índice Taka (espejada de rankings.ts:calcScore)
function calcScore(f: { rendimiento: number; contexto: number; mediatico: number; narrativa: number }) {
  const base = f.rendimiento * 0.35 + f.contexto * 0.25 + f.mediatico * 0.25 + f.narrativa * 0.15
  return Math.round(Math.max(0, Math.min(100, base)) * 10) / 10
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { category, entries, promoteSnapshot = false } = body ?? {}
  if (!category || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'missing category/entries' }, { status: 400 })
  }

  // Crear ingest run para auditoría
  const { data: runRow } = await sb
    .from('ranking_ingest_runs')
    .insert({ source: 'n8n', category, entries_fetched: entries.length, status: 'running' })
    .select('id')
    .single()
  const runId = runRow?.id

  // Carga las entradas existentes en bloque para saber cuáles están locked
  const { data: existing } = await sb
    .from('ranking_entries')
    .select('id, editorial_locked')
    .eq('category', category)
  const lockedIds = new Set((existing ?? []).filter(r => r.editorial_locked).map(r => r.id))

  let updated = 0, skipped = 0
  const errors: any[] = []

  // Asignar rank_auto por orden de score_auto descendente
  const computed = entries.map((e: any) => {
    const factors = e.factors ?? { rendimiento: 0, contexto: 0, mediatico: 0, narrativa: 0 }
    return { ...e, _score: calcScore(factors), _factors: factors }
  })
  computed.sort((a: any, b: any) => b._score - a._score)
  computed.forEach((e: any, i: number) => { e._rank = i + 1 })

  for (const e of computed) {
    if (lockedIds.has(e.id)) { skipped++; continue }

    const row: Record<string, any> = {
      id: e.id,
      category,
      name: e.name,
      subtitle: e.subtitle ?? null,
      sport: e.sport ?? null,
      emoji: e.emoji ?? null,
      image_url: e.image ?? e.imageUrl ?? null,
      country: e.country ?? null,
      league: e.league ?? null,
      position: e.position ?? null,
      region: e.region ?? null,
      gender: e.gender ?? null,
      badge: e.badge ?? null,
      featured: e.featured ?? false,
      // Capa AUTO (SOLO esta — los _manual nunca se tocan aquí)
      rendimiento_auto: e._factors.rendimiento,
      contexto_auto:    e._factors.contexto,
      mediatico_auto:   e._factors.mediatico,
      narrativa_auto:   e._factors.narrativa,
      score_auto:       e._score,
      rank_auto:        e._rank,
      insight_auto:     e.insight ?? null,
      trend_reason_auto: e.trendReason ?? null,
      last_auto_update: new Date().toISOString(),
      active:           true,
    }

    const { error } = await sb
      .from('ranking_entries')
      .upsert(row, { onConflict: 'id,category' })
    if (error) errors.push({ id: e.id, error: error.message })
    else updated++
  }

  // Recalcula trend_auto comparando score_auto vs score_prev
  await sb.rpc('f_ranking_recompute_trends')

  // Snapshot opcional (final del ciclo semanal)
  if (promoteSnapshot) {
    await sb.rpc('f_ranking_promote_snapshot', { p_category: category })
  }

  // Cierra el run
  await sb
    .from('ranking_ingest_runs')
    .update({
      status: errors.length === 0 ? 'success' : 'partial',
      finished_at: new Date().toISOString(),
      entries_updated: updated,
      entries_skipped: skipped,
      errors: errors.length ? errors : null,
    })
    .eq('id', runId)

  revalidatePath('/rankings')
  revalidatePath('/rankings/comparar')
  revalidatePath('/rankings/[id]', 'page')

  return NextResponse.json({
    ok: true,
    runId,
    category,
    fetched: entries.length,
    updated,
    skipped_locked: skipped,
    errors: errors.length,
  })
}

// GET → estado del último run (debug rápido)
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

  const { data } = await sb
    .from('ranking_ingest_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ runs: data ?? [] })
}
