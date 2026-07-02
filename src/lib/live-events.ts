// Lógica pura para anteponer los partidos EN JUEGO (de /api/events/live) en el
// escaparate "Destacados" del Inicio. Extraída del componente para poder
// testearla sin React. La consume LiveEventsSection.tsx.

import type { SportEvent } from '@/lib/types'
import { getEventHighlightScore } from '@/lib/competitions'

// Forma cruda de cada partido que devuelve /api/events/live (incluye en juego,
// recién terminados y a veces no empezados → hay que filtrar por estado).
export type RawLiveFixture = {
  id?: string
  homeTeam: string; awayTeam: string | null
  homeGoals: number | null; awayGoals: number | null
  status: string; elapsed: number | null
  sport: string; comp?: string
  matchRef?: string
  homeLogo?: string; awayLogo?: string
  homeAbbr?: string; awayAbbr?: string
}

export interface LiveScore {
  homeGoals: number | null
  awayGoals: number | null
  status: string
  elapsed: number | null
  homeLogo?: string
  awayLogo?: string
  matchRef?: string
}

// Estados terminales o aún no empezados: NO cuentan como "en juego".
export const FINISHED = new Set([
  'FT', 'Final', 'FINAL', 'FINAL_PEN', 'FINAL_AET', 'STATUS_FINAL', 'NS', 'STATUS_SCHEDULED',
  'POST_GAME', 'END_OF_REGULATION',
  'ABANDONED', 'WALKOVER', 'RETIRED', 'CANCELED', 'POSTPONED', 'SUSPENDED',
])

export const SPORT_LABELS: Record<string, string> = {
  soccer: 'Fútbol', basketball: 'Baloncesto', racing: 'F1', mma: 'MMA', tennis: 'Tenis',
}
export const SPORT_ACCENTS: Record<string, string> = {
  soccer: '#34D399', basketball: '#F59E0B', racing: '#EF4444', mma: '#D4AF37', tennis: '#E0B33A',
}

function normalizeTeam(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}
// Casa nombres de equipo entre fuentes (ESPN vs Sanity los escriben distinto).
export function namesMatch(a: string, b: string) {
  const na = normalizeTeam(a), nb = normalizeTeam(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

// Convierte un partido EN JUEGO en una tarjeta (SportEvent). id propio `live:`
// para no chocar con los próximos; EventCard lo pinta en directo en cuanto
// scoresForEvents le asocia el marcador por nombre de equipo.
export function liveFixtureToEvent(f: RawLiveFixture): SportEvent {
  return {
    id: `live:${f.matchRef ?? f.id ?? `${f.homeTeam}|${f.awayTeam}`}`,
    home: f.homeTeam,
    away: f.awayTeam,
    sport: SPORT_LABELS[f.sport] ?? f.sport,
    comp: f.comp ?? '',
    date: 'Hoy',
    time: '',
    accent: SPORT_ACCENTS[f.sport] ?? '#7C3AED',
    matchRef: f.matchRef,
    homeLogo: f.homeLogo,
    awayLogo: f.awayLogo,
    homeAbbr: f.homeAbbr,
    awayAbbr: f.awayAbbr,
  }
}

// Tarjetas de partidos EN JUEGO, más importantes primero y con tope (para no
// desbordar el carrusel si hay muchos a la vez, p. ej. tenis). Excluye los que
// no son cara a cara (sin rival): combate/carrera no llevan marcador.
export function liveCardsFromFixtures(fixtures: RawLiveFixture[], max = 6): SportEvent[] {
  const cards = fixtures
    .filter(f => f.awayTeam && !FINISHED.has(f.status))
    .map(liveFixtureToEvent)
  cards.sort((a, b) =>
    getEventHighlightScore({ comp: b.comp, home: b.home, away: b.away, isLive: true }) -
    getEventHighlightScore({ comp: a.comp, home: a.home, away: a.away, isLive: true }))
  return cards.slice(0, max)
}

// Antepone las tarjetas en vivo al escaparate, quitando de los próximos los que
// ya están en juego (evita la tarjeta duplicada del mismo partido).
export function withLiveFirst(liveCards: SportEvent[], upcoming: SportEvent[]): SportEvent[] {
  if (liveCards.length === 0) return upcoming
  const dedup = upcoming.filter(ev =>
    !liveCards.some(lc => lc.away && ev.away && namesMatch(lc.home, ev.home) && namesMatch(lc.away, ev.away)),
  )
  return [...liveCards, ...dedup]
}

// Asocia el marcador en vivo a cada evento mostrado (clave = ev.id), casando por
// nombres de equipo. Cubre tanto los próximos que pasaron a estar en juego como
// las tarjetas en vivo antepuestas (su home/away vienen del propio fixture).
export function scoresForEvents(events: SportEvent[], fixtures: RawLiveFixture[]): Map<string, LiveScore> {
  const next = new Map<string, LiveScore>()
  for (const ev of events) {
    if (!ev.away) continue
    const m = fixtures.find(f => f.awayTeam && namesMatch(f.homeTeam, ev.home) && namesMatch(f.awayTeam, ev.away!))
    if (m) next.set(ev.id, {
      homeGoals: m.homeGoals, awayGoals: m.awayGoals,
      status: m.status, elapsed: m.elapsed,
      homeLogo: m.homeLogo, awayLogo: m.awayLogo,
    })
  }
  return next
}
