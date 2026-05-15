// Cliente para consumir contenido publicado desde game_content.
//
// Uso esperado en cada juego (cuando migre a este sistema):
//
//   const content = await loadGameContent('crackquiz', period, FALLBACK_QUIZ)
//
// Si Supabase devuelve payload publicado, se usa. Si no, fallback
// hardcoded — zero downtime, opt-in por juego.

import type { GameId } from './games-store'

export interface ContentResponse<T = unknown> {
  payload:    T | null
  updated_at: string | null
}

export async function loadGameContent<T>(gameId: GameId, period: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`/api/games/content?game=${encodeURIComponent(gameId)}&period=${encodeURIComponent(period)}`, {
      // Cache-Control en server hace el trabajo; aquí pedimos respeto de cache.
      next: { revalidate: 60 },
    } as RequestInit)
    if (!res.ok) return fallback
    const data = await res.json() as ContentResponse<T>
    return (data.payload ?? fallback)
  } catch {
    return fallback
  }
}

/** Versión sync que solo lee de `caches` / memoria; útil cuando el caller
 *  ya hizo prefetch. En la práctica los juegos llaman loadGameContent
 *  en useEffect y mantienen el resultado en estado local. */
export type { GameId }
