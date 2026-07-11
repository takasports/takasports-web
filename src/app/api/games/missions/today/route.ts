// GET /api/games/missions/today
//
// Misiones activas de HOY (deterministas por día/semana Madrid, mismo catálogo y
// misma selección que la web). Público y cacheado — la app las lee para MOSTRARLAS
// y trackear el progreso local; el reclamo real (con award de puntos) va aparte por
// POST /api/games/missions/claim.
//
// Devuelve las CLAVES de periodo calculadas en el servidor (dayKey/weekKey Madrid)
// para que la app las use TAL CUAL en el claim — así no recomputa Madrid por su
// cuenta y nunca hay desajuste de periodo (que el claim rechazaría como stale).

import { NextResponse } from 'next/server'
import { TEMPLATES, activeDailyIds, activeWeeklyIds, type MissionGoal, type MissionPeriod } from '@/lib/missions-catalog'
import { madridDayISO, madridWeekISO } from '@/lib/taka-time'

interface TodayMission {
  id: string
  title: string
  description: string
  emoji: string
  reward: number
  period: MissionPeriod
  goal: MissionGoal
  key: string // clave del periodo (dayKey o weekKey) — usar tal cual en el claim
}

function pick(id: string, key: string): TodayMission | null {
  const t = TEMPLATES[id]
  if (!t) return null
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    emoji: t.emoji,
    reward: t.reward,
    period: t.period,
    goal: t.goal,
    key,
  }
}

export async function GET() {
  const dayKey = madridDayISO()
  const weekKey = madridWeekISO()

  const missions: TodayMission[] = [
    ...activeDailyIds(dayKey).map((id) => pick(id, dayKey)),
    ...activeWeeklyIds(weekKey).map((id) => pick(id, weekKey)),
  ].filter((m): m is TodayMission => m !== null)

  return NextResponse.json(
    { dayKey, weekKey, missions },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
