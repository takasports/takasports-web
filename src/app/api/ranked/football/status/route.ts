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
import { groupIntoFechas, fechaLabel } from '@/components/ranked/soccer/fecha'
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
    // TODOS los partidos abiertos, no solo los de la Fecha en curso. Lo usa el
    // widget de las noticias, que cruza el titular del artículo con los equipos:
    // limitado a la Fecha de hoy, una noticia sobre un partido del sábado no
    // encontraba nada y el artículo se quedaba sin puerta de entrada al juego.
    // La portada y el CTA siguen leyendo `matches` (la Fecha en curso).
    upcoming: events
      .filter(e => e.status === 'open')
      .map(e => ({
        home:     e.team_home ?? '',
        away:     e.team_away ?? '',
        comp:     e.competition,
        kickoff:  e.event_date,
        homeLogo: e.meta?.home_logo ?? undefined,
        awayLogo: e.meta?.away_logo ?? undefined,
        featured: e.featured,
      })),
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
    lastSettled: await lastSettledFecha(admin, user.id),
  })
}

// ── Última Fecha liquidada del usuario ───────────────────────────────────────
// Alimenta PorraSettlementToast, que al volver el usuario le enseña cómo le fue
// y le ofrece compartirlo en /predicciones/resultado/[slug] —una landing con su
// propia imagen de OpenGraph—. Toda esa cadena ya estaba construida y llevaba
// desconectada desde la retirada de la quiniela: el toast leía `lastSettled` y
// nadie se lo daba, así que el único bucle de crecimiento de la sección no
// llegaba a arrancar nunca.
async function lastSettledFecha(
  admin: NonNullable<ReturnType<typeof adminSupabase>>,
  userId: string,
): Promise<{
  jornada: string
  correctCount: number
  totalPicks: number
  totalWon: number
  settledAt: string | null
  featuredHit: boolean
  exactHits: number
} | null> {
  // Se parte de los EVENTOS de fútbol recientes, no de las predicciones del
  // usuario. Filtrar por "sus N últimas predicciones" parecía equivalente, pero
  // un jugador activo de UFC llenaría ese cupo con combates y sus Fechas de
  // fútbol se caerían de la lista sin que nada avisara.
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data: evs } = await admin
    .from('ranked_events')
    .select('id, featured, result, meta, updated_at')
    .eq('sport', RANKED_FOOTBALL_SPORT)
    .eq('status', 'resolved')
    .gte('event_date', since)
    .order('event_date', { ascending: false })
    .limit(120)

  if (!evs || evs.length === 0) return null

  type Ev = { id: string; featured: boolean; result: { home_score?: number; away_score?: number } | null; meta?: { date_key?: string }; updated_at: string }
  const evById = new Map((evs as Ev[]).map(e => [e.id, e]))

  const { data: preds } = await admin
    .from('ranked_predictions')
    .select('event_id, is_correct, points_awarded, prediction')
    .eq('user_id', userId)
    .not('is_correct', 'is', null)
    .in('event_id', [...evById.keys()])

  if (!preds || preds.length === 0) return null

  // La Fecha más reciente EN LA QUE JUGÓ (no la última que se resolvió): si no
  // participó ayer, se le enseña el resultado del día que sí jugó.
  let latest = ''
  for (const p of preds as { event_id: string }[]) {
    const dk = evById.get(p.event_id)?.meta?.date_key
    if (dk && dk > latest) latest = dk
  }
  if (!latest) return null

  const mine = (preds as { event_id: string; is_correct: boolean | null; points_awarded: number | null; prediction?: { exactScore?: { home: number; away: number } } }[])
    .filter(p => evById.get(p.event_id)?.meta?.date_key === latest)
  if (mine.length === 0) return null

  let correct = 0, won = 0, exactHits = 0, featuredHit = false, settledAt: string | null = null
  for (const p of mine) {
    const ev = evById.get(p.event_id)!
    if (p.is_correct) {
      correct++
      if (ev.featured) featuredHit = true
      const ex = p.prediction?.exactScore
      if (ex && ex.home === ev.result?.home_score && ex.away === ev.result?.away_score) exactHits++
    }
    won += p.points_awarded ?? 0
    if (!settledAt || ev.updated_at > settledAt) settledAt = ev.updated_at
  }

  return {
    // El slug compartible se construye a partir de esto, así que va en el mismo
    // idioma que la cabecera de la Fecha en la web.
    jornada: fechaLabel(latest),
    correctCount: correct,
    totalPicks: mine.length,
    totalWon: won,
    settledAt,
    featuredHit,
    exactHits,
  }
}

/** Reexportado para que quede claro de dónde sale el deadline del CTA. */
export const LOCK_MS = SOCCER_LOCK_MS
