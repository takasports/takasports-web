import type { Metadata } from 'next'
import RankingsClient from './RankingsClient'
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd'
import { getTopMovers, getAllRankings, getLastIngestTime, type RankingCategory } from '@/lib/rankings-data'

// Rankings: revalidar cada 30 min. La ingesta semanal y las ediciones del
// admin fuerzan revalidatePath('/rankings') al instante; el temporizador solo
// cubre correcciones de foto por script. Antes 1 min, demasiado frecuente para
// datos que cambian ~1x/semana (recálculo continuo de ranking_view).
export const revalidate = 1800  // 30 min
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'
import {
  RANKING_JUGADORES, RANKING_CLUBES,
  RANKING_CREADORES, RANKING_PERIODISTAS, RANKING_JUGADORAS,
  RANKING_CLUBES_FEMENINO, RANKING_LUCHADORAS_UFC, RANKING_CREADORES_WWE,
  RANKING_JUGADORES_SUB21, RANKING_JUGADORES_LATAM,
  type RankingEntry,
} from '@/lib/rankings'

// ── Etiquetas humanas para metadatos ───────────────────────────────
const SPORT_LABELS: Record<string, string> = {
  futbol: 'Fútbol', baloncesto: 'Baloncesto', formula1: 'F1', tenis: 'Tenis',
  ufc: 'UFC', wwe: 'WWE', contenido: 'Contenido',
}
const TAB_LABELS: Record<string, string> = {
  jugadores: 'jugadores', clubes: 'clubes',
  creadores: 'creadores', periodistas: 'periodistas',
}
const LIGA_LABELS: Record<string, string> = {
  laliga: 'LaLiga', premier: 'Premier League', bundesliga: 'Bundesliga',
  seriea: 'Serie A', ligue1: 'Ligue 1', mls: 'MLS', nba: 'NBA',
}

function currentEdition(): string {
  const now = new Date()
  return now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
}

type SP = Record<string, string | string[] | undefined>
function pickStr(sp: SP, key: string): string {
  const v = sp[key]
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

/**
 * Selecciona la base que aproxima el scope activo. Sirve para SEO
 * (title, description y JSON-LD top-10). La UI hace un filtrado más
 * fino — esto es una versión "best effort" derivada de los params.
 */
function selectBase(deporte: string, tab: string, scope: string, gender: string): RankingEntry[] {
  const isFemenino = gender === 'f'
  if (tab === 'creadores') return RANKING_CREADORES
  if (tab === 'periodistas') return RANKING_PERIODISTAS
  if (tab === 'clubes') {
    const base = isFemenino ? RANKING_CLUBES_FEMENINO : RANKING_CLUBES
    return deporte ? base.filter(e => e.sport === deporte) : base
  }
  // jugadores (default)
  if (deporte === 'wwe') return RANKING_CREADORES_WWE
  if (isFemenino && deporte === 'ufc') return RANKING_LUCHADORAS_UFC
  const base = isFemenino ? RANKING_JUGADORAS : RANKING_JUGADORES
  let pool = deporte ? base.filter(e => e.sport === deporte) : base
  if (scope === 'sub21') pool = RANKING_JUGADORES_SUB21
  if (scope === 'pais')  pool = RANKING_JUGADORES_LATAM
  return pool
}

const POSITION_LABELS: Record<string, string> = {
  delantero: 'Delanteros', extremo: 'Extremos', mediocampista: 'Mediocampistas',
  defensa: 'Defensas', portero: 'Porteros',
}
const BADGE_LABELS: Record<string, string> = {
  'Histórico': 'históricos',
  'Revelación': 'revelaciones',
  'Nuevo': 'nuevas entradas',
}

function buildTitle(sp: SP): { title: string; description: string } {
  const deporte = pickStr(sp, 'deporte')
  const tab     = pickStr(sp, 'tab') || 'jugadores'
  const scope   = pickStr(sp, 'scope')
  const liga    = pickStr(sp, 'liga')
  const gender  = pickStr(sp, 'gender')
  const posicion = pickStr(sp, 'posicion')
  const badge   = pickStr(sp, 'badge')

  const edition  = currentEdition()
  const sportLbl = SPORT_LABELS[deporte] ?? ''
  const tabLbl   = TAB_LABELS[tab] ?? 'jugadores'
  const ligaLbl  = LIGA_LABELS[liga] ?? ''
  const posLbl   = POSITION_LABELS[posicion] ?? ''
  const badgeLbl = BADGE_LABELS[badge] ?? ''
  const genderLbl = gender === 'f' ? ' femenino' : ''

  const subject = posLbl
    ? `Top ${posLbl}${sportLbl ? ' de ' + sportLbl : ''}`
    : sportLbl
      ? `Top ${tabLbl}${genderLbl} de ${sportLbl}`
      : `Top ${tabLbl}${genderLbl} del mundo`
  const ctx = ligaLbl
    ? ` · ${ligaLbl}`
    : scope === 'sub21' ? ' · Sub-21'
    : scope === 'pais'  ? ' · LATAM'
    : badgeLbl ? ` · ${badgeLbl}`
    : ''

  const title = `${subject}${ctx} · ${edition} · Ranking Taka`
  const description =
    `Ranking ${tabLbl}${genderLbl}${sportLbl ? ' de ' + sportLbl : ''} edición ${edition}. ` +
    `Calculado con el Ranking Taka: rendimiento, contexto, influencia mediática y narrativa.`

  return { title, description }
}

// ── Metadata base (ISR) ────────────────────────────────────────────
// /rankings es ISR cacheable: NO leemos searchParams en el servidor (eso forzaría
// render por-petición = no-store en cada visita). Los filtros (?deporte=…) son
// client-side (router.replace) y NO se indexan: no están en el sitemap ni
// enlazados con <a>, así que Google solo conoce /rankings. Un canonical FIJO a
// /rankings consolida cualquier variante filtrada que alguien comparta — más
// limpio que el noindex anterior y, sobre todo, cacheable. `generateMetadata`
// sin args (no `export const`) deja que currentEdition() se evalúe en cada
// revalidación, manteniendo el mes/año del título al día.
export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = buildTitle({})
  const url = `${SITE_URL}/rankings`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: 'website', url, siteName: 'TakaSports', locale: 'es_ES' },
    twitter: { card: 'summary_large_image', title, description, site: '@takasportsx' },
  }
}

// ── JSON-LD ItemList helper ────────────────────────────────────────
function buildItemListJsonLd(sp: SP) {
  const deporte = pickStr(sp, 'deporte')
  const tab     = pickStr(sp, 'tab') || 'jugadores'
  const scope   = pickStr(sp, 'scope')
  const gender  = pickStr(sp, 'gender')

  const top = selectBase(deporte, tab, scope, gender).slice(0, 10)
  const { title } = buildTitle(sp)

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: top.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: top.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.name,
      description: e.subtitle,
      url: `${SITE_URL}/rankings/${e.id}`,
    })),
  }
}

// Categorías que cargamos en SSR. Cargamos TODAS desde DB para que image_url
// sea siempre el valor real de Supabase (con fotos actualizadas); sin esto el
// cliente caería al fallback estático de rankings.ts (URLs antiguas). El cliente
// hace el filtrado fino por deporte/tab/etc. a partir de este bag.
function categoriesForView(): RankingCategory[] {
  const ALL: RankingCategory[] = [
    'jugadores', 'jugadoras', 'clubes', 'clubes_femenino',
    'creadores', 'periodistas', 'luchadoras_ufc',
    'creadores_wwe', 'sub21', 'latam', 'concacaf',
  ]
  return ALL
}

// ── Página (server, ISR) ───────────────────────────────────────────
// NO lee searchParams (eso forzaría render dinámico): los datos son idénticos
// para cualquier filtro (el cliente filtra). El JSON-LD top-10 refleja la vista
// por defecto (jugadores), que es la que ve Google en /rankings.
export default async function Page() {
  const targetCats = categoriesForView()

  const [{ movers, fallers }, dbData, lastUpdated] = await Promise.all([
    getTopMovers(3),
    getAllRankings(targetCats),
    getLastIngestTime(),
  ])
  const jsonLd = buildItemListJsonLd({})
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BreadcrumbJsonLd items={[{ name: 'TakaSports', path: '' }, { name: 'Rankings', path: '/rankings' }]} />
      <RankingsClient initialMovers={movers} initialFallers={fallers} dbData={dbData} lastUpdated={lastUpdated ?? undefined} />
    </>
  )
}
