// API route — sirve los reels de @taka.sports
// Toda la lógica de fusión, cache y timeouts vive en lib/reels-feed.ts
// para que el video-sitemap pueda reusarla sin duplicar fuentes.

import { getMergedReels } from '@/lib/reels-feed'

export const runtime = 'nodejs'

// Feed público no personalizado (la home lo pide en CADA carga). Lo cacheamos en
// el CDN para que todos los visitantes compartan una sola respuesta en vez de
// invocar la función por visita. El merge ya tiene su propia caché en memoria
// (~30 min) en lib/reels-feed, así que 300s de borde no atrasa nada perceptible.
const CACHE = 'public, s-maxage=300, stale-while-revalidate=900'

export async function GET() {
  const reels = await getMergedReels()
  return Response.json(reels, {
    headers: { 'Cache-Control': CACHE, 'CDN-Cache-Control': CACHE },
  })
}
