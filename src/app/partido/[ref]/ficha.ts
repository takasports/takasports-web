import type { MatchDetail } from '@/app/api/match/[ref]/route'
import { fetchFicha } from '@/lib/fetch-ficha'

/** Lo leen el layout (¿existe?), la metadata y la página: la URL y el revalidate
 *  iguales hacen que Next sirva las tres del mismo fetch. */
export function fetchMatchDetail(ref: string): Promise<MatchDetail | null> {
  return fetchFicha<MatchDetail>(`/api/match/${ref}`, 15)
}
