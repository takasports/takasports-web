'use client'

// Puerta de montaje en cliente para EstadisticasClient.
//
// HISTORIA (2026-07-19): se creó durante la caza de un "esqueleto eterno en /estadisticas"
// que se creía un bug de SSG de Next 16, pero era el SERVICE WORKER sirviendo HTML fósil a
// los navegadores de prueba (ver memoria verificacion-navegador-sw). Con Chromium prístino
// (serviceWorkers:block) la página montaba bien también con el patrón anterior (next/dynamic).
// Aun así el gate SE QUEDA: es un patrón limpio y sin riesgo — al diferir el montaje (y con él
// el useSearchParams de EstadisticasClient) a después de la hidratación, el prerender solo
// emite el esqueleto y NINGÚN boundary de Suspense queda suspendido en el HTML, evitando de
// raíz el footgun conocido useSearchParams+Suspense-en-prerender. El SEO lo cubren los
// directorios server-rendered de StatsView.
import { Suspense, useEffect, useState } from 'react'
import EstadisticasClient from './EstadisticasClient'
import EstadisticasLoading from './loading'
import type { LiveStandingsData } from './live-data'

export default function EstadisticasClientGate({ initialData, initialSport }: {
  initialData?: LiveStandingsData | null
  initialSport?: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // El prerender solo ve el esqueleto (mounted=false), así que el useSearchParams de
  // EstadisticasClient nunca se ejecuta en el servidor y NINGÚN boundary queda
  // suspendido en el HTML. El Suspense de aquí nace ya en cliente, donde sí se reanuda.
  if (!mounted) return <EstadisticasLoading />
  return (
    <Suspense fallback={<EstadisticasLoading />}>
      <EstadisticasClient initialData={initialData} initialSport={initialSport} />
    </Suspense>
  )
}
