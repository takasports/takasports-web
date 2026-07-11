'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { RosterPlayer } from '@/app/api/team/[slug]/route'

type SortKey = 'jersey' | 'goals' | 'assists' | 'gamesPlayed'

const POS_ORDER: Record<string, number> = { GK: 0, G: 0, P: 0, DF: 1, D: 1, MF: 2, M: 2, FW: 3, F: 3 }
const POS_LABEL: Record<string, string> = {
  GK: 'Porteros', G: 'Porteros', P: 'Porteros',
  DF: 'Defensas', D: 'Defensas',
  MF: 'Centrocampistas', M: 'Centrocampistas',
  FW: 'Delanteros', F: 'Delanteros',
}

function PlayerRow({ player, leagueSlug }: { player: RosterPlayer; leagueSlug: string }) {
  const href = player.id ? `/jugador/${leagueSlug.replaceAll('/', '_')}_${player.id}` : undefined
  const inner = (
    <div
      className={`flex items-center gap-3 py-2.5 px-4 rounded-xl mb-1 hover:bg-white/5 transition-all${href ? ' cursor-pointer' : ''}`}
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)' }}
    >
      <div
        className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.25)' }}
      >
        {player.headshot ? (
          <Image src={player.headshot} alt={player.name} width={32} height={32} unoptimized
            style={{ objectFit: 'cover', borderRadius: '50%' }} />
        ) : (
          <span className="text-[11px] font-black text-[#C4B5FD]" style={{ fontFamily: 'var(--font-sport)' }}>
            {player.jersey ?? player.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="w-0 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-white truncate">{player.name}</div>
        {player.nationality && (
          <div className="text-[11px] text-[var(--text-muted)]">{player.nationality}</div>
        )}
      </div>
      {player.age && (
        <div className="hidden sm:block text-[11px] text-[var(--text-muted)] w-8 text-right flex-shrink-0">
          {player.age}a
        </div>
      )}
      <div className="flex gap-3 flex-shrink-0">
        {player.posAbbr !== 'GK' && player.posAbbr !== 'G' && player.posAbbr !== 'P' ? (
          <>
            <div className="text-center w-8">
              <div className="text-[13px] font-black text-white">{player.goals}</div>
              <div className="text-[9px] text-[var(--text-muted)] uppercase">Gol</div>
            </div>
            <div className="text-center w-8">
              <div className="text-[13px] font-black text-white">{player.assists}</div>
              <div className="text-[9px] text-[var(--text-muted)] uppercase">Ast</div>
            </div>
          </>
        ) : (
          <div className="text-center w-16">
            <div className="text-[11px] text-[var(--text-muted)]">Portero</div>
          </div>
        )}
        <div className="text-center w-8">
          <div className="text-[13px] font-black text-white">{player.gamesPlayed}</div>
          <div className="text-[9px] text-[var(--text-muted)] uppercase">PJ</div>
        </div>
      </div>
    </div>
  )
  return href ? <Link href={href} prefetch={false}>{inner}</Link> : inner
}

function SortBtn({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-black uppercase tracking-widest w-8 text-center cursor-pointer select-none transition-colors"
      style={{
        color: active ? '#C4B5FD' : '#3A3A4A',
        fontFamily: 'var(--font-sport)',
        background: 'none',
        border: 'none',
      }}
    >
      {label}
      {active && <span className="ml-0.5">↓</span>}
    </button>
  )
}

export function RosterTab({ roster, leagueSlug }: { roster: RosterPlayer[]; leagueSlug: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('jersey')

  if (roster.length === 0) {
    return <div className="text-center py-10 text-[var(--text-muted)] text-sm">Sin datos de plantilla</div>
  }

  const groups: Record<string, RosterPlayer[]> = {}
  for (const p of roster) {
    const abbr = p.posAbbr
    const order = POS_ORDER[abbr] ?? 9
    const key = `${order}:${POS_LABEL[abbr] ?? p.position}`
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  }
  const sortedGroups = Object.entries(groups).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))

  function sortPlayers(players: RosterPlayer[]) {
    if (sortKey === 'jersey') return [...players].sort((a, b) => Number(a.jersey ?? 99) - Number(b.jersey ?? 99))
    return [...players].sort((a, b) => (Number(b[sortKey] ?? 0)) - (Number(a[sortKey] ?? 0)))
  }

  function toggle(key: SortKey) {
    setSortKey(prev => prev === key ? 'jersey' : key)
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-4 pb-2 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="w-8 flex-shrink-0" />
        <div className="w-6 flex-shrink-0" />
        <div className="flex-1 text-[10px] uppercase tracking-widest text-[#3A3A4A]">Jugador</div>
        <div className="hidden sm:block w-8 text-right text-[10px] uppercase tracking-widest text-[#3A3A4A] flex-shrink-0">Edad</div>
        <div className="flex gap-3 flex-shrink-0">
          <SortBtn label="Gol" active={sortKey === 'goals'} onClick={() => toggle('goals')} />
          <SortBtn label="Ast" active={sortKey === 'assists'} onClick={() => toggle('assists')} />
          <SortBtn label="PJ" active={sortKey === 'gamesPlayed'} onClick={() => toggle('gamesPlayed')} />
        </div>
      </div>
      {sortedGroups.map(([key, players]) => {
        const label = key.split(':').slice(1).join(':')
        return (
          <div key={key} className="mb-5">
            <div
              className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] px-4 py-2"
              style={{ fontFamily: 'var(--font-sport)' }}
            >
              {label}
            </div>
            {sortPlayers(players).map(p => <PlayerRow key={p.id} player={p} leagueSlug={leagueSlug} />)}
          </div>
        )
      })}
    </div>
  )
}
