import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTopEntriesForCompare } from '@/lib/rankings-data'
import CompararClient from './CompararClient'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Comparador · Índice Taka',
  description: 'Compara dos figuras del Índice Taka: radar de 4 factores, desglose objetivo y delta total.',
  robots: { index: false },
}

export default async function CompararPage() {
  // Pre-fetch top DB entries (top 600 por score) para que el picker incluya
  // entries de la DB además de los estáticos. Ligero: 1 sola query sin joins.
  const dbEntries = await getTopEntriesForCompare(600)

  return (
    <Suspense>
      <CompararClient dbEntries={dbEntries} />
    </Suspense>
  )
}
