import type { Metadata } from 'next'
import { createClient } from '@sanity/client'
import ScrollToTop from '@/components/ScrollToTop'
import ArchivoContent from '@/components/ArchivoContent'
import type { ArchivoFilterState } from '@/components/ArchivoFilters'
import { presetToRange, VALID_PRESETS, type DateRangePreset } from '@/lib/archivo'
import { SITE_URL } from '@/lib/constants'

export const revalidate = 60

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sport?: string; rango?: string; from?: string; to?: string }>
}): Promise<Metadata> {
  const sp = await searchParams
  const q = sp.q?.trim().slice(0, 60)
  const sport = sp.sport?.trim().slice(0, 20)
  const parts: string[] = []
  if (q) parts.push(`"${q}"`)
  if (sport) parts.push(sport)
  if (sp.from || sp.to) parts.push(`${sp.from ?? '…'} → ${sp.to ?? '…'}`)
  const suffix = parts.length ? ` — ${parts.join(' · ')}` : ''
  const title = `Archivo de noticias${suffix} | TakaSports`
  const description = q || sport
    ? `Resultados del archivo de noticias deportivas filtrados${q ? ` por "${q}"` : ''}${sport ? ` en ${sport}` : ''}.`
    : 'Busca y filtra todo el archivo histórico de noticias deportivas de TakaSports por palabra clave, deporte y rango de fechas.'
  // Canonical apunta a /archivo limpio: las combinaciones filtradas no deben generar URLs canónicas únicas
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/archivo` },
    robots: q || sport || sp.from || sp.to
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2024-01-01',
  useCdn: true,
})

const BASE_FILTER = `_type == "article" && (status == "publicado" || (defined(headline) && !(_id in path('drafts.**'))))`
const PAGE_SIZE = 24

interface SsrArticle {
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

function sanitizeQuery(raw?: string): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[*?"\\]/g, ' ').trim().slice(0, 80)
  return cleaned ? `${cleaned}*` : undefined
}

function isValidDate(d?: string): string | undefined {
  if (!d) return undefined
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(d) ? d : undefined
}

export default async function ArchivoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sport?: string; rango?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const presetRaw = (sp.rango ?? 'todo') as DateRangePreset
  const preset = VALID_PRESETS.includes(presetRaw) ? presetRaw : 'todo'

  const initialFilters: ArchivoFilterState = {
    q: (sp.q ?? '').slice(0, 80),
    sport: sp.sport ?? '',
    preset,
    from: isValidDate(sp.from) ?? '',
    to: isValidDate(sp.to) ?? '',
  }

  // Construir filtros GROQ para la primera carga (mismo patrón que /api/articles)
  const range = presetToRange(preset, { from: initialFilters.from, to: initialFilters.to })
  const groqParts = [BASE_FILTER]
  const params: Record<string, string> = {}
  if (initialFilters.sport) {
    groqParts.push(`(sport == $sport || competition == $sport)`)
    params.sport = initialFilters.sport
  }
  if (range.from) {
    groqParts.push(`publishedAt >= $from`)
    params.from = `${range.from}T00:00:00.000Z`
  }
  if (range.to) {
    groqParts.push(`publishedAt <= $to`)
    params.to = `${range.to}T23:59:59.999Z`
  }
  const q = sanitizeQuery(initialFilters.q)
  if (q) {
    groqParts.push(`(title match $q || headline match $q || short_summary match $q || metaDescription match $q)`)
    params.q = q
  }
  const filterClause = groqParts.join(' && ')

  const dataQuery = `*[${filterClause}] | order(publishedAt desc)[0...${PAGE_SIZE}] {
    _id,
    "slug": slug.current,
    "title": select(defined(headline) => headline, title),
    "short_summary": select(defined(headline) => metaDescription, short_summary),
    "imageUrl": select(defined(headline) => imageUrl, null),
    "image": select(defined(headline) => mainImage, image),
    publishedAt,
    sport,
    "category": select(defined(headline) => competition, category)
  }`
  const countQuery = `count(*[${filterClause}])`

  let articles: SsrArticle[] = []
  let total = 0
  try {
    const [a, t] = await Promise.all([
      sanity.fetch<SsrArticle[]>(dataQuery, params),
      sanity.fetch<number>(countQuery, params),
    ])
    articles = a
    total = t
  } catch {
    // En fallo de Sanity dejamos vacío; el cliente puede reintentar mediante el filtro.
  }

  const initialHasMore = articles.length < total

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      <div className="max-w-[1440px] mx-auto pb-24">
        <div className="px-4 sm:px-6 xl:px-10 pt-8 pb-2">
          <h1
            className="font-black leading-none"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              color: '#F2F2FA',
              letterSpacing: '-0.028em',
            }}
          >
            Archivo de noticias
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Busca en todo el histórico por jugador, equipo, deporte o fecha.
          </p>
        </div>

        <ArchivoContent
          initialArticles={articles}
          initialTotal={total}
          initialHasMore={initialHasMore}
          initialFilters={initialFilters}
        />
      </div>

      <ScrollToTop />
    </div>
  )
}
