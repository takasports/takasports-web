// GET /api/og/previa/[ref] → JPEG 1200×675, portada de una previa automática.
//
// La placa es nuestra: los dos escudos, la hora en España y en Latinoamérica, y el
// estadio. Si la cascada de fotos de WF-08 encontró una foto buena (apaisada, ancha
// y sin marca de agua), va de fondo oscurecida; si no, fondo con los colores de los
// dos equipos. Así toda previa tiene portada sin pagar generación con IA. El dibujo
// vive en `lib/placa-previa.tsx`.
//
// La foto NO viaja en la URL. Se lee del encargo de la previa (`route_jobs`,
// `input_json.foto`), que solo escribe WF-08. Aceptar `?foto=<url>` convertía esto
// en un generador abierto: cualquiera podía componer una imagen ajena con nuestra
// marca y servirla desde nuestro dominio. `?v=` solo rompe la caché cuando cambia
// la foto; su valor se ignora.
//
// 1200×675 (16:9): es el ancho que pide Google Discover y la caja del hero de la
// noticia exige apaisado (ratio ≥ 1,3).

import { adminSupabase } from '@/lib/supabase-admin'
import { fetchSummary, parseMatchRef } from '@/lib/previas-dossier'
import { renderPlacaPrevia, type DatosEncargo } from '@/lib/placa-previa'
import { accentForSport } from '@/lib/sports'

export const runtime = 'nodejs'

const hex = (c: unknown, fallback: string) => (typeof c === 'string' && /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : fallback)

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref: rawRef } = await params
  const ref = decodeURIComponent(rawRef)
  if (!parseMatchRef(ref)) return new Response('bad_ref', { status: 400 })

  const sb = adminSupabase()
  const encargo = sb
    ? await sb.from('route_jobs').select('input_json')
        .eq('input_json->>kind', 'previa').eq('input_json->>matchRef', ref)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
        .then((r) => r.data?.input_json as { datos?: DatosEncargo; foto?: string | null } | null, () => null)
    : null

  const summary = await fetchSummary(ref)
  const comp = summary?.header?.competitions?.[0]
  const competidores: Array<Record<string, any>> = comp?.competitors ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
  const cHome = competidores.find((c) => c.homeAway === 'home')
  const cAway = competidores.find((c) => c.homeAway === 'away')
  if (!encargo?.datos && !cHome) return new Response('match_not_found', { status: 404 })

  const d = encargo?.datos ?? {}
  const home = d.home ?? cHome?.team?.displayName ?? ''
  const away = d.away ?? cAway?.team?.displayName ?? ''
  const kickoff = d.kickoffIso ?? comp?.date
  const competicion = d.competicion ?? summary?.header?.league?.name ?? ''
  const venue = summary?.gameInfo?.venue
  const estadio = d.estadio ?? venue?.fullName ?? null
  const ciudad = venue?.address?.city ?? null
  const accent = accentForSport(d.sport ?? parseMatchRef(ref)?.sport)
  const colorHome = hex(cHome?.team?.color, accent)
  const colorAway = hex(cAway?.team?.color, '#7C3AED')
  const logo = (c: Record<string, any> | undefined) => c?.team?.logos?.[0]?.href ?? c?.team?.logo ?? null // eslint-disable-line @typescript-eslint/no-explicit-any

  const r = await renderPlacaPrevia({
    home, away, competicion, kickoffIso: kickoff, estadio, ciudad, accent, colorHome, colorAway,
    logoHome: logo(cHome), logoAway: logo(cAway), fotoUrl: encargo?.foto ?? null,
  })
  // Una previa no cambia hasta que cambia su foto, y eso ya rompe la caché con `?v=`.
  const cacheHeaders = {
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }
  return new Response(r.body as BodyInit, { headers: { ...cacheHeaders, 'Content-Type': r.type } })
}
