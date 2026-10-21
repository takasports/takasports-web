import type { PlayerDetail } from '@/app/api/jugador/[slug]/route'
import { fetchFicha } from '@/lib/fetch-ficha'

/** Lo leen el layout (¿existe?), la metadata y la página: la URL y el revalidate
 *  iguales hacen que Next sirva las tres del mismo fetch. */
export function fetchPlayer(slug: string): Promise<PlayerDetail | null> {
  return fetchFicha<PlayerDetail>(`/api/jugador/${slug}`, 1800)
}
