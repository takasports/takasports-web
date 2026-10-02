// /equipo/real-madrid → /equipo/real-madrid-86 (308 de verdad).
//
// El slug sin id daba 200 con «Equipo no encontrado»: un soft 404 que Search
// Console marca, y una URL que la gente escribe a mano o enlaza desde fuera.
//
// POR QUÉ EN next.config Y NO EN LA PÁGINA: la ficha es ISR con loading.tsx
// (streaming), y ahí un `permanentRedirect()` se degrada a meta refresh con
// 200 — mismo motivo por el que /reportajes se redirige desde next.config.
// Una regla de next.config es un 308 en el borde, sin invocar ninguna función.
//
// Fuente: /api/stats/standings, la misma de la que salen las fichas del
// sitemap y la resolución de team-slug.ts. Se lee UNA vez, al construir. Solo
// entran nombres que casan con UN club sin ambigüedad.
//
// Sin imports con alias `@/`: este módulo lo carga next.config.

import { canonicalTeamSlug, toNameSlug } from './entity-slug'

interface StandRow { teamId?: string | number; name?: string }
interface Standings { football?: Array<{ rows?: StandRow[] }>; nbaEast?: StandRow[]; nbaWest?: StandRow[] }

export interface TeamNameRedirect {
  source: string
  destination: string
  permanent: true
}

/**
 * Reglas a partir de las clasificaciones. Puro, para testearlo.
 *
 * Fuera:
 *   - nombres que dan el mismo slug para DOS clubes distintos (ambiguos);
 *   - slugs que acaban en «-número» («schalke-04»): la ruta los lee como
 *     nombre-id, y redirigirlos podría pisar la ficha de otro club;
 *   - slugs vacíos (alfabetos no latinos).
 */
export function teamNameRedirectsFrom(data: Standings): TeamNameRedirect[] {
  const rows: StandRow[] = [
    ...(data.football ?? []).flatMap(g => g.rows ?? []),
    ...(data.nbaEast ?? []),
    ...(data.nbaWest ?? []),
  ]
  const bySlug = new Map<string, { id: string; name: string } | null>()
  for (const r of rows) {
    if (r.teamId == null || !r.name) continue
    const id = String(r.teamId)
    const slug = toNameSlug(r.name)
    if (!slug || /-\d+$/.test(slug) || /^\d+$/.test(slug)) continue
    const prev = bySlug.get(slug)
    if (prev === undefined) bySlug.set(slug, { id, name: r.name })
    else if (prev && prev.id !== id) bySlug.set(slug, null) // ambiguo → fuera
  }
  const out: TeamNameRedirect[] = []
  for (const [slug, hit] of bySlug) {
    if (!hit) continue
    out.push({ source: `/equipo/${slug}`, destination: `/equipo/${canonicalTeamSlug(hit.name, hit.id)}`, permanent: true })
  }
  return out.sort((a, b) => a.source.localeCompare(b.source))
}

/** Lee las clasificaciones de producción al construir. Si falla, no hay reglas
 *  (la ficha sigue como antes: noindex) y el build no se cae. */
export async function fetchTeamNameRedirects(siteUrl: string): Promise<TeamNameRedirect[]> {
  try {
    const res = await fetch(`${siteUrl}/api/stats/standings`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return []
    return teamNameRedirectsFrom(await res.json())
  } catch {
    return []
  }
}
