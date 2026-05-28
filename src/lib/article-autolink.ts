/**
 * Auto-interlinking de artículos: detecta menciones de equipos y jugadores
 * y las convierte en enlaces internos a /equipo/[slug] y /jugador/[slug].
 *
 * Reglas SEO aplicadas:
 *  - Solo el primer match por entidad y por artículo.
 *  - Cap de 5 enlaces auto por artículo (evita sobre-linkeo).
 *  - Filtrado por deporte del artículo cuando está disponible.
 *  - Equipos: nombre ≥ 8 caracteres o multi-palabra (descarta acrónimos cortos).
 *  - Jugadores: solo nombres multi-palabra (descarta apellidos sueltos
 *    que provocan falsos positivos como "Real" o "Bayern").
 *  - Word-boundary unicode-aware (respeta acentos y ñ).
 */

import { unstable_cache } from 'next/cache'
import { SITE_URL } from './constants'

const ENTITY_CACHE_TTL = 60 * 60 // 1h

const MAX_AUTOLINKS_PER_ARTICLE = 5
const MIN_TEAM_NAME_LENGTH = 8

const STOPWORDS = new Set([
  'real', 'racing', 'atletico', 'atlético', 'sporting', 'unión', 'union',
  'olympique', 'inter', 'milan', 'roma', 'celta', 'leganés', 'leganes',
  'cádiz', 'cadiz', 'levante',
])

type Sport =
  | 'futbol' | 'baloncesto' | 'f1' | 'tenis' | 'ufc' | 'motogp'
  | 'wwe' | 'rugby' | 'mundial' | null

export interface AutolinkEntry {
  url: string
  displayName: string
  sport: Sport
  isPlayer: boolean
}

export interface EntityIndex {
  entries: AutolinkEntry[]
  /** Lookup case-insensitive: nombre normalizado → entrada.
   *  Usamos Record (objeto plano) para que unstable_cache pueda serializarlo a JSON. */
  byKey: Record<string, AutolinkEntry>
}

function leagueToSport(leagueSlug: string | undefined): Sport {
  if (!leagueSlug) return null
  if (leagueSlug.startsWith('soccer/')) return 'futbol'
  if (leagueSlug.startsWith('basketball/')) return 'baloncesto'
  if (leagueSlug.startsWith('f1') || leagueSlug.startsWith('racing/f1')) return 'f1'
  if (leagueSlug.startsWith('tennis') || leagueSlug.startsWith('atp') || leagueSlug.startsWith('wta')) return 'tenis'
  if (leagueSlug.startsWith('mma') || leagueSlug.startsWith('ufc')) return 'ufc'
  return null
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isTeamNameAcceptable(name: string): boolean {
  const trimmed = name.trim()
  if (trimmed.length === 0) return false
  if (STOPWORDS.has(normalize(trimmed))) return false
  if (trimmed.includes(' ')) return true
  return trimmed.length >= MIN_TEAM_NAME_LENGTH
}

function isPlayerNameAcceptable(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.includes(' ') && trimmed.length >= 6
}

async function fetchEntities(): Promise<{
  teams: Array<{ name: string; teamId: string; leagueSlug: string }>
  players: Array<{ name: string; playerId: string; leagueSlug: string }>
}> {
  const teams: Array<{ name: string; teamId: string; leagueSlug: string }> = []
  const players: Array<{ name: string; playerId: string; leagueSlug: string }> = []

  try {
    const [stRes, plRes] = await Promise.all([
      fetch(`${SITE_URL}/api/stats/standings`, { next: { revalidate: ENTITY_CACHE_TTL } }),
      fetch(`${SITE_URL}/api/stats/players`,   { next: { revalidate: ENTITY_CACHE_TTL } }),
    ])

    if (stRes.ok) {
      const s = await stRes.json()
      // Football leagues
      for (const g of s.football ?? []) {
        const ls = g.leagueSlug as string | undefined
        if (!ls) continue
        for (const r of g.rows ?? []) {
          if (r.teamId && r.team) teams.push({ name: r.team, teamId: r.teamId, leagueSlug: ls })
        }
      }
      // NBA East/West
      for (const r of [...(s.nbaEast ?? []), ...(s.nbaWest ?? [])]) {
        if (r.teamId && r.team) teams.push({ name: r.team, teamId: r.teamId, leagueSlug: 'basketball/nba' })
      }
    }

    if (plRes.ok) {
      const p = await plRes.json()
      const pushPlayers = (arr: Array<{ name: string; playerId?: string; leagueSlug?: string }> | undefined) => {
        for (const x of arr ?? []) {
          if (x.playerId && x.leagueSlug && x.name) {
            players.push({ name: x.name, playerId: x.playerId, leagueSlug: x.leagueSlug })
          }
        }
      }
      for (const lg of p.leagues ?? []) {
        pushPlayers(lg.goals)
        pushPlayers(lg.assists)
      }
      for (const k of Object.keys(p.combined ?? {})) pushPlayers(p.combined[k])
    }
  } catch {
    // En caso de fallo de red, devolvemos vacío y el artículo se renderiza sin auto-links.
  }

  return { teams, players }
}

export const getEntityIndex = unstable_cache(
  async (): Promise<EntityIndex> => {
    const { teams, players } = await fetchEntities()

    const byKey: Record<string, AutolinkEntry> = {}

    for (const t of teams) {
      if (!isTeamNameAcceptable(t.name)) continue
      const key = normalize(t.name)
      if (key in byKey) continue
      const slug = `${t.leagueSlug.replace('/', '_')}_${t.teamId}`
      byKey[key] = {
        url: `/equipo/${slug}`,
        displayName: t.name,
        sport: leagueToSport(t.leagueSlug),
        isPlayer: false,
      }
    }

    for (const p of players) {
      if (!isPlayerNameAcceptable(p.name)) continue
      const key = normalize(p.name)
      if (key in byKey) continue
      const slug = `${p.leagueSlug.replace('/', '_')}_${p.playerId}`
      byKey[key] = {
        url: `/jugador/${slug}`,
        displayName: p.name,
        sport: leagueToSport(p.leagueSlug),
        isPlayer: true,
      }
    }

    // Orden por longitud descendente para que "Real Madrid" gane a "Real" si lo hubiera.
    const entries = Object.values(byKey).sort((a, b) => b.displayName.length - a.displayName.length)

    return { entries, byKey }
  },
  ['article-autolink-entity-index-v1'],
  { revalidate: ENTITY_CACHE_TTL, tags: ['autolink-entities'] },
)

export interface AutolinkContext {
  /** Slugs ya enlazados en este artículo (clave: url). */
  used: Set<string>
  /** Contador global de auto-links insertados en el artículo. */
  count: number
  /** Deporte del artículo (filtro contextual). null = sin filtro. */
  sport: Sport
}

export function createAutolinkContext(sport: string | null | undefined): AutolinkContext {
  return {
    used: new Set(),
    count: 0,
    sport: (sport ?? null) as Sport,
  }
}

export interface AutolinkSegment {
  type: 'text' | 'link'
  text: string
  url?: string
}

/**
 * Segmenta un texto plano en tramos de texto y enlaces. Devuelve estructura
 * neutra a React para que el caller pueda renderizar con `<Link>` o `<a>`.
 */
export function autolinkSegments(
  text: string,
  index: EntityIndex,
  ctx: AutolinkContext,
): AutolinkSegment[] {
  if (!text || index.entries.length === 0 || ctx.count >= MAX_AUTOLINKS_PER_ARTICLE) {
    return [{ type: 'text', text }]
  }

  const alt = index.entries.map(e => escapeRegex(e.displayName)).join('|')
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${alt})(?![\\p{L}\\p{N}])`, 'gu')

  const segments: AutolinkSegment[] = []
  let lastEnd = 0

  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    if (ctx.count >= MAX_AUTOLINKS_PER_ARTICLE) break

    const matchText = m[1]
    const entry = index.byKey[normalize(matchText)]
    if (!entry) continue

    // Filtro por deporte del artículo: si está marcado, debe coincidir con la entidad.
    if (ctx.sport && entry.sport && ctx.sport !== entry.sport) continue

    // Solo primer match por entidad.
    if (ctx.used.has(entry.url)) continue

    if (m.index > lastEnd) segments.push({ type: 'text', text: text.slice(lastEnd, m.index) })
    segments.push({ type: 'link', text: matchText, url: entry.url })
    ctx.used.add(entry.url)
    ctx.count += 1
    lastEnd = m.index + matchText.length
  }

  if (lastEnd < text.length) segments.push({ type: 'text', text: text.slice(lastEnd) })

  return segments.length > 0 ? segments : [{ type: 'text', text }]
}
