'use client'

// Leaderboard unificado del sistema Ranked.
// 4 pestañas: Global (todos los deportes) | Mundial | Fútbol | UFC (pronto)
// Consume /api/ranked/leaderboard?sport=<sport>

import { useState, useEffect, useCallback } from 'react'
import TakaPoint from '@/components/TakaPoint'
import { LeaderboardBadgesRow, LeaderboardTitleLine } from '@/components/badges/LeaderboardBadgeChip'
import type { LeaderboardBadge, LeaderboardEquipment } from '@/lib/leaderboard-badges'

type RankedSport = 'global' | 'mundial' | 'futbol' | 'ufc'

interface RankedEntry {
  user_id:      string
  display_name: string | null
  avatar_url:   string | null
  total:        number
  rank:         number
  badges?:      LeaderboardBadge[]
  equipment?:   LeaderboardEquipment
}

const TABS: { id: RankedSport; label: string; emoji: string; accent: string; available: boolean }[] = [
  { id: 'global',  label: 'Global',        emoji: '⚡', accent: '#A78BFA', available: true },
  { id: 'mundial', label: 'Mundial 2026',  emoji: '🏆', accent: '#FBBF24', available: true },
  { id: 'futbol',  label: 'Ranked Fútbol', emoji: '⚽', accent: '#4ADE80', available: true },
  { id: 'ufc',     label: 'Ranked UFC',    emoji: '🥊', accent: '#F87171', available: false },
]

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  const initials = (name ?? '?').slice(0, 2).toUpperCase()
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ''}
        width={28}
        height={28}
        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 900, color: '#A78BFA', fontFamily: 'var(--font-display)' }}>{initials}</span>
    </div>
  )
}

interface Props {
  activeSport?: 'futbol' | 'ufc' | 'mundial'
}

export default function RankedLeaderboard({ activeSport }: Props) {
  const defaultTab: RankedSport = activeSport === 'mundial' ? 'mundial'
    : activeSport === 'futbol' ? 'futbol'
    : 'global'

  const [tab, setTab]           = useState<RankedSport>(defaultTab)
  const [entries, setEntries]   = useState<RankedEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [hasLive, setHasLive]   = useState(false)  // true si hay partidos en curso
  const [ufcEmail, setUfcEmail]         = useState('')
  const [ufcSubmitted, setUfcSubmitted] = useState(false)
  const [ufcSubmitting, setUfcSubmitting] = useState(false)

  useEffect(() => {
    setTab(defaultTab)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSport])

  const load = useCallback(async (sport: RankedSport) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ranked/leaderboard?sport=${sport}&limit=10`, { cache: 'no-store' })
      if (!res.ok) throw new Error('error')
      const data = await res.json() as { entries: RankedEntry[]; has_live?: boolean }
      setEntries(data.entries ?? [])
      setHasLive(data.has_live ?? false)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(tab)
  }, [tab, load])

  // Auto-refresh cada 60s cuando hay partidos en curso (status=closed = live)
  useEffect(() => {
    if (!hasLive) return
    const id = setInterval(() => { void load(tab) }, 60_000)
    return () => clearInterval(id)
  }, [hasLive, tab, load])

  const activeTabInfo = TABS.find(t => t.id === tab)!
  const accent = activeTabInfo.accent

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-8 mt-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="section-accent" />
        <h2 className="section-label" style={{ color: '#F0F0F8', fontFamily: 'var(--font-sport)' }}>
          RANKING RANKED
        </h2>
      </div>

      {/* Tab pills */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => t.available && setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
            style={{
              background: tab === t.id && t.available
                ? `${t.accent}18`
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${tab === t.id && t.available ? `${t.accent}50` : 'rgba(255,255,255,0.06)'}`,
              color: t.available ? (tab === t.id ? t.accent : 'var(--text-muted)') : '#3A3A52',
              cursor: t.available ? 'pointer' : 'default',
              fontFamily: 'var(--font-sport)',
              opacity: t.available ? 1 : 0.5,
            }}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
            {!t.available && (
              <span className="text-[7px] px-1 py-0.5 rounded-full ml-0.5" style={{ background: 'rgba(255,255,255,0.04)', color: '#3A3A52' }}>
                Pronto
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leaderboard card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${accent}07 0%, rgba(8,0,15,0.55) 100%)`,
          border: `1px solid ${accent}20`,
        }}
      >
        {/* Card header */}
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${accent}12` }}>
          <span style={{ fontSize: 13 }}>{activeTabInfo.emoji}</span>
          <p className="text-[11px] font-black uppercase tracking-widest flex-1" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
            {activeTabInfo.label}
          </p>
          <TakaPoint size={12} />
          <p className="text-[9px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            pts acumulados
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="px-5 py-4 flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-9 rounded-xl animate-pulse" style={{ background: `${accent}06` }} />
            ))}
          </div>
        )}

        {/* UFC waitlist */}
        {!loading && tab === 'ufc' && (
          <div className="px-5 py-8 flex flex-col items-center gap-4">
            <span style={{ fontSize: 32 }}>🥊</span>
            <p className="text-sm font-black" style={{ color: '#F87171', fontFamily: 'var(--font-display)' }}>Ranked UFC</p>
            <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', maxWidth: 220 }}>
              Predicciones por PPV. Muy pronto. Déjanos tu email y te avisamos en el lanzamiento.
            </p>
            {ufcSubmitted ? (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}
              >
                <span style={{ fontSize: 14 }}>✅</span>
                <span className="text-[12px] font-black" style={{ color: '#F87171', fontFamily: 'var(--font-display)' }}>
                  Te avisamos cuando lancemos UFC
                </span>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!ufcEmail.trim() || ufcSubmitting) return
                  setUfcSubmitting(true)
                  try {
                    await fetch('/api/ranked/ufc-waitlist', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ email: ufcEmail.trim() }),
                    })
                    setUfcSubmitted(true)
                  } catch { /* ignore */ } finally {
                    setUfcSubmitting(false)
                  }
                }}
                className="flex gap-2 w-full"
                style={{ maxWidth: 280 }}
              >
                <input
                  type="email"
                  required
                  value={ufcEmail}
                  onChange={e => setUfcEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="flex-1 rounded-xl px-3 py-2 text-[12px] outline-none"
                  style={{
                    background: 'rgba(248,113,113,0.07)',
                    border: '1px solid rgba(248,113,113,0.22)',
                    color: '#F0F0F8',
                    fontFamily: 'var(--font-sport)',
                  }}
                />
                <button
                  type="submit"
                  disabled={ufcSubmitting}
                  className="px-3 py-2 rounded-xl text-[11px] font-black transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{
                    background: 'rgba(248,113,113,0.15)',
                    border: '1px solid rgba(248,113,113,0.35)',
                    color: '#F87171',
                    fontFamily: 'var(--font-display)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {ufcSubmitting ? '…' : 'Avisarme'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Empty */}
        {!loading && tab !== 'ufc' && entries.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-[12px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              Nadie en el ranking todavía · Sé el primero
            </p>
          </div>
        )}

        {/* Rows */}
        {!loading && entries.length > 0 && (
          <div className="px-4 py-3 flex flex-col gap-1">
            {entries.map((e, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              const isTop = i < 3
              const eq          = e.equipment
              const frameColor  = eq?.frame?.color
              const cardBg      = eq?.card_bg?.gradient
              const equipBadge  = eq?.badge
              const title       = eq?.title

              // Background priority: equipped card_bg > top-3 accent > base
              const rowBg = cardBg
                ? cardBg
                : isTop ? `${accent}08` : 'rgba(255,255,255,0.015)'
              // Border priority: equipped frame > top-3 accent > none
              const rowBorder = frameColor
                ? `1px solid ${frameColor}`
                : isTop ? `1px solid ${accent}18` : '1px solid transparent'

              return (
                <div
                  key={e.user_id ?? i}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: rowBg, border: rowBorder }}
                >
                  <span style={{ fontSize: 11, fontWeight: 900, width: 20, textAlign: 'center', color: isTop ? accent : '#4A4A6A', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                    {medal ?? `${e.rank}`}
                  </span>
                  <Avatar url={e.avatar_url} name={e.display_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-black" style={{ color: isTop ? '#F0F0F8' : '#8A8AAA', fontFamily: 'var(--font-display)' }}>
                        {e.display_name ?? 'Anónimo'}
                      </span>
                      <LeaderboardBadgesRow badges={e.badges} equippedBadge={equipBadge} />
                    </div>
                    <LeaderboardTitleLine title={title} />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <TakaPoint size={11} />
                    <span className="text-[12px] font-black tabular-nums" style={{ color: isTop ? accent : '#6A6A8A', fontFamily: 'var(--font-display)' }}>
                      {e.total.toLocaleString('es-ES')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
