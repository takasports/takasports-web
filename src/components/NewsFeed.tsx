'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { CATEGORY_TO_SLUG, getSportStyle } from '@/lib/sports'
import CategoriesFilter from './CategoriesFilter'
import ViewToggle from './ViewToggle'

interface Article {
  _id: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  image?: { asset: { _ref: string } }
}

function isNew(publishedAt?: string): boolean {
  if (!publishedAt) return false
  return Date.now() - new Date(publishedAt).getTime() < 7_200_000
}

function SportPlaceholder({ sport, category }: { sport?: string; category?: string }) {
  const { bg, accent } = getSportStyle(sport, category)
  const label = sport ?? category ?? ''
  const initial = label.charAt(0).toUpperCase()
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: bg }}
    >
      <span
        className="font-black opacity-30"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          color: accent,
          lineHeight: 1,
        }}
      >
        {initial}
      </span>
    </div>
  )
}

function Thumb({
  url, title, w, h, sport, category,
}: {
  url: string | null; title: string; w: number; h: number; sport?: string; category?: string
}) {
  return url ? (
    <Image src={url} alt={title} width={w} height={h} className="w-full h-full object-cover" />
  ) : (
    <SportPlaceholder sport={sport} category={category} />
  )
}

export default function NewsFeed({
  articles,
  initialCategory = 'Todo',
  limit,
  viewAllHref,
  baseRoute = '/',
}: {
  articles: Article[]
  initialCategory?: string
  limit?: number
  viewAllHref?: string
  baseRoute?: string
}) {
  const router = useRouter()
  const [category, setCategory] = useState(initialCategory)
  const [view, setView] = useState<'list' | 'grid'>('list')

  const handleCategorySelect = useCallback((cat: string) => {
    setCategory(cat)
    // Persistir en URL
    const slug = CATEGORY_TO_SLUG[cat]
    if (slug) {
      router.replace(`${baseRoute}?sport=${slug}`, { scroll: false })
    } else {
      router.replace(baseRoute, { scroll: false })
    }
  }, [router, baseRoute])

  const filtered =
    category === 'Todo'
      ? articles
      : articles.filter(
          (a) =>
            a.category?.toLowerCase() === category.toLowerCase() ||
            a.sport?.toLowerCase() === category.toLowerCase()
        )

  const displayed = limit ? filtered.slice(0, limit) : filtered
  const hasMore = limit ? filtered.length > limit : false

  return (
    <section id="noticias" className="mt-6">

      {/* Header de sección */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="section-accent" />
        <h2 className="section-label">Noticias</h2>
      </div>

      {/* Categorías + toggle */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <CategoriesFilter active={category} onSelect={handleCategorySelect} />
        </div>
        <ViewToggle view={view} onToggle={setView} />
      </div>

      {/* Empty */}
      {displayed.length === 0 && (
        <div className="py-14 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay noticias en esta categoría.
          </p>
        </div>
      )}

      {/* LIST */}
      {view === 'list' && displayed.length > 0 && (
        <div key={`list-${category}`} className="flex flex-col gap-1.5 feed-animate">
          {displayed.map((article) => {
            const imgUrl = article.image?.asset
              ? urlFor(article.image).width(180).height(120).url()
              : null
            const label = article.sport ?? article.category
            const { accent: sportAccent } = getSportStyle(article.sport, article.category)

            return (
              <Link
                key={article._id}
                href={`/article/${article._id}`}
                className="news-card flex gap-3.5 rounded-xl p-3"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                }}
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 104, height: 72 }}>
                  <Thumb url={imgUrl} title={article.title} w={104} h={72} sport={article.sport} category={article.category} />
                </div>

                {/* Content */}
                <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {label && (
                        <span
                          className="text-[9px] font-black uppercase tracking-widest"
                          style={{ color: sportAccent, fontFamily: 'var(--font-sport)' }}
                        >
                          {label}
                        </span>
                      )}
                      {isNew(article.publishedAt) && (
                        <span
                          className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(124,58,237,0.18)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.25)' }}
                        >
                          Nuevo
                        </span>
                      )}
                    </div>
                    <h3
                      className="news-title text-[13px] font-semibold leading-snug line-clamp-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {article.title}
                    </h3>
                    {article.short_summary && (
                      <p
                        className="text-[11px] leading-relaxed mt-0.5 line-clamp-1 hidden lg:block"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {article.short_summary}
                      </p>
                    )}
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
      )}

      {/* GRID */}
      {view === 'grid' && displayed.length > 0 && (
        <div key={`grid-${category}`} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 feed-animate">
          {displayed.map((article) => {
            const imgUrl = article.image?.asset
              ? urlFor(article.image).width(400).height(220).url()
              : null
            const label = article.sport ?? article.category
            const { accent } = getSportStyle(article.sport, article.category)

            return (
              <Link
                key={article._id}
                href={`/article/${article._id}`}
                className="news-card rounded-xl overflow-hidden block"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                }}
              >
                <div className="overflow-hidden" style={{ height: 120 }}>
                  <Thumb url={imgUrl} title={article.title} w={400} h={120} sport={article.sport} category={article.category} />
                </div>
                <div className="p-3">
                  {label && (
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: accent, fontFamily: 'var(--font-sport)' }}
                    >
                      {label}
                    </span>
                  )}
                  <h3
                    className="news-title text-xs font-semibold leading-snug line-clamp-2 mt-0.5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {article.title}
                  </h3>
                  {article.publishedAt && (
                    <p className="text-[10px] mt-2" style={{ color: 'var(--text-faint)' }}>
                      {timeAgo(article.publishedAt)}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Ver todos CTA */}
      {(hasMore || viewAllHref) && viewAllHref && (
        <div className="mt-5 text-center">
          <a
            href={viewAllHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{
              background: 'rgba(124,58,237,0.1)',
              color: '#A78BFA',
              border: '1px solid rgba(124,58,237,0.2)',
              fontFamily: 'var(--font-sport)',
              textDecoration: 'none',
            }}
          >
            Ver todas las noticias
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      )}
    </section>
  )
}
