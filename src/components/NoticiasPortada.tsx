'use client'

import Image from '@/components/DynamicImage'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'

interface Article {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  takaStatus?: string | null
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

function SportBadge({ sport, category }: { sport?: string; category?: string }) {
  const { accent } = getSportStyle(sport, category)
  const label = getSportLabel(sport, category)
  if (!label) return null
  return (
    <span
      className="inline-block text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded mb-1.5"
      style={{
        background: `${accent}28`,
        color: accent,
        border: `1px solid ${accent}50`,
        fontFamily: 'var(--font-sport)',
      }}
    >
      {label}
    </span>
  )
}

function BreakingBadge() {
  return (
    <div className="absolute top-3 left-3 z-10">
      <span
        className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded animate-pulse"
        style={{
          background: 'rgba(9,9,15,0.88)',
          color: '#ef4444',
          border: '1px solid rgba(239,68,68,0.5)',
          backdropFilter: 'blur(8px)',
          fontFamily: 'var(--font-sport)',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Breaking
      </span>
    </div>
  )
}

// ── Hero (izquierda, grande) ───────────────────────────────────
function HeroCard({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(900).height(580).url() : null)

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl h-full"
      style={{ textDecoration: 'none', minHeight: 380 }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 1024px) 100vw, 58vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          priority
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}35, #07070F)` }} />
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(4,4,12,0.97) 0%, rgba(4,4,12,0.55) 38%, rgba(4,4,12,0.1) 68%, transparent 100%)' }}
      />

      {article.takaStatus === 'breaking' && <BreakingBadge />}
      {article.takaStatus === 'featured' && (
        <div className="absolute top-3 left-3 z-10">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded"
            style={{ background: 'rgba(9,9,15,0.88)', color: accent, border: `1px solid ${accent}60`, backdropFilter: 'blur(8px)', fontFamily: 'var(--font-sport)' }}
          >
            ⭐ Destacado
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
        <SportBadge sport={article.sport} category={article.category} />
        <h2
          className="font-black leading-[1.1] mb-2.5 transition-colors group-hover:text-white"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.25rem, 1.9vw, 1.7rem)',
            color: '#F0F0FA',
            letterSpacing: '-0.02em',
          }}
        >
          {article.title}
        </h2>
        {article.short_summary && (
          <p className="line-clamp-2 mb-3" style={{ fontSize: '0.84rem', color: '#9090B8', lineHeight: 1.55 }}>
            {article.short_summary}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          {article.publishedAt && (
            <span className="text-[10px]" style={{ color: '#46465E', fontFamily: 'var(--font-sport)' }}>
              {timeAgo(article.publishedAt)}
            </span>
          )}
          <span
            className="text-[10px] font-bold flex items-center gap-1 transition-all group-hover:gap-2"
            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
          >
            Leer
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Card mediana (columna derecha) ─────────────────────────────
function MediumCard({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(520).height(300).url() : null)

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-xl h-full"
      style={{ textDecoration: 'none' }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 1024px) 100vw, 30vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}30, #07070F)` }} />
      )}

      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(4,4,12,0.95) 0%, rgba(4,4,12,0.45) 50%, transparent 85%)' }}
      />

      {article.takaStatus === 'breaking' && (
        <div className="absolute top-2 left-2 z-10">
          <span
            className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded animate-pulse"
            style={{ background: 'rgba(9,9,15,0.88)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', fontFamily: 'var(--font-sport)' }}
          >
            <span className="w-1 h-1 rounded-full bg-red-500" />
            Breaking
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3.5 z-10">
        <SportBadge sport={article.sport} category={article.category} />
        <h3
          className="font-bold leading-snug line-clamp-2 transition-colors group-hover:text-white"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(0.88rem, 1.1vw, 1rem)',
            color: '#E6E6F4',
            letterSpacing: '-0.01em',
          }}
        >
          {article.title}
        </h3>
        {article.publishedAt && (
          <span className="text-[9px] mt-1 block" style={{ color: '#36364E', fontFamily: 'var(--font-sport)' }}>
            {timeAgo(article.publishedAt)}
          </span>
        )}
      </div>
    </Link>
  )
}

// ── Card pequeña (fila inferior) ───────────────────────────────
function SmallCard({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(400).height(250).url() : null)

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-xl"
      style={{ height: 175, textDecoration: 'none' }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 768px) 50vw, 22vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}30, #07070F)` }} />
      )}

      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(4,4,12,0.94) 0%, rgba(4,4,12,0.3) 55%, transparent 88%)' }}
      />

      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        <SportBadge sport={article.sport} category={article.category} />
        <h3
          className="font-bold leading-snug line-clamp-2 transition-colors group-hover:text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: '#D8D8EE', letterSpacing: '-0.01em' }}
        >
          {article.title}
        </h3>
      </div>
    </Link>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function NoticiasPortada({ articles }: { articles: Article[] }) {
  const safe = articles.filter(Boolean)
  if (safe.length === 0) return null

  const hero   = safe[0]
  const medium = safe.slice(1, 3)
  const small  = safe.slice(3, 7)

  return (
    <div className="mb-6">

      {/* ── BENTO TOP: hero + 2 medianas ── */}
      <div
        className="grid gap-3 mb-3"
        style={{ gridTemplateColumns: '1.75fr 1fr', height: 460 }}
      >
        <HeroCard article={hero} />

        <div className="grid gap-3" style={{ gridTemplateRows: '1fr 1fr' }}>
          {medium.map(a => (
            <MediumCard key={a._id} article={a} />
          ))}
        </div>
      </div>

      {/* ── FILA PEQUEÑAS: hasta 4 cards ── */}
      {small.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(small.length, 4)}, 1fr)` }}
        >
          {small.map(a => (
            <SmallCard key={a._id} article={a} />
          ))}
        </div>
      )}

    </div>
  )
}
