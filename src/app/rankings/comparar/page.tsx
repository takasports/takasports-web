import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getAllRankings } from '@/lib/rankings-data'
import CompararClient from './CompararClient'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Comparador · Índice Taka',
  description: 'Compara dos figuras del Índice Taka: radar de 4 factores, desglose objetivo y delta total.',
  robots: { index: false },
}

export default async function CompararPage() {
  // Pre-fetch DB entries so the client picker can search them immediately.
  // Falls back gracefully if Supabase is unavailable (getAllRankings returns static).
  const dbData = await getAllRankings()
  const dbEntries = Object.values(dbData).flat()

  return (
    <Suspense>
      <CompararClient dbEntries={dbEntries} />
    </Suspense>
  )
}
