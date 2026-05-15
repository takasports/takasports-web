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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ScoreBody
    if (!body?.jornada || !Array.isArray(body?.picks) || body.picks.length === 0) {
      return NextResponse.json({ error: 'jornada and picks required' }, { status: 400 })
    }
    if (body.picks.length > 50) {
      return NextResponse.json({ error: 'too many picks' }, { status: 400 })
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
