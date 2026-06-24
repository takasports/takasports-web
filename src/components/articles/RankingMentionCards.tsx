import Link from 'next/link'
import type { MatchedEntry } from '@/lib/rankings-match'

// Cards compactas del Ranking Taka para incrustar en artículos.
// Se renderiza server-side desde la página del artículo cuando el autor
// menciona a un deportista/club/creador del top 500.

export default function RankingMentionCards({ entries }: { entries: MatchedEntry[] }) {
  if (!entries || entries.length === 0) return null

  return (
    <div style={{ maxWidth: 680, margin: '2.5rem 0' }}>
      <p
        className="text-[10px] font-black uppercase tracking-[0.2em] mb-2"
        style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)' }}
      >
        En el Ranking Taka
      </p>
      <div className="space-y-2">
        {entries.map((e) => {
          const delta = e.score_prev != null ? e.score - Number(e.score_prev) : null
          const deltaColor = delta != null && delta >= 0 ? '#22c55e' : '#f87171'
          return (
            <Link
              key={e.id}
              href={`/rankings/${e.id}`}
              className="block rounded-xl overflow-hidden transition-all hover:brightness-110"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid #7C3AED',
                textDecoration: 'none',
              }}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                {e.image_url ? (
                  <img
                    src={e.image_url}
                    alt={e.name}
                    width={40}
                    height={40}
                    style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'rgba(124,58,237,0.18)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold truncate"
                    style={{ color: '#E8E8F0', fontFamily: 'var(--font-sport)' }}
                  >
                    {e.name}
                    {e.rank != null && (
                      <span className="ml-2 text-[10px] font-black" style={{ color: '#8E8E9E' }}>
                        #{e.rank}
                      </span>
                    )}
                  </p>
                  <p
                    className="text-[10px] truncate"
                    style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}
                  >
                    {e.subtitle ?? e.category ?? ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-base font-black tabular-nums"
                    style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}
                  >
                    {e.score.toFixed(1)}
                  </span>
                  {delta != null && Math.abs(delta) >= 0.1 && (
                    <span
                      className="block text-[9px] tabular-nums"
                      style={{ color: deltaColor, fontFamily: 'var(--font-display)' }}
                    >
                      {delta >= 0 ? '+' : ''}
                      {delta.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      <p
        className="text-[9px] mt-2 text-right"
        style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}
      >
        <Link href="/rankings" style={{ color: '#7C3AED' }}>Ver el Ranking completo →</Link>
      </p>
    </div>
  )
}
