import { notFound, permanentRedirect } from 'next/navigation'
import { canonicalPlayerSlug, isLegacyPlayerSlug } from '@/lib/player-slug'
import { fetchPlayer } from './ficha'

// Se decide AQUÍ si la ficha existe, y no en la página, porque el loading.tsx
// del segmento envuelve a la página pero no a su layout. En cuanto se pinta el
// esqueleto la respuesta ya ha salido con un 200, así que un notFound() o un
// redirect dentro de la página llegaban tarde: salían como un 200 con noindex
// (soft 404) o como un <meta refresh>. Desde aquí son un 404 y un 308 de verdad.
export default async function JugadorLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const player = await fetchPlayer(slug)
  if (!player) notFound()

  // Una ficha, una URL: «mbappe-231388» → «kylian-mbappe-231388». Solo entre
  // slugs del formato nuevo, que se resuelven los dos por el id y no pueden dar
  // un destino roto. El histórico «soccer_esp.1_231388» trae la liga en la URL y
  // puede ser la única vía a un jugador que no está en sport_entities: ese se
  // queda como está y consolida por canonical.
  const canonical = canonicalPlayerSlug(player.name, player.id)
  if (!isLegacyPlayerSlug(slug) && slug !== canonical) permanentRedirect(`/jugador/${canonical}`)

  return children
}
