'use client'

// Aplica filtros + orden a un array de juegos según los searchParams
// actuales. Es un select() puro: el array entra, sale filtrado/ordenado.
//
// Orden por defecto: status 'active' primero, luego 'live', luego 'coming'.

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { readFilters } from '@/components/games/GamesFilterBar'

interface FilterableGame {
  category: string
  format:   string
  status:   'active' | 'live' | 'coming'
}

const STATUS_RANK: Record<FilterableGame['status'], number> = {
  active: 0,
  live:   1,
  coming: 2,
}

export function useGamesFilter<T extends FilterableGame>(games: T[]): T[] {
  const searchParams = useSearchParams()
  return useMemo(() => {
    const { category, cadence } = readFilters(new URLSearchParams(searchParams.toString()))
    const filtered = games.filter(g => {
      if (category !== 'all' && g.category !== category) return false
      if (cadence  !== 'all' && g.format   !== cadence)  return false
      return true
    })
    return filtered.slice().sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
  }, [games, searchParams])
}
