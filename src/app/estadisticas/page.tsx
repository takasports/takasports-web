import { getStandingsData } from '@/app/api/stats/standings/route'
import EstadisticasClient from './EstadisticasClient'

export default async function EstadisticasPage() {
  let initialData = null
  try {
    initialData = await getStandingsData()
  } catch (err) {
    console.error('[estadisticas] SSR data fetch failed:', err)
  }
  return <EstadisticasClient initialData={initialData} />
}
