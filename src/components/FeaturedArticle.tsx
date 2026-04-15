'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { urlFor } from '@/lib/sanity'
import { timeAgo } from '@/lib/timeAgo'
import { getSportStyle } from '@/lib/sports'

interface Article {
  _id: string
  title: string
  short_summary?: string
  publishedAt?: string
  category?: string
  sport?: string
  image?: { asset: { _ref: string } }
}

export default function FeaturedArticle({ articles }: { articles: Article[] }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (articles.length <= 1) return
    const t = setInterval(() => setCurrent((p) => (p + 1) % articles.length), 7500)
    return () => clearInterval(t)
  }, [articles.length])

  const article = articles[current]
  if (!article) return null

  const label = article.sport ?? article.category
  const { accent: labelAccent } = getSportStyle(article.sport, article.category)

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 'clamp(300px, 30vw, 460px)', borderRadius: '16px 16px 0 0' }}
    >
      {/* ── Crossfade images ── */}
      {articles.map((art, i) => {
        const imgUrl = art.image?.asset
          ? urlFor(art.image).width(1600).height(700).url()
          : null
        return (
          <div
            key={art._id}
            className="absolute inset-0"
            style={{
              opacity: i === current ? 1 : 0,
              transition: 'opacity 800ms ease-in-out',
              zIndex: i === current ? 1 : 0,
            }}
          >
            {imgUrl ? (
              <Image
                src={imgUrl}
                alt={art.title}
                fill
                className="object-cover"
                priority={i === 0}
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(135deg,#1e1040 0%,#0f0825 45%,#090912 100%)' }}
              />
            )}
          </div>
        )
      })}

      {/* ── Overlays fijos sobre las imágenes ── */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to top,rgba(9,9,15,0.97) 0%,rgba(9,9,15,0.55) 38%,rgba(9,9,15,0.1) 65%,transparent 100%)' }}
      />
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right,rgba(9,9,15,0.55) 0%,transparent 55%)' }}
      />
      {/* Glow morado */}
      <div
        className="absolute bottom-0 left-0 w-96 h-64 blur-3xl opacity-20 pointer-events-none z-10"
        style={{ background: 'radial-gradient(ellipse at 30% 80%,#7C3AED,transparent)' }}
      />

      {/* ── Link wrapper sobre todo ── */}
      <Link
        href={`/article/${article._id}`}
        className="absolute inset-0 z-20 flex flex-col justify-between p-7 md:p-9 group"
        style={{ textDecoration: 'none' }}
      >
        {/* Top row: categoría + indicadores */}
        <div className="flex items-start justify-between">
          {label ? (
            <span
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={{
                background: `${labelAccent}22`,
                color: labelAccent,
                border: `1px solid ${labelAccent}40`,
                backdropFilter: 'blur(8px)',
                fontFamily: 'var(--font-sport)',
              }}
            >
              {label}
            </span>
          ) : <span />}

          {/* Bar indicators */}
          {articles.length > 1 && (
            <div className="flex items-center gap-1.5">
              {articles.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); setCurrent(i) }}
                  style={{
                    width: i === current ? 28 : 8,
                    height: 3,
                    background: i === current ? '#8B5CF6' : 'rgba(255,255,255,0.18)',
                    borderRadius: 2,
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'width 300ms ease, background 300ms ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom: bloque editorial */}
        <div className="max-w-2xl">
          <h1
            className="font-black leading-tight mb-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.85rem, 3.2vw, 3rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.01em',
              textShadow: '0 2px 28px rgba(0,0,0,0.5)',
            }}
          >
            {article.title}
          </h1>

          {article.short_summary && (
            <p
              className="leading-relaxed line-clamp-2 mb-3"
              style={{ fontSize: 'clamp(0.8rem, 1.5vw, 0.9375rem)', color: '#A0A0B8' }}
            >
              {article.short_summary}
            </p>
          )}

          <div className="flex items-center gap-4">
            {article.publishedAt && (
              <span className="text-xs" style={{ color: '#6B6B7B' }}>
                {timeAgo(article.publishedAt)}
              </span>
            )}
            <span
              className="text-xs font-semibold flex items-center gap-1 transition-opacity group-hover:opacity-70"
              style={{ color: '#8B5CF6' }}
            >
              Leer artículo
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>
      </Link>

      {/* Flechas prev/next — z-30 para estar sobre el Link */}
      {articles.length > 1 && current > 0 && (
        <button
          onClick={() => setCurrent(current - 1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-30 transition-opacity hover:opacity-80"
          style={{ background: 'rgba(9,9,15,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8.5 2L4 6.5l4.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {articles.length > 1 && current < articles.length - 1 && (
        <button
          onClick={() => setCurrent(current + 1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-30 transition-opacity hover:opacity-80"
          style={{ background: 'rgba(9,9,15,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M4.5 2L9 6.5l-4.5 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
