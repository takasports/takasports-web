import Image from '@/components/DynamicImage'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'

interface Article {
  _id: string
  slug?: string
  title: string
  publishedAt?: string
  category?: string
  sport?: string
  image?: { asset: { _ref: string } } | null
  imageUrl?: string | null
}

export default function SecondaryArticles({ articles }: { articles: Article[] }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 gap-px"
      style={{
        borderRadius: '0 0 16px 16px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}
    >
      {articles.map((article, idx) => {
        const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(320).height(200).url() : null)
        const label = getSportLabel(article.sport, article.category)
        const { accent } = getSportStyle(article.sport, article.category)
        const num = String(idx + 1).padStart(2, '0')
        const href = `/noticias/${article.slug ?? article._id}`

        return (
          <Link
            key={article._id}
            href={href}
            className="group relative flex flex-col justify-end overflow-hidden"
            style={{
              background: 'rgba(9,9,15,0.82)',
              borderLeft: idx > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              borderTop: `2px solid ${accent}`,
              minHeight: 'clamp(100px, 18vw, 140px)',
              textDecoration: 'none',
            }}
          >
            {/* Watermark number */}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: -4,
                right: 10,
                fontFamily: 'var(--font-display)',
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1,
                color: accent,
                opacity: 0.055,
                letterSpacing: '-0.04em',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {num}
            </span>

            {/* Thumbnail or sport gradient */}
            <div className="absolute inset-0 z-0">
              {imgUrl ? (
                <Image src={imgUrl} alt={article.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px" className="object-cover" />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: `radial-gradient(ellipse 120% 100% at 80% 0%, ${accent}18 0%, transparent 70%)`,
                  }}
                />
              )}
            </div>

            {/* Gradient overlay */}
            <div
              className="absolute inset-0 z-10"
              style={{ background: imgUrl
                ? 'linear-gradient(to top, rgba(9,9,15,0.97) 0%, rgba(9,9,15,0.75) 50%, rgba(9,9,15,0.45) 100%)'
                : 'linear-gradient(to top, rgba(9,9,15,1) 0%, rgba(9,9,15,0.7) 60%, rgba(9,9,15,0.2) 100%)'
              }}
            />

            {/* Content */}
            <div className="relative z-20 p-4">
              {label && (
                <span
                  className="block text-[9px] font-black uppercase tracking-widest mb-1"
                  style={{ color: accent, fontFamily: 'var(--font-sport)' }}
                >
                  {label}
                </span>
              )}
              <h3
                className="text-[12.5px] font-bold leading-snug line-clamp-2 mb-1.5 transition-colors group-hover:text-white"
                style={{ color: '#D8D8F0', fontFamily: 'var(--font-display)' }}
              >
                {article.title}
              </h3>
              {article.publishedAt && (
                <p className="text-[10px]" style={{ color: '#3D3D58' }}>
                  {timeAgo(article.publishedAt)}
                </p>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
