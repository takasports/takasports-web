'use client'

import Link from 'next/link'
import Image from '@/components/DynamicImage'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle, getSportLabel } from '@/lib/sports'
import SportPlaceholder from '@/components/SportPlaceholder'
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

export default function ArchivoResults({
  articles,
  hasMore,
  loadingMore,
  onLoadMore,
  initialLoading,
}: {
  articles: Article[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  initialLoading?: boolean
}) {
  const gridRef = useScrollReveal({ threshold: 0, rootMargin: '0px 0px 400px 0px' })

  if (initialLoading) {
    return (
      <div className="px-4 sm:px-6 xl:px-10 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl animate-pulse"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 180 }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="px-4 sm:px-6 xl:px-10 py-16 flex flex-col items-center gap-4 text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}
        >
          🔎
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No hay noticias que coincidan con estos filtros.
        </p>
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Prueba a quitar el rango de fechas, cambiar de deporte o ajustar la búsqueda.
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 xl:px-10 pt-6">
      <div ref={gridRef} className="feed-animate grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {articles.map(article => {
          const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(400).height(220).url() : null)
          const sportLabel = getSportLabel(article.sport, article.category)
          const { accent: sportAccent } = getSportStyle(article.sport, article.category)

          return (
            <Link
              key={article._id}
              href={`/noticias/${article.slug ?? article._id}`}
              className="news-card flex flex-col rounded-xl overflow-hidden"
              data-reveal
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <div className="aspect-[16/10] overflow-hidden">
                {imgUrl ? (
                  <Image src={imgUrl} alt={article.title} width={400} height={250} className="w-full h-full object-cover" />
                ) : (
                  <SportPlaceholder sport={article.sport} category={article.category} />
                )}
              </div>
              <div className="p-3 flex flex-col gap-1.5 flex-1">
                {sportLabel && (
                  <span
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: sportAccent, fontFamily: 'var(--font-sport)' }}
                  >
                    {sportLabel}
                  </span>
                )}
                <h3
                  className="news-title text-sm font-semibold leading-snug line-clamp-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {article.title}
                </h3>
                {article.publishedAt && (
                  <p className="text-[10px] mt-auto" style={{ color: 'var(--text-faint)' }}>
                    {timeAgo(article.publishedAt)}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-8 flex items-center gap-4">
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:brightness-110 hover:-translate-y-px active:translate-y-0"
            style={{
              background: 'rgba(124,58,237,0.1)',
              color: '#C4B5FD',
              border: '1px solid rgba(124,58,237,0.25)',
              fontFamily: 'var(--font-sport)',
              cursor: loadingMore ? 'default' : 'pointer',
              boxShadow: '0 4px 20px rgba(124,58,237,0.1)',
            }}
          >
            {loadingMore ? 'Cargando…' : 'Cargar más'}
          </button>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
      )}

      {!hasMore && articles.length > 0 && (
        <div className="mt-10 mb-4 flex items-center gap-4">
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#2A2A3A', fontFamily: 'var(--font-sport)' }}>
            Fin · {articles.length} {articles.length === 1 ? 'resultado' : 'resultados'}
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
      )}
    </div>
  )
}
