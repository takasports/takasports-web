'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { scoreColor } from '@/lib/rankings-ui'
import PlayerAvatar from './PlayerAvatar'

export type SearchHit = {
  id: string
  name: string
  subtitle: string
  sport?: string
  category?: string
  score: number
  rank?: number
  emoji?: string
  image?: string
  country?: string
  badge?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  jugadores: 'Jugadores',
  jugadoras: 'Jugadoras',
  sub21: 'Sub-21',
  latam: 'LATAM',
  concacaf: 'CONCACAF',
  clubes: 'Clubes',
  clubes_femenino: 'Clubes F',
  entrenadores: 'Entrenadores',
  creadores: 'Creadores',
  periodistas: 'Periodistas',
  luchadoras_ufc: 'UFC F',
  creadores_wwe: 'WWE',
}

export default function GlobalSearchResults({ query }: { query: string }) {
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/rankings/search?q=${encodeURIComponent(q)}&limit=40`)
        const data = await r.json()
        if (!cancelled) {
          setHits(Array.isArray(data.hits) ? data.hits : [])
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setHits([])
          setLoading(false)
        }
      }
    }, 220) // debounce 220ms

    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  if (query.trim().length < 2) return null

  return (
    <div className="rounded-2xl mb-6 overflow-hidden"
      style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.18)' }}>
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(124,58,237,0.12)' }}>
        <span className="text-[9px] font-black uppercase tracking-[0.18em]"
          style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
          🔍 Resultados globales · todos los rankings
        </span>
        <span className="text-[9px] tabular-nums" style={{ color: '#5A5A72', fontFamily: 'var(--font-display)' }}>
          {loading ? 'buscando…' : hits ? `${hits.length} ${hits.length === 1 ? 'coincidencia' : 'coincidencias'}` : ''}
        </span>
      </div>

      {!loading && hits && hits.length === 0 && (
        <div className="px-4 py-6 text-center">
          <p className="text-xs" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
            No encontramos a &ldquo;{query}&rdquo; en ningún ranking.
          </p>
        </div>
      )}

      {hits && hits.length > 0 && (
        <div className="flex flex-col">
          {hits.map((h, idx) => {
            const sc = scoreColor(h.score)
            const fallback = h.emoji ?? '🏅'
            return (
              <Link
                key={`${h.id}-${idx}`}
                href={`/rankings/${h.id}`}
                className="flex items-center gap-3 px-4 py-2 transition-all hover:bg-white/[0.03]"
                style={{ borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
              >
                <div className="flex items-center justify-center rounded-lg overflow-hidden flex-shrink-0"
                  style={{ width: 32, height: 32, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)' }}>
                  <PlayerAvatar src={h.image} alt={h.name} fallback={fallback} size={32} rounded="lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold truncate"
                      style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}>
                      {h.name}
                    </span>
                    {h.country && <span className="text-[10px] leading-none">{h.country}</span>}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                    {h.subtitle}
                  </p>
                </div>
                {h.category && (
                  <span className="hidden sm:inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: 'rgba(124,58,237,0.12)',
                      color: '#A78BFA',
                      border: '1px solid rgba(124,58,237,0.2)',
                      fontFamily: 'var(--font-sport)',
                    }}>
                    {CATEGORY_LABELS[h.category] ?? h.category}
                  </span>
                )}
                <div className="flex flex-col items-end flex-shrink-0 ml-1">
                  <span className="font-black tabular-nums text-base leading-none"
                    style={{ fontFamily: 'var(--font-display)', color: sc }}>
                    {h.score.toFixed(1)}
                  </span>
                  {h.rank !== undefined && (
                    <span className="text-[8px] tabular-nums leading-none mt-0.5"
                      style={{ color: '#3A3A52', fontFamily: 'var(--font-display)' }}>
                      #{h.rank}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
