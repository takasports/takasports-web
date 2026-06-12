import dynamicImport from 'next/dynamic'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getStandingsData, shardStandingsForSport, type StatsStandingsResponse } from '@/app/api/stats/standings/route'
import { SITE_URL } from '@/lib/constants'
import EstadisticasLoading from './loading'

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

type DirTeam = { name: string; href: string }
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
      .map((r) => {
        const href = teamHref(lg.leagueSlug, r.teamId)
        return href ? { name: r.name, href } : null
      })
      .filter((x): x is DirTeam => x !== null)
    if (!teams.length) continue
    const ligaId = lg.leagueSlug?.replace('soccer/', '') ?? ''
    groups.push({ title: lg.label, hubHref: LIGA_HUB_IDS.has(ligaId) ? `/liga/${ligaId}` : null, teams })
  }

  const nbaTeams = [...(data.nbaEast ?? []), ...(data.nbaWest ?? [])]
    .map((r) => (r.teamId ? { name: r.name, href: `/equipo/basketball_nba_${r.teamId}` } : null))
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

const EstadisticasClient = dynamicImport(() => import('./EstadisticasClient'), {
  loading: () => <EstadisticasLoading />,
})

// searchParams hace la página dinámica; force-dynamic evita el error de build.
export const dynamic = 'force-dynamic'
export const dynamicParams = true

interface SportMeta { label: string; description: string }
const SPORT_META: Record<string, SportMeta> = {
  futbol:     { label: 'Fútbol',      description: 'LaLiga, Premier, Bundesliga, Serie A, Ligue 1 y UEFA en vivo.' },
  baloncesto: { label: 'NBA',         description: 'Conferencias, anotadores, MVP/DPOY/ROY race y playoffs en vivo.' },
  f1:         { label: 'Fórmula 1',   description: 'Pilotos, constructores, sprints, poles y calendario 2026 en vivo.' },
  tenis:      { label: 'Tenis',       description: 'Rankings ATP/WTA y calendario Grand Slams 2026.' },
  motogp:     { label: 'MotoGP',      description: 'Mundial de pilotos y constructores temporada 2026.' },
  ufc:        { label: 'UFC',         description: 'Pound for Pound y campeones por división actualizados.' },
  mundial:    { label: 'Mundial 2026',description: 'Grupos, clasificados, anfitriones y goleadores del Mundial.' },
}

export async function generateMetadata({
  searchParams,
}: { searchParams: Promise<{ sport?: string }> }): Promise<Metadata> {
  const sp = await searchParams
  const sport = (sp?.sport ?? '').toLowerCase()
  const meta = SPORT_META[sport]

  const title = meta
    ? `Estadísticas ${meta.label} en vivo`
    : 'Estadísticas deportivas en vivo'
  const description = meta
    ? `${meta.description} Datos actualizados al minuto.`
    : 'Goleadores, asistencias, clasificaciones de LaLiga, Premier League, NBA, F1 y más ligas actualizadas en tiempo real.'
  const ogImage = sport && meta
    ? `${SITE_URL}/api/og/estadisticas?sport=${sport}`
    : `${SITE_URL}/estadisticas/opengraph-image`
  const canonical = sport && meta
    ? `${SITE_URL}/estadisticas?sport=${sport}`
    : `${SITE_URL}/estadisticas`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | TakaSports`,
      description,
      url: canonical,
      siteName: 'TakaSports',
      locale: 'es_ES',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — TakaSports`,
      description,
      site: '@takasportsx',
      images: [ogImage],
    },
  }
}

export default async function EstadisticasPage({
  searchParams,
}: { searchParams: Promise<{ sport?: string }> }) {
  let initialData = null
  // `full` (sin shardear) alimenta el directorio server-rendered de equipos.
  // Reutiliza la MISMA llamada a getStandingsData() (sin fetch extra).
  let full: StatsStandingsResponse | null = null
  try {
    full = await getStandingsData()
    const sp = await searchParams
    const sport = (sp?.sport ?? '').toLowerCase()
    // Si vienen a un sport específico (link compartido / SEO), shardear el
    // payload SSR a solo ese sport. Reduce HTML ~80% (320KB → ~50KB).
    // El cliente hará un fetch full en background tras hidratar.
    if (sport && sport !== 'resumen') {
      initialData = shardStandingsForSport(full, sport) as typeof full
    } else {
      initialData = full
    }
  } catch (err) {
    console.error('[estadisticas] SSR data fetch failed:', err)
  }
  return (
    <>
      <EstadisticasClient initialData={initialData} />
      <ClasificacionesHub data={full} />
    </>
  )
}
