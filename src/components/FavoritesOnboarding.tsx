'use client'

import { useState } from 'react'

// Curated list of popular teams/athletes per sport. Names match what appears in the
// SportEvent.home/away strings from ESPN/Sanity data.
const POPULAR_TEAMS: { name: string; sport: string; icon: string }[] = [
  // Fútbol
  { name: 'Real Madrid',          sport: 'Fútbol', icon: '⚪' },
  { name: 'Barcelona',            sport: 'Fútbol', icon: '🔵' },
  { name: 'Atlético Madrid',      sport: 'Fútbol', icon: '🔴' },
  { name: 'Manchester City',      sport: 'Fútbol', icon: '🩵' },
  { name: 'Liverpool',            sport: 'Fútbol', icon: '🔴' },
  { name: 'Arsenal',              sport: 'Fútbol', icon: '🔴' },
  { name: 'Manchester United',    sport: 'Fútbol', icon: '🔴' },
  { name: 'Chelsea',              sport: 'Fútbol', icon: '🔵' },
  { name: 'Bayern',               sport: 'Fútbol', icon: '🔴' },
  { name: 'PSG',                  sport: 'Fútbol', icon: '🔵' },
  { name: 'Juventus',             sport: 'Fútbol', icon: '⚫' },
  { name: 'Inter',                sport: 'Fútbol', icon: '🔵' },
  // NBA
  { name: 'Lakers',               sport: 'NBA', icon: '🟣' },
  { name: 'Celtics',              sport: 'NBA', icon: '🟢' },
  { name: 'Warriors',             sport: 'NBA', icon: '🔵' },
  { name: 'Bulls',                sport: 'NBA', icon: '🔴' },
  { name: 'Heat',                 sport: 'NBA', icon: '🔥' },
  { name: 'Nuggets',              sport: 'NBA', icon: '🟡' },
  // Tenis
  { name: 'Alcaraz',              sport: 'Tenis', icon: '🎾' },
  { name: 'Sinner',               sport: 'Tenis', icon: '🎾' },
  { name: 'Djokovic',             sport: 'Tenis', icon: '🎾' },
  { name: 'Swiatek',              sport: 'Tenis', icon: '🎾' },
  { name: 'Sabalenka',            sport: 'Tenis', icon: '🎾' },
  // F1
  { name: 'Verstappen',           sport: 'F1', icon: '🏎️' },
  { name: 'Hamilton',             sport: 'F1', icon: '🏎️' },
  { name: 'Leclerc',              sport: 'F1', icon: '🏎️' },
  { name: 'Norris',               sport: 'F1', icon: '🏎️' },
  // UFC / MMA
  { name: 'McGregor',             sport: 'UFC', icon: '🥊' },
  { name: 'Pereira',              sport: 'UFC', icon: '🥊' },
  { name: 'Topuria',              sport: 'UFC', icon: '🥊' },
]

interface Props {
  onClose: () => void
  onSave: (favorites: string[]) => void
}

export default function FavoritesOnboarding({ onClose, onSave }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<string>('Todos')

  const sports = ['Todos', ...Array.from(new Set(POPULAR_TEAMS.map(t => t.sport)))]
  const visibleTeams = filter === 'Todos'
    ? POPULAR_TEAMS
    : POPULAR_TEAMS.filter(t => t.sport === filter)

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleSave = () => {
    onSave(Array.from(selected))
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[199] backdrop-blur-sm"
        style={{ background: 'rgba(0, 0, 0, 0.7)' }}
      />

      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] max-h-[85vh] overflow-y-auto rounded-2xl w-[92vw] sm:w-[520px]"
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,30,0.97) 0%, rgba(15,15,22,0.99) 100%)',
          border: '1px solid rgba(124,58,237,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(124,58,237,0.15)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(124,58,237,0.18)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: '#C4B5FD', fontFamily: 'var(--font-sport)' }}>
                ⭐ Bienvenido
              </p>
              <h2 className="text-lg font-black leading-tight mt-1"
                style={{ color: '#F8F8FF', fontFamily: 'var(--font-display)' }}>
                Elige tus equipos favoritos
              </h2>
              <p className="text-[10px] mt-1" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                Personalizamos tu calendario · puedes cambiarlo después
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all hover:brightness-125"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Saltar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#9090A8" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sport filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-5 py-3" style={{ scrollbarWidth: 'none' }}>
          {sports.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all flex-shrink-0"
              style={{
                background: filter === s ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                color: filter === s ? '#C4B5FD' : '#7A7A8E',
                border: filter === s ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                fontFamily: 'var(--font-sport)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Team grid */}
        <div className="px-5 py-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {visibleTeams.map(team => {
            const active = selected.has(team.name)
            return (
              <button
                key={team.name}
                onClick={() => toggle(team.name)}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all"
                style={{
                  background: active ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                  border: active ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  minHeight: 64,
                }}
              >
                <span className="text-[18px]">{team.icon}</span>
                <span className="text-[9.5px] font-black text-center leading-tight"
                  style={{
                    color: active ? '#E0D0FF' : '#C0C0D8',
                    fontFamily: 'var(--font-sport)',
                  }}>
                  {team.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex items-center justify-between gap-3"
          style={{ borderColor: 'rgba(124,58,237,0.15)' }}>
          <button
            onClick={onClose}
            className="text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)', cursor: 'pointer' }}
          >
            Saltar
          </button>
          <button
            onClick={handleSave}
            disabled={selected.size === 0}
            className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
            style={{
              background: selected.size > 0 ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
              color: selected.size > 0 ? '#E0D0FF' : '#5A5A6A',
              border: selected.size > 0 ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.06)',
              fontFamily: 'var(--font-sport)',
              cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
              boxShadow: selected.size > 0 ? '0 0 14px rgba(124,58,237,0.25)' : 'none',
            }}
          >
            Guardar {selected.size > 0 && `(${selected.size})`}
          </button>
        </div>
      </div>
    </>
  )
}
