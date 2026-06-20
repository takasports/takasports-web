import { EstadisticasView } from './StatsView'

// La portada de /estadisticas ya NO lee `searchParams`: el deporte vive ahora en
// rutas de path /estadisticas/[sport] (params SÍ cacheables). Por eso esta página
// puede precocinarse (ISR): el middleware le aplica FAST_CACHE y `revalidate=300`
// regenera el árbol de datos en segundo plano cada 5 min. La metadata por defecto
// (title/canonical/OG de /estadisticas) la aporta layout.tsx.
export const revalidate = 300

export default async function EstadisticasPage() {
  return (
    <>
      {/* H1 server-rendered: la vista de estadísticas es cliente y no emitía H1. (Fix M1 SEO) */}
      <h1 className="sr-only">Estadísticas deportivas en vivo</h1>
      <EstadisticasView sport="" />
    </>
  )
}
