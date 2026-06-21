'use client'

// Hook que devuelve un Set<GameId> de juegos que el usuario logueado ya
// jugó en su periodo actual (daily para juegos diarios, weekly para
// semanales, etc.). Lectura única al montar.
//
// Estrategia: pedir resumen con /api/games/me/all (un solo round-trip)
// y comparar last_period de cada juego contra el periodo "actual"
// calculado en el cliente con getGamePeriod().
//
// Si no hay sesión → set vacío (failsafe).

import { useEffect, useState } from 'react'
import { getGamePeriod } from '@/lib/games-periods'
import { createClient } from '@/lib/supabase'
import type { GameId } from '@/lib/games-store'
import type { MeAllResponse } from '@/app/api/games/me/all/route'

export function useMyPlayedGames(): Set<GameId> {
  const [played, setPlayed] = useState<Set<GameId>>(new Set())

  useEffect(() => {
    let cancelled = false

    // Sin sesión → NO llamamos a la API: para anónimos devuelve vacío igual,
    // así que el resultado no cambia, pero nos ahorramos una Function Invocation
    // por visita (la mayoría del tráfico es anónimo). getSession() lee la cookie
    // local sin ir al servidor; el endpoint solo se llama si hay sesión real.
    const supabase = createClient()
    if (!supabase) return

    supabase.auth.getSession().then(({ data: sess }) => {
      if (cancelled || !sess.session) return
      fetch('/api/games/me/all', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then((data: MeAllResponse | null) => {
          if (cancelled || !data) return
          const next = new Set<GameId>()
          for (const g of data.games) {
            const currentPeriod = getGamePeriod(g.game_id).period
            // Sin periodo identificable (e.g. Quiniela jornada) → contar
            // como jugado si tiene cualquier partida reciente (<= 7 días).
            if (!currentPeriod) {
              const ageMs = Date.now() - new Date(g.last_at).getTime()
              if (ageMs <= 7 * 86400000) next.add(g.game_id)
            } else if (g.last_period === currentPeriod) {
              next.add(g.game_id)
            }
          }
          setPlayed(next)
        })
        .catch(() => { /* ignore — set vacío es failsafe */ })
    }).catch(() => { /* ignore — sin sesión, set vacío */ })

    return () => { cancelled = true }
  }, [])

  return played
}
