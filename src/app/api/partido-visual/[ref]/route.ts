// GET /api/partido-visual/[ref] → las piezas visuales de una nota de partido
// (marcador y eventos, estadísticas, clasificación, racha, cara a cara y figura) para
// que la app las pinte igual que la web. Los datos son de ESPN; ver
// `lib/partido-visual.ts`. Caché de una hora en el CDN.

import { NextResponse } from 'next/server'
import { fetchFichaVisual } from '@/lib/partido-visual'
import { parseMatchRef } from '@/lib/previas-dossier'

export const revalidate = 3600

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref: raw } = await params
  const ref = decodeURIComponent(raw)
  if (!parseMatchRef(ref)) return NextResponse.json({ error: 'bad_ref' }, { status: 400 })
  const ficha = await fetchFichaVisual(ref)
  const cc = 'public, s-maxage=3600, stale-while-revalidate=86400'
  if (!ficha) return NextResponse.json({ ficha: null }, { headers: { 'Cache-Control': 'public, s-maxage=300' } })
  return NextResponse.json({ ficha }, { headers: { 'Cache-Control': cc, 'CDN-Cache-Control': cc } })
}
