'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { TeamTableRow } from '@/app/api/team/[slug]/route'

export function StandingsTab({
  table,
  leagueSlug,
}: {
  table: TeamTableRow[]
  leagueSlug: string
}) {
  const router = useRouter()

  if (table.length === 0) {
    return <div className="text-center py-10 text-[#5A5A6A] text-sm">Sin datos de clasificación</div>
  }

  return (
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
        <span className="w-8 text-center font-black text-[#5A5A6A]">PTS</span>
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
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              background: isMain ? 'rgba(124,58,237,0.12)' : undefined,
            }}
            onClick={rowHref ? () => router.push(rowHref) : undefined}
          >
            <span
              className="w-6 text-center text-[12px] font-black flex-shrink-0"
              style={{ color: isMain ? '#C4B5FD' : '#5A5A6A', fontFamily: 'var(--font-sport)' }}
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
            <span className="w-7 text-center text-[12px] text-[#5A5A6A]">{row.gp}</span>
            <span className="w-7 text-center text-[12px] text-[#5A5A6A]">{row.w}</span>
            <span className="w-7 text-center text-[12px] text-[#5A5A6A]">{row.d}</span>
            <span className="w-7 text-center text-[12px] text-[#5A5A6A]">{row.l}</span>
            <span
              className="hidden sm:block w-9 text-center text-[12px]"
              style={{ color: row.gd > 0 ? '#22c55e' : row.gd < 0 ? '#ef4444' : '#5A5A6A' }}
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
  )
}
