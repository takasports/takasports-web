import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ShareButton } from '@/components/ShareButton'
import BreadcrumbsNav from '@/components/BreadcrumbsNav'
import { SITE_URL, SITE_NAME } from '@/lib/constants'
import { fetchLeagueTableRows } from '@/lib/espn-standings'

export const revalidate = 1800

interface LeagueDef {
  id: string
  label: string
  tableBlockId: string
  leagueSlug: string         // ESPN slug, e.g. "soccer/esp.1"
  playersKey: string         // /api/stats/players league.id
  accent: string
  /** Ligas fuera de la API agregada de stats (Latam): se sirven de ESPN directo,
   *  sin pasar por el monolito de /estadisticas ni tocar su comportamiento. */
  direct?: boolean
}

const LEAGUES: Record<string, LeagueDef> = {
  'esp.1':   { id: 'esp.1',   label: 'LaLiga',         tableBlockId: 'tabla-laliga',     leagueSlug: 'soccer/esp.1', playersKey: 'esp.1', accent: '#ef4444' },
  'eng.1':   { id: 'eng.1',   label: 'Premier League', tableBlockId: 'tabla-premier',    leagueSlug: 'soccer/eng.1', playersKey: 'eng.1', accent: '#a78bfa' },
  'ita.1':   { id: 'ita.1',   label: 'Serie A',        tableBlockId: 'tabla-serie-a',    leagueSlug: 'soccer/ita.1', playersKey: 'ita.1', accent: '#22c55e' },
  'ger.1':   { id: 'ger.1',   label: 'Bundesliga',     tableBlockId: 'tabla-bundesliga', leagueSlug: 'soccer/ger.1', playersKey: 'ger.1', accent: '#f59e0b' },
  'fra.1':   { id: 'fra.1',   label: 'Ligue 1',        tableBlockId: 'tabla-ligue1',     leagueSlug: 'soccer/fra.1', playersKey: 'fra.1', accent: '#3b82f6' },
  // Latinoamérica — vía ESPN directa (ver `direct`). Tabla + goleadores/asistentes.
  'bra.1':   { id: 'bra.1',   label: 'Brasileirão',    tableBlockId: '', leagueSlug: 'soccer/bra.1', playersKey: '', accent: '#f59e0b', direct: true },
  'mex.1':   { id: 'mex.1',   label: 'Liga MX',        tableBlockId: '', leagueSlug: 'soccer/mex.1', playersKey: '', accent: '#16a34a', direct: true },
  'arg.1':   { id: 'arg.1',   label: 'Liga Argentina', tableBlockId: '', leagueSlug: 'soccer/arg.1', playersKey: '', accent: '#6CACE4', direct: true },
}

export function generateStaticParams() {
  return Object.keys(LEAGUES).map(id => ({ id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lg = LEAGUES[id]
  if (!lg) return { title: 'Liga' }   // sin sufijo: title.template del root ya lo añade
  // Sin sufijo manual de marca: la plantilla raíz ya añadía " | TakaSports", lo
  // que producía el doble sufijo "...| TakaSports | TakaSports" (76 chars). Con
  // absolute controlamos el título exacto y evitamos el truncado. (Fase 0 SEO)
  const title = `${lg.label} · Clasificación, goleadores y asistencias`
  const description = `Tabla en vivo de ${lg.label}, máximos goleadores y mejores asistentes de la temporada.`
  return {
    title: { absolute: title }, description,
    alternates: { canonical: `${SITE_URL}/liga/${id}` },
    openGraph: { title, description, type: 'website', siteName: SITE_NAME, url: `${SITE_URL}/liga/${id}` },
    // Sin definir `twitter`, X heredaba el default genérico del root layout
    // (logo + "Noticias deportivas") en vez de la tarjeta OG propia de la liga.
    // Al declararlo, la convención opengraph-image.tsx de esta ruta rellena
    // también twitter:image (tarjeta 1200×630), igual que en /rankings. (Fix A3 SEO)
    twitter: { card: 'summary_large_image', title, description },
  }
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000')
}

interface StandRow {
  rank: number; name: string; abbr: string; value: string
  extra: Record<string, string>; teamId?: string; logo?: string
}
interface PlayerRow { name: string; team: string; value: number; matches: number; playerId?: string; teamLogo?: string; leagueSlug?: string; photo?: string }

async function fetchData(def: LeagueDef): Promise<{ rows: StandRow[]; goals: PlayerRow[]; assists: PlayerRow[] }> {
  const base = apiBase()
  try {
    const [standRes, playRes] = await Promise.all([
      fetch(`${base}/api/stats/standings`, { next: { revalidate: 1800 } }),
      fetch(`${base}/api/stats/players`, { next: { revalidate: 1800 } }),
    ])
    const stand = standRes.ok ? await standRes.json() : {}
    const play  = playRes.ok  ? await playRes.json()  : {}
    const group = (stand.football ?? []).find((g: { id: string }) => g.id === def.tableBlockId)
    const rows: StandRow[] = group?.rows ?? []
    const lg = (play.leagues ?? []).find((l: { id: string }) => l.id === def.playersKey)
    return { rows, goals: lg?.goals ?? [], assists: lg?.assists ?? [] }
  } catch {
    return { rows: [], goals: [], assists: [] }
  }
}

// Goleadores + asistentes de una liga desde el endpoint `statistics` de ESPN (ambas
// categorías inline, con nombre y equipo — sin resolver por atleta). Mismo parseo que
// /api/stats/players, pero aquí directo para las ligas Latam que no van por la agregada.
async function fetchLeagueLeaders(leagueSlug: string): Promise<{ goals: PlayerRow[]; assists: PlayerRow[] }> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${leagueSlug}/statistics`,
      { next: { revalidate: 1800 } },
    )
    if (!res.ok) return { goals: [], assists: [] }
    const json = await res.json()
    const stats = (json.stats ?? []) as Array<{ name?: string; displayName?: string; leaders?: unknown[] }>
    const parse = (display: string, name: string): PlayerRow[] => {
      const cat = stats.find(c => c.displayName === display || c.name === name)
      return ((cat?.leaders ?? []) as Array<Record<string, unknown>>).slice(0, 10).map(l => {
        const ath = (l.athlete ?? {}) as Record<string, unknown>
        const team = (ath.team ?? {}) as Record<string, unknown>
        const teamId = typeof team.id === 'string' ? team.id : undefined
        const logos = (team.logos ?? []) as Array<{ href?: string }>
        const m = /Matches:\s*(\d+)/.exec(typeof l.displayValue === 'string' ? l.displayValue : '')
        return {
          name: (ath.displayName as string) ?? '',
          team: (team.displayName as string) ?? '',
          value: Math.round((l.value as number) ?? 0),
          matches: m ? parseInt(m[1]) : 0,
          playerId: ath.id as string | undefined,
          teamLogo: logos[0]?.href ?? (teamId ? `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png` : undefined),
          leagueSlug,
        }
      }).filter(p => p.name)
    }
    return { goals: parse('Goals', 'goals'), assists: parse('Assists', 'assists') }
  } catch {
    return { goals: [], assists: [] }
  }
}

// Ligas Latam: tabla (fetchLeagueTableRows, ya soportada en TABLE_LEAGUE_SLUGS) +
// goleadores/asistentes directos. Mapea a la MISMA forma que fetchData para reusar el render.
async function fetchDirect(def: LeagueDef): Promise<{ rows: StandRow[]; goals: PlayerRow[]; assists: PlayerRow[] }> {
  const [table, leaders] = await Promise.all([
    fetchLeagueTableRows(def.leagueSlug),
    fetchLeagueLeaders(def.leagueSlug),
  ])
  const rows: StandRow[] = table.map(t => ({
    rank: t.rank,
    name: t.name,
    abbr: t.abbr,
    value: String(t.pts),
    extra: { V: String(t.w), E: String(t.d), D: String(t.l), DG: t.gd > 0 ? `+${t.gd}` : String(t.gd) },
    teamId: t.teamId,
    logo: t.logo,
  }))
  return { rows, goals: leaders.goals, assists: leaders.assists }
}

function teamHref(def: LeagueDef, teamId?: string) {
  return teamId ? `/equipo/${def.leagueSlug.replace('/', '_')}_${teamId}` : undefined
}
function playerHref(p: PlayerRow) {
  return p.playerId && p.leagueSlug ? `/jugador/${p.leagueSlug.replace('/', '_')}_${p.playerId}` : undefined
}

function StandingsTable({ rows, def }: { rows: StandRow[]; def: LeagueDef }) {
  if (!rows.length) return <p className="text-[12px] text-[var(--text-muted)] px-4 py-6 text-center">Sin datos</p>
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)' }}>
      <div className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#3A3A4A]"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-sport)' }}>
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Equipo</span>
        <span className="w-7 text-center">PJ</span>
        <span className="hidden sm:block w-9 text-center">DG</span>
        <span className="w-8 text-center font-black text-[var(--text-muted)]">PTS</span>
      </div>
      {rows.map(r => {
        const href = teamHref(def, r.teamId)
        const inner = (
          <div className="flex items-center gap-2 px-4 py-2.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <span className="w-6 text-center text-[12px] font-black" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{r.rank}</span>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {r.logo && <Image src={r.logo} alt={r.abbr} width={20} height={20} unoptimized style={{ objectFit: 'contain', flexShrink: 0 }} />}
              <span className="text-[12px] font-semibold truncate" style={{ color: href ? '#fff' : '#9A9AAA' }}>{r.name}</span>
            </div>
            <span className="w-7 text-center text-[12px] text-[var(--text-muted)] tabular-nums">{(parseInt(r.extra?.V ?? '0') + parseInt(r.extra?.E ?? '0') + parseInt(r.extra?.D ?? '0')) || 0}</span>
            <span className="hidden sm:block w-9 text-center text-[12px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{r.extra?.DG ?? '—'}</span>
            <span className="w-8 text-center text-[13px] font-black tabular-nums text-white" style={{ fontFamily: 'var(--font-display)' }}>{r.value}</span>
          </div>
        )
        return href
          ? <Link key={r.rank} href={href} className="block hover:bg-white/5 transition-colors">{inner}</Link>
          : <div key={r.rank}>{inner}</div>
      })}
    </div>
  )
}

function LeaderList({ title, players, metric, def }: { title: string; players: PlayerRow[]; metric: string; def: LeagueDef }) {
  if (!players.length) return null
  return (
    <section>
      <div className="text-[10px] font-black uppercase tracking-widest mb-3"
        style={{ color: def.accent, fontFamily: 'var(--font-sport)' }}>
        {title}
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)' }}>
        {players.slice(0, 10).map((p, i) => {
          const href = playerHref(p)
          const inner = (
            <div className="flex items-center gap-2.5 px-4 py-2.5"
              style={{ borderBottom: i < Math.min(players.length, 10) - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <span className="w-5 text-[11px] font-black tabular-nums text-right" style={{ color: i < 3 ? def.accent : '#5A5A72' }}>{i + 1}</span>
              {/* Foto si el cron la resolvió: redonda y encuadrada arriba, porque las de
                  Commons son fotos de acción y la cara suele quedar en la parte alta.
                  Sin foto, el escudo del club como hasta ahora. */}
              {(p.photo ?? p.teamLogo) && (
                <Image
                  src={(p.photo ?? p.teamLogo)!}
                  // Si es la FOTO del jugador, el alt dice de quién es (contexto real
                  // para Google Imágenes y lectores de pantalla). Si es el escudo del
                  // club es decorativo: el equipo ya va en texto al lado → alt vacío.
                  alt={p.photo ? p.name : ''}
                  width={22}
                  height={22}
                  unoptimized
                  style={{
                    objectFit: p.photo ? 'cover' : 'contain',
                    objectPosition: 'top',
                    borderRadius: p.photo ? '50%' : undefined,
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate text-white">{p.name}</div>
                <div className="text-[10px] truncate" style={{ color: '#7A7A92' }}>{p.team} · {p.matches} PJ</div>
              </div>
              <span className="w-10 text-right font-black tabular-nums" style={{ color: i < 3 ? def.accent : '#fff', fontFamily: 'var(--font-display)' }}>
                {p.value}
              </span>
              <span className="hidden sm:block w-12 text-right text-[10px] uppercase tracking-wide" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>{metric}</span>
            </div>
          )
          return href
            ? <Link key={i} href={href} className="block hover:bg-white/5 transition-colors">{inner}</Link>
            : <div key={i}>{inner}</div>
        })}
      </div>
    </section>
  )
}

async function Content({ id }: { id: string }) {
  const def = LEAGUES[id]
  if (!def) notFound()
  const { rows, goals, assists } = def.direct ? await fetchDirect(def) : await fetchData(def)

  const canonical = `${SITE_URL}/liga/${id}`

  // Esta ruta era la única ficha de entidad sin NINGÚN dato estructurado: ni la liga
  // como entidad, ni la clasificación, ni breadcrumbs. Se marcan las tres cosas.
  const leagueJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: def.label,
    url: canonical,
    sport: 'Football',
    ...(rows.length ? {
      // La clasificación como lista ORDENADA: `position` es lo que permite a Google
      // leerla como tabla de posiciones y no como un listado suelto de equipos.
      subOrganization: {
        '@type': 'ItemList',
        name: `Clasificación de ${def.label}`,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        numberOfItems: rows.length,
        itemListElement: rows.map(r => ({
          '@type': 'ListItem',
          position: r.rank,
          item: {
            '@type': 'SportsTeam',
            name: r.name,
            ...(r.logo ? { logo: r.logo } : {}),
            ...(r.teamId ? { url: `${SITE_URL}/equipo/${r.teamId}` } : {}),
          },
        })),
      },
    } : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Estadísticas', item: `${SITE_URL}/estadisticas` },
      { '@type': 'ListItem', position: 3, name: 'Fútbol', item: `${SITE_URL}/estadisticas/futbol` },
      { '@type': 'ListItem', position: 4, name: def.label, item: canonical },
    ],
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(leagueJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <BreadcrumbsNav
        className="mb-4 text-xs flex items-center gap-2 flex-wrap"
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Estadísticas', href: '/estadisticas' },
          { label: 'Fútbol', href: '/estadisticas/futbol' },
          { label: def.label },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <Link href="/estadisticas/futbol"
          className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-white transition-colors"
          style={{ fontFamily: 'var(--font-sport)' }}>
          ‹ Volver a estadísticas
        </Link>
        <ShareButton title={`${def.label} · TakaSports`} />
      </div>

      <div className="rounded-2xl p-5 mb-6"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-[11px] font-black uppercase tracking-widest mb-1"
          style={{ color: def.accent, fontFamily: 'var(--font-sport)' }}>Liga</div>
        <h1 className="text-2xl font-black text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {def.label}
        </h1>
        <p className="text-[12px] text-[#9A9AAA] mt-1">Tabla, goleadores y asistentes en vivo</p>
      </div>

      <section className="mb-8">
        <div className="text-[10px] font-black uppercase tracking-widest mb-3"
          style={{ color: def.accent, fontFamily: 'var(--font-sport)' }}>
          Clasificación
        </div>
        <StandingsTable rows={rows} def={def} />
      </section>

      <div className="grid sm:grid-cols-2 gap-6">
        <LeaderList title="Goleadores" players={goals} metric="Goles" def={def} />
        <LeaderList title="Asistencias" players={assists} metric="Asist." def={def} />
      </div>
    </div>
  )
}

export default async function LigaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <>
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Suspense>
          <Content id={id} />
        </Suspense>
      </div>
    </>
  )
}
