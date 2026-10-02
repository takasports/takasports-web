/**
 * Auto-interlinking de artículos: detecta menciones de equipos y jugadores
 * y las convierte en enlaces internos a /equipo/[slug] y /jugador/[slug].
 *
 * Equipos: los de /api/stats/standings (= las fichas del sitemap), con alias en
 * español («Atlético de Madrid», «Bayern Múnich») y el apodo NBA («Lakers»).
 * Pilotos de F1: NO. La ficha /jugador no sirve automovilismo (la API solo
 * resuelve fútbol, NBA y tenis) y la clasificación de F1 no trae ids, así que
 * no hay a dónde enlazarlos sin crear una página que no existe.
 *
 * Reglas SEO aplicadas:
 *  - Solo el primer match por entidad y por artículo.
 *  - Cap de 5 enlaces auto por artículo (evita sobre-linkeo).
 *  - Filtrado por deporte del artículo cuando está disponible.
 *  - Equipos: nombre ≥ 6 caracteres o multi-palabra, y nunca un nombre
 *    ambiguo suelto (STOPWORDS: «Real», «City», «United», «Atlético»…).
 *  - Jugadores: solo nombres multi-palabra (descarta apellidos sueltos
 *    que provocan falsos positivos como "Real" o "Bayern").
 *  - Word-boundary unicode-aware (respeta acentos y ñ).
 */

import { unstable_cache } from 'next/cache'
import { SITE_URL } from './constants'
// Constructores puros (entity-slug): player-slug arrastra supabase-admin y aquí
// solo se construye la URL. Son exactamente los mismos que reexporta aquel.
import { canonicalPlayerSlug, canonicalTeamSlug } from './entity-slug'

const ENTITY_CACHE_TTL = 60 * 60 // 1h

// Cap de enlaces auto por artículo. Subido de 5 → 8 en F2.4 (jun 2026) para
// dar más linking interno a hubs de entidad. Trade-off vs sobre-linkeo:
//   - 5 era conservador (evitar parecer spam)
//   - 8 todavía está dentro del rango seguro para artículos de 1500+ palabras
//   - Long-form de TakaSports promedia 1500-1800 palabras → 8 enlaces ≈ 1 cada
//     200 palabras = densidad natural editorial
export const MAX_AUTOLINKS_PER_ARTICLE = 8
// Bajado de 8 a 6 (oct 2026): con 8 se quedaban fuera Arsenal, Chelsea,
// Sevilla, Napoli, Getafe, Benfica u Osasuna, que no se confunden con nada.
// Lo que SÍ se confunde va a STOPWORDS por nombre, no por longitud.
const MIN_TEAM_NAME_LENGTH = 6

// Nombres sueltos que NO se enlazan nunca: o son media denominación de varios
// clubes («Real», «City», «United», «Atlético»), o son una palabra corriente
// que a principio de frase va con mayúscula («Como», «Deportivo»).
const STOPWORDS = new Set([
  'real', 'racing', 'atletico', 'atlético', 'sporting', 'unión', 'union',
  'olympique', 'inter', 'milan', 'roma', 'celta', 'leganés', 'leganes',
  'cádiz', 'cadiz', 'levante',
  'city', 'united', 'athletic', 'deportivo', 'internacional', 'club',
  'como', 'nice', 'lens', 'celtic', 'magic', 'kings', 'spurs', 'heat', 'jazz',
  'nets', 'suns', 'thunder',
])

/**
 * Clubes que también son la ciudad. «Se jugará en Barcelona» habla del sitio,
 * no del club, así que tras «en» no se enlazan. El resto de usos («el
 * Barcelona», «del Valencia») se enlaza como siempre.
 */
const CITY_NAMES = new Set([
  'barcelona', 'valencia', 'sevilla', 'villarreal', 'getafe', 'girona', 'liverpool',
  'mallorca', 'madrid', 'bilbao', 'napoli', 'torino', 'bologna', 'genoa', 'parma',
  'marseille', 'toulouse', 'strasbourg', 'brentford', 'sunderland', 'everton',
  'elche', 'malaga', 'málaga', 'lecce', 'monza', 'venezia', 'angers', 'brest',
  // Alias de TEAM_ALIASES que también son ciudad.
  'newcastle', 'nottingham', 'leeds', 'brighton', 'stuttgart', 'rennes', 'bournemouth',
  'marsella', 'oporto', 'friburgo', 'tottenham',
])

/**
 * Cómo escribe la prensa en español a los clubes que ESPN (la fuente de las
 * clasificaciones) nombra en inglés o con otra forma. Clave = nombre de ESPN.
 * Solo se activan si el club tiene ficha (está en las clasificaciones).
 */
const TEAM_ALIASES: Record<string, string[]> = {
  'Atlético Madrid': ['Atlético de Madrid'],
  'Bayern Munich': ['Bayern Múnich', 'Bayern de Múnich'],
  'Internazionale': ['Inter de Milán'],
  'Celta Vigo': ['Celta de Vigo'],
  'Marseille': ['Olympique de Marsella', 'Marsella'],
  'Lyon': ['Olympique de Lyon'],
  'Sporting CP': ['Sporting de Portugal', 'Sporting de Lisboa'],
  'FC Porto': ['Oporto'],
  'Tottenham Hotspur': ['Tottenham'],
  'Paris Saint-Germain': ['PSG'],
  'Borussia Mönchengladbach': ['Mönchengladbach'],
  'Eintracht Frankfurt': ['Eintracht de Fráncfort'],
  'Stade Rennais': ['Rennes'],
  'Feyenoord Rotterdam': ['Feyenoord'],
  'Newcastle United': ['Newcastle'],
  'Nottingham Forest': ['Nottingham'],
  'Leeds United': ['Leeds'],
  'Brighton & Hove Albion': ['Brighton'],
  'AFC Bournemouth': ['Bournemouth'],
  'TSG Hoffenheim': ['Hoffenheim'],
  'VfB Stuttgart': ['Stuttgart'],
  'SC Freiburg': ['Friburgo'],
}

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

/** Alias de un equipo: los de la tabla y, en NBA, el apodo («los Lakers»). */
export function teamAliases(name: string, leagueSlug: string): string[] {
  const out = [...(TEAM_ALIASES[name] ?? [])]
  if (leagueSlug === 'basketball/nba') {
    const nick = name.trim().split(/\s+/).pop() ?? ''
    if (nick && nick !== name.trim()) out.push(nick)
  }
  return out
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
        // La fila trae `name`, no `team`. Se leía `r.team`, que no existe, así
        // que NINGÚN equipo entraba en el índice y el autolink, que se anunciaba
        // como «equipos y jugadores», solo enlazaba jugadores.
        for (const r of g.rows ?? []) {
          const name = r.name ?? r.team
          if (r.teamId && name) teams.push({ name, teamId: String(r.teamId), leagueSlug: ls })
        }
      }
      // NBA East/West
      for (const r of [...(s.nbaEast ?? []), ...(s.nbaWest ?? [])]) {
        const name = r.name ?? r.team
        if (r.teamId && name) teams.push({ name, teamId: String(r.teamId), leagueSlug: 'basketball/nba' })
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

type TeamSeed = { name: string; teamId: string; leagueSlug: string }
type PlayerSeed = { name: string; playerId: string; leagueSlug: string }

/**
 * Índice de entidades enlazables. Puro (sin red) para poder testearlo.
 *
 * Equipos: SOLO los de las clasificaciones, que son exactamente los que el
 * sitemap publica como ficha → nunca se enlaza a una ficha que no existe o no
 * se indexa. Un mismo club puede aparecer en liga y en Champions: se queda la
 * primera aparición, y como la URL canónica no lleva liga, coinciden.
 */
export function buildEntityIndex(teams: readonly TeamSeed[], players: readonly PlayerSeed[]): EntityIndex {
  const byKey: Record<string, AutolinkEntry> = {}
  const add = (text: string, base: Omit<AutolinkEntry, 'displayName'>) => {
    const key = normalize(text)
    if (!key || key in byKey) return
    byKey[key] = { ...base, displayName: text.trim() }
  }

  for (const t of teams) {
    const base = {
      url: `/equipo/${canonicalTeamSlug(t.name, t.teamId)}`,
      sport: leagueToSport(t.leagueSlug),
      isPlayer: false,
    }
    if (isTeamNameAcceptable(t.name)) add(t.name, base)
    // Los alias curados a mano (TEAM_ALIASES) se saltan el mínimo de longitud
    // —«PSG» es inequívoco con tres letras—, pero no la lista negra. Los
    // apodos NBA, que salen solos, pasan el filtro completo.
    const curated = new Set(TEAM_ALIASES[t.name] ?? [])
    for (const alias of teamAliases(t.name, t.leagueSlug)) {
      const ok = curated.has(alias) ? !STOPWORDS.has(normalize(alias)) : isTeamNameAcceptable(alias)
      if (ok) add(alias, base)
    }
  }

  for (const p of players) {
    if (!isPlayerNameAcceptable(p.name)) continue
    add(p.name, {
      url: `/jugador/${canonicalPlayerSlug(p.name, p.playerId)}`,
      sport: leagueToSport(p.leagueSlug),
      isPlayer: true,
    })
  }

  // Orden por longitud descendente para que "Real Madrid" gane a "Real" si lo hubiera.
  const entries = Object.values(byKey).sort((a, b) => b.displayName.length - a.displayName.length)
  return { entries, byKey }
}

export const getEntityIndex = unstable_cache(
  async (): Promise<EntityIndex> => {
    const { teams, players } = await fetchEntities()
    return buildEntityIndex(teams, players)
  },
  // v2: el índice pasa a llevar equipos y alias (antes salía sin equipos).
  ['article-autolink-entity-index-v2'],
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

/** ¿Cae la posición dentro de `[texto](url)` o de una URL escrita tal cual? */
function insideExistingLink(text: string, at: number): boolean {
  const before = text.slice(0, at)
  // Corchete de markdown abierto y sin cerrar antes de la mención.
  if (before.lastIndexOf('[') > before.lastIndexOf(']')) return true
  // Paréntesis de destino de un enlace markdown: «](…».
  const paren = before.lastIndexOf('](')
  if (paren !== -1 && before.indexOf(')', paren) === -1) return true
  // Dentro de una URL: desde el último espacio hay un «http» o «www.».
  const token = before.slice(before.search(/\S*$/))
  return /https?:\/\/|www\./i.test(token)
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

    // «En Barcelona» es la ciudad, no el club.
    if (!entry.isPlayer && CITY_NAMES.has(normalize(matchText)) && /(?:^|\s)en\s+$/i.test(text.slice(Math.max(0, m.index - 4), m.index))) continue

    // Nunca dentro de un enlace ya escrito en el texto (markdown o URL suelta).
    if (insideExistingLink(text, m.index)) continue

    if (m.index > lastEnd) segments.push({ type: 'text', text: text.slice(lastEnd, m.index) })
    segments.push({ type: 'link', text: matchText, url: entry.url })
    ctx.used.add(entry.url)
    ctx.count += 1
    lastEnd = m.index + matchText.length
  }

  if (lastEnd < text.length) segments.push({ type: 'text', text: text.slice(lastEnd) })

  return segments.length > 0 ? segments : [{ type: 'text', text }]
}
