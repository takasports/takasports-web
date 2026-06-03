import Link from 'next/link'
import { getSportStyle, getSportLabel, SLUG_TO_LABEL } from '@/lib/sports'

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

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span
          style={{ display: 'block', width: 3, height: 14, background: '#7C3AED', borderRadius: 2 }}
        />
        <h3
          className="font-black uppercase tracking-widest text-[11px]"
          style={{ color: '#A0A0B8', fontFamily: 'var(--font-sport)' }}
        >
          {children}
        </h3>
      </div>
      {action}
    </div>
  )
}

export default function NewsSidebar({ articles }: { articles: Article[] }) {
  // Skip los 5 primeros (apertura + 4 cubierta en NoticiasPortada)
  const trending = articles.slice(5, 11)

  // Count por deporte — normaliza aliases al slug canónico antes de contar
  const ALIAS_TO_CANONICAL: Record<string, string> = {
    wrestling: 'wwe',
    nba: 'baloncesto', bcl: 'baloncesto', euroliga: 'baloncesto', acb: 'baloncesto',
  }
  const sportCounts: Record<string, number> = {}
  for (const a of articles) {
    const raw = a.sport?.toLowerCase() ?? ''
    if (!raw) continue
    const slug = ALIAS_TO_CANONICAL[raw] ?? raw
    sportCounts[slug] = (sportCounts[slug] ?? 0) + 1
  }

  // Solo slugs canónicos (sin aliases ni sub-competiciones) para el sidebar
  const CANONICAL_SLUGS = ['futbol', 'wwe', 'formula1', 'baloncesto', 'tenis', 'ufc', 'rugby']
  const sportEntries = CANONICAL_SLUGS
    .map(slug => ({ slug, label: SLUG_TO_LABEL[slug], count: sportCounts[slug] ?? 0 }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count)

  return (
    <div className="flex flex-col gap-6 pt-1">

      {/* ── Tendencias ── */}
      {trending.length > 0 && (
        <div>
          <SectionHeader>Tendencias</SectionHeader>
          <div className="flex flex-col gap-1">
            {trending.map((article, i) => {
              const { accent } = getSportStyle(article.sport, article.category)
              const label = getSportLabel(article.sport, article.category)
              return (
                <Link
                  key={article._id}
                  href={`/noticias/${article.slug ?? article._id}`}
                  className="group flex items-start gap-3 p-2.5 rounded-xl transition-all hover:brightness-110"
                  style={{
                    textDecoration: 'none',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Número */}
                  <span
                    className="font-black text-[20px] leading-none flex-shrink-0 w-5 text-center mt-0.5"
                    style={{
                      fontFamily: 'var(--font-display)',
                      color: i === 0 ? '#7C3AED' : '#2E2E42',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {i + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    {label && (
                      <span
                        className="text-[8px] font-black uppercase tracking-widest"
                        style={{ color: accent, fontFamily: 'var(--font-sport)' }}
                      >
                        {label}
                      </span>
                    )}
                    <p
                      className="text-[12px] font-semibold leading-snug line-clamp-2 transition-opacity group-hover:opacity-75"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {article.title}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Por deporte ── */}
      {sportEntries.length > 0 && (
        <div>
          <SectionHeader>Por deporte</SectionHeader>
          <div className="flex flex-col gap-1">
            {sportEntries.map(({ slug, label, count }) => {
              const { accent } = getSportStyle(slug)
              return (
                <Link
                  key={slug}
                  href={`/noticias?sport=${slug}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all hover:brightness-110"
                  style={{
                    textDecoration: 'none',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${accent}`,
                  }}
                >
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: '#C0C0D4', fontFamily: 'var(--font-sport)' }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{
                      background: `${accent}15`,
                      color: accent,
                      fontFamily: 'var(--font-sport)',
                    }}
                  >
                    {count}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Predicciones Mundial CTA ── */}
      <div>
        <SectionHeader>Predicciones</SectionHeader>
        <Link
          href="/mundial"
          className="block p-4 rounded-xl transition-all hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, rgba(167,139,250,0.16) 0%, rgba(76,29,149,0.12) 100%)',
            border: '1px solid rgba(167,139,250,0.28)',
            textDecoration: 'none',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span style={{ fontSize: 15, lineHeight: 1 }}>🏆</span>
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
            >
              Mundial 2026
            </span>
          </div>
          <p
            className="font-black text-[13px] mb-1"
            style={{
              color: '#E9E2FF',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.01em',
            }}
          >
            Predicciones del Mundial
          </p>
          <p className="text-[11px]" style={{ color: '#6A6288' }}>
            Acierta cada partido y sube en la clasificación Taka
          </p>
          <span
            className="inline-flex items-center gap-1.5 mt-2.5 text-[10px] font-black uppercase tracking-widest"
            style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}
          >
            Jugar
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Link>
      </div>

    </div>
  )
}
