import { EstadisticasView } from './StatsView'

// La portada de /estadisticas ya NO lee `searchParams`: el deporte vive ahora en
// rutas de path /estadisticas/[sport] (params SÍ cacheables). Por eso esta página
// puede precocinarse (ISR): el middleware le aplica FAST_CACHE y `revalidate=300`
// regenera el árbol de datos en segundo plano cada 5 min. La metadata por defecto
// (title/canonical/OG de /estadisticas) la aporta layout.tsx.
export const revalidate = 300

export default async function EstadisticasPage() {
  return <EstadisticasView sport="" />
}
