import Link from 'next/link'
import { Suspense } from 'react'
import { getStandingsData, shardStandingsForSport, type StatsStandingsResponse } from '@/app/api/stats/standings/route'
import type { PlayersResponse } from '@/app/api/stats/players/route'
import { SITE_URL } from '@/lib/constants'
import EstadisticasLoading from './loading'
import { canonicalPlayerSlug } from '@/lib/player-slug'
import { canonicalTeamSlug } from '@/lib/team-slug'

// ── Landings de estadísticas por deporte ──────────────────────────────────────
// El deporte vive en la RUTA DE PATH (/estadisticas/[sport]) en vez de en el
// query (?sport=X). Los `params` de ruta SÍ son cacheables, así que la página se
// puede precocinar (ISR) — a diferencia de leer `searchParams`, que fuerza
// `no-store`. El slug es el que ve Google: futbol, baloncesto, f1, tenis, motogp,
// ufc, mundial. Estos slugs se pasan TAL CUAL a shardStandingsForSport (mismo
// comportamiento que el viejo ?sport=X).
// Los deportes viven en lib/stats-sports (sin JSX) para que la ruta de API pueda
// leer la MISMA lista; se reexportan aquí porque /estadisticas/[sport] los importa
// de este módulo desde siempre.
export { SPORT_META, getSportMeta, type SportMeta, type SportSlug } from '@/lib/stats-sports'
import type { SportSlug } from '@/lib/stats-sports'

// Slug de la URL → id interno del componente cliente. Solo la F1 difiere: el
// cliente la llama 'formula1', pero la URL/SEO usa 'f1'.
export const SLUG_TO_CLIENT_ID: Record<string, string> = { f1: 'formula1' }

// Directorio de equipos server-rendered: la vista interactiva de /estadisticas
// se pinta en cliente (0 enlaces profundos en el HTML que ve Google). Esta sección
// estática enlaza los hubs /liga/* y CADA ficha de /equipo, reutilizando los datos
// ya cargados en el servidor (sin fetch extra), para que Googlebot descubra y
// reparta autoridad a las páginas profundas evergreen a 1 clic. (Fase 1 SEO, jun 2026)
const LIGA_HUB_IDS = new Set(['esp.1', 'eng.1', 'ita.1', 'ger.1', 'fra.1'])

function teamHref(name: string, teamId: string | undefined): string | null {
  if (!teamId) return null
  return `/equipo/${canonicalTeamSlug(name, teamId)}`
}

type DirTeam = { name: string; href: string; meta?: string }
// El deporte lo declara cada grupo DONDE SE CONSTRUYE, no una tabla aparte: así
// una liga nueva en SOCCER_LEAGUES entra sola en el directorio de fútbol y nadie
// tiene que acordarse de nada. `sport` usa los slugs de SPORT_META (los de la URL).
type DirGroup = { title: string; hubHref: string | null; teams: DirTeam[]; sport: SportSlug }

function DirectoryGroup({ title, hubHref, teams }: Omit<DirGroup, 'sport'>) {
  if (!teams.length) return null
  return (
    <div className="mb-5">
      <h3
        className="text-[10px] font-black uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
      >
        {hubHref ? (
          <Link href={hubHref} className="hover:text-white transition-colors">{title} ›</Link>
        ) : title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {teams.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="px-2.5 py-1 rounded-md text-[11px] transition-colors hover:text-white"
            style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {t.name}
            {/* Cifra (pts / récord / goles) server-rendered junto al nombre: convierte
                el directorio de "solo enlaces" en un mini-cuadro indexable. (Fix A1 SEO) */}
            {t.meta && <span style={{ color: 'var(--text-muted)' }}> · {t.meta}</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}

/**
 * Directorio de equipos. En una landing de deporte enseña SOLO ese deporte.
 *
 * Medido el 21/08/2026: este bloque y el de jugadores sumaban 9.233 px y 583
 * enlaces IDÉNTICOS en las 8 landings — el 73% del scroll de /estadisticas/tenis
 * eran equipos y goleadores de fútbol. La portada conserva el directorio completo,
 * así que ningún enlace desaparece del sitio: solo deja de repetirse donde no pinta.
 */
function ClasificacionesHub({ data, sport }: { data: StatsStandingsResponse | null; sport?: string }) {
  if (!data) return null
  const groups: DirGroup[] = []

  for (const lg of data.football ?? []) {
    const teams = (lg.rows ?? [])
      .map((r): DirTeam | null => {
        const href = teamHref(r.name, r.teamId)
        // value = puntos en fútbol (route.ts standings) → "45 pts".
        return href ? { name: r.name, href, meta: `${r.value} ${r.value === '1' ? 'pt' : 'pts'}` } : null
      })
      .filter((x): x is DirTeam => x !== null)
    if (!teams.length) continue
    const ligaId = lg.leagueSlug?.replace('soccer/', '') ?? ''
    groups.push({ title: lg.label, hubHref: LIGA_HUB_IDS.has(ligaId) ? `/liga/${ligaId}` : null, teams, sport: 'futbol' })
  }

  // Las 48 selecciones del Mundial, por grupo. Estaban en el payload desde
  // siempre pero sin `teamId`, que es lo único que resuelve la ficha de /equipo:
  // eran 48 páginas a las que no apuntaba nada desde estadísticas.
  for (const g of data.worldCup ?? []) {
    const teams = (g.rows ?? [])
      .map((r): DirTeam | null => {
        const href = teamHref(r.name, r.teamId)
        // value = puntos del grupo; "Sin jugar" cuando el torneo no ha empezado.
        return href ? { name: r.name, href, meta: r.sub === 'Sin jugar' ? undefined : `${r.value} ${r.value === '1' ? 'pt' : 'pts'}` } : null
      })
      .filter((x): x is DirTeam => x !== null)
    if (teams.length) groups.push({ title: g.label, hubHref: null, teams, sport: 'mundial' })
  }

  const nbaTeams = [...(data.nbaEast ?? []), ...(data.nbaWest ?? [])]
    // value = récord "w-l" en NBA (route.ts standings).
    .map((r): DirTeam | null => (r.teamId ? { name: r.name, href: `/equipo/${canonicalTeamSlug(r.name, r.teamId)}`, meta: r.value } : null))
    .filter((x): x is DirTeam => x !== null)
  if (nbaTeams.length) groups.push({ title: 'NBA', hubHref: null, teams: nbaTeams, sport: 'baloncesto' })

  const visibles = sport ? groups.filter(g => g.sport === sport) : groups
  if (!visibles.length) return null

  return (
    <nav aria-label="Directorio de equipos y clasificaciones" className="max-w-2xl mx-auto px-4 pt-4 pb-12">
      <h2
        className="text-[11px] font-black uppercase tracking-widest mb-4"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)' }}
      >
        Equipos y clasificaciones
      </h2>
      {visibles.map((g) => (
        <DirectoryGroup key={g.title} title={g.title} hubHref={g.hubHref} teams={g.teams} />
      ))}
    </nav>
  )
}

function playerHref(name: string, playerId: string | undefined): string | null {
  if (!playerId) return null
  return `/jugador/${canonicalPlayerSlug(name, playerId)}`
}

// Directorio de jugadores: goleadores + asistentes por liga, deduplicados, cada
// uno enlazando su ficha /jugador. Mismo objetivo que el de equipos: sacar las
// fichas profundas del limbo "solo en sitemap" a 1 clic. (Fase 1 SEO)
// Goleadores y asistentes. Todo lo que sirve /api/stats/players es fútbol, así que
// en cualquier otra landing este bloque no tiene nada que decir y no se pinta (ni
// se pide el payload — ver EstadisticasView).
function PlayersDirectory({ data }: { data: PlayersResponse | null }) {
  if (!data?.leagues?.length) return null
  const groups: DirGroup[] = []
  for (const lg of data.leagues) {
    const seen = new Set<string>()
    const players: DirTeam[] = []
    // Goleadores primero (value = goles), luego asistentes (value = asistencias).
    // Separados para etiquetar la cifra sin ambigüedad. (Fix A1 SEO)
    for (const p of (lg.goals ?? [])) {
      const href = playerHref(p.name, p.playerId)
      if (!href || seen.has(href)) continue
      seen.add(href)
      players.push({ name: p.name, href, meta: `${p.value} ${p.value === 1 ? 'gol' : 'goles'}` })
    }
    for (const p of (lg.assists ?? [])) {
      const href = playerHref(p.name, p.playerId)
      if (!href || seen.has(href)) continue
      seen.add(href)
      players.push({ name: p.name, href, meta: `${p.value} asist.` })
    }
    if (players.length) groups.push({ title: lg.label, hubHref: null, teams: players, sport: 'futbol' })
  }
  if (!groups.length) return null
  return (
    <nav aria-label="Goleadores y asistentes por liga" className="max-w-2xl mx-auto px-4 pb-12">
      <h2
        className="text-[11px] font-black uppercase tracking-widest mb-4"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)' }}
      >
        Goleadores y asistentes
      </h2>
      {groups.map((g) => (
        <DirectoryGroup key={g.title} title={g.title} hubHref={g.hubHref} teams={g.teams} />
      ))}
    </nav>
  )
}

async function fetchPlayersForDirectory(): Promise<PlayersResponse | null> {
  const base = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
  try {
    const res = await fetch(`${base}/api/stats/players`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })
    return res.ok ? ((await res.json()) as PlayersResponse) : null
  } catch {
    return null
  }
}

// Gate cliente con import estático (patrón limpio; ver EstadisticasClientGate para
// la historia del falso "bug de SSG" que en realidad era el service worker).
import EstadisticasClientGate from './EstadisticasClientGate'

// Vista compartida por /estadisticas (portada, sport='') y /estadisticas/[sport].
// `sport` = slug de la URL ('' = portada con "Destacados").
export async function EstadisticasView({ sport }: { sport: string }) {
  // Jugadores para el directorio — lanzado en paralelo con las clasificaciones.
  // Solo donde ese directorio se va a pintar: todo lo que sirve /api/stats/players
  // es fútbol, así que en /estadisticas/tenis era una llamada de 196 KB tirada.
  const necesitaJugadores = !sport || sport === 'resumen' || sport === 'futbol'
  const playersPromise = necesitaJugadores ? fetchPlayersForDirectory() : Promise.resolve(null)
  let initialData: StatsStandingsResponse | null = null
  // `full` (sin shardear) alimenta el directorio server-rendered de equipos.
  // Reutiliza la MISMA llamada a getStandingsData() (sin fetch extra).
  let full: StatsStandingsResponse | null = null
  try {
    full = await getStandingsData()
    // En una landing de deporte, shardear el payload SSR a solo ese sport.
    // El cliente hará un fetch full tras hidratar. Las claves de SPORT_KEYS son
    // los slugs de la URL: si no casan, el shard no recorta NADA y no avisa.
    if (sport && sport !== 'resumen') {
      initialData = shardStandingsForSport(full, sport) as typeof full
    } else {
      initialData = full
    }
  } catch (err) {
    console.error('[estadisticas] SSR data fetch failed:', err)
  }
  const playersData = await playersPromise
  const clientSport = sport ? (SLUG_TO_CLIENT_ID[sport] ?? sport) : undefined
  return (
    <>
      {/* Sin <Suspense> aquí: el gate cliente ya crea el suyo tras hidratar, y así el
          prerender no ejecuta el useSearchParams del cliente ni deja un boundary
          suspendido en el HTML. El SEO lo cubren los directorios de abajo. */}
      <EstadisticasClientGate initialData={initialData} initialSport={clientSport} />
      {/* En la portada, el directorio completo; en una landing, solo su deporte. */}
      <ClasificacionesHub data={full} sport={sport && sport !== 'resumen' ? sport : undefined} />
      <PlayersDirectory data={playersData} />
    </>
  )
}
