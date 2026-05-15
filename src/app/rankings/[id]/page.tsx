import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { calcScore, type RankingEntry } from '@/lib/rankings'
import { findEntryById, getEntrySources, getAllRankingEntries } from '@/lib/rankings-search'
import { findEntryByIdFromDb, getAllEntryIdsFromDb } from '@/lib/rankings-data'
import { getSportStyle } from '@/lib/sports'
import ShareButton from './ShareButton'
import PlayerAvatar from '@/components/rankings/PlayerAvatar'
import ScoreHistoryChart from '@/components/rankings/ScoreHistoryChart'
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'

// ── Helpers compartidos ───────────────────────────────────────────
function getDisplayScore(entry: RankingEntry): number {
  return entry.factors ? calcScore(entry.factors, entry.editorialBoost) : entry.score
}
function scoreColor(score: number): string {
  if (score >= 95) return '#22c55e'
  if (score >= 90) return '#86efac'
  if (score >= 85) return '#f59e0b'
  if (score >= 80) return '#f97316'
  if (score >= 75) return '#fb923c'
  return '#f87171'
}

const SPORT_EMOJI: Record<string, string> = {
  futbol: '⚽', baloncesto: '🏀', formula1: '🏎️', tenis: '🎾',
  ufc: '🥊', wwe: '🤼', contenido: '✍️',
}
const FACTOR_DEFS = [
  { key: 'rendimiento', label: 'Rendimiento', pct: 40, color: '#22c55e' },
  { key: 'contexto',    label: 'Contexto',    pct: 20, color: '#60a5fa' },
  { key: 'mediatico',   label: 'Mediático',   pct: 25, color: '#f59e0b' },
  { key: 'narrativa',   label: 'Narrativa',   pct: 15, color: '#c084fc' },
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
// Revalidar perfiles cada 2h (scores cambian ~semanalmente)
export const revalidate = 7200
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
  if (!entry) return { title: 'Entry no encontrada — Índice Taka' }

  const score = getDisplayScore(entry).toFixed(1)
  const title = `${entry.name} · Índice Taka ${score} — TakaSports`
  const description = entry.insight ?? `${entry.subtitle}. Índice Taka ${score}/100.`

  return {
    title,
    description,
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

  const ds = getDisplayScore(entry)
  const sportAccent = entry.sport ? getSportStyle(entry.sport).accent : '#7C3AED'
  const sportEmoji = entry.sport ? SPORT_EMOJI[entry.sport] ?? '🏅' : '🏅'
  const avatar = entry.emoji && entry.emoji !== entry.country ? entry.emoji : sportEmoji

  const sources = getEntrySources(id)
  const factors = entry.factors

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
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: ds,
      bestRating: 100,
      worstRating: 0,
      ratingCount: 1,
    },
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
      <Header />
      <LiveStrip />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-16">
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
                #{entry.rank} · Índice Taka
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
              Desglose · 4 factores objetivos
            </p>
            <div className="flex flex-col gap-4">
              {FACTOR_DEFS.map(({ key, label, pct, color }) => (
                <FactorBar
                  key={key}
                  value={factors[key as FactorKey]}
                  color={color}
                  label={label}
                  pct={pct}
                />
              ))}
            </div>
            {entry.editorialBoost !== undefined && entry.editorialBoost !== 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
                      color: entry.editorialBoost > 0 ? '#22c55e' : '#f87171',
                      fontFamily: 'var(--font-display)',
                    }}>
                    {entry.editorialBoost > 0 ? '+' : ''}{entry.editorialBoost.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

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
            El <span style={{ color: '#9B7CF6' }}>Índice Taka</span> pondera rendimiento reciente (40 %), contexto competitivo (20 %), influencia mediática (25 %) y narrativa pública (15 %). Las tendencias reflejan el movimiento respecto al período anterior.
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
      </main>

      <ScrollToTop />
      <Footer />
    </div>
  )
}
