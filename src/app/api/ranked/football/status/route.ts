// GET /api/ranked/football/status
//
// Estado LIGERO de la Fecha en curso, para las superficies que anuncian las
// predicciones fuera de /predicciones: la píldora del Header (PorraCTA), el
// widget de las noticias (PorraMatchWidget), el teaser de la portada y el toast
// de liquidación.
//
// Devuelve el MISMO contrato que el viejo /api/quiniela/status a propósito: las
// cuatro superficies leen de un único store cliente (porra-status-client), así
// que conservando la forma basta con repuntar ese store para que todas pasen a
// hablar de Fechas en vez de la quiniela retirada.
//
//   · jornada      → etiqueta de la Fecha ("Hoy", "sábado 22 ago")
//   · deadline     → cierre del PRIMER partido del día (el que de verdad corre)
//   · totalMatches → partidos de la Fecha
//   · matches[]    → para el widget de noticias (cruza equipos con el artículo)
//   · con sesión: hasPicked + picksCount + userPicks

import { NextRequest, NextResponse } from 'next/server'
import { supabaseForRequest } from '@/lib/supabase-server'
import { adminSupabase } from '@/lib/supabase-admin'
import { RANKED_FOOTBALL_SPORT } from '@/lib/football-ranked'
import { groupIntoFechas } from '@/components/ranked/soccer/fecha'
import { SOCCER_LOCK_MS, type SoccerEvent } from '@/components/ranked/soccer/types'

export const dynamic = 'force-dynamic'

const EMPTY = {
  jornada: null, deadline: null, totalMatches: 0, matches: [],
  isAuthed: false, hasPicked: false, picksCount: 0,
}

export async function GET(req: NextRequest) {
  const admin = adminSupabase()
  if (!admin) return NextResponse.json(EMPTY)

  // Ventana corta: solo interesa lo que está por jugarse. Los partidos ya
  // resueltos no entran, y los de días pasados los descarta el filtro de abajo.
  const since = new Date(Date.now() - 6 * 3_600_000).toISOString()
  const { data, error } = await admin
    .from('ranked_events')
    .select('id, sport, competition, event_date, team_home, team_away, featured, status, result, meta')
    .eq('sport', RANKED_FOOTBALL_SPORT)
    .neq('status', 'resolved')
    .gte('event_date', since)
    .order('event_date', { ascending: true })
    .limit(60)

  if (error || !data || data.length === 0) return NextResponse.json(EMPTY)

  const events = data as unknown as SoccerEvent[]
  const now    = new Date()

  // La Fecha "en curso" es la primera que todavía tiene algún partido con los
  // picks abiertos. Si la de hoy ya cerró entera, el CTA debe apuntar a la
  // siguiente — no a una que el usuario ya no puede jugar.
  const fechas  = groupIntoFechas(events, now)
  const current = fechas.find(f => f.firstLockAt !== null) ?? null
  if (!current) return NextResponse.json(EMPTY)

  const matches = current.events.map(e => ({
    home:     e.team_home ?? '',
    away:     e.team_away ?? '',
    comp:     e.competition,
    kickoff:  e.event_date,
    homeLogo: e.meta?.home_logo ?? undefined,
    awayLogo: e.meta?.away_logo ?? undefined,
    featured: e.featured,
  }))

  const base = {
    jornada:      current.label,
    // El deadline que le importa al usuario es el del primer partido: a partir
    // de ahí ya no puede completar la Fecha entera.
    deadline:     new Date(current.firstLockAt!).toISOString(),
    totalMatches: current.events.length,
    matches,
  }

  // ── Parte por usuario ──────────────────────────────────────────────────────
  const { supabase: sb, user } = await supabaseForRequest(req)
  if (!user) {
    return NextResponse.json({ ...base, isAuthed: false, hasPicked: false, picksCount: 0 })
  }

  const ids = current.events.map(e => e.id)
  const { data: myPicks } = await sb
    .from('ranked_predictions')
    .select('event_id, prediction')
    .eq('user_id', user.id)
    .in('event_id', ids)

  const rows = (myPicks ?? []) as { event_id: string; prediction?: { pick?: string } }[]
  const byId = new Map(current.events.map(e => [e.id, e]))

  return NextResponse.json({
    ...base,
    isAuthed:   true,
    hasPicked:  rows.length > 0,
    picksCount: rows.length,
    userPicks:  rows.map(r => ({
      home: byId.get(r.event_id)?.team_home ?? '',
      away: byId.get(r.event_id)?.team_away ?? '',
      pick: r.prediction?.pick ?? '',
    })),
  })
}

/** Reexportado para que quede claro de dónde sale el deadline del CTA. */
export const LOCK_MS = SOCCER_LOCK_MS
