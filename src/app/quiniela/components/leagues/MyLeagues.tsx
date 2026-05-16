'use client'

import { useState, useEffect } from 'react'
import { COMPETITIONS } from '@/lib/clubs'
import { LEAGUES_KEY } from '../../lib/constants'
import type { League, MatchResult } from '../../lib/types'
import { LeagueExpanded } from './LeagueExpanded'
import { LeagueShareModal } from './LeagueShareModal'

export function MyLeagues({ onCreate }: { onCreate: () => void }) {
  const [leagues, setLeagues] = useState<League[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [results, setResults] = useState<MatchResult[]>([])
  const [shareLeague, setShareLeague] = useState<League | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LEAGUES_KEY)
      if (raw) setLeagues(JSON.parse(raw))
    } catch { /* ignore */ }
    fetch('/api/quiniela/results')
      .then(r => r.ok ? r.json() : [])
      .then(setResults)
      .catch(() => {})
  }, [])

  if (leagues.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 gap-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)' }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="3" y="3" width="9" height="9" rx="2" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
            <rect x="16" y="3" width="9" height="9" rx="2" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
            <rect x="3" y="16" width="9" height="9" rx="2" stroke="#7C3AED" strokeWidth="1.5" opacity="0.5" />
            <rect x="16" y="16" width="9" height="9" rx="2" fill="#7C3AED" stroke="#7C3AED" strokeWidth="1.5" opacity="0.7" />
          </svg>
        </div>
        <div>
          <p className="font-black text-base mb-1" style={{ color: '#C0C0D8', fontFamily: 'var(--font-display)' }}>
            Aún no tienes ligas
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Crea una liga privada y elige tus partidos.
            <br />Invita a amigos y compite.
          </p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest transition-opacity hover:opacity-85"
          style={{
            background: 'linear-gradient(135deg,#7C3AED,#5B21B6)',
            color: '#fff', fontSize: 12,
            fontFamily: 'var(--font-sport)',
            letterSpacing: '0.09em',
            boxShadow: '0 6px 24px rgba(124,58,237,0.38)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Crear liga
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          {leagues.length} liga{leagues.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest"
          style={{ color: '#7C3AED', fontFamily: 'var(--font-sport)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          + Nueva liga
        </button>
      </div>

      {shareLeague && (
        <LeagueShareModal leagueId={shareLeague.id} leagueName={shareLeague.name} onClose={() => setShareLeague(null)} />
      )}

      {leagues.map((l) => {
        const comp = COMPETITIONS.find(c => c.id === l.competitionId)
        const picksCount = Object.keys(l.picks).length
        const isExpanded = expandedId === l.id
        return (
          <div key={l.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {/* Header clickable */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : l.id)}
              className="w-full flex items-start justify-between gap-3 p-5 text-left transition-opacity hover:opacity-90"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm mb-0.5" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>{l.name}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                  {comp?.emoji} {comp?.name} · {l.matchIds.length} partidos
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {l.submitted ? (
                  <span className="text-[9px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)', fontFamily: 'var(--font-sport)' }}>
                    Enviada
                  </span>
                ) : (
                  <span className="text-[9px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)', fontFamily: 'var(--font-sport)' }}>
                    {picksCount}/{l.matchIds.length} picks
                  </span>
                )}
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.22s', color: '#3A3A5A', flexShrink: 0 }}
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>

            {/* Detalle expandido */}
            {isExpanded && (
              <div className="px-5 pb-5">
                <LeagueExpanded league={l} localResults={results} />
                <div className="flex items-center gap-2 mt-4">
                  <button
                    className="flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(124,58,237,0.1)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)' }}
                  >
                    Ver picks
                  </button>
                  <button
                    onClick={() => setShareLeague(l)}
                    aria-label={`Compartir liga ${l.name}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(124,58,237,0.08)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.22)', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <rect x="2" y="2" width="4" height="4" stroke="currentColor" strokeWidth="1.4" />
                      <rect x="8" y="2" width="4" height="4" stroke="currentColor" strokeWidth="1.4" />
                      <rect x="2" y="8" width="4" height="4" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M8 8h2M8 11h2M11 8v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    Compartir · QR
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
