// Slugs de las fichas de equipo — el equivalente para clubes de player-slug.ts.
//
// Antes:  /equipo/soccer_esp.1_86     → sin keyword
// Ahora:  /equipo/real-madrid-86      → keyword en la URL
//
// Además CONSOLIDA duplicados: hoy un equipo que juega liga + competición europea
// tiene DOS URLs (soccer_esp.1_86 y soccer_uefa.champions_86); el slug nuevo, al no
// llevar la liga dentro, las funde en una sola (real-madrid-86). ~33 equipos estaban
// indexados por partida doble.
//
// COMPATIBILIDAD CON LA APP — el formato legacy no se retira nunca:
// la app móvil publicada construye "<sport>_<league>_<teamId>" por concatenación y lo
// guarda como identidad de los equipos SEGUIDOS (AsyncStorage + Supabase). Ver la nota
// equivalente en player-slug.ts.
//
// Resolución de la liga: el slug nuevo no la lleva, así que para un club hay que
// mapear teamId -> leagueSlug. La fuente es /api/stats/standings, que es EXACTAMENTE
// de donde el sitemap saca las URLs de equipo → cobertura 100% por construcción, sin
// tabla que sembrar ni bootstrap. El formato legacy (el de la app) NO paga esta
// resolución: la liga viene en la propia URL.

import { SITE_URL } from '@/lib/constants'
import { toNameSlug } from '@/lib/entity-slug'

/** Referencia resuelta de un equipo, sea cual sea el formato de entrada. */
export interface TeamRef {
  teamId: string
  /** "soccer/esp.1" o "basketball/nba". */
  leagueSlug: string
}

// El constructor puro vive en entity-slug.ts (sin dependencias de servidor) para
// que lo pueda usar el calendario, que es un componente cliente.
export { canonicalTeamSlug } from '@/lib/entity-slug'

/** Formato antiguo "<sport>_<league>_<teamId>", reconocido por el "_". */
export function isLegacyTeamSlug(slug: string): boolean {
  return slug.includes('_')
}

/** "soccer_esp.1_86" → { teamId: "86", leagueSlug: "soccer/esp.1" } */
export function parseLegacyTeamSlug(slug: string): TeamRef | null {
  const parts = slug.split('_')
  if (parts.length < 3) return null
  const teamId = parts[parts.length - 1]
  if (!/^\d+$/.test(teamId)) return null
  return { teamId, leagueSlug: parts.slice(0, -1).join('/') }
}

/** "real-madrid-86" → "86". También acepta un id pelado. */
export function extractTeamId(slug: string): string | null {
  const m = /(?:^|-)(\d+)$/.exec(slug)
  return m ? m[1] : null
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
}

interface StandRow { teamId?: string | number; name?: string }
interface StandGroup { leagueSlug?: string; rows?: StandRow[] }

/**
 * teamId → { sport, leagueSlug } leyendo /api/stats/standings (cacheado). Cubre los
 * mismos equipos que el sitemap por construcción.
 *
 * Dos desempates:
 *   - Un club en liga + competición europea sale en ambos bloques: se PREFIERE la liga
 *     doméstica (no `uefa.*`), que es la que una ficha de equipo debe mostrar por
 *     defecto. Así, además, las dos URLs viejas convergen a la misma canónica.
 *   - Un teamId que coincidiera entre fútbol y NBA (hoy no pasa entre los indexados) se
 *     desempata con `nameHint`, la parte de nombre del propio slug.
 */
export async function lookupTeamLeague(teamId: string, nameHint?: string): Promise<TeamRef | null> {
  let data: { football?: StandGroup[]; nbaEast?: StandRow[]; nbaWest?: StandRow[] }
  try {
    const res = await fetch(`${apiBase()}/api/stats/standings`, { next: { revalidate: 1800 } })
    if (!res.ok) return null
    data = await res.json()
  } catch {
    return null
  }

  const footballHits: Array<{ leagueSlug: string; name: string }> = []
  for (const g of data.football ?? []) {
    if (!g.leagueSlug) continue
    for (const r of g.rows ?? []) {
      if (r.teamId != null && String(r.teamId) === teamId) {
        footballHits.push({ leagueSlug: g.leagueSlug, name: r.name ?? '' })
      }
    }
  }
  const nbaHit = [...(data.nbaEast ?? []), ...(data.nbaWest ?? [])]
    .find(r => r.teamId != null && String(r.teamId) === teamId)

  // Entre los bloques de fútbol, la liga doméstica gana a la competición europea.
  const pickFootball = () =>
    footballHits.find(m => !m.leagueSlug.includes('uefa')) ?? footballHits[0]

  // Colisión fútbol/NBA: desempatar por el nombre del slug si se puede.
  if (footballHits.length && nbaHit) {
    if (nameHint) {
      const fb = pickFootball()
      if (toNameSlug(fb.name) === nameHint) return { teamId, leagueSlug: fb.leagueSlug }
      if (toNameSlug(nbaHit.name ?? '') === nameHint) return { teamId, leagueSlug: 'basketball/nba' }
    }
    return { teamId, leagueSlug: pickFootball().leagueSlug }   // determinista si no hay hint
  }
  if (footballHits.length) return { teamId, leagueSlug: pickFootball().leagueSlug }
  if (nbaHit) return { teamId, leagueSlug: 'basketball/nba' }
  return null
}

/**
 * Resuelve cualquiera de los dos formatos a { teamId, leagueSlug }. El legacy se
 * resuelve sin red (la liga viene en la URL); el nuevo consulta standings una vez.
 */
export async function resolveTeamSlug(slug: string): Promise<TeamRef | null> {
  if (isLegacyTeamSlug(slug)) return parseLegacyTeamSlug(slug)

  const teamId = extractTeamId(slug)
  if (!teamId) return null
  // La parte de nombre del slug ("real-madrid" de "real-madrid-86") sirve de desempate.
  const nameHint = slug.slice(0, slug.length - teamId.length).replace(/-+$/, '') || undefined
  return lookupTeamLeague(teamId, nameHint)
}
