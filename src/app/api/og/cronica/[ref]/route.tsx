// GET /api/og/cronica/[ref] → JPEG 1200×675, portada de una crónica automática.
//
// Misma placa que la previa (diseño aprobado el 02/10/2026, la variante con foto),
// pero con el marcador final y los goleadores de cada lado en vez de la hora. Los
// datos salen del encargo de la crónica y de la ficha de ESPN; la foto, igual que en
// la previa, se lee del encargo (nunca de la URL). `?v=` solo rompe la caché.

import { adminSupabase } from '@/lib/supabase-admin'
import { fetchSummary, parseMatchRef } from '@/lib/previas-dossier'
import { golesPorEquipo, renderPlacaPrevia, type DatosEncargo } from '@/lib/placa-previa'
import { accentForSport } from '@/lib/sports'
import { toSpanishNation } from '@/lib/nation-names'

export const runtime = 'nodejs'

const hex = (c: unknown, fallback: string) => (typeof c === 'string' && /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : fallback)

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref: rawRef } = await params
  const ref = decodeURIComponent(rawRef)
  if (!parseMatchRef(ref)) return new Response('bad_ref', { status: 400 })

  const sb = adminSupabase()
  const encargo = sb
    ? await sb.from('route_jobs').select('input_json')
        .eq('input_json->>kind', 'cronica').eq('input_json->>matchRef', ref)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then((r) => r.data?.input_json as { datos?: DatosEncargo & { marcador?: { home: number; away: number } }; foto?: string | null } | null, () => null)
    : null

  const summary = await fetchSummary(ref)
  const comp = summary?.header?.competitions?.[0]
  const competidores: Array<Record<string, any>> = comp?.competitors ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
  const cHome = competidores.find((c) => c.homeAway === 'home')
  const cAway = competidores.find((c) => c.homeAway === 'away')
  if (!cHome || !cAway) return new Response('match_not_found', { status: 404 })

  const d = encargo?.datos ?? {}
  const marcador = d.marcador ?? { home: Number(cHome.score), away: Number(cAway.score) }
  if (!Number.isFinite(marcador.home) || !Number.isFinite(marcador.away)) return new Response('no_score', { status: 404 })
  const accent = accentForSport(d.sport ?? parseMatchRef(ref)?.sport)
  const logo = (c: Record<string, any> | undefined) => c?.team?.logos?.[0]?.href ?? c?.team?.logo ?? null // eslint-disable-line @typescript-eslint/no-explicit-any
  const venue = summary?.gameInfo?.venue

  const r = await renderPlacaPrevia({
    modo: 'cronica',
    marcador,
    goles: parseMatchRef(ref)?.sport === 'soccer'
      ? golesPorEquipo(summary?.keyEvents ?? [], String(cHome.team?.id ?? ''), String(cAway.team?.id ?? ''))
      : null,
    home: d.home ?? toSpanishNation(cHome.team?.displayName ?? '') ?? '',
    away: d.away ?? toSpanishNation(cAway.team?.displayName ?? '') ?? '',
    competicion: d.competicion ?? summary?.header?.league?.name ?? '',
    kickoffIso: d.kickoffIso ?? comp?.date,
    estadio: d.estadio ?? venue?.fullName ?? null,
    ciudad: venue?.address?.city ?? null,
    accent,
    colorHome: hex(cHome.team?.color, accent),
    colorAway: hex(cAway.team?.color, '#7C3AED'),
    logoHome: logo(cHome),
    logoAway: logo(cAway),
    fotoUrl: encargo?.foto ?? d.fotoEstadio?.url ?? null,
  })
  const cacheHeaders = {
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }
  return new Response(r.body as BodyInit, { headers: { ...cacheHeaders, 'Content-Type': r.type } })
}
