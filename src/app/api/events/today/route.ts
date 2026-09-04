import { NextResponse } from 'next/server'
import { fetchEspnEvents } from '@/lib/espn'
import { isoToLocalDate } from '@/lib/calendar'
import type { SportEvent } from '@/lib/types'

// Partidos de HOY, en versión flaca. Para el bloque "Tu día".
//
// Ninguno de los endpoints que había servía:
//   · `/api/events/upcoming` es una lista CURADA de "lo próximo" — 9 eventos en
//     total y, medido el 03/09/2026, ninguno de hoy.
//   · `/api/events/feed` sí los trae, pero son ~495 KB (su `?from=` solo recorta
//     el pasado). Descargar medio mega en el arranque del inicio para pintar
//     tres filas no compensa.
//
// La web no lo necesita —resuelve "Tu día" en su propio render de servidor—,
// pero la app sí: es un cliente delgado y no tiene el calendario en memoria.
//
// Se devuelven TODOS los partidos del día, sin curar: quién es "tuyo" lo decide
// el cliente cruzando con sus equipos seguidos, que viven en su dispositivo.

export const revalidate = 300

export interface TodayEvent {
  id: string
  home: string
  away: string | null
  sport: string
  comp: string
  time: string
  isoDate?: string
  timeTbd?: boolean
  accent?: string
  matchRef?: string
  homeLogo?: string
  awayLogo?: string
}

function flaco(e: SportEvent): TodayEvent {
  return {
    id: e.id, home: e.home, away: e.away, sport: e.sport, comp: e.comp,
    time: e.time, isoDate: e.isoDate, timeTbd: e.timeTbd, accent: e.accent,
    matchRef: e.matchRef, homeLogo: e.homeLogo, awayLogo: e.awayLogo,
  }
}

export async function GET() {
  const eventos = await fetchEspnEvents().catch(() => [] as SportEvent[])
  // El día se calcula en la zona de origen (Madrid), igual que el agrupado del
  // calendario; el cliente ya convierte la HORA a la suya.
  const hoy = isoToLocalDate(new Date().toISOString())
  const deHoy = eventos.filter(e => e.isoDate && isoToLocalDate(e.isoDate) === hoy).map(flaco)

  return NextResponse.json(
    { events: deHoy },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}
