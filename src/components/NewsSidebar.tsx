import Link from 'next/link'
import { getSportStyle, SLUG_TO_LABEL } from '@/lib/sports'
import ArticleCard from '@/components/news/ArticleCard'
import { TrophyIcon } from '@/components/icons/GameIcons'
import SectionHeader from '@/components/ui/SectionHeader'

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
          <SectionHeader as="h3" className="mb-3">Tendencias</SectionHeader>
          <div className="flex flex-col gap-1">
            {trending.map((article, i) => (
              <ArticleCard
                key={article._id}
                article={article}
                variant="row"
                size="sm"
                rank={i + 1}
                kicker
                thumb={false}
                fecha={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Por deporte ── */}
      {sportEntries.length > 0 && (
        <div>
          <SectionHeader as="h3" className="mb-3">Por deporte</SectionHeader>
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
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderTop: '1px solid rgba(255,255,255,0.16)',
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
        <SectionHeader as="h3" className="mb-3">Predicciones</SectionHeader>
        <Link
          href="/predicciones"
          className="block p-4 rounded-xl transition-all hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, rgba(167,139,250,0.16) 0%, rgba(76,29,149,0.12) 100%)',
            border: '1px solid rgba(167,139,250,0.28)',
            textDecoration: 'none',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span style={{ display: 'inline-flex', lineHeight: 1, color: '#FBBF24' }}><TrophyIcon size={15} /></span>
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}
            >
              La Jornada
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
            Predicciones de la semana
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
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
