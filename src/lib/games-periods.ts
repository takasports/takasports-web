// Periodo "actual" de cada juego para clavar el scoring + ventana de cierre.
//
// Convenciones:
//   · Daily   -> "YYYY-MM-DD"     (CrackQuiz, TakaGrid)
//   · Weekly  -> "YYYY-Www"       (Mi Once, Sopa de Cracks)
//   · Jornada -> "<comp>-Jxx"     (Quiniela; el código de fuera lo provee)
//   · None    -> ""               (Striker Rush — sin ventana)
//
// nextResetMs() devuelve los ms hasta el próximo cierre en UTC. UI usa
// esto para countdowns ("Cierra en 4h 12m"). Returns 0 si no aplica.

import { currentDayISO, currentWeekISO, type GameId } from './games-store'

export type Cadence = 'daily' | 'weekly' | 'jornada' | 'none'

export interface GamePeriod {
  cadence: Cadence
  /** Identificador legible para Supabase + UI. */
  period:  string
  /** ms hasta el reset (00:00 UTC del día o lunes de semana). 0 si none. */
  nextResetMs: number
}

const CADENCE: Record<GameId, Cadence> = {
  crackquiz:   'daily',
  takagrid:    'daily',
  mionce:      'weekly',
  sopacracks:  'weekly',
  quiniela:    'jornada',
  strikerrush: 'none',
}

function msUntilTomorrowUTC(now: Date): number {
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.getTime() - now.getTime()
}

function msUntilNextMondayUTC(now: Date): number {
  // ISO week resets on Monday 00:00 UTC.
  const day = now.getUTCDay() || 7        // Sun=0 -> 7; Mon=1 .. Sun=7
  const daysToMonday = 8 - day            // 1..7
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday))
  return next.getTime() - now.getTime()
}

/**
 * @param gameId  Juego.
 * @param jornada Solo para Quiniela: etiqueta de la jornada en curso
 *                (e.g. "laliga-J38"). El caller la conoce.
 * @param now     Inyectable para testing.
 */
export function getGamePeriod(gameId: GameId, jornada?: string, now: Date = new Date()): GamePeriod {
  const cad = CADENCE[gameId]
  switch (cad) {
    case 'daily':
      return { cadence: 'daily',   period: currentDayISO(now),  nextResetMs: msUntilTomorrowUTC(now) }
    case 'weekly':
      return { cadence: 'weekly',  period: currentWeekISO(now), nextResetMs: msUntilNextMondayUTC(now) }
    case 'jornada':
      return { cadence: 'jornada', period: jornada ?? 'unknown', nextResetMs: 0 }
    case 'none':
    default:
      return { cadence: 'none',    period: '', nextResetMs: 0 }
  }
}

/** Formatea "4h 12m", "2d 6h", "37s". Sin segundos si > 1h. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'cerrado'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
