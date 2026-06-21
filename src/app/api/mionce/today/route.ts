// GET /api/mionce/today?week=YYYY-Www  (default = semana actual de Madrid)
//
// Sirve el RETO SEMANAL "posición × club" que juega la web (getChallengeForWeek,
// determinista por semana ISO de Madrid). La app lo replica exactamente:
//   · formation + slots[{slotId, position, label, club, emoji, x, y}] (layout).
//   · validBySlot[slotId] → ids de TODOS los jugadores válidos en ese hueco
//     (posición del hueco + jugó en ese club, multiclub vía playerClubs).
// La app valida cada pick contra validBySlot[slotId] y puntúa validos*10 (0..110),
// idéntico a la web. Los nombres los resuelve con /api/players/catalog.

import { NextRequest, NextResponse } from 'next/server'
import { getChallengeForWeek } from '@/lib/mionce-challenges'
import { FORMATIONS } from '@/lib/mionce-formations'
import { PLAYERS_DEDUP, playerClubs } from '@/lib/players-catalog'
import { madridWeekISO } from '@/lib/taka-time'

export const dynamic = 'force-dynamic'

function assertWeek(s: string | null): s is string {
  return !!s && /^\d{4}-W\d{2}$/.test(s)
}

export async function GET(req: NextRequest) {
  const param = new URL(req.url).searchParams.get('week')
  if (param !== null && !assertWeek(param)) {
    return NextResponse.json({ error: 'week (YYYY-Www) required' }, { status: 400 })
  }
  const week = param ?? madridWeekISO()

  const challenge = getChallengeForWeek(week)
  if (!challenge) {
    return NextResponse.json({ error: 'invalid week' }, { status: 400 })
  }
  const formation = challenge.recommendedFormation
  const slotDefs = FORMATIONS[formation]

  const slots = slotDefs.map(s => {
    const tag = challenge.slotTags?.[s.id]
    return {
      slotId: s.id,
      position: s.position,
      label: s.label,
      club: tag?.label ?? '',
      emoji: tag?.emoji ?? '',
      x: s.x,
      y: s.y,
    }
  })

  const validBySlot: Record<string, string[]> = {}
  for (const s of slotDefs) {
    const club = challenge.slotTags?.[s.id]?.label ?? ''
    validBySlot[s.id] = PLAYERS_DEDUP
      .filter(p => p.position === s.position && playerClubs(p).includes(club))
      .map(p => p.id)
  }

  return NextResponse.json(
    {
      week,
      boardId: challenge.id,
      formation,
      title: challenge.title,
      tagline: challenge.tagline,
      description: challenge.description,
      slots,
      validBySlot,
    },
    { headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=86400' } },
  )
}
