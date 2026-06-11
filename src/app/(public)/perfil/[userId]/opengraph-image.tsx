// Next.js convención: este archivo se sirve como meta og:image del
// /perfil/[userId]/page.tsx automáticamente.
// Cuando alguien comparte el link en X / WhatsApp / IG, ven la placa
// del usuario como preview.

import { fetchPlacaForOG, placaFallback, renderPlacaOG, OG_WIDTH, OG_HEIGHT } from '@/lib/og/placa-og'
import { SITE_URL } from '@/lib/constants'

export const runtime     = 'nodejs'
export const alt         = 'Mi placa · TakaSports'
export const size        = { width: OG_WIDTH, height: OG_HEIGHT }
export const contentType = 'image/png'

export default async function PlacaOpengraphImage({ params }: { params: { userId: string } }) {
  const data = await fetchPlacaForOG(params.userId, SITE_URL) ?? placaFallback()
  return renderPlacaOG(data, params.userId)
}
