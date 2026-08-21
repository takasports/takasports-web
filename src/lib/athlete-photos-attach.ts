// ── La cara del calendario sale de UNA sola fuente ──────────────────────────
//
// Hasta ahora la foto de un tenista en la fila venía de dos sitios propios del
// calendario y sin relación con el resto del sitio:
//   · `athletePhoto()`, una lista ESTÁTICA de 191 nombres (athlete-photos.ts).
//   · el headshot del scoreboard de ESPN, que para tenis suele ser 404.
// Mientras tanto, la ficha de jugador y las plantillas leen de la caché que
// resuelve el cron (api-sports → ESPN → Wikimedia). Resultado medido el
// 21/08/2026: de 14 eventos de tenis/UFC, solo 4 mostraban las dos caras y 3
// salían A MEDIAS — una foto y un hueco — que es lo que se ve mal.
//
// Esta pasada pone la caché POR DELANTE: la foto resuelta manda, y lo anterior
// queda como respaldo. Es una lectura barata y por lote de nuestra propia base;
// la cascada contra terceros sigue ocurriendo solo en el cron.

import type { SportEvent } from './types'
import { getPhotosByEspnId } from './sport-entities'

/** Deportes cuya fila enseña cara en vez de escudo. */
function usesFace(sport: string | undefined): boolean {
  const s = (sport ?? '').toLowerCase()
  return s === 'tenis' || s === 'tennis' || s === 'ufc' || s === 'mma'
}

/** Sport con el que están guardadas estas entidades en `sport_entities`. */
function entitySport(sport: string | undefined): string {
  const s = (sport ?? '').toLowerCase()
  return s === 'ufc' || s === 'mma' ? 'mma' : 'tennis'
}

/**
 * Rellena `homePhoto`/`awayPhoto` con la foto ya resuelta cuando la hay. Muta los
 * eventos. Best-effort: sin Supabase o sin coincidencia, todo queda como estaba.
 */
export async function attachAthletePhotos(events: SportEvent[]): Promise<void> {
  const idsBySport = new Map<string, Set<string>>()
  for (const e of events) {
    if (!usesFace(e.sport)) continue
    const sport = entitySport(e.sport)
    const set = idsBySport.get(sport) ?? new Set<string>()
    if (e.homeAthleteId) set.add(e.homeAthleteId)
    if (e.awayAthleteId) set.add(e.awayAthleteId)
    if (set.size) idsBySport.set(sport, set)
  }
  if (idsBySport.size === 0) return

  const photosBySport = new Map<string, Map<string, { url: string }>>()
  await Promise.all(
    [...idsBySport].map(async ([sport, ids]) => {
      try {
        const photos = await getPhotosByEspnId(sport, [...ids])
        photosBySport.set(sport, photos)
      } catch {
        /* sin caché disponible → se conserva el respaldo de siempre */
      }
    }),
  )

  for (const e of events) {
    if (!usesFace(e.sport)) continue
    const photos = photosBySport.get(entitySport(e.sport))
    if (!photos) continue
    const home = e.homeAthleteId ? photos.get(e.homeAthleteId)?.url : undefined
    const away = e.awayAthleteId ? photos.get(e.awayAthleteId)?.url : undefined
    if (home) e.homePhoto = home
    if (away) e.awayPhoto = away
  }
}
