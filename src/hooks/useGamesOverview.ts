'use client'

// Estado del usuario en la zona de juegos, en UNA sola lectura.
//
// El hub pedía lo mismo una y otra vez: tres componentes montaban useStreak()
// por su cuenta (3 GET a /api/games/streak + 3 flushQueue compitiendo), cada
// tarjeta montaba un GameStatusBadge con su propio useGameState (2 peticiones
// por tarjeta), y encima TuDiaTaka pedía /api/games/me/all. Unas 16 peticiones
// para pintar una página que, para un visitante anónimo, no muestra nada de eso.
//
// Aquí se resuelve con: 0 peticiones sin sesión (la cookie se mira en local) y
// 2 con sesión (/api/games/me/all + el nivel de Liga Taka).

import { useEffect, useState } from 'react'
import { getGamePeriod } from '@/lib/games-periods'
import { createClient } from '@/lib/supabase'
import type { GameId } from '@/lib/games-store'
import type { MeAllResponse } from '@/app/api/games/me/all/route'

export interface GameCardState {
  /** Ya jugado en el periodo en curso (hoy / esta semana). */
  played: boolean
  /** Puntuación de esa partida, si la hay. */
  score: number | null
}

export interface GamesOverview {
  /** 'loading' solo con sesión; los invitados resuelven a 'guest' sin red. */
  status: 'loading' | 'guest' | 'ready'
  streak: { current: number; best: number } | null
  level: { level: number; xpInLevel: number; xpToNext: number; progress: number } | null
  byGame: Record<string, GameCardState>
  /** Juegos con periodo abierto que aún no ha jugado, en el orden recibido. */
  pending: GameId[]
  done: number
  total: number
}

const EMPTY: GamesOverview = {
  status: 'loading', streak: null, level: null, byGame: {}, pending: [], done: 0, total: 0,
}

export function useGamesOverview(games: readonly GameId[]): GamesOverview {
  // El total se conoce desde el primer render (es la lista de juegos, no un
  // dato del servidor): así la barra nunca enseña un "—/0" sin sentido.
  const [data, setData] = useState<GamesOverview>({ ...EMPTY, total: games.length })

  useEffect(() => {
    let cancelled = false

    // Red de seguridad: si la sesión o la API no contestan, se resuelve como
    // invitado en vez de dejar la barra en "cargando" para siempre. Un hueco
    // permanente esperando datos se lee como que la página está rota.
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setData(prev => (prev.status === 'loading'
          ? { ...EMPTY, status: 'guest', total: games.length }
          : prev))
      }
    }, 4000)

    const supabase = createClient()
    if (!supabase) {
      setData({ ...EMPTY, status: 'guest', total: games.length })
      clearTimeout(timeout)
      return
    }

    supabase.auth.getSession().then(async ({ data: sess }) => {
      if (cancelled) return
      if (!sess.session) {
        setData({ ...EMPTY, status: 'guest', total: games.length })
        return
      }

      const [meAll, meLevel] = await Promise.all([
        fetch('/api/games/me/all', { cache: 'no-store' })
          .then(r => (r.ok ? r.json() as Promise<MeAllResponse> : null))
          .catch(() => null),
        fetch('/api/quiniela/me')
          .then(r => (r.ok ? r.json() as Promise<GamesOverview['level']> : null))
          .catch(() => null),
      ])
      if (cancelled) return

      const byGame: Record<string, GameCardState> = {}
      const pending: GameId[] = []
      for (const id of games) {
        const period = getGamePeriod(id).period
        const summary = meAll?.games.find(g => g.game_id === id)
        // Sin periodo identificable (Quiniela usa jornada) se considera jugado
        // si hay partida reciente — misma regla que usaba TuDiaTaka.
        const played = !summary
          ? false
          : period
            ? summary.last_period === period
            : Date.now() - new Date(summary.last_at).getTime() <= 7 * 86400000
        byGame[id] = { played, score: played ? summary?.last_score ?? null : null }
        if (!played) pending.push(id)
      }

      setData({
        status: 'ready',
        streak: meAll?.streak ? { current: meAll.streak.current, best: meAll.streak.best } : null,
        level: meLevel ?? null,
        byGame,
        pending,
        done: games.length - pending.length,
        total: games.length,
      })
    }).catch(() => {
      if (!cancelled) setData({ ...EMPTY, status: 'guest', total: games.length })
    })

    return () => { cancelled = true; clearTimeout(timeout) }
    // `games` es una constante del módulo en todos los usos; la clave evita
    // reejecutar por identidad de array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games.join(',')])

  return data
}
