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
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

function SportBadge({ sport, category }: { sport?: string; category?: string }) {
  const label = getSportLabel(sport, category)
  const { accent } = getSportStyle(sport, category)
  if (!label) return null
  return (
    <span
      className="text-[9px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full"
      style={{
        background: `${accent}18`,
        color: accent,
        border: `1px solid ${accent}35`,
        backdropFilter: 'blur(8px)',
        fontFamily: 'var(--font-sport)',
      }}
    >
      {label}
    </span>
  )
}

function FeaturedCard({ article }: { article: Article }) {
  const href = `/article/${article.slug ?? article._id}`
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(900).height(520).url() : null)

  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-2xl"
      style={{ height: 'clamp(260px, 36vw, 400px)', textDecoration: 'none' }}
    >
      {/* Image */}
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
          priority
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg,#1e1040 0%,#0f0825 45%,#090912 100%)' }}
        />
      )}

      {/* Overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top,rgba(9,9,15,0.97) 0%,rgba(9,9,15,0.6) 40%,rgba(9,9,15,0.1) 70%,transparent 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to right,rgba(9,9,15,0.52) 0%,transparent 55%)' }}
      />

      {/* Badges — top */}
      <div className="absolute top-4 left-5 flex items-center gap-2">
        <span
          className="text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(124,58,237,0.22)',
            color: '#C4B5FD',
            border: '1px solid rgba(124,58,237,0.35)',
            backdropFilter: 'blur(8px)',
            fontFamily: 'var(--font-sport)',
          }}
        >
          Destacado
        </span>
        <SportBadge sport={article.sport} category={article.category} />
      </div>

      {/* Content — bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h2
          className="font-black leading-tight mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
            color: '#F8F8FF',
            letterSpacing: '-0.01em',
            textShadow: '0 2px 20px rgba(0,0,0,0.4)',
          }}
        >
          {article.title}
        </h2>
        {article.short_summary && (
          <p
            className="hidden sm:block text-sm leading-relaxed line-clamp-2 mb-3"
            style={{ color: '#7A7A94' }}
          >
            {article.short_summary}
          </p>
        )}
        <div className="flex items-center gap-4">
          {article.publishedAt && (
            <span className="text-xs" style={{ color: '#525266' }}>
              {timeAgo(article.publishedAt)}
            </span>
          )}
          <span
            className="text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 group-hover:gap-2.5"
            style={{ color: '#8B5CF6', fontFamily: 'var(--font-sport)' }}
          >
            Leer nota
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5h7M6 2.5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

function SecondaryCard({ article }: { article: Article }) {
  const { accent } = getSportStyle(article.sport, article.category)
  const label = getSportLabel(article.sport, article.category)
  const href = `/article/${article.slug ?? article._id}`
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(280).height(180).url() : null)

  return (
    <Link
      href={href}
      className="group flex gap-3.5 rounded-xl p-3 transition-colors flex-1"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
      }}
    >
      {/* Thumbnail */}
      <div
        className="flex-shrink-0 rounded-lg overflow-hidden"
        style={{ width: 88, minHeight: 72, alignSelf: 'stretch' }}
      >
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={article.title}
            width={88}
            height={72}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${accent}18, #09090F)` }}
          />
        )}
      </div>

      {/* Text */}
      <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
        <div>
          {label && (
            <span
              className="text-[9px] font-black uppercase tracking-widest block mb-0.5"
              style={{ color: accent, fontFamily: 'var(--font-sport)' }}
            >
              {label}
            </span>
          )}
          <h3
            className="text-[13px] font-semibold leading-snug line-clamp-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {article.title}
          </h3>
        </div>
        {article.publishedAt && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-faint)' }}>
            {timeAgo(article.publishedAt)}
          </p>
        )}
      </div>
    </Link>
  )
}

export default function NewsTopGrid({ articles }: { articles: Article[] }) {
  const featured = articles[0]
  const secondary = articles.slice(1, 3)

  if (!featured) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
      {/* Featured — 3/5 */}
      <div className="lg:col-span-3">
        <FeaturedCard article={featured} />
      </div>

      {/* Secondary — 2/5 */}
      <div className="lg:col-span-2 flex flex-col gap-3">
        {secondary.map((article) => (
          <SecondaryCard key={article._id} article={article} />
        ))}
      </div>
    </div>
  )
}
