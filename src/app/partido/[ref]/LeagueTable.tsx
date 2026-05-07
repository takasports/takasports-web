'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { LeagueTableRow } from '@/app/api/match/[ref]/route'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 mb-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-4"
        style={{ color: '#4A4A5A', fontFamily: 'var(--font-sport)' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

export function LeagueTableBlock({
  rows,
  leagueLabel,
  leagueSlug,
}: {
  rows: LeagueTableRow[]
  leagueLabel: string
  leagueSlug: string
}) {
  const router = useRouter()

  const highlightedIdxs = rows.reduce<number[]>((acc, r, i) => {
    if (r.highlight) acc.push(i)
    return acc
  }, [])
  const minI = highlightedIdxs.length ? Math.max(0, Math.min(...highlightedIdxs) - 3) : 0
  const maxI = highlightedIdxs.length ? Math.min(rows.length - 1, Math.max(...highlightedIdxs) + 3) : rows.length - 1
  const visible = rows.slice(minI, maxI + 1)
  const showAll = visible.length >= rows.length

  return (
    <Section title={`Clasificación · ${leagueLabel}`}>
      <div className="flex gap-3 mb-3 flex-wrap">
        {rows.filter(r => r.highlight).map(r => (
          <div key={r.name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{
              background: r.highlight === 'home' ? 'rgba(129,140,248,0.10)' : 'rgba(245,158,11,0.10)',
              border: `1px solid ${r.highlight === 'home' ? 'rgba(129,140,248,0.25)' : 'rgba(245,158,11,0.25)'}`,
            }}>
            {r.logo && (
              <Image src={r.logo} alt={r.name} width={16} height={16} unoptimized style={{ objectFit: 'contain' }} />
            )}
            <span className="text-[10px] font-black"
              style={{ color: r.highlight === 'home' ? '#818cf8' : '#f59e0b', fontFamily: 'var(--font-sport)' }}>
              {r.abbr || r.name}
            </span>
            <span className="text-[10px] font-black"
              style={{ color: r.highlight === 'home' ? '#818cf8' : '#f59e0b', fontFamily: 'var(--font-display)' }}>
              {r.rank}º · {r.pts} pts
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[10px]"
          style={{ fontFamily: 'var(--font-sport)', borderCollapse: 'separate', borderSpacing: '0 1px' }}>
          <thead>
            <tr style={{ color: '#3A3A5A' }}>
              <th className="text-left font-semibold pb-2 w-5">#</th>
              <th className="text-left font-semibold pb-2">Equipo</th>
              <th className="text-center font-semibold pb-2 px-1 w-7">PJ</th>
              <th className="text-center font-semibold pb-2 px-1 w-7">V</th>
              <th className="text-center font-semibold pb-2 px-1 w-7">E</th>
              <th className="text-center font-semibold pb-2 px-1 w-7">D</th>
              <th className="text-center font-semibold pb-2 px-1 w-8">DG</th>
              <th className="text-center font-black pb-2 px-1 w-8" style={{ color: '#9090A8' }}>PTS</th>
            </tr>
          </thead>
          <tbody>
            {minI > 0 && (
              <tr>
                <td colSpan={8} className="py-1 text-center text-[9px]" style={{ color: '#2A2A3A' }}>···</td>
              </tr>
            )}
            {visible.map((row) => {
              const isHome = row.highlight === 'home'
              const isAway = row.highlight === 'away'
              const accent = isHome ? '#818cf8' : isAway ? '#f59e0b' : undefined
              const teamHref = row.teamId ? `/equipo/${leagueSlug.replace('/', '_')}_${row.teamId}` : undefined
              return (
                <tr
                  key={row.rank}
                  style={{
                    background: accent ? `${accent}0e` : 'transparent',
                    cursor: teamHref ? 'pointer' : 'default',
                  }}
                  onClick={teamHref ? () => router.push(teamHref) : undefined}
                >
                  <td className="py-1.5 pl-1 tabular-nums"
                    style={{ color: accent ?? '#3A3A5A', fontWeight: accent ? 900 : 600 }}>
                    {row.rank}
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      {row.logo && (
                        <Image src={row.logo} alt={row.name} width={14} height={14} unoptimized
                          style={{ objectFit: 'contain', flexShrink: 0 }} />
                      )}
                      <span className="font-black truncate"
                        style={{ color: accent ?? '#C0C0D4', maxWidth: 120 }}>
                        {row.abbr || row.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-center tabular-nums py-1.5" style={{ color: '#6A6A7A' }}>{row.gp}</td>
                  <td className="text-center tabular-nums py-1.5" style={{ color: '#6A6A7A' }}>{row.w}</td>
                  <td className="text-center tabular-nums py-1.5" style={{ color: '#6A6A7A' }}>{row.d}</td>
                  <td className="text-center tabular-nums py-1.5" style={{ color: '#6A6A7A' }}>{row.l}</td>
                  <td className="text-center tabular-nums py-1.5" style={{ color: '#6A6A7A' }}>
                    {row.gd >= 0 ? `+${row.gd}` : row.gd}
                  </td>
                  <td className="text-center font-black tabular-nums py-1.5"
                    style={{ color: accent ?? '#E0E0F0' }}>
                    {row.pts}
                  </td>
                </tr>
              )
            })}
            {!showAll && maxI < rows.length - 1 && (
              <tr>
                <td colSpan={8} className="py-1 text-center text-[9px]" style={{ color: '#2A2A3A' }}>···</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
