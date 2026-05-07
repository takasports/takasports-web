import dynamic from 'next/dynamic'
import { getStandingsData } from '@/app/api/stats/standings/route'
import EstadisticasLoading from './loading'

const EstadisticasClient = dynamic(() => import('./EstadisticasClient'), {
  loading: () => <EstadisticasLoading />,
})

export default async function EstadisticasPage() {
  let initialData = null
  try {
    initialData = await getStandingsData()
  } catch (err) {
    console.error('[estadisticas] SSR data fetch failed:', err)
  }
  return <EstadisticasClient initialData={initialData} />
}
