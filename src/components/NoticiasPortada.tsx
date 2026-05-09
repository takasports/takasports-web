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

// ── Lead story (izquierda) ─────────────────────────────────────
function LeadStory({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const label = getSportLabel(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(860).height(540).url() : null)

  return (
    <Link
      href={href}
      className="group block"
      style={{ textDecoration: 'none' }}
    >
      {/* Imagen — altura fija para que el título quede visible en el viewport inicial */}
      <div
        className="rounded-xl overflow-hidden mb-4"
        style={{ position: 'relative', width: '100%', height: 'clamp(220px, 28vw, 370px)' }}
      >
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={article.title}
            fill
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            priority
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${accent}40, #0d0d1a)` }}
          />
        )}

        {/* Badge breaking — único overlay permitido */}
        {article.takaStatus === 'breaking' && (
          <div className="absolute top-3 left-3">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded animate-pulse"
              style={{ background: 'rgba(9,9,15,0.85)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)', backdropFilter: 'blur(8px)', fontFamily: 'var(--font-sport)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Breaking
            </span>
          </div>
        )}
        {article.takaStatus === 'featured' && (
          <div className="absolute top-3 left-3">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded"
              style={{ background: 'rgba(9,9,15,0.85)', color: accent, border: `1px solid ${accent}60`, backdropFilter: 'blur(8px)', fontFamily: 'var(--font-sport)' }}
            >
              ⭐ Destacado
            </span>
          </div>
        )}
      </div>

      {/* Texto — fuera de la imagen, completamente legible */}
      <div>
        {label && (
          <span
            className="inline-block text-[10px] font-black uppercase tracking-[0.15em] mb-2"
            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
          >
            {label}
          </span>
        )}

        <h2
          className="font-black leading-[1.1] mb-3 transition-colors group-hover:text-white"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.35rem, 2.2vw, 1.85rem)',
            color: '#EEEEF8',
            letterSpacing: '-0.018em',
          }}
        >
          {article.title}
        </h2>

        {article.short_summary && (
          <p
            className="leading-relaxed line-clamp-3 mb-3"
            style={{ fontSize: '0.9rem', color: '#7070A0', lineHeight: 1.65 }}
          >
            {article.short_summary}
          </p>
        )}

        <div className="flex items-center gap-3">
          {article.publishedAt && (
            <span className="text-[11px]" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>
              {timeAgo(article.publishedAt)}
            </span>
          )}
          <span
            className="text-[11px] font-semibold flex items-center gap-1 transition-all group-hover:gap-2"
            style={{ color: accent, fontFamily: 'var(--font-sport)' }}
          >
            Leer
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5h7M5.5 2L8.5 5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Artículo secundario (columna derecha) ──────────────────────
function SecondaryStory({ article, showDivider }: { article: Article; showDivider: boolean }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const label = getSportLabel(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(180).height(120).url() : null)

  return (
    <>
      {showDivider && (
        <div style={{ height: 1, background: 'var(--border)', margin: '0 0 14px 0' }} />
      )}
      <Link
        href={href}
        className="group flex gap-3 items-start"
        style={{ textDecoration: 'none', marginBottom: 14 }}
      >
        {/* Texto — izquierda (convención periódico: texto primario) */}
        <div className="flex-1 min-w-0">
          {label && (
            <span
              className="inline-block text-[9px] font-black uppercase tracking-[0.14em] mb-1"
              style={{ color: accent, fontFamily: 'var(--font-sport)' }}
            >
              {label}
            </span>
          )}
          <h3
            className="font-bold leading-snug line-clamp-2 mb-1 transition-colors group-hover:text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(0.82rem, 1.1vw, 0.93rem)',
              color: '#CCCCE0',
              letterSpacing: '-0.01em',
            }}
          >
            {article.takaStatus === 'breaking' && (
              <span style={{ color: '#ef4444', marginRight: 4 }}>●</span>
            )}
            {article.title}
          </h3>
          {article.short_summary && (
            <p className="line-clamp-1 mb-1" style={{ fontSize: '0.75rem', color: '#48485E', lineHeight: 1.55 }}>
              {article.short_summary}
            </p>
          )}
          {article.publishedAt && (
            <span className="text-[9px]" style={{ color: '#2E2E46', fontFamily: 'var(--font-sport)' }}>
              {timeAgo(article.publishedAt)}
            </span>
          )}
        </div>

        {/* Miniatura — derecha (imagen como soporte, no protagonista) */}
        {imgUrl && (
          <div
            className="flex-shrink-0 rounded-lg overflow-hidden"
            style={{ width: 72, height: 52, marginTop: 2 }}
          >
            <Image
              src={imgUrl}
              alt={article.title}
              width={72}
              height={52}
              className="w-full h-full object-cover transition-opacity group-hover:opacity-80"
            />
          </div>
        )}
      </Link>
    </>
  )
}

// ── Artículo de la fila inferior (horizontal) ──────────────────
function BottomStory({ article }: { article: Article }) {
  const href = `/noticias/${article.slug ?? article._id}`
  const { accent } = getSportStyle(article.sport, article.category)
  const label = getSportLabel(article.sport, article.category)
  const imgUrl = article.imageUrl ?? (article.image?.asset ? urlFor(article.image).width(300).height(180).url() : null)

  return (
    <Link
      href={href}
      className="group flex gap-3 items-start rounded-xl p-3 transition-all hover:brightness-110"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', textDecoration: 'none' }}
    >
      {imgUrl && (
        <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 80, height: 58 }}>
          <Image
            src={imgUrl}
            alt={article.title}
            width={80}
            height={58}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {label && (
          <span className="text-[8px] font-black uppercase tracking-[0.14em]" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
            {label}
          </span>
        )}
        <h3
          className="font-bold leading-snug line-clamp-2 mt-0.5 transition-colors group-hover:text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: '#B0B0C8', letterSpacing: '-0.01em' }}
        >
          {article.title}
        </h3>
        {article.publishedAt && (
          <p className="text-[9px] mt-1" style={{ color: '#2E2E46', fontFamily: 'var(--font-sport)' }}>
            {timeAgo(article.publishedAt)}
          </p>
        )}
      </div>
    </Link>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function NoticiasPortada({ articles }: { articles: Article[] }) {
  const safe = articles.filter(Boolean)
  if (safe.length === 0) return null

  const lead = safe[0]
  const secondary = safe.slice(1, 5)   // 4 en columna derecha
  const bottom = safe.slice(5, 9)      // hasta 4 en fila inferior

  return (
    <div className="mb-8">

      {/* ── GRID PRINCIPAL ── */}
      <div className="grid grid-cols-1 gap-0 items-start lg:grid-cols-[58%_1px_1fr]">

        {/* Columna izquierda: lead story */}
        <div className="lg:pr-7 pb-6 lg:pb-0">
          <LeadStory article={lead} />
        </div>

        {/* Separador vertical desktop */}
        <div
          className="hidden lg:block self-stretch"
          style={{ background: 'var(--border)', width: 1 }}
        />

        {/* Columna derecha: 4 secundarios */}
        {secondary.length > 0 && (
          <div className="lg:pl-7 pt-6 lg:pt-0">
            {secondary.map((article, i) => (
              <SecondaryStory key={article._id} article={article} showDivider={i > 0} />
            ))}
          </div>
        )}
      </div>

      {/* ── FILA INFERIOR ── */}
      {bottom.length > 0 && (
        <div
          className="mt-4 pt-4 grid gap-2"
          style={{
            borderTop: '1px solid var(--border)',
            gridTemplateColumns: `repeat(${Math.min(bottom.length, 4)}, 1fr)`,
          }}
        >
          {bottom.map((article) => (
            <BottomStory key={article._id} article={article} />
          ))}
        </div>
      )}

    </div>
  )
}
