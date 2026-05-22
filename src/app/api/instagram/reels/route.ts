// API route — sirve los reels de @taka.sports
// Toda la lógica de fusión, cache y timeouts vive en lib/reels-feed.ts
// para que el video-sitemap pueda reusarla sin duplicar fuentes.

import { getMergedReels } from '@/lib/reels-feed'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const reels = await getMergedReels()
  return Response.json(reels)
}
