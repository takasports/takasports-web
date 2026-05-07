'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SportEvent } from '@/lib/types'
import { getCompAccent, getLiveLabel } from '@/lib/competitions'
import { formatDateLabel, isoToLocalDate } from '@/lib/calendar'

interface LiveScore {
  homeGoals: number | null
  awayGoals: number | null
  status: string
  elapsed: number | null
}

interface UFCCardModalProps {
  date: string // YYYY-MM-DD
  events: SportEvent[]
  liveScores: Map<string, LiveScore>
  reminders: Set<string>
  onToggleReminder: (id: string) => void
  onClose: () => void
}

function ReminderButton({ active, onClick, color = '#D4AF37', size = 'md' }: {
  active: boolean; onClick: () => void; color?: string; size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 24 : 28
  const icon = size === 'sm' ? 11 : 13
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      className="flex items-center justify-center rounded-md transition-all flex-shrink-0"
      style={{
        width: dim, height: dim,
        background: active ? `${color}1F` : 'rgba(255,255,255,0.04)',
        border: active ? `1px solid ${color}55` : '1px solid rgba(255,255,255,0.06)',
      }}
      aria-label={active ? 'Quitar recordatorio' : 'Recordar'}
    >
      <svg width={icon} height={icon} viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5A4.5 4.5 0 003.5 6v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 008 1.5z"
          stroke={active ? color : '#5A5A6A'} strokeWidth="1.3"
          fill={active ? color : 'none'} fillOpacity={active ? 0.25 : 0} />
      </svg>
    </button>
  )
}

function TeamLogo({ logo, photo, name, size = 24, sport }: { logo?: string; photo?: string; name: string; size?: number; sport?: string }) {
  const [err, setErr] = useState(false)
  const displayPhoto = photo && !err

  if (displayPhoto) {
    return (
      <img src={photo} alt={name} width={size} height={size} onError={() => setErr(true)}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }} />
    )
  }

  if (!logo || err) {
    const isMMA = sport ? /mma|ufc|boxing|boxeo/i.test(sport) : false
    return (
      <div className="flex items-center justify-center rounded-full font-black flex-shrink-0"
        style={{
          width: size, height: size,
          fontSize: size * 0.36,
          background: isMMA ? 'rgba(212,175,55,0.14)' : 'rgba(255,255,255,0.06)',
          color: isMMA ? '#D4AF37' : '#7A7A8E',
          border: isMMA ? '1px solid rgba(212,175,55,0.25)' : 'none',
        }}>
        {isMMA ? initials(name) : name.slice(0, 2).toUpperCase()}
      </div>
    )
  }
  return (
    <img src={logo} alt={name} width={size} height={size} onError={() => setErr(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
  )
}

function initials(name: string): string {
  const cleaned = name.replace(/\s*\/\s*/g, ' ').trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function UFCCardModal({
  date, events, liveScores, reminders, onToggleReminder, onClose
}: UFCCardModalProps) {
  const FINISHED = new Set(['FT', 'Final', 'STATUS_FINAL', 'NS'])
  const dateLabel = formatDateLabel(date)
  const liveCount = events.filter(e => {
    const score = liveScores.get(e.id)
    return score && !FINISHED.has(score.status)
  }).length

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[199] backdrop-blur-sm"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
        }}
      />

      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] max-h-[90vh] overflow-y-auto rounded-2xl w-[90vw] sm:w-[600px]"
        style={{
          background: 'linear-gradient(135deg, rgba(20,20,30,0.95) 0%, rgba(15,15,22,0.98) 100%)',
          border: '1px solid rgba(212,175,55,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 px-5 py-4 border-b" style={{ borderColor: 'rgba(212,175,55,0.15)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#D4AF37', fontFamily: 'var(--font-sport)' }}>
                📋 Cartelera UFC
              </p>
              <h2 className="text-lg font-black leading-tight mt-1" style={{ color: '#F8F8FF', fontFamily: 'var(--font-display)' }}>
                {dateLabel}
              </h2>
              <p className="text-[9px] mt-1" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                {events.length} combate{events.length !== 1 ? 's' : ''}
                {liveCount > 0 && <span style={{ color: '#4ade80' }}> · {liveCount} en vivo</span>}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:brightness-125 transition-all"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              aria-label="Cerrar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#C0C0D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-2">
          {events.length === 0 ? (
            <div className="text-center py-8">
              <p style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)', fontSize: 13 }}>
                No hay combates para esta fecha
              </p>
            </div>
          ) : (
            events.map(event => {
              const liveScore = liveScores.get(event.id)
              const isLive = liveScore && !FINISHED.has(liveScore.status)
              const accent = '#D4AF37'

              return (
                <div
                  key={event.id}
                  className="grid gap-3 p-3 rounded-lg transition-all"
                  style={{
                    gridTemplateColumns: '1fr auto 1fr auto',
                    background: isLive ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.025)',
                    borderLeft: `3px solid ${isLive ? '#4ade80' : accent}`,
                  }}
                >
                  {/* Home Luchador */}
                  <div className="flex flex-col items-center gap-1.5 min-w-0">
                    <TeamLogo logo={event.homeLogo} photo={event.homePhoto} name={event.home} size={32} sport={event.sport} />
                    <span className="text-[10px] font-black text-center truncate w-full" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                      {event.home}
                    </span>
                    {event.homeAbbr && (
                      <span className="text-[8px]" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                        {event.homeAbbr}
                      </span>
                    )}
                  </div>

                  {/* Score/vs */}
                  <div className="flex flex-col items-center justify-center flex-shrink-0 px-1 gap-1 min-w-[60px]">
                    {isLive && liveScore ? (
                      <>
                        <span className="text-[11px] font-black" style={{ color: '#4ade80', fontFamily: 'var(--font-display)' }}>
                          {liveScore.homeGoals ?? 0}
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: '#5A5A6A', fontFamily: 'var(--font-sport)' }}>
                          —
                        </span>
                        <span className="text-[11px] font-black" style={{ color: '#4ade80', fontFamily: 'var(--font-display)' }}>
                          {liveScore.awayGoals ?? 0}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-wider mt-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontFamily: 'var(--font-sport)' }}>
                          {getLiveLabel(liveScore.status, liveScore.elapsed, { sport: event.sport, homeScore: liveScore.homeGoals, awayScore: liveScore.awayGoals })}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-bold" style={{ color: '#B0B0C8', fontFamily: 'var(--font-display)' }}>
                          {event.time}
                        </span>
                        <span className="text-[8px]" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                          vs
                        </span>
                      </>
                    )}
                  </div>

                  {/* Away Luchador */}
                  <div className="flex flex-col items-center gap-1.5 min-w-0">
                    <TeamLogo logo={event.awayLogo} photo={event.awayPhoto} name={event.away ?? ''} size={32} sport={event.sport} />
                    <span className="text-[10px] font-black text-center truncate w-full" style={{ color: '#E8E8F4', fontFamily: 'var(--font-sport)' }}>
                      {event.away}
                    </span>
                    {event.awayAbbr && (
                      <span className="text-[8px]" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
                        {event.awayAbbr}
                      </span>
                    )}
                  </div>

                  {/* Reminder Button */}
                  <div className="flex items-center justify-center">
                    <ReminderButton
                      active={reminders.has(event.id)}
                      onClick={() => onToggleReminder(event.id)}
                      color={accent}
                      size="sm"
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 text-center" style={{ borderColor: 'rgba(212,175,55,0.15)' }}>
          <p className="text-[9px]" style={{ color: '#7A7A8E', fontFamily: 'var(--font-sport)' }}>
            Click fuera para cerrar
          </p>
        </div>
      </div>
    </>
  )
}
