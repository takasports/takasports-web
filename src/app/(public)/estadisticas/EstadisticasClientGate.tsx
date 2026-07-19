'use client'

// Puerta de montaje en cliente para EstadisticasClient.
//
// POR QUÉ EXISTE (incidente 2026-07-19): con Next 16, el patrón anterior
// (next/dynamic en el Server Component StatsView + useSearchParams dentro del
// cliente) dejaba la página SSG clavada PARA SIEMPRE en el fallback de Suspense:
// el boundary suspendido durante el prerender no se reanudaba nunca al hidratar.
// En dev funcionaba (sin prerender), por eso el bug pasó invisible: TODO build de
// producción (Vercel incluido) servía el esqueleto eterno en /estadisticas.
//
// El arreglo: importar el cliente ESTÁTICAMENTE desde un client component y
// montarlo tras un gate de useEffect. El HTML sigue llevando el esqueleto (igual
// que antes: el SEO lo cubren los directorios server-rendered de StatsView) y el
// contenido interactivo aparece al hidratar, que era el contrato original.
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
