'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { TeamTableRow, StandingZone } from '@/app/api/team/[slug]/route'

const ZONE_COLOR: Record<StandingZone, string> = {
  champions:          '#3b82f6',
  europa:             '#f97316',
  conference:         '#10b981',
  promotion:          '#22c55e',
  promotion_playoff:  '#3b82f6',
  playoffs:           '#3b82f6',
  relegation_playoff: '#f59e0b',
  relegation:         '#ef4444',
}

const ZONE_LABEL: Record<StandingZone, string> = {
  champions:          'Champions League',
  europa:             'Europa League',
  conference:         'Conference League',
  promotion:          'Ascenso',
  promotion_playoff:  'Play-off ascenso',
  playoffs:           'Playoffs',
  relegation_playoff: 'Play-off descenso',
  relegation:         'Descenso',
}

export function StandingsTab({
  table,
  leagueSlug,
}: {
  table: TeamTableRow[]
  leagueSlug: string
}) {
  const router = useRouter()

  if (table.length === 0) {
    return <div className="text-center py-10 text-[var(--text-muted)] text-sm">Sin datos de clasificación</div>
  }

  const usedZones = [...new Set(table.map(r => r.zone).filter((z): z is StandingZone => !!z))]

  return (
    <div>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)' }}>
        <div
          className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-widest text-[#3A3A4A]"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-sport)' }}
        >
          <span className="w-6 text-center">#</span>
          <span className="flex-1">Equipo</span>
          <span className="w-7 text-center">PJ</span>
          <span className="w-7 text-center">V</span>
          <span className="w-7 text-center">E</span>
          <span className="w-7 text-center">D</span>
          <span className="hidden sm:block w-9 text-center">DG</span>
          <span className="w-8 text-center font-black text-[var(--text-muted)]">PTS</span>
        </div>
        {table.map(row => {
          const isMain = row.isMain
          const rowHref = row.teamId && !isMain
            ? `/equipo/${leagueSlug.replace('/', '_')}_${row.teamId}`
            : undefined
          return (
            <div
              key={row.rank}
              className={`flex items-center gap-2 px-4 py-2.5${rowHref ? ' cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
              title={row.zone ? ZONE_LABEL[row.zone] : undefined}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: isMain ? 'rgba(124,58,237,0.12)' : undefined,
                borderLeft: row.zone ? `3px solid ${ZONE_COLOR[row.zone]}` : '3px solid transparent',
              }}
              onClick={rowHref ? () => router.push(rowHref) : undefined}
            >
              <span
                className="w-6 text-center text-[12px] font-black flex-shrink-0"
                style={{ color: isMain ? '#C4B5FD' : 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
              >
                {row.rank}
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {row.logo && (
                  <Image src={row.logo} alt={row.abbr} width={20} height={20} unoptimized
                    style={{ objectFit: 'contain', flexShrink: 0 }} />
                )}
                <span
                  className="text-[12px] font-semibold truncate"
                  style={{ color: isMain ? '#fff' : '#9A9AAA', fontWeight: isMain ? 700 : 400 }}
                >
                  {row.abbr}
                </span>
              </div>
              <span className="w-7 text-center text-[12px] text-[var(--text-muted)]">{row.gp}</span>
              <span className="w-7 text-center text-[12px] text-[var(--text-muted)]">{row.w}</span>
              <span className="w-7 text-center text-[12px] text-[var(--text-muted)]">{row.d}</span>
              <span className="w-7 text-center text-[12px] text-[var(--text-muted)]">{row.l}</span>
              <span
                className="hidden sm:block w-9 text-center text-[12px]"
                style={{ color: row.gd > 0 ? '#22c55e' : row.gd < 0 ? '#ef4444' : 'var(--text-muted)' }}
              >
                {row.gd > 0 ? `+${row.gd}` : row.gd}
              </span>
              <span
                className="w-8 text-center text-[13px] font-black"
                style={{ color: isMain ? '#C4B5FD' : '#fff', fontFamily: 'var(--font-display)' }}
              >
                {row.pts}
              </span>
            </div>
          )
        })}
      </div>
      {usedZones.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 pb-1">
          {usedZones.map(z => (
            <div key={z} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ZONE_COLOR[z] }} />
              <span className="text-[10px] text-[var(--text-muted)]">{ZONE_LABEL[z]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
