import { notFound } from 'next/navigation'
import { fetchTeamDetail } from './ficha'

// Se decide AQUÍ si la ficha existe, y no en la página, porque el loading.tsx
// del segmento envuelve a la página pero no a su layout: en cuanto se pinta el
// esqueleto la respuesta ya ha salido con un 200, y el notFound() de la página
// acababa en un 200 con noindex (soft 404). Desde aquí es un 404 de verdad.
export default async function EquipoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!(await fetchTeamDetail(slug))) notFound()
  return children
}
