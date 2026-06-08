'use client'

// Cliente del leaderboard completo. Wrapper sobre <Leaderboard /> con
// limit=100 y refresco cada 30s.

import Leaderboard from '@/components/games/Leaderboard'
import { getGamePeriod } from '@/lib/games-periods'
import type { GameId } from '@/lib/games-store'

interface Props {
  gameId: GameId
  accent: string
  /** Periodo explícito (ej. Sopa contrarreloj usa "YYYY-Www-TA"). Si se omite,
   *  se usa el periodo actual estándar del juego. */
  periodOverride?: string
  title?: string
  periodLabel?: string
}

export default function LeaderboardFull({ gameId, accent, periodOverride, title, periodLabel }: Props) {
  const period = periodOverride ?? getGamePeriod(gameId).period
  return (
    <Leaderboard
      gameId={gameId}
      period={period}
      limit={100}
      accent={accent}
      refreshMs={30_000}
      title={title ?? 'Top 100'}
      periodLabel={periodLabel ?? (gameId === 'quiniela' && period ? 'Jornada actual' : undefined)}
    />
  )
}
