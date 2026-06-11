import Link from 'next/link'
import Image from 'next/image'
import type { ScorerRow } from '@/lib/espn-standings'

// Tabla de máximos goleadores (Pichichi) de una competición. Cada jugador
// enlaza a su ficha /jugador. Presentacional (server component) — datos vía
// fetchTopScorers (lib/espn-standings). Coste $0.
export function TopScorers({
  scorers,
  espnSlug,
  title = 'Máximos goleadores',
}: {
  scorers: ScorerRow[]
  /** Slug ESPN ('soccer/esp.1') para construir el enlace /jugador. */
  espnSlug: string
  title?: string
}) {
  if (!scorers.length) return null
  const leaguePart = espnSlug.replace('/', '_')

  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-4"
        style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
        {title}
      </p>
      <ul className="flex flex-col">
        {scorers.map((s, i) => {
          const href = `/jugador/${leaguePart}_${s.playerId}`
          const accent = i === 0 ? '#FCD34D' : i === 1 ? '#D1D5DB' : i === 2 ? '#D97706' : 'var(--text-muted)'
          return (
            <li key={s.playerId}>
              <Link
                href={href}
                className="flex items-center gap-3 py-2 rounded-lg transition-colors hover:bg-white/[0.03]"
              >
                <span className="w-5 text-center font-black tabular-nums flex-shrink-0"
                  style={{ color: accent, fontFamily: 'var(--font-display)', fontSize: 13 }}>
                  {s.rank}
                </span>
                {s.teamLogo ? (
                  <Image src={s.teamLogo} alt="" width={18} height={18} unoptimized
                    style={{ objectFit: 'contain', flexShrink: 0 }} />
                ) : (
                  <span className="w-[18px] h-[18px] flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black truncate"
                    style={{ color: '#D8D8EC', fontFamily: 'var(--font-sport)' }}>
                    {s.name}
                  </p>
                  {(s.matches != null || s.assists != null) && (
                    <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                      {[s.matches != null ? `${s.matches} PJ` : null,
                        s.assists != null ? `${s.assists} asist.` : null]
                        .filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-baseline gap-1 flex-shrink-0">
                  <span className="font-black tabular-nums"
                    style={{ color: '#A78BFA', fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1 }}>
                    {s.goals}
                  </span>
                  <span className="text-[9px] font-black uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                    {s.goals === 1 ? 'gol' : 'goles'}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
