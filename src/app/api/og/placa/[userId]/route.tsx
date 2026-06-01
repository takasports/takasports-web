// GET /api/og/placa/[userId]
//
// Genera PNG 1200×630 compartible con la placa de un usuario.
// La lógica de render vive en src/lib/og/placa-og.tsx — compartida
// con /perfil/[userId]/opengraph-image.tsx + twitter-image.tsx.

import type { NextRequest } from 'next/server'
import { fetchPlacaForOG, placaFallback, renderPlacaOG } from '@/lib/og/placa-og'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const contentType = 'image/png'

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const origin = new URL(req.url).origin
  const data = await fetchPlacaForOG(userId, origin) ?? placaFallback()
  return renderPlacaOG(data, userId)
}
