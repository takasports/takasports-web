// GET /api/og/placa/[userId]
//
// Genera PNG 1200×630 compartible con la placa de un usuario.
// La lógica de render vive en src/lib/og/placa-og.tsx — compartida
// con /perfil/[userId]/opengraph-image.tsx + twitter-image.tsx.

import type { NextRequest } from 'next/server'
import { fetchPlacaForOG, placaFallback, renderPlacaOG } from '@/lib/og/placa-og'

export const runtime     = 'nodejs'
export const contentType = 'image/png'

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const origin = new URL(req.url).origin
  const data = await fetchPlacaForOG(userId, origin) ?? placaFallback()
  const res = renderPlacaOG(data, userId)
  // Caché de CDN: la placa refleja nivel/puntos/cosméticos (cambian), pero como
  // imagen compartible una instantánea de ~1h vale. Antes era force-dynamic:
  // re-render satori (CPU) en cada apertura del enlace compartido. CDN-Cache-Control
  // es la que respeta Vercel para su caché de borde (Next sobrescribe el
  // Cache-Control de cara al navegador en rutas dinámicas).
  res.headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  res.headers.set('CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  return res
}
