'use client'

// Cliente del leaderboard completo. Wrapper sobre <Leaderboard /> con
// limit=100 y refresco cada 30s. Periodo = el actual estándar del juego
// (un único ranking por juego; suma a la Liga Taka global).

import Leaderboard from '@/components/games/Leaderboard'
import { getGamePeriod } from '@/lib/games-periods'
import { useMounted } from '@/hooks/useMounted'
import type { GameId } from '@/lib/games-store'

interface Props {
  gameId: GameId
  accent: string
}

export default function LeaderboardFull({ gameId, accent }: Props) {
  // El periodo se deriva del reloj del navegador y se PINTA como texto
  // ("2026-09-04"), así que solo después de montar: en el HTML servido iría el
  // del servidor y al hidratar cambiaría → fallo de hidratación (#418).
  const montado = useMounted()
  const period = montado ? getGamePeriod(gameId).period : ''
  return (
    <Leaderboard
      gameId={gameId}
      period={period}
      limit={100}
      accent={accent}
      refreshMs={30_000}
      title="Top 100"
      periodLabel={gameId === 'quiniela' && period ? 'Jornada actual' : undefined}
    />
  )
}
