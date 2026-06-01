// Next.js convención: twitter:image. Mismo render que opengraph-image.
// Twitter usa este específicamente para "summary_large_image" cards.

import { fetchPlacaForOG, placaFallback, renderPlacaOG, OG_WIDTH, OG_HEIGHT } from '@/lib/og/placa-og'
import { SITE_URL } from '@/lib/constants'

export const runtime     = 'nodejs'
export const alt         = 'Mi placa · TakaSports'
export const size        = { width: OG_WIDTH, height: OG_HEIGHT }
export const contentType = 'image/png'

export default async function PlacaTwitterImage({ params }: { params: { userId: string } }) {
  const data = await fetchPlacaForOG(params.userId, SITE_URL) ?? placaFallback()
  return renderPlacaOG(data, params.userId)
}
