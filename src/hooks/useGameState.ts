// Hooks React para games-store.
//
// useGameState(gameId, period)  - estado de la partida del usuario en
//                                 un periodo (loading | not_played | played).
// useStreak()                   - racha global del usuario.
// useLeaderboard(...)           - top N + auto-refresh opcional.
//
// Todos son seguros en SSR: no acceden a localStorage hasta el primer
// useEffect. Devuelven { loading: true } durante la primera hidratación.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type GameId,
  type GamePlay,
  type Streak,
  type LeaderboardEntry,
  type MyPosition,
  getMyPlay,
  getStreak,
  getLeaderboard,
  getMyPosition,
  flushQueue,
} from '@/lib/games-store'

// ── useGameState ─────────────────────────────────────────────────

export type GameStatus = 'loading' | 'not_played' | 'played'

export interface UseGameStateResult {
  status:    GameStatus
  play:      GamePlay | null
  position:  number | null
  total:     number
  refresh:   () => Promise<void>
}

export function useGameState(gameId: GameId, period: string): UseGameStateResult {
  const [play,     setPlay]     = useState<GamePlay | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [total,    setTotal]    = useState<number>(0)
  const [status,   setStatus]   = useState<GameStatus>('loading')
  const mounted = useRef(true)

  const load = useCallback(async () => {
    const [myPlay, myPos] = await Promise.all([
      getMyPlay(gameId, period),
      getMyPosition(gameId, period),
    ])
    if (!mounted.current) return
    setPlay(myPlay)
    setPosition(myPos.position)
    setTotal(myPos.total)
    setStatus(myPlay ? 'played' : 'not_played')
  }, [gameId, period])

  useEffect(() => {
    mounted.current = true
    void load()
    return () => { mounted.current = false }
  }, [load])

  return { status, play, position, total, refresh: load }
}

// ── useStreak ────────────────────────────────────────────────────

export function useStreak(): { streak: Streak | null; loading: boolean; refresh: () => Promise<void> } {
  const [streak,  setStreak]  = useState<Streak | null>(null)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    const s = await getStreak()
    if (!mounted.current) return
    setStreak(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    mounted.current = true
    void refresh()
    // Reintentar partidas encoladas (offline → online) al montar.
    void flushQueue()
    return () => { mounted.current = false }
  }, [refresh])

  return { streak, loading, refresh }
}

// ── useLeaderboard ───────────────────────────────────────────────

export interface UseLeaderboardOptions {
  limit?:      number
  refreshMs?:  number   // 0 o undefined => sin polling
}

export function useLeaderboard(
  gameId: GameId,
  period: string,
  { limit = 20, refreshMs }: UseLeaderboardOptions = {},
): { entries: LeaderboardEntry[]; loading: boolean; refresh: () => Promise<void> } {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    const data = await getLeaderboard(gameId, period, limit)
    if (!mounted.current) return
    setEntries(data)
    setLoading(false)
  }, [gameId, period, limit])

  useEffect(() => {
    mounted.current = true
    void refresh()
    if (!refreshMs || refreshMs < 5_000) {
      return () => { mounted.current = false }
    }
    const id = setInterval(() => { void refresh() }, refreshMs)
    return () => { mounted.current = false; clearInterval(id) }
  }, [refresh, refreshMs])

  return { entries, loading, refresh }
}

// ── useMyPosition (independiente, ligero) ────────────────────────

/**
 * @param retryIfEmpty  Si true, cuando la primera lectura viene sin
 *   partida (total===0) reintenta unas veces con backoff corto. Sirve
 *   para el modal post-partida: se monta a la vez que recordPlay() está
 *   escribiendo, y sin reintento mostraría "sin datos / invitado"
 *   aunque la partida sí se guarde milisegundos después.
 */
export function useMyPosition(
  gameId: GameId,
  period: string,
  retryIfEmpty = false,
): { data: MyPosition; loading: boolean; refresh: () => Promise<void> } {
  const [data,    setData]    = useState<MyPosition>({ play: null, position: null, total: 0 })
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    // Backoff: inmediato, +0.8s, +1.5s, +2.5s (solo si retryIfEmpty y
    // sigue vacío — la escritura de recordPlay suele tardar <1s).
    const delays = retryIfEmpty ? [0, 800, 1500, 2500] : [0]
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]))
      if (!mounted.current) return
      const d = await getMyPosition(gameId, period)
      if (!mounted.current) return
      const empty = !d.play && d.total === 0
      if (!empty || i === delays.length - 1) {
        setData(d)
        setLoading(false)
        return
      }
    }
  }, [gameId, period, retryIfEmpty])

  useEffect(() => {
    mounted.current = true
    void refresh()
    return () => { mounted.current = false }
  }, [refresh])

  return { data, loading, refresh }
}
