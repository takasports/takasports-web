import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { sanityClient, eventDetailQuery, relatedByEventQuery, urlFor } from '@/lib/sanity'
import { getSportStyle, getSportLabel, getSportEmoji } from '@/lib/sports'
import { SOURCE_TZ } from '@/lib/timezone'
import { SITE_URL, SITE_NAME, TWITTER_HANDLE, LOGO_URL, ICON_URL } from '@/lib/constants'

export const revalidate = 300

// Pre-genera en build todas las páginas de eventos Sanity programados/en_vivo
export async function generateStaticParams() {
  const events: { _id: string }[] = await sanityClient
    .fetch<{ _id: string }[]>(
      `*[_type == "event" && status in ["programado", "en_vivo"]]{ _id }`
    )
    .catch(() => [] as { _id: string }[]) // si Sanity cae, no tumbar el build
  return events.map(e => ({ id: e._id }))
}

// ── Types ─────────────────────────────────────────────────────
interface SanityEventDetail {
  _id: string
  sport: string
  home: string
  away?: string
  date: string
  venue?: string
  status?: string
  stage?: string
  broadcast?: string
  competition?: { name: string; slug: string }
}

interface RelatedArticle {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  imageUrl?: string
  image?: { asset: { _ref: string } }
  publishedAt?: string
  sport?: string
  category?: string
}

// ── Helpers ───────────────────────────────────────────────────
const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatEventDate(isoDate: string): string {
  const d = new Date(isoDate)
  const parts = new Intl.DateTimeFormat('es', {
    timeZone: SOURCE_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return `${capitalizeFirst(get('weekday'))}, ${get('day')} de ${get('month')} de ${get('year')}`
}

function formatEventTime(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: SOURCE_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(isoDate))
  const h = parts.find(p => p.type === 'hour')?.value   ?? '00'
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${h}:${m}`
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const h    = Math.floor(diff / 3_600_000)
  if (h < 1)  return 'Hace menos de 1h'
  if (h < 24) return `Hace ${h}h`
  const d = Math.floor(h / 24)
  return `Hace ${d}d`
}

function articleImageUrl(a: RelatedArticle, w = 320, h = 180): string | null {
  if (a.imageUrl) return a.imageUrl
  if (a.image?.asset) return urlFor(a.image).width(w).height(h).url()
  return null
}

// ── Metadata ──────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = await params
  const event: SanityEventDetail | null = await sanityClient.fetch(eventDetailQuery, { id }).catch(() => null)
  if (!event) return { title: 'Evento | TakaSports' }

  const sportLabel = getSportLabel(event.sport)
  const title = event.away
    ? `${event.home} vs ${event.away} · ${event.competition?.name ?? sportLabel} | TakaSports`
    : `${event.home} · ${event.competition?.name ?? sportLabel} | TakaSports`
  const description = [
    event.competition?.name ?? sportLabel,
    event.stage,
    event.date ? formatEventDate(event.date) : null,
    event.venue,
  ].filter(Boolean).join(' · ')

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/evento/${id}` },
    openGraph: {
      title, description, type: 'website',
      url: `${SITE_URL}/evento/${id}`, siteName: 'TakaSports', locale: 'es_ES',
      images: [{ url: LOGO_URL, width: 1200, height: 630, alt: SITE_NAME, type: 'image/png' }],
    },
    twitter:   { card: 'summary_large_image', title, description, site: '@takasportsx', creator: '@takasportsx', images: [LOGO_URL] },
    robots:    { index: true, follow: true },
  }
}

// ── Sub-components ────────────────────────────────────────────
function MetaChip({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-[11px]">{icon}</span>
      <span className="text-[10px] font-semibold" style={{ color: '#8A8AA0', fontFamily: 'var(--font-sport)' }}>{text}</span>
    </div>
  )
}

function SportPill({ sport, accent }: { sport: string; accent: string }) {
  const label = getSportLabel(sport)
  const emoji = getSportEmoji(label)
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
      style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}40`, fontFamily: 'var(--font-sport)' }}>
      {emoji} {label}
    </span>
  )
}

function RelatedArticleCard({ article }: { article: RelatedArticle }) {
  const img = articleImageUrl(article)
  const href = `/noticias/${article.slug ?? article._id}`
  return (
    <Link href={href} className="block no-underline group">
      <div className="flex gap-3 p-3 rounded-xl transition-all hover:brightness-110"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {img && (
          <Image src={img} alt={article.title}
            width={80} height={54}
            className="rounded-lg flex-shrink-0 object-cover"
            style={{ width: 80, height: 54 }}
            unoptimized />
        )}
        <div className="flex flex-col gap-1 min-w-0 justify-center">
          <p className="text-[12px] font-bold leading-snug line-clamp-2"
            style={{ color: '#E0E0F0', fontFamily: 'var(--font-sport)' }}>
            {article.title}
          </p>
          {article.publishedAt && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              {timeAgo(article.publishedAt)}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event: SanityEventDetail | null = await sanityClient.fetch(eventDetailQuery, { id }).catch(() => null)
  if (!event) notFound()

  const { bg, accent } = getSportStyle(event.sport)
  const sportLabel     = getSportLabel(event.sport)

  // Time window for related articles: 7 days before → 2 days after
  const eventTs   = new Date(event.date).getTime()
  const fromIso   = new Date(eventTs - 7 * 86_400_000).toISOString()
  const toIso     = new Date(eventTs + 2 * 86_400_000).toISOString()

  const related: RelatedArticle[] = await sanityClient.fetch(relatedByEventQuery, {
    sport: event.sport,
    from:  fromIso,
    to:    toIso,
    home:  event.home ?? '',
    away:  event.away ?? '',
  }).catch(() => [])

  const isLive    = event.status === 'en_vivo'
  const statusLabel = isLive ? 'En Vivo' : event.status === 'finalizado' ? 'Finalizado' : null
  const dateStr   = formatEventDate(event.date)
  const timeStr   = formatEventTime(event.date)

  const eventStatusMap: Record<string, string> = {
    programado: 'https://schema.org/EventScheduled',
    en_vivo:    'https://schema.org/EventScheduled',
    finalizado: 'https://schema.org/EventCompleted',
  }
  const locationName = event.venue
    ?? (event.competition?.name ? `${event.competition.name} — sede por confirmar` : 'Sede por confirmar')
  const sportsEventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: event.away ? `${event.home} vs ${event.away}` : event.home,
    description: [event.competition?.name ?? sportLabel, event.stage, dateStr, event.venue].filter(Boolean).join(' · '),
    startDate: event.date,
    url: `${SITE_URL}/evento/${id}`,
    sport: sportLabel,
    inLanguage: 'es-ES',
    isAccessibleForFree: true,
    eventStatus: eventStatusMap[event.status ?? 'programado'] ?? 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: locationName },
    ...(event.competition ? {
      organizer: { '@type': 'SportsOrganization', name: event.competition.name },
      superEvent: { '@type': 'SportsEvent', name: event.competition.name },
    } : {}),
    ...(event.away ? {
      competitor: [
        { '@type': 'SportsTeam', name: event.home },
        { '@type': 'SportsTeam', name: event.away },
      ],
    } : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Calendario', item: `${SITE_URL}/calendario` },
      { '@type': 'ListItem', position: 3, name: event.away ? `${event.home} vs ${event.away}` : event.home, item: `${SITE_URL}/evento/${id}` },
    ],
  }

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }} className="flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-4 pb-20">
          {/* Back */}
          <div className="py-5">
            <Link href="/calendario" className="inline-flex items-center gap-1.5 text-[11px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)', textDecoration: 'none', fontFamily: 'var(--font-sport)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Calendario
            </Link>
          </div>

          {/* Sport + status pills */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <SportPill sport={event.sport} accent={accent} />
            {event.competition?.name && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#6A6A80', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}>
                {event.competition.name}
              </span>
            )}
            {statusLabel && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                style={{
                  background: isLive ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)',
                  color: isLive ? '#4ade80' : '#6A6A80',
                  border: isLive ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  fontFamily: 'var(--font-sport)',
                }}>
                {isLive && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />}
                {statusLabel}
              </span>
            )}
          </div>

          {/* Hero card */}
          <div className="rounded-2xl p-6 mb-5"
            style={{
              background: isLive
                ? 'linear-gradient(135deg, rgba(74,222,128,0.07) 0%, rgba(9,9,15,0.9) 60%)'
                : bg,
              border: isLive
                ? '1px solid rgba(74,222,128,0.2)'
                : `1px solid ${accent}25`,
            }}>
            {event.stage && (
              <p className="text-[10px] font-black uppercase tracking-widest text-center mb-4"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                {event.stage}
              </p>
            )}

            {event.away ? (
              /* vs layout */
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <p className="font-black text-base leading-tight"
                    style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                    {event.home}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span className="font-black"
                    style={{ color: '#3A3A5A', fontFamily: 'var(--font-display)', fontSize: 28 }}>
                    vs
                  </span>
                </div>
                <div className="flex-1 text-center">
                  <p className="font-black text-base leading-tight"
                    style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                    {event.away}
                  </p>
                </div>
              </div>
            ) : (
              /* solo event (F1 GP, etc.) */
              <p className="text-center font-black text-xl"
                style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                {event.home}
              </p>
            )}

            {/* Date + time */}
            <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold"
                style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M1 5h10M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {dateStr}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-black tabular-nums"
                style={{ color: '#B0B0C8', fontFamily: 'var(--font-display)' }}>
                {timeStr} (Madrid)
              </span>
            </div>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 mb-8">
            {event.venue     && <MetaChip icon="📍" text={event.venue} />}
            {event.broadcast && <MetaChip icon="📺" text={event.broadcast} />}
          </div>

          {/* Related articles */}
          {related.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-3"
                style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
                Artículos relacionados
              </p>
              <div className="flex flex-col gap-2">
                {related.map(a => <RelatedArticleCard key={a._id} article={a} />)}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
