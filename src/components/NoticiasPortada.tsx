'use client'

import Image from '@/components/DynamicImage'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import { useTilt } from '@/hooks/useTilt'
import { useScrollReveal } from '@/hooks/useScrollReveal'

interface Article {
  _id: string
  slug?: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

function SportChip({ sport, category }: { sport?: string; category?: string }) {
  const { accent } = getSportStyle(sport, category)
  const label = getSportLabel(sport, category)
  if (!label) return null
  return (
    <span
      className="text-[9px] font-black uppercase tracking-[0.14em] px-2 py-1 rounded"
      style={{
        background: `${accent}20`,
        color: accent,
        border: `1px solid ${accent}35`,
        fontFamily: 'var(--font-sport)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {label}
    </span>
  )
}

function BigCard({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(900).height(640).url() : null)
  const { elRef, glareRef } = useTilt({ max: 7, scale: 1.02, glare: true })

  return (
    <div ref={elRef} className="h-full">
    <Link
      href={href}
      className="group relative flex flex-col justify-end rounded-2xl overflow-hidden h-full"
      style={{ textDecoration: 'none' }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 1024px) 100vw, 65vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          priority
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}25 0%, #09090F 100%)` }} />
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(5,5,12,0.96) 0%, rgba(5,5,12,0.55) 40%, rgba(5,5,12,0.15) 68%, transparent 100%)' }}
      />
      <div ref={glareRef} className="absolute inset-0 pointer-events-none" />

      <div className="relative p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-2.5">
          <SportChip sport={article.sport} category={article.category} />
        </div>
        <h2
          className="font-black leading-[1.07]"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.25rem, 2.4vw, 2rem)',
            color: '#F2F2FA',
            letterSpacing: '-0.02em',
          }}
        >
          {article.title}
        </h2>
        {article.short_summary && (
          <p
            className="hidden lg:block text-[13px] leading-relaxed mt-2 line-clamp-2"
            style={{ color: 'rgba(200,200,220,0.6)' }}
          >
            {article.short_summary}
          </p>
        )}
        <div className="flex items-center gap-3 mt-3">
          {article.publishedAt && (
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-sport)' }}>
              {timeAgo(article.publishedAt)}
            </span>
          )}
          <span
            className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all duration-200 group-hover:gap-2.5"
            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
          >
            Leer
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1.5 4.5h6M4 2l2.5 2.5L4 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
    </div>
  )
}

function GridCard({ article, priority = false }: { article: Article; priority?: boolean }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(500).height(380).url() : null)
  const { elRef } = useTilt({ max: 4, scale: 1.025 })

  return (
    <div ref={elRef} className="h-full">
    <Link
      href={href}
      className="group relative flex flex-col justify-end rounded-xl overflow-hidden h-full"
      style={{ textDecoration: 'none' }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 1024px) 50vw, 22vw"
          className="object-cover transition-transform duration-600 group-hover:scale-[1.05]"
          priority={priority}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}20 0%, #09090F 100%)` }} />
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(5,5,12,0.92) 0%, rgba(5,5,12,0.3) 50%, transparent 80%)' }}
      />

      <div className="relative p-3 lg:p-4">
        <SportChip sport={article.sport} category={article.category} />
        <h3
          className="font-black leading-snug mt-1.5 line-clamp-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(0.82rem, 1.2vw, 1.05rem)',
            color: '#F0F0FA',
            letterSpacing: '-0.01em',
          }}
        >
          {article.title}
        </h3>
        {article.publishedAt && (
          <p className="text-[9px] mt-1.5" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sport)' }}>
            {timeAgo(article.publishedAt)}
          </p>
        )}
      </div>
    </Link>
    </div>
  )
}

export default function NoticiasPortada({ articles }: { articles: Article[] }) {
  const safeArticles = articles.filter(Boolean)
  if (safeArticles.length === 0) return null
  const items = safeArticles.slice(0, 6)
  const bottomRowRef = useScrollReveal({ threshold: 0.05, rootMargin: '0px 0px -30px 0px' })

  return (
    <div className="mb-10">

      {/* ── MOBILE layout: col-2 grid ── */}
      <div className="lg:hidden grid grid-cols-2 gap-2">
        <div className="col-span-2" style={{ height: 230 }}>
          <BigCard article={items[0]} />
        </div>
        {items.slice(1, 5).map((a, i) => (
          <div key={a._id} style={{ height: 145 }}>
            <GridCard article={a} priority={i < 2} />
          </div>
        ))}
        {items[5] && (
          <div className="col-span-2" style={{ height: 120 }}>
            <GridCard article={items[5]} />
          </div>
        )}
      </div>

      {/* ── DESKTOP layout: magazine grid ── */}
      <div className="hidden lg:block">
        {/* Top section: big (65%) + side column (35%) */}
        <div className="flex gap-3 mb-3" style={{ height: 'clamp(340px, 38vw, 430px)' }}>
          {/* Big card */}
          <div className="flex-1">
            <BigCard article={items[0]} />
          </div>
          {/* Side column: 2 stacked cards */}
          {(items[1] || items[2]) && (
            <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: '34%' }}>
              {items[1] && (
                <div className="flex-1">
                  <GridCard article={items[1]} priority />
                </div>
              )}
              {items[2] && (
                <div className="flex-1">
                  <GridCard article={items[2]} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom row: 3 equal cards — reveal al scrollear */}
        <div
          ref={bottomRowRef}
          className="grid grid-cols-3 gap-3"
          style={{ height: 'clamp(150px, 16vw, 190px)' }}
        >
          {items.slice(3, 6).map((a) => (
            <div key={a._id} data-reveal className="h-full">
              <GridCard article={a} />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
