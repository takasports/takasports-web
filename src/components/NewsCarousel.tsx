'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function NewsCarousel({ articles }: { articles: Article[] }) {
  const items = articles.slice(0, 3)
  const [active, setActive] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)

  const next = useCallback(() => {
    setActive((i) => (i + 1) % items.length)
    setProgress(0)
  }, [items.length])

  const prev = useCallback(() => {
    setActive((i) => (i - 1 + items.length) % items.length)
    setProgress(0)
  }, [items.length])

  const goTo = (i: number) => {
    setActive(i)
    setProgress(0)
  }

  // Progress ticker
  useEffect(() => {
    if (paused) return
    const interval = 50
    const step = (interval / AUTOPLAY_MS) * 100
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          next()
          return 0
        }
        return p + step
      })
    }, interval)
    return () => clearInterval(timer)
  }, [paused, next])

  if (items.length === 0) return null

  const article = items[active]
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const label = getSportLabel(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(560).height(400).url() : null)

  return (
    <div
      className="rounded-2xl overflow-hidden mb-8"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex flex-col lg:flex-row" style={{ minHeight: 260 }}>

        {/* ── Imagen (40%) ── */}
        <div className="relative lg:w-[42%] flex-shrink-0 overflow-hidden" style={{ minHeight: 200 }}>
          {imgUrl ? (
            <Image
              key={article._id}
              src={imgUrl}
              alt={article.title}
              fill
              className="object-cover transition-opacity duration-500"
              priority
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${accent}14 0%, #09090F 100%)` }}
            />
          )}
          {/* Overlay lateral derecho solo en desktop */}
          <div
            className="absolute inset-0 hidden lg:block pointer-events-none"
            style={{ background: 'linear-gradient(to right, transparent 60%, var(--bg-card) 100%)' }}
          />
          {/* Overlay inferior en mobile */}
          <div
            className="absolute inset-0 block lg:hidden pointer-events-none"
            style={{ background: 'linear-gradient(to top, var(--bg-card) 0%, transparent 50%)' }}
          />
        </div>

        {/* ── Texto (60%) ── */}
        <div className="flex-1 flex flex-col justify-between p-6 lg:p-8 lg:pl-6">

          {/* Top: badges + nav */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(124,58,237,0.15)',
                  color: '#C4B5FD',
                  border: '1px solid rgba(124,58,237,0.3)',
                  fontFamily: 'var(--font-sport)',
                }}
              >
                {active + 1} / {items.length}
              </span>
              {label && (
                <span
                  className="text-[8px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full"
                  style={{
                    background: `${accent}15`,
                    color: accent,
                    border: `1px solid ${accent}30`,
                    fontFamily: 'var(--font-sport)',
                  }}
                >
                  {label}
                </span>
              )}
            </div>

            {/* Nav arrows */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={prev}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M7 5H3M4.5 3L3 5l1.5 2" stroke="#A0A0C0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={next}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 5h4M5.5 3L7 5l-1.5 2" stroke="#A0A0C0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Headline */}
          <div className="flex-1 flex flex-col justify-center">
            <Link
              href={href}
              className="group block"
              style={{ textDecoration: 'none' }}
            >
              <h2
                className="font-black leading-tight mb-3 transition-opacity group-hover:opacity-80"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.35rem, 2.2vw, 2rem)',
                  color: '#F8F8FF',
                  letterSpacing: '-0.015em',
                }}
              >
                {article.title}
              </h2>
              {article.short_summary && (
                <p
                  className="text-sm leading-relaxed line-clamp-2 mb-4"
                  style={{ color: '#6A6A84' }}
                >
                  {article.short_summary}
                </p>
              )}
            </Link>
          </div>

          {/* Bottom: meta + dots + progress */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                {article.publishedAt && (
                  <span className="text-[10px]" style={{ color: '#44445A' }}>
                    {timeAgo(article.publishedAt)}
                  </span>
                )}
                <Link
                  href={href}
                  className="text-[11px] font-semibold flex items-center gap-1.5 transition-all hover:gap-2.5"
                  style={{ color: '#8B5CF6', fontFamily: 'var(--font-sport)', textDecoration: 'none' }}
                >
                  Leer nota
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>

              {/* Dots */}
              <div className="flex items-center gap-1.5">
                {items.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    style={{
                      width: i === active ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === active ? '#7C3AED' : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'width 200ms ease, background 200ms ease',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div
              style={{
                height: 2,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: `linear-gradient(to right, #7C3AED, ${accent})`,
                  transition: 'width 50ms linear',
                  borderRadius: 2,
                }}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
