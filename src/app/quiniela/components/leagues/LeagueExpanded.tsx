'use client'

import { useState, useEffect } from 'react'
import type { League, MatchResult } from '../../lib/types'
import { scoreForMember } from '../../lib/helpers'
import { LeagueChat } from './LeagueChat'

interface ServerMember { nickname: string; picks: Record<number, string> }

export function LeagueExpanded({ league, localResults }: { league: League; localResults: MatchResult[] }) {
  const [members, setMembers] = useState<ServerMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/quiniela/leagues?id=${league.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.members) setMembers(data.members) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [league.id])

  const ranked = [...members]
    .map(m => ({ name: m.nickname, pts: scoreForMember(m.picks, localResults) }))
    .sort((a, b) => b.pts - a.pts)

  const hasResults = localResults.length > 0

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#3A3A58', fontFamily: 'var(--font-sport)' }}>
        Ranking
      </p>

      {loading && (
        <div className="flex flex-col gap-1 mb-3">
          {[0,1,2].map(i => (
            <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
          ))}
        </div>
      )}

      {!loading && ranked.length === 0 && (
        <p className="text-[10px] mb-3" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          Nadie ha enviado picks todavía. Sé el primero.
        </p>
      )}

      {!loading && ranked.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {ranked.map((r, pos) => {
            const isMe = r.name === 'Tú'
            const gold = pos === 0
            return (
              <div key={r.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                style={{
                  background: gold ? 'rgba(245,158,11,0.08)' : isMe ? 'rgba(124,58,237,0.07)' : 'rgba(255,255,255,0.025)',
                  border: gold ? '1px solid rgba(245,158,11,0.2)' : isMe ? '1px solid rgba(124,58,237,0.18)' : '1px solid transparent',
                }}
              >
                <span className="text-[10px] font-black tabular-nums w-4" style={{ color: gold ? '#fbbf24' : '#3A3A58', fontFamily: 'var(--font-sport)' }}>
                  {pos + 1}
                </span>
                <span className="flex-1 text-[11px] font-bold" style={{ color: gold || isMe ? '#F0F0F5' : '#8080A0', fontFamily: 'var(--font-display)' }}>
                  {r.name}{isMe && <span style={{ color: '#A78BFA', marginLeft: 4, fontSize: 8 }}>tú</span>}
                </span>
                <span className="text-[11px] font-black tabular-nums" style={{ color: gold ? '#fbbf24' : isMe ? '#A78BFA' : '#5A5A7A', fontFamily: 'var(--font-display)' }}>
                  {hasResults ? `${r.pts} pts` : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!hasResults && (
        <p className="text-[9px] mb-2" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
          Los puntos aparecerán cuando terminen los partidos.
        </p>
      )}

      <LeagueChat leagueId={league.id} />
    </div>
  )
}
