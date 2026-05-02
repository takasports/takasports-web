import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Estadísticas — TakaSports',
  description: 'Estadísticas deportivas: goleadores, asistencias, tablas de clasificación y más. Fútbol, NBA, F1, Tenis y más deportes.',
}

export default function EstadisticasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
