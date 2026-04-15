import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle } from '@/lib/sports'

interface Article {
  _id: string
  title: string
  publishedAt?: string
  category?: string
  sport?: string
  image?: { asset: { _ref: string } }
}

export default function SecondaryArticles({ articles }: { articles: Article[] }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.026)',
        borderRadius: '0 0 16px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Label de bloque */}
      <div
        className="flex items-center gap-2 px-4 pt-3 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <span style={{ display: 'block', width: 3, height: 12, background: '#7C3AED', borderRadius: 2, flexShrink: 0 }} />
        <span
          className="text-[9px] font-black uppercase tracking-widest"
          style={{ color: '#5A4A8A', fontFamily: 'var(--font-sport)' }}
        >
          También en portada
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${articles.length}, 1fr)`,
          gap: 1,
          background: 'rgba(255,255,255,0.035)',
        }}
      >
        {articles.map((article, idx) => {
          const imgUrl = article.image?.asset
            ? urlFor(article.image).width(240).height(160).url()
            : null
          const label = article.sport ?? article.category
          const { accent } = getSportStyle(article.sport, article.category)

          return (
            <Link
              key={article._id}
              href={`/article/${article._id}`}
              className="news-card flex gap-3 p-4 transition-all"
              style={{
                background: idx === 0
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(9,9,15,0.5)',
                textDecoration: 'none',
              }}
            >
              {/* Thumbnail */}
              <div
                className="flex-shrink-0 rounded-lg overflow-hidden"
                style={{
                  width: 80,
                  height: 60,
                  background: 'linear-gradient(145deg,#1a1a2e,#0f0820)',
                  flexShrink: 0,
                }}
              >
                {imgUrl ? (
                  <Image src={imgUrl} alt={article.title} width={80} height={60} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#1e1b4b,#1a0a30)' }} />
                )}
              </div>

              {/* Text */}
              <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                <div>
                  {label && (
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: accent, fontFamily: 'var(--font-sport)' }}
                    >
                      {label}
                    </span>
                  )}
                  <h3
                    className="news-title text-[12px] font-semibold leading-snug line-clamp-2 mt-0.5"
                    style={{ color: '#D4D4E8' }}
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
        })}
      </div>
    </div>
  )
}
