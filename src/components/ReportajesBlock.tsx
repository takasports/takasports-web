import Link from 'next/link'
import Image from '@/components/DynamicImage'
import SportPlaceholder from '@/components/SportPlaceholder'
import { urlFor } from '@/lib/sanity'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { displayAuthor } from '@/lib/brand'
import { readingLabel } from '@/lib/reading'

// Bloque de Reportajes — las piezas de fondo no compiten con el feed.
//
// El feed ordena por frescura y a las 48 h entierra cualquier cosa; un reportaje
// de tres semanas sigue mereciendo lectura. Por eso vive en un recinto propio:
// fondo, filo ámbar y un formato horizontal que el feed no usa en ningún sitio,
// de modo que no hay forma de confundirlos al hacer scroll. La firma y los
// minutos de lectura van delante porque son la promesa de la pieza.

export interface Reportaje {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  sport?: string
  category?: string
  author?: string | null
  readWords?: number | null
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

const CARD_BG = '#06060F'

function href(r: Reportaje) {
  return `/noticias/${r.slug ?? r._id}`
}

function coverUrl(r: Reportaje, w: number, h: number) {
  return r.imageUrl ?? (r.image?.asset ? urlFor(r.image).width(w).height(h).url() : null)
}

export function ReportajeSello({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded font-black uppercase"
      style={{
        fontFamily: 'var(--font-sport)',
        fontSize: compact ? 8 : 9,
        letterSpacing: '0.17em',
        padding: compact ? '2px 6px' : '3px 8px',
        background: 'rgba(232,163,61,0.13)',
        color: 'var(--reportaje)',
        border: '1px solid rgba(232,163,61,0.34)',
      }}
    >
      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
        <path d="M1 1h8v1.4H1zM1 4.3h8v1.4H1zM1 7.6h5.2V9H1z" />
      </svg>
      Reportaje
    </span>
  )
}

function SportBadge({ sport, category }: { sport?: string; category?: string }) {
  const { accent } = getSportStyle(sport, category)
  const label = getSportLabel(sport, category)
  if (!label) return null
  return (
    <span
      className="inline-block rounded font-black uppercase"
      style={{
        fontFamily: 'var(--font-sport)',
        fontSize: 9,
        letterSpacing: '0.14em',
        padding: '2px 8px',
        background: `${accent}26`,
        color: accent,
        border: `1px solid ${accent}48`,
      }}
    >
      {label}
    </span>
  )
}

function Meta({ r, className = '' }: { r: Reportaje; className?: string }) {
  const read = readingLabel(r.readWords)
  return (
    <div
      className={`flex items-center gap-2 flex-wrap ${className}`}
      style={{ fontFamily: 'var(--font-sport)', fontSize: 10.5, color: '#63637E', letterSpacing: '0.03em' }}
    >
      <span style={{ color: '#9A9AB4', fontWeight: 600 }}>{displayAuthor(r.author)}</span>
      {read && (
        <>
          <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#3C3C52' }} />
          <span>{read}</span>
        </>
      )}
    </div>
  )
}

// ── Pieza principal: foto a la izquierda, texto a la derecha ──
function LeadCard({ r, lcp }: { r: Reportaje; lcp?: boolean }) {
  const img = coverUrl(r, 900, 640)
  return (
    <Link
      href={href(r)}
      className="group grid grid-cols-1 md:grid-cols-[1.12fr_1fr] gap-4 md:gap-6 items-stretch"
      style={{ textDecoration: 'none' }}
    >
      <div
        className="relative overflow-hidden rounded-2xl h-[200px] sm:h-[260px] md:h-[290px]"
        style={{ background: CARD_BG }}
      >
        {img ? (
          <Image
            src={img}
            alt={r.title}
            fill
            sizes="(max-width: 768px) 100vw, 45vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            priority={lcp}
            loading={lcp ? 'eager' : 'lazy'}
          />
        ) : (
          <SportPlaceholder sport={r.sport} category={r.category} emojiSize={64} />
        )}
      </div>

      <div className="flex flex-col justify-center md:pr-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ReportajeSello />
          <SportBadge sport={r.sport} category={r.category} />
        </div>
        <h3
          className="font-black transition-colors group-hover:text-white"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.45rem, 2.6vw, 2.25rem)',
            lineHeight: 1.04,
            letterSpacing: '-0.022em',
            color: '#F2F2FA',
            margin: '11px 0',
          }}
        >
          {r.title}
        </h3>
        {r.short_summary && (
          <p className="line-clamp-3 mb-4" style={{ fontSize: '0.88rem', lineHeight: 1.6, color: '#9797AE' }}>
            {r.short_summary}
          </p>
        )}
        <Meta r={r} />
      </div>
    </Link>
  )
}

// ── Tira inferior: miniatura + titular, numeradas ──
function MiniCard({ r, n }: { r: Reportaje; n: number }) {
  const img = coverUrl(r, 220, 220)
  return (
    <Link
      href={href(r)}
      className="group grid grid-cols-[60px_1fr] sm:grid-cols-[74px_1fr] gap-3 items-center"
      style={{ textDecoration: 'none' }}
    >
      <div
        className="relative overflow-hidden rounded-[10px] w-[60px] h-[60px] sm:w-[74px] sm:h-[74px]"
        style={{ background: CARD_BG }}
      >
        {img ? (
          <Image src={img} alt={r.title} fill sizes="74px" className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" loading="lazy" />
        ) : (
          <SportPlaceholder sport={r.sport} category={r.category} emojiSize={26} />
        )}
      </div>
      <div>
        <span
          className="block"
          style={{ fontFamily: 'var(--font-headline)', fontSize: 13, color: 'var(--reportaje-dim)', letterSpacing: '0.06em', marginBottom: 3 }}
        >
          {String(n).padStart(2, '0')}
        </span>
        <h4
          className="font-bold line-clamp-2 transition-colors group-hover:text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', lineHeight: 1.22, letterSpacing: '-0.012em', color: '#D8D8EC', marginBottom: 5 }}
        >
          {r.title}
        </h4>
        <div style={{ fontFamily: 'var(--font-sport)', fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {[readingLabel(r.readWords)?.replace(' de lectura', ''), getSportLabel(r.sport, r.category)].filter(Boolean).join(' · ')}
        </div>
      </div>
    </Link>
  )
}

export default function ReportajesBlock({ reportajes }: { reportajes: Reportaje[] }) {
  const safe = (reportajes ?? []).filter(Boolean)
  if (safe.length === 0) return null

  const [lead, ...rest] = safe

  return (
    <section className="mt-8">
      <div
        className="rounded-[18px] p-4 sm:p-5"
        style={{
          background: 'linear-gradient(180deg, rgba(232,163,61,0.055), rgba(232,163,61,0) 190px), var(--bg-surface)',
          border: '1px solid var(--border)',
          borderTop: '2px solid rgba(232,163,61,0.55)',
        }}
      >
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="section-accent" style={{ background: 'var(--reportaje)' }} />
            <h2 className="section-label">Reportajes</h2>
          </div>
          <Link
            href="/reportajes"
            className="text-[11px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: 'var(--reportaje)', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
          >
            Ver todos →
          </Link>
        </div>

        <LeadCard r={lead} />

        {rest.length > 0 && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5 pt-[19px]"
            style={{ borderTop: '1px solid rgba(255,255,255,0.055)' }}
          >
            {rest.map((r, i) => (
              <MiniCard key={r._id} r={r} n={i + 2} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
