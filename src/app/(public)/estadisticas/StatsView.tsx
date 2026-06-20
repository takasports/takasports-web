import dynamicImport from 'next/dynamic'
import Link from 'next/link'
import { Suspense } from 'react'
import { getStandingsData, shardStandingsForSport, type StatsStandingsResponse } from '@/app/api/stats/standings/route'
import type { PlayersResponse } from '@/app/api/stats/players/route'
import { SITE_URL } from '@/lib/constants'
import EstadisticasLoading from './loading'

// ── Landings de estadísticas por deporte ──────────────────────────────────────
// El deporte vive en la RUTA DE PATH (/estadisticas/[sport]) en vez de en el
// query (?sport=X). Los `params` de ruta SÍ son cacheables, así que la página se
// puede precocinar (ISR) — a diferencia de leer `searchParams`, que fuerza
// `no-store`. El slug es el que ve Google: futbol, baloncesto, f1, tenis, motogp,
// ufc, mundial. Estos slugs se pasan TAL CUAL a shardStandingsForSport (mismo
// comportamiento que el viejo ?sport=X).
export interface SportMeta { label: string; description: string }
export const SPORT_META: Record<string, SportMeta> = {
  futbol:     { label: 'Fútbol',      description: 'LaLiga, Premier, Bundesliga, Serie A, Ligue 1 y UEFA en vivo.' },
  baloncesto: { label: 'NBA',         description: 'Conferencias, anotadores, MVP/DPOY/ROY race y playoffs en vivo.' },
  f1:         { label: 'Fórmula 1',   description: 'Pilotos, constructores, sprints, poles y calendario 2026 en vivo.' },
  tenis:      { label: 'Tenis',       description: 'Rankings ATP/WTA y calendario Grand Slams 2026.' },
  motogp:     { label: 'MotoGP',      description: 'Mundial de pilotos y constructores temporada 2026.' },
  ufc:        { label: 'UFC',         description: 'Pound for Pound y campeones por división actualizados.' },
  mundial:    { label: 'Mundial 2026',description: 'Grupos, clasificados, anfitriones y goleadores del Mundial.' },
}

// Slug de la URL → id interno del componente cliente. Solo la F1 difiere: el
// cliente la llama 'formula1', pero la URL/SEO usa 'f1'.
export const SLUG_TO_CLIENT_ID: Record<string, string> = { f1: 'formula1' }

// Directorio de equipos server-rendered: la vista interactiva de /estadisticas
// se pinta en cliente (0 enlaces profundos en el HTML que ve Google). Esta sección
// estática enlaza los hubs /liga/* y CADA ficha de /equipo, reutilizando los datos
// ya cargados en el servidor (sin fetch extra), para que Googlebot descubra y
// reparta autoridad a las páginas profundas evergreen a 1 clic. (Fase 1 SEO, jun 2026)
const LIGA_HUB_IDS = new Set(['esp.1', 'eng.1', 'ita.1', 'ger.1', 'fra.1'])

function teamHref(leagueSlug: string | undefined, teamId: string | undefined): string | null {
  if (!leagueSlug || !teamId) return null
  return `/equipo/${leagueSlug.replace('/', '_')}_${teamId}`
}

type DirTeam = { name: string; href: string; meta?: string }
type DirGroup = { title: string; hubHref: string | null; teams: DirTeam[] }

function DirectoryGroup({ title, hubHref, teams }: DirGroup) {
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

function ClasificacionesHub({ data }: { data: StatsStandingsResponse | null }) {
  if (!data) return null
  const groups: DirGroup[] = []

  for (const lg of data.football ?? []) {
    const teams = (lg.rows ?? [])
      .map((r): DirTeam | null => {
        const href = teamHref(lg.leagueSlug, r.teamId)
        // value = puntos en fútbol (route.ts standings) → "45 pts".
        return href ? { name: r.name, href, meta: `${r.value} pts` } : null
      })
      .filter((x): x is DirTeam => x !== null)
    if (!teams.length) continue
    const ligaId = lg.leagueSlug?.replace('soccer/', '') ?? ''
    groups.push({ title: lg.label, hubHref: LIGA_HUB_IDS.has(ligaId) ? `/liga/${ligaId}` : null, teams })
  }

  const nbaTeams = [...(data.nbaEast ?? []), ...(data.nbaWest ?? [])]
    // value = récord "w-l" en NBA (route.ts standings).
    .map((r): DirTeam | null => (r.teamId ? { name: r.name, href: `/equipo/basketball_nba_${r.teamId}`, meta: r.value } : null))
    .filter((x): x is DirTeam => x !== null)
  if (nbaTeams.length) groups.push({ title: 'NBA', hubHref: null, teams: nbaTeams })

  if (!groups.length) return null

  return (
    <nav aria-label="Directorio de equipos y clasificaciones" className="max-w-2xl mx-auto px-4 pt-4 pb-12">
      <h2
        className="text-[11px] font-black uppercase tracking-widest mb-4"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)' }}
      >
        Equipos y clasificaciones
      </h2>
      {groups.map((g) => (
        <DirectoryGroup key={g.title} {...g} />
      ))}
    </nav>
  )
}

function playerHref(leagueSlug: string | undefined, playerId: string | undefined): string | null {
  if (!leagueSlug || !playerId) return null
  return `/jugador/${leagueSlug.replace('/', '_')}_${playerId}`
}

// Directorio de jugadores: goleadores + asistentes por liga, deduplicados, cada
// uno enlazando su ficha /jugador. Mismo objetivo que el de equipos: sacar las
// fichas profundas del limbo "solo en sitemap" a 1 clic. (Fase 1 SEO)
function PlayersDirectory({ data }: { data: PlayersResponse | null }) {
  if (!data?.leagues?.length) return null
  const groups: DirGroup[] = []
  for (const lg of data.leagues) {
    const seen = new Set<string>()
    const players: DirTeam[] = []
    // Goleadores primero (value = goles), luego asistentes (value = asistencias).
    // Separados para etiquetar la cifra sin ambigüedad. (Fix A1 SEO)
    for (const p of (lg.goals ?? [])) {
      const href = playerHref(p.leagueSlug, p.playerId)
      if (!href || seen.has(href)) continue
      seen.add(href)
      players.push({ name: p.name, href, meta: `${p.value} ${p.value === 1 ? 'gol' : 'goles'}` })
    }
    for (const p of (lg.assists ?? [])) {
      const href = playerHref(p.leagueSlug, p.playerId)
      if (!href || seen.has(href)) continue
      seen.add(href)
      players.push({ name: p.name, href, meta: `${p.value} asist.` })
    }
    if (players.length) groups.push({ title: lg.label, hubHref: null, teams: players })
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
        <DirectoryGroup key={g.title} {...g} />
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

const EstadisticasClient = dynamicImport(() => import('./EstadisticasClient'), {
  loading: () => <EstadisticasLoading />,
})

// Vista compartida por /estadisticas (portada, sport='') y /estadisticas/[sport].
// `sport` = slug de la URL ('' = portada con "Destacados").
export async function EstadisticasView({ sport }: { sport: string }) {
  // Jugadores para el directorio — lanzado en paralelo con las clasificaciones.
  const playersPromise = fetchPlayersForDirectory()
  let initialData: StatsStandingsResponse | null = null
  // `full` (sin shardear) alimenta el directorio server-rendered de equipos.
  // Reutiliza la MISMA llamada a getStandingsData() (sin fetch extra).
  let full: StatsStandingsResponse | null = null
  try {
    full = await getStandingsData()
    // En una landing de deporte, shardear el payload SSR a solo ese sport.
    // Reduce HTML ~80% (320KB → ~50KB). El cliente hará un fetch full tras hidratar.
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
      {/* useSearchParams (sección/género) obliga a un límite Suspense para que la
          página pueda generarse estáticamente; el contenido interactivo se pinta
          en cliente tras hidratar (con initialData ya servido). El SEO lo cubren
          los directorios server-rendered de abajo. */}
      <Suspense fallback={<EstadisticasLoading />}>
        <EstadisticasClient initialData={initialData} initialSport={clientSport} />
      </Suspense>
      <ClasificacionesHub data={full} />
      <PlayersDirectory data={playersData} />
    </>
  )
}
