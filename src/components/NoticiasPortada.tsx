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

const OVERLAY = 'linear-gradient(to top, rgba(3,3,10,0.97) 0%, rgba(3,3,10,0.55) 38%, rgba(3,3,10,0.08) 72%, transparent 100%)'

function Badge({ sport, category }: { sport?: string; category?: string }) {
  const { accent } = getSportStyle(sport, category)
  const label = getSportLabel(sport, category)
  if (!label) return null
  return (
    <span
      className="inline-block text-[9px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded mb-1.5"
      style={{ background: `${accent}26`, color: accent, border: `1px solid ${accent}48`, fontFamily: 'var(--font-sport)' }}
    >
      {label}
    </span>
  )
}

// ── Card grande (top 2) ────────────────────────────────────────
function BigCard({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(800).height(520).url() : null)

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl"
      style={{ height: 340, textDecoration: 'none' }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 1024px) 100vw, 48vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          priority
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}35, #06060F)` }} />
      )}

      <div className="absolute inset-0" style={{ background: OVERLAY }} />

      {article.takaStatus === 'breaking' && (
        <div className="absolute top-3 left-3 z-10">
          <span
            className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded animate-pulse"
            style={{ background: 'rgba(6,6,14,0.9)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)', backdropFilter: 'blur(8px)', fontFamily: 'var(--font-sport)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Breaking
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
        <Badge sport={article.sport} category={article.category} />
        <h2
          className="font-black leading-[1.1] mb-2 transition-colors group-hover:text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.1rem, 1.6vw, 1.45rem)', color: '#EEEEF8', letterSpacing: '-0.018em' }}
        >
          {article.title}
        </h2>
        {article.short_summary && (
          <p className="line-clamp-2 mb-2.5" style={{ fontSize: '0.82rem', color: '#8888AA', lineHeight: 1.5 }}>
            {article.short_summary}
          </p>
        )}
        <div className="flex items-center gap-2">
          {article.publishedAt && (
            <span className="text-[10px]" style={{ color: '#40405A', fontFamily: 'var(--font-sport)' }}>
              {timeAgo(article.publishedAt)}
            </span>
          )}
          <span
            className="text-[10px] font-bold flex items-center gap-1 group-hover:gap-2 transition-all"
            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
          >
            Leer <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Card de tira (strip inferior) ─────────────────────────────
function StripCard({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(400).height(280).url() : null)

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-xl"
      style={{ height: 200, textDecoration: 'none' }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 768px) 50vw, 20vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}30, #06060F)` }} />
      )}

      <div className="absolute inset-0" style={{ background: OVERLAY }} />

      {article.takaStatus === 'breaking' && (
        <div className="absolute top-2 left-2 z-10">
          <span
            className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded animate-pulse"
            style={{ background: 'rgba(6,6,14,0.9)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', fontFamily: 'var(--font-sport)' }}
          >
            <span className="w-1 h-1 rounded-full bg-red-500" />
            Breaking
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
        <Badge sport={article.sport} category={article.category} />
        <h3
          className="font-bold leading-snug line-clamp-2 transition-colors group-hover:text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: '0.82rem', color: '#DCDCF0', letterSpacing: '-0.01em' }}
        >
          {article.title}
        </h3>
        {article.publishedAt && (
          <span className="text-[9px] mt-1 block" style={{ color: '#32324A', fontFamily: 'var(--font-sport)' }}>
            {timeAgo(article.publishedAt)}
          </span>
        )}
      </div>
    </Link>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function NoticiasPortada({ articles }: { articles: Article[] }) {
  const safe = articles.filter(Boolean)
  if (safe.length === 0) return null

  const big   = safe.slice(0, 2)   // 2 grandes iguales
  const strip = safe.slice(2, 7)   // hasta 5 en tira

  return (
    <div className="mb-6">

      {/* ── 2 GRANDES IGUALES ── */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {big.map(a => <BigCard key={a._id} article={a} />)}
      </div>

      {/* ── TIRA DE 5 ── */}
      {strip.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(strip.length, 5)}, 1fr)` }}
        >
          {strip.map(a => <StripCard key={a._id} article={a} />)}
        </div>
      )}

    </div>
  )
}
