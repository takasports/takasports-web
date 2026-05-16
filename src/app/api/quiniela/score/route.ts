// Scoring autoritativo server-side.
// El cliente NUNCA debería confiar en su propio cálculo de monedas/puntos:
// envía sus picks aquí y recibe el desglose oficial.
//
// Si Supabase está disponible y el usuario está autenticado, también
// registra el resultado en quiniela_picks (audit) y sube monedas via RPC.
//
// Sin auth, devuelve solo el desglose calculado (modo invitado).

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { scorePicks, type SavedPick, type MatchResult } from '@/lib/quiniela'

interface ScoreBody {
  jornada: string
  picks: SavedPick[]
  captainIdx?: number
  // Resultados se obtienen del endpoint oficial — el cliente NO los inyecta
}

const VALID_PICKS = new Set(['1', 'X', '2', '1X', 'X2'])
const VALID_CONFIDENCE = new Set([1, 2, 3])
const MAX_PICKS = 20
const MAX_TEAM_LEN = 80
const MAX_GOALS = 20
const MAX_JORNADA_LEN = 64

// Normaliza un partido para deduplicación. Evita que envíen el mismo
// home/away N veces para multiplicar coins por acierto.
function matchKey(home: string, away: string): string {
  return `${home.toLowerCase().trim()}|${away.toLowerCase().trim()}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ScoreBody
    if (!body?.jornada || typeof body.jornada !== 'string' || body.jornada.length > MAX_JORNADA_LEN) {
      return NextResponse.json({ error: 'invalid jornada' }, { status: 400 })
    }
    if (!Array.isArray(body?.picks) || body.picks.length === 0) {
      return NextResponse.json({ error: 'picks required' }, { status: 400 })
    }
    if (body.picks.length > MAX_PICKS) {
      return NextResponse.json({ error: 'too many picks' }, { status: 400 })
    }
    if (body.captainIdx != null && (
      !Number.isInteger(body.captainIdx) ||
      body.captainIdx < 0 ||
      body.captainIdx >= body.picks.length
    )) {
      return NextResponse.json({ error: 'invalid captainIdx' }, { status: 400 })
    }
    // Validación por pick — cualquier irregularidad bloquea el batch
    const seen = new Set<string>()
    for (const p of body.picks) {
      if (!p || typeof p !== 'object') {
        return NextResponse.json({ error: 'invalid pick shape' }, { status: 400 })
      }
      if (typeof p.home !== 'string' || typeof p.away !== 'string' ||
          p.home.length === 0 || p.away.length === 0 ||
          p.home.length > MAX_TEAM_LEN || p.away.length > MAX_TEAM_LEN) {
        return NextResponse.json({ error: 'invalid team' }, { status: 400 })
      }
      if (!VALID_PICKS.has(p.pick as string)) {
        return NextResponse.json({ error: 'invalid pick value' }, { status: 400 })
      }
      if (p.confidence != null && !VALID_CONFIDENCE.has(p.confidence as number)) {
        return NextResponse.json({ error: 'invalid confidence' }, { status: 400 })
      }
      if (p.exactHome != null && (
        !Number.isInteger(p.exactHome) || p.exactHome < 0 || p.exactHome > MAX_GOALS
      )) {
        return NextResponse.json({ error: 'invalid exactHome' }, { status: 400 })
      }
      if (p.exactAway != null && (
        !Number.isInteger(p.exactAway) || p.exactAway < 0 || p.exactAway > MAX_GOALS
      )) {
        return NextResponse.json({ error: 'invalid exactAway' }, { status: 400 })
      }
      const key = matchKey(p.home, p.away)
      if (seen.has(key)) {
        return NextResponse.json({ error: 'duplicate match in batch' }, { status: 400 })
      }
      seen.add(key)
    }

    // Cargamos resultados oficiales del endpoint server-side
    const origin = new URL(req.url).origin
    const resultsRes = await fetch(`${origin}/api/quiniela/results`, { cache: 'no-store' })
    if (!resultsRes.ok) {
      return NextResponse.json({ error: 'results unavailable' }, { status: 503 })
    }
    const results = await resultsRes.json() as MatchResult[]

    const breakdown = scorePicks(body.picks, results, body.captainIdx)

    // Si hay sesión, guardar audit y monedas. Si Supabase no está configurado
    // (dev local sin .env) devolvemos solo el breakdown.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ breakdown, evaluated: results.length, persisted: false })
    }
    const sb = await createServerSupabaseClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user) {
      await sb.from('quiniela_picks').insert({
        user_id: user.id,
        jornada: body.jornada,
        picks: { picks: body.picks, captainIdx: body.captainIdx, breakdown },
      })
      // Sube monedas via RPC (server-side audit, no manipulable)
      if (breakdown.totalCoins > 0) {
        await sb.rpc('add_coins', {
          p_amount: breakdown.totalCoins,
          p_reason: `Quiniela ${body.jornada}: ${breakdown.hits}/${body.picks.length} aciertos${breakdown.pleno ? ' · ¡PLENO!' : ''}`,
          p_context: { jornada: body.jornada, hits: breakdown.hits, exacts: breakdown.exacts, pleno: breakdown.pleno },
        })
      }

      // Registrar también en game_plays para el ranking cross-game unificado.
      // Score = aciertos (hits). Payload con picks + results para el share encoder.
      await sb.rpc('record_game_play', {
        p_game_id: 'quiniela',
        p_period:  body.jornada,
        p_score:   breakdown.hits,
        p_payload: {
          picks:   body.picks.map(p => p.pick ?? null),
          results: results.map(r => r.outcome ?? null),
          exacts:  breakdown.exacts,
          pleno:   breakdown.pleno,
        },
        p_duration_ms: null,
      })
    }

    return NextResponse.json({ breakdown, evaluated: results.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
