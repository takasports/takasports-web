import { notFound } from 'next/navigation'
import { fetchMatchDetail } from './ficha'

// Se decide AQUÍ si el partido existe, y no en la página, porque el loading.tsx
// del segmento envuelve a la página pero no a su layout: en cuanto se pinta el
// esqueleto la respuesta ya ha salido con un 200, y el notFound() de la página
// acababa en un 200 con noindex (soft 404). Desde aquí es un 404 de verdad.
export default async function PartidoLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  if (!(await fetchMatchDetail(ref))) notFound()
  return children
}
