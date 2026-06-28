import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ScrollToTop from '@/components/ScrollToTop'
import { getDisplayScore, scoreColor, isCreatorEntry } from '@/lib/rankings-ui'
import { SCORE_WEIGHTS, CREATOR_WEIGHTS, weightedBase } from '@/lib/rankings'
import { findEntryById, getEntrySources, getAllRankingEntries } from '@/lib/rankings-search'
import { findEntryByIdFromDb, getAllEntryIdsFromDb } from '@/lib/rankings-data'
import { getSportStyle } from '@/lib/sports'
import ShareButton from './ShareButton'
import PlayerAvatar from '@/components/rankings/PlayerAvatar'
import ScoreHistoryChart from '@/components/rankings/ScoreHistoryChart'
import ComputedBadges from '@/components/rankings/ComputedBadges'
import RelatedArticlesByEntity from '@/components/RelatedArticlesByEntity'
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'
import { Suspense } from 'react'

// ── Helpers de score/color: fuente única en rankings-ui (track-aware) ──

const SPORT_EMOJI: Record<string, string> = {
  futbol: '⚽', baloncesto: '🏀', formula1: '🏎️', tenis: '🎾',
  ufc: '🥊', wwe: '🤼', contenido: '✍️',
}
// `pct` se deriva de los pesos canónicos (SCORE_WEIGHTS/CREATOR_WEIGHTS) para
// que la etiqueta y la barra nunca puedan contradecir la fórmula real.
const pctOf = (w: number) => Math.round(w * 100)
const FACTOR_DEFS = [
  { key: 'rendimiento', label: 'Rendimiento', pct: pctOf(SCORE_WEIGHTS.rendimiento), color: '#22c55e' },
  { key: 'contexto',    label: 'Contexto',    pct: pctOf(SCORE_WEIGHTS.contexto),    color: '#60a5fa' },
  { key: 'mediatico',   label: 'Mediático',   pct: pctOf(SCORE_WEIGHTS.mediatico),   color: '#f59e0b' },
  { key: 'narrativa',   label: 'Narrativa',   pct: pctOf(SCORE_WEIGHTS.narrativa),   color: '#c084fc' },
] as const
// Contenido (creadores/periodistas): criterio propio, audiencia-heavy
const FACTOR_DEFS_CREATOR = [
  { key: 'mediatico',   label: 'Audiencia',   pct: pctOf(CREATOR_WEIGHTS.mediatico),   color: '#f59e0b' },
  { key: 'rendimiento', label: 'Contenido',   pct: pctOf(CREATOR_WEIGHTS.rendimiento), color: '#22c55e' },
  { key: 'narrativa',   label: 'Momento',     pct: pctOf(CREATOR_WEIGHTS.narrativa),   color: '#c084fc' },
  { key: 'contexto',    label: 'Profundidad', pct: pctOf(CREATOR_WEIGHTS.contexto),    color: '#60a5fa' },
] as const
type FactorKey = typeof FACTOR_DEFS[number]['key']

const SOURCE_LABELS: Record<string, string> = {
  jugadores: 'Top jugadores',
  jugadoras: 'Top jugadoras',
  sub21: 'Top Sub-21',
  latam: 'Top LATAM',
  concacaf: 'Top CONCACAF',
  clubes: 'Top clubes',
  clubes_femenino: 'Top clubes femenino',
  ufc_femenino: 'UFC femenino',
  entrenadores: 'Top entrenadores',
  creadores: 'Top creadores',
  periodistas: 'Top periodistas',
  creadores_wwe: 'WWE Creadores',
}

// ── SSG: top 500 por score en build time; el resto on-demand via ISR ─
// Revalidar perfiles cada 1h. Los datos cambian ~1x/semana y la ingesta
// semanal + las ediciones del admin fuerzan revalidatePath('/rankings/[id]')
// al instante, así que el temporizador solo cubre correcciones de foto hechas
// con scripts sueltos (escriben directo en DB sin avisar a Next). Antes 5 min,
// pero ese recálculo continuo de ranking_view (~65% del coste de la BD para
// datos que apenas cambian) disparaba el aviso de "recursos agotándose".
export const revalidate = 3600  // 1 hora
export const dynamicParams = true
export async function generateStaticParams() {
  const staticIds = getAllRankingEntries().map(e => e.id)
  const dbIds = await getAllEntryIdsFromDb(500) // solo top 500
  const allIds = [...new Set([...staticIds, ...dbIds])]
  return allIds.map(id => ({ id }))
}

// ── Metadata por entry ────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const entry = (await findEntryByIdFromDb(id)) ?? findEntryById(id)
  if (!entry) {
    // Entry no existe: marcar noindex Y self-canonical para evitar que Google
    // la trate como duplicada del hub /rankings (hereda layout-canonical si no
    // sobrescribimos). Bug relacionado: notFound() de Next 16 con ISR no propaga
    // 404 status, así que la página sigue siendo 200 + content "no encontrada".
    return {
      title: 'Entry no encontrada — Ranking Taka',
      robots: { index: false, follow: true },
      alternates: { canonical: `${SITE_URL}/rankings/${id}` },
    }
  }

  const score = getDisplayScore(entry).toFixed(1)
  const title = `${entry.name} · Ranking Taka ${score} — TakaSports`
  const description = entry.insight ?? `${entry.subtitle}. Ranking Taka ${score}/100.`

  return {
    title,
    description,
    // Entrenadores ya no forman parte del ranking público → sus fichas no se indexan.
    ...((entry.category === 'entrenadores' || id.startsWith('coach-')) ? { robots: { index: false, follow: true } } : {}),
    // Self-canonical: sobrescribe el canonical heredado de rankings/layout.tsx
    // que apuntaba a `/rankings` (hub) → Google trataba TODAS las entries
    // individuales como duplicadas del hub y no las indexaba. Mail GSC del
    // 30/5/2026 reportó la primera URL afectada (/rankings/thegrefg).
    alternates: { canonical: `${SITE_URL}/rankings/${id}` },
    openGraph: {
      title, description, type: 'profile',
      url: `${SITE_URL}/rankings/${id}`,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// ── Componentes auxiliares ────────────────────────────────────────
function FactorBar({ value, color, label, pct }: {
  value: number; color: string; label: string; pct: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold"
          style={{ color, fontFamily: 'var(--font-sport)' }}>
          {label} <span style={{ color: '#3A3A4A' }}>{pct}%</span>
        </span>
        <span className="text-xs tabular-nums font-black"
          style={{ color: '#D0D0E0', fontFamily: 'var(--font-display)' }}>
          {value}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-2 rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color, opacity: 0.9 }} />
      </div>
    </div>
  )
}

// ── Página detalle ────────────────────────────────────────────────
export default async function EntryDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // DB primero (datos frescos con overrides aplicados), fallback al estático
  const entry = (await findEntryByIdFromDb(id)) ?? findEntryById(id)
  if (!entry) notFound()

  // Rankings relacionados: hasta ahora cada /rankings/[id] era una hoja sin
  // enlaces salientes a hermanos → no repartía autoridad ni daba a Google rutas
  // de crawl. Enlazamos las entries de mayor score del mismo deporte (excluyendo
  // entrenadores, que son noindex). (Fase 1 SEO, jun 2026)
  const relatedEntries = (() => {
    const all = getAllRankingEntries().filter(
      e => e.id !== entry.id && !e.id.startsWith('coach-') && e.category !== 'entrenadores',
    )
    const sameSport = entry.sport ? all.filter(e => e.sport === entry.sport) : []
    return (sameSport.length >= 6 ? sameSport : all).slice(0, 12)
  })()

  const ds = getDisplayScore(entry)
  const sportAccent = entry.sport ? getSportStyle(entry.sport).accent : '#7C3AED'
  const sportEmoji = entry.sport ? SPORT_EMOJI[entry.sport] ?? '🏅' : '🏅'
  const avatar = entry.emoji && entry.emoji !== entry.country ? entry.emoji : sportEmoji

  const sources = getEntrySources(id)
  const factors = entry.factors
  // Base objetiva (suma ponderada de factores) y ajuste editorial = lo que la
  // separa del Ranking mostrado (editorial_boost y/o score_manual). Reconcilia
  // las barras con el número grande cuando hay override editorial.
  const factorBase = factors
    ? Math.round(weightedBase(factors, isCreatorEntry(entry) ? CREATOR_WEIGHTS : SCORE_WEIGHTS) * 10) / 10
    : ds
  const editorialAdj = Math.round((ds - factorBase) * 10) / 10

  // JSON-LD por entry — tipo correcto según categoría
  const cat = entry.category ?? (sources.length > 0 ? sources[0] : '')
  const schemaType = cat.includes('club')
    ? 'SportsTeam'
    : 'Person'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: entry.name,
    description: entry.insight ?? entry.subtitle,
    url: `${SITE_URL}/rankings/${id}`,
    ...(entry.image && { image: entry.image }),
    ...(entry.country && schemaType === 'Person' && { nationality: { '@type': 'Country', name: entry.country } }),
    ...(entry.sport && schemaType === 'Person' && { knowsAbout: entry.sport }),
    ...(entry.sport && schemaType === 'SportsTeam' && { sport: entry.sport }),
    // El "Ranking Taka" (ds) es una puntuación editorial propia, no una reseña
    // agregada. Modelarlo como AggregateRating (con ratingCount:1, auto-otorgado)
    // viola la política de review snippets de Google y arriesga supresión/acción
    // manual a escala (~1.100 entidades). Se retira de los datos estructurados;
    // el score se sigue mostrando en la propia página. (Fix A4 SEO, jun 2026)
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Rankings', item: `${SITE_URL}/rankings` },
      { '@type': 'ListItem', position: 3, name: entry.name, item: `${SITE_URL}/rankings/${id}` },
    ],
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-[11px]"
          style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
          <Link href="/rankings" className="hover:brightness-150 transition-all"
            style={{ color: '#7C3AED' }}>
            ← Rankings
          </Link>
          <span style={{ color: '#3A3A52' }}>/</span>
          <span className="truncate">{entry.name}</span>
        </div>

        {/* Header del entry */}
        <div className="rounded-2xl p-5 sm:p-7 mb-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderTop: `3px solid ${sportAccent}`,
          }}>
          {/* Mobile: avatar + score en fila, nombre debajo. Desktop: todo en fila */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">

            {/* Avatar + score inline en mobile */}
            <div className="flex items-center gap-4 sm:contents">
              <div className="relative flex-shrink-0">
                <div className="flex items-center justify-center rounded-2xl"
                  style={{
                    width: 72, height: 72,
                    background: `${sportAccent}14`,
                    border: `1px solid ${sportAccent}28`,
                  }}>
                  <PlayerAvatar src={entry.image} alt={entry.name} fallback={avatar} size={72} rounded="2xl" />
                </div>
                {entry.country && (
                  <span className="absolute -bottom-1 -right-1 text-base leading-none">{entry.country}</span>
                )}
              </div>

              {/* Score — visible inline solo en mobile */}
              <div className="sm:hidden">
                <span className="block font-black tabular-nums leading-none"
                  style={{ color: scoreColor(ds), fontFamily: 'var(--font-display)', fontSize: '2.8rem' }}>
                  {ds.toFixed(1)}
                </span>
                <span className="block text-[9px] font-black uppercase tracking-widest"
                  style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>
                  / 100
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1"
                style={{ color: sportAccent, fontFamily: 'var(--font-sport)' }}>
                #{entry.rank} · Ranking Taka
              </p>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-1"
                style={{ color: '#F0F0F8', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                {entry.name}
              </h1>
              <p className="text-sm mb-3"
                style={{ color: '#8A8AA0', fontFamily: 'var(--font-sport)' }}>
                {entry.subtitle}
              </p>
              {entry.insight && (
                <p className="text-[12px] sm:text-sm leading-relaxed max-w-prose"
                  style={{ color: '#A0A0B8', fontFamily: 'var(--font-sport)' }}>
                  {entry.insight}
                </p>
              )}
            </div>

            {/* Score — solo en desktop */}
            <div className="hidden sm:block text-right flex-shrink-0">
              <span className="block font-black tabular-nums leading-none"
                style={{
                  color: scoreColor(ds),
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2.4rem, 6vw, 3.6rem)',
                }}>
                {ds.toFixed(1)}
              </span>
              <span className="block text-[9px] font-black uppercase tracking-widest mt-1"
                style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>
                / 100
              </span>
            </div>
          </div>
        </div>

        {/* Factores */}
        {factors && (
          <div className="rounded-2xl p-5 sm:p-6 mb-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-4"
              style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
              {isCreatorEntry(entry) ? 'Desglose · Ranking de Contenido' : 'Desglose · 4 factores objetivos'}
            </p>
            <div className="flex flex-col gap-4">
              {(isCreatorEntry(entry) ? FACTOR_DEFS_CREATOR : FACTOR_DEFS).map(({ key, label, pct, color }) => (
                <FactorBar
                  key={key}
                  value={factors[key as FactorKey]}
                  color={color}
                  label={label}
                  pct={pct}
                />
              ))}
            </div>
            {Math.abs(editorialAdj) >= 0.1 && (
              <div className="mt-4 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: '#6A6A82', fontFamily: 'var(--font-sport)' }}>
                    Base objetiva (factores)
                  </span>
                  <span className="text-sm tabular-nums font-bold" style={{ color: '#8A8AA0', fontFamily: 'var(--font-display)' }}>
                    {factorBase.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1"
                      style={{ color: '#A0A0B8', fontFamily: 'var(--font-sport)' }}>
                      📌 Ajuste editorial
                    </p>
                    {entry.editorialNote && (
                      <p className="text-[11px]"
                        style={{ color: '#6A6A82', fontFamily: 'var(--font-sport)' }}>
                        &ldquo;{entry.editorialNote}&rdquo;
                      </p>
                    )}
                  </div>
                  <span className="text-base tabular-nums font-black flex-shrink-0"
                    style={{
                      color: editorialAdj > 0 ? '#22c55e' : '#f87171',
                      fontFamily: 'var(--font-display)',
                    }}>
                    {editorialAdj > 0 ? '+' : ''}{editorialAdj.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Badges computados */}
        <div className="mb-4">
          <ComputedBadges entryId={id} />
        </div>

        {/* Histórico semanal */}
        <div className="rounded-2xl p-5 sm:p-6 mb-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <ScoreHistoryChart
            entryId={id}
            category={entry.category}
            current={ds}
            prev={entry.scorePrev}
            trendReason={entry.trendReason}
            weeks={12}
          />
        </div>

        {/* Apariciones en otros rankings */}
        {sources.length > 1 && (
          <div className="rounded-2xl p-5 sm:p-6 mb-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-3"
              style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
              Aparece también en
            </p>
            <div className="flex flex-wrap gap-2">
              {sources.map(s => (
                <span key={s}
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(124,58,237,0.1)',
                    color: '#C4B5FD',
                    border: '1px solid rgba(124,58,237,0.25)',
                    fontFamily: 'var(--font-sport)',
                  }}>
                  {SOURCE_LABELS[s] ?? s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metodología compacta */}
        <div className="rounded-2xl p-4 sm:p-5 mb-6 flex gap-3"
          style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.1)' }}>
          <span className="text-sm flex-shrink-0 mt-0.5">ℹ️</span>
          <p className="text-[11px] leading-relaxed"
            style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)' }}>
            El <span style={{ color: '#9B7CF6' }}>Ranking Taka</span> pondera rendimiento reciente ({pctOf(SCORE_WEIGHTS.rendimiento)} %), contexto competitivo ({pctOf(SCORE_WEIGHTS.contexto)} %), influencia mediática ({pctOf(SCORE_WEIGHTS.mediatico)} %) y narrativa pública ({pctOf(SCORE_WEIGHTS.narrativa)} %). Las tendencias reflejan el movimiento respecto al período anterior.
          </p>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap justify-center gap-3">
          <ShareButton title={entry.name} />
          <Link
            href={`/rankings/comparar?a=${entry.id}`}
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-125"
            style={{
              background: 'rgba(34,211,238,0.1)',
              color: '#67e8f9',
              border: '1px solid rgba(34,211,238,0.3)',
              fontFamily: 'var(--font-sport)',
            }}>
            ⚖️ Comparar con otro
          </Link>
        </div>

        {/* Widget de noticias relacionadas con esta entry del ranking.
            Distribuye autoridad desde el feed editorial al hub de la entidad. */}
        <Suspense>
          <RelatedArticlesByEntity entityName={entry.name} limit={6} />
        </Suspense>

        {/* Rankings relacionados — enlaza hermanos del mismo deporte para repartir
            autoridad y dar a Google rutas de crawl entre fichas del Ranking Taka. */}
        {relatedEntries.length > 0 && (
          <nav aria-label="Rankings relacionados" className="pt-2">
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-3 text-center"
              style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}
            >
              Más en el Ranking Taka
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {relatedEntries.map(e => (
                <Link
                  key={e.id}
                  href={`/rankings/${e.id}`}
                  className="px-3 py-1.5 rounded-full text-xs transition-colors hover:text-white"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {e.name}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>

      <ScrollToTop />
    </div>
  )
}
