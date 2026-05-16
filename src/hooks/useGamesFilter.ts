'use client'

// Aplica filtros + orden a un array de juegos según los searchParams
// actuales. Es un select() puro: el array entra, sale filtrado/ordenado.
//
// Orden por defecto: status 'active' primero, luego 'live', luego 'coming'.

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { readFilters } from '@/components/games/GamesFilterBar'
import type { GameId } from '@/lib/games-store'

interface FilterableGame {
  id:       string
  category: string
  format:   string
  status:   'active' | 'live' | 'coming'
}

const STATUS_RANK: Record<FilterableGame['status'], number> = {
  active: 0,
  live:   1,
  coming: 2,
}

export function useGamesFilter<T extends FilterableGame>(games: T[], playedGames?: Set<GameId>): T[] {
  const searchParams = useSearchParams()
  return useMemo(() => {
    const { category, cadence, pending } = readFilters(new URLSearchParams(searchParams.toString()))
    const filtered = games.filter(g => {
      if (category !== 'all' && g.category !== category) return false
      if (cadence  !== 'all' && g.format   !== cadence)  return false
      // "Solo no jugados": excluir los que están en el set.
      if (pending && playedGames && playedGames.has(g.id as GameId)) return false
      return true
    })
    return filtered.slice().sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
  }, [games, searchParams, playedGames])
}
