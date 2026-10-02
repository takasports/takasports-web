// GET /api/og/columna/[id] → JPEG 1200×675, portada de una columna de opinión.
// `id` es el del encargo (route_jobs) que crea WF-07 al elegir una propuesta. El
// titular, la firma y la foto salen del encargo, nunca de la URL. `?v=` solo
// rompe la caché.

import { adminSupabase } from '@/lib/supabase-admin'
import { renderPlacaColumna } from '@/lib/placa-previa'
import { accentForSport } from '@/lib/sports'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('bad_id', { status: 400 })
  const sb = adminSupabase()
  if (!sb) return new Response('no_db', { status: 503 })
  const { data } = await sb.from('route_jobs').select('input_json, generated').eq('id', id).maybeSingle()
  const ij = data?.input_json as { kind?: string; firma?: string; foto?: string | null; titular?: string; propuesta?: { titulo?: string; base?: Array<{ deporte?: string }> } } | null
  if (!ij || ij.kind !== 'columna' || !ij.firma) return new Response('not_found', { status: 404 })
  const gen = data?.generated as { headline?: string } | null
  const r = await renderPlacaColumna({
    titulo: gen?.headline || ij.titular || ij.propuesta?.titulo || '',
    firma: ij.firma,
    accent: accentForSport(ij.propuesta?.base?.[0]?.deporte ?? 'futbol'),
    fotoUrl: ij.foto ?? null,
  })
  const cc = 'public, s-maxage=86400, stale-while-revalidate=604800'
  return new Response(r.body as BodyInit, { headers: { 'Cache-Control': cc, 'CDN-Cache-Control': cc, 'Content-Type': r.type } })
}
