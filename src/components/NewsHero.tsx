'use client'

import { useState, useEffect, useRef } from 'react'
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

const AUTOPLAY_MS = 5000

// Badge de deporte en esquina
function SportBadge({ sport, category }: { sport?: string; category?: string }) {
  const { accent } = getSportStyle(sport, category)
  const label = getSportLabel(sport, category)
  if (!label) return null
  return (
    <span
      className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
      style={{
        background: `${accent}22`,
        color: accent,
        border: `1px solid ${accent}40`,
        fontFamily: 'var(--font-sport)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {label}
    </span>
  )
}

// Card principal — imagen de fondo completa, texto encima
// Desktop: col-span-2, 370px de alto. Mobile: 280px
function HeroCard({ article, isActive, onClick }: {
  article: Article
  isActive: boolean
  onClick: () => void
}) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(1400).height(800).url() : null)

  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-end rounded-2xl overflow-hidden"
      style={{
        textDecoration: 'none',
        height: 'clamp(260px, 38vw, 380px)',
        border: isActive ? `1px solid ${accent}50` : '1px solid var(--border)',
        boxShadow: isActive ? `0 0 0 1px ${accent}20, 0 16px 48px rgba(0,0,0,0.5)` : '0 4px 24px rgba(0,0,0,0.3)',
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
      }}
      onClick={onClick}
    >
      {/* Imagen fondo */}
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          priority
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${accent}30 0%, #09090F 100%)` }}
        />
      )}

      {/* Gradiente inferior — texto legible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(5,5,12,0.92) 0%, rgba(5,5,12,0.45) 50%, transparent 80%)' }}
      />

      {/* Badge deporte — top left */}
      <div className="absolute top-4 left-4">
        <SportBadge sport={article.sport} category={article.category} />
      </div>

      {/* Texto superpuesto — bottom */}
      <div className="relative px-5 pb-5">
        <h2
          className="font-black leading-tight mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.2rem, 2.2vw, 1.75rem)',
            color: '#F8F8FF',
            letterSpacing: '-0.02em',
          }}
        >
          {article.title}
        </h2>

        {article.short_summary && (
          <p
            className="text-[12px] leading-relaxed line-clamp-2 mb-3 hidden sm:block"
            style={{ color: 'rgba(210,210,230,0.65)' }}
          >
            {article.short_summary}
          </p>
        )}

        <div className="flex items-center justify-between">
          {article.publishedAt && (
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)' }}>
              {timeAgo(article.publishedAt)}
            </span>
          )}
          <span
            className="text-[10px] font-semibold flex items-center gap-1.5 transition-all group-hover:gap-2.5"
            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
          >
            Leer artículo
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1.5 4.5h6M4 2l2.5 2.5L4 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

// Card secundaria — imagen fondo completa, más compacta
function SecondaryCard({ article, isActive, onClick }: {
  article: Article
  isActive: boolean
  onClick: () => void
}) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(720).height(400).url() : null)

  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-end rounded-xl overflow-hidden"
      style={{
        textDecoration: 'none',
        height: 'clamp(130px, 16vw, 178px)',
        border: isActive ? `1px solid ${accent}45` : '1px solid var(--border)',
        boxShadow: isActive ? `0 4px 20px ${accent}18` : 'none',
        transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
      }}
      onClick={onClick}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={article.title}
          fill
          sizes="(max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${accent}25 0%, #09090F 100%)` }}
        />
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(5,5,12,0.9) 0%, rgba(5,5,12,0.3) 55%, transparent 80%)' }}
      />

      {/* Badge */}
      <div className="absolute top-2.5 left-2.5">
        <SportBadge sport={article.sport} category={article.category} />
      </div>

      <div className="relative px-3.5 pb-3">
        <h3
          className="font-black leading-tight line-clamp-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(0.8rem, 1.1vw, 1rem)',
            color: '#F2F2FA',
            letterSpacing: '-0.01em',
          }}
        >
          {article.title}
        </h3>
        {article.publishedAt && (
          <span className="text-[9px] mt-1 block" style={{ color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-sport)' }}>
            {timeAgo(article.publishedAt)}
          </span>
        )}
      </div>
    </Link>
  )
}

export default function NewsHero({ articles }: { articles: Article[] }) {
  const items = articles.slice(0, 3)
  const [activeIdx, setActiveIdx] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const resetInterval = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % items.length)
    }, AUTOPLAY_MS)
  }

  useEffect(() => {
    if (items.length <= 1) return
    resetInterval()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [items.length])

  if (items.length === 0) return null

  return (
    <div className="mb-8">
      {/* Desktop: 2/3 + 1/3. Mobile: card principal + 2 cards en fila */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Card principal — col-span-2 en desktop */}
        {items[0] && (
          <div className="lg:col-span-2">
            <HeroCard
              article={items[0]}
              isActive={0 === activeIdx}
              onClick={() => { setActiveIdx(0); resetInterval() }}
            />
          </div>
        )}

        {/* Cards secundarias — col derecha en desktop, fila en mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-3">
          {items.slice(1).map((article, i) => (
            <SecondaryCard
              key={article._id}
              article={article}
              isActive={i + 1 === activeIdx}
              onClick={() => { setActiveIdx(i + 1); resetInterval() }}
            />
          ))}
        </div>
      </div>

      {/* Dots de navegación */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {items.map((_, i) => {
            const { accent } = getSportStyle(items[i].sport, items[i].category)
            return (
              <button
                key={i}
                onClick={() => { setActiveIdx(i); resetInterval() }}
                aria-label={`Ver portada ${i + 1}`}
                aria-pressed={i === activeIdx}
                className="transition-all duration-300"
                style={{
                  width: i === activeIdx ? 22 : 6,
                  height: 4,
                  borderRadius: 2,
                  background: i === activeIdx ? accent : 'rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
