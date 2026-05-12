'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ArchivoFilters, { type ArchivoFilterState } from '@/components/ArchivoFilters'
import { presetToRange, VALID_PRESETS, type DateRangePreset } from '@/lib/archivo'
import ArchivoResults from '@/components/ArchivoResults'

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

function parseUrlState(sp: URLSearchParams): ArchivoFilterState {
  const presetRaw = (sp.get('rango') ?? 'todo') as DateRangePreset
  return {
    q: (sp.get('q') ?? '').slice(0, 80),
    sport: sp.get('sport') ?? '',
    preset: VALID_PRESETS.includes(presetRaw) ? presetRaw : 'todo',
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
  }
}

function stateToUrl(state: ArchivoFilterState): string {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.sport) params.set('sport', state.sport)
  if (state.preset !== 'todo') params.set('rango', state.preset)
  if (state.preset === 'custom') {
    if (state.from) params.set('from', state.from)
    if (state.to) params.set('to', state.to)
  }
  const qs = params.toString()
  return qs ? `/archivo?${qs}` : '/archivo'
}

function buildApiUrl(state: ArchivoFilterState, page: number, pageSize: number): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (state.q) params.set('q', state.q)
  if (state.sport) params.set('sport', state.sport)
  const range = presetToRange(state.preset, { from: state.from, to: state.to })
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  return `/api/articles?${params.toString()}`
}

const PAGE_SIZE = 24

export default function ArchivoContent({
  initialArticles,
  initialTotal,
  initialHasMore,
  initialFilters,
}: {
  initialArticles: Article[]
  initialTotal: number
  initialHasMore: boolean
  initialFilters: ArchivoFilterState
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<ArchivoFilterState>(initialFilters)
  const [articles, setArticles] = useState<Article[]>(initialArticles)
  const [total, setTotal] = useState<number>(initialTotal)
  const [page, setPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const [initialLoading, setInitialLoading] = useState<boolean>(false)

  // Token de petición para evitar race conditions cuando el usuario
  // cambia filtros rápido (debounce de q, click rápido).
  const reqIdRef = useRef(0)
  // Skip el primer effect — usamos los datos del SSR.
  const isFirstRun = useRef(true)

  const applyFilters = useCallback(async (next: ArchivoFilterState) => {
    const myReq = ++reqIdRef.current
    setInitialLoading(true)
    try {
      const res = await fetch(buildApiUrl(next, 1, PAGE_SIZE))
      if (!res.ok) return
      const data = await res.json()
      if (myReq !== reqIdRef.current) return // descartada por una petición más reciente
      setArticles(data.articles ?? [])
      setTotal(data.total ?? 0)
      setHasMore(Boolean(data.hasMore))
      setPage(1)
    } catch { /* silencio */ }
    finally {
      if (myReq === reqIdRef.current) setInitialLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    try {
      const res = await fetch(buildApiUrl(filters, nextPage, PAGE_SIZE))
      if (!res.ok) return
      const data = await res.json()
      const fetched: Article[] = data.articles ?? []
      const seen = new Set(articles.map(a => a._id))
      const fresh = fetched.filter(a => !seen.has(a._id))
      setArticles(prev => [...prev, ...fresh])
      setPage(nextPage)
      setHasMore(Boolean(data.hasMore))
    } catch { /* silencio */ }
    finally { setLoadingMore(false) }
  }, [loadingMore, hasMore, page, filters, articles])

  // Cuando cambian los filtros (excepto en el primer render), actualizar URL y refetch.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    const newUrl = stateToUrl(filters)
    router.replace(newUrl, { scroll: false })
    void applyFilters(filters)
  }, [filters, router, applyFilters])

  // Sincronizar si el usuario navega con back/forward
  useEffect(() => {
    const sp = searchParams
    const parsed = parseUrlState(new URLSearchParams(sp.toString()))
    // Solo actualizar si difiere — evita loops con el effect anterior.
    if (JSON.stringify(parsed) !== JSON.stringify(filters)) {
      setFilters(parsed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleReset = useCallback(() => {
    setFilters({ q: '', sport: '', preset: 'todo', from: '', to: '' })
  }, [])

  return (
    <>
      <ArchivoFilters
        value={filters}
        onChange={setFilters}
        onReset={handleReset}
        resultCount={total}
      />
      <ArchivoResults
        articles={articles}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        initialLoading={initialLoading}
      />
    </>
  )
}
