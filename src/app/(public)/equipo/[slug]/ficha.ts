import type { TeamDetail } from '@/app/api/team/[slug]/route'
import { fetchFicha } from '@/lib/fetch-ficha'

/** Lo leen el layout (¿existe?), la metadata y la página: la URL y el revalidate
 *  iguales hacen que Next sirva las tres del mismo fetch. */
export function fetchTeamDetail(slug: string): Promise<TeamDetail | null> {
  return fetchFicha<TeamDetail>(`/api/team/${slug}`, 300)
}
