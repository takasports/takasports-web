'use client'

// Leaderboard unificado del sistema Ranked.
// 4 pestañas: Global (todos los deportes) | Mundial | Fútbol (pronto) | UFC
// Consume /api/ranked/leaderboard?sport=<sport>

import { useState, useEffect, useCallback, type KeyboardEvent } from 'react'
import TakaPoint from '@/components/TakaPoint'
import { LeaderboardBadgesRow, LeaderboardTitleLine } from '@/components/badges/LeaderboardBadgeChip'
import type { LeaderboardBadge, LeaderboardEquipment } from '@/lib/leaderboard-badges'
import { PlacaRowV3 } from '@/components/placa/PlacaRowV3'
import { buildPlacaData, type ApiEquipment } from '@/components/placa/adapter'
import { RANKED_FUTBOL_ENABLED } from '@/lib/feature-flags'

type RankedSport = 'global' | 'mundial' | 'futbol' | 'ufc'

interface RankedEntry {
  pid:          string
  display_name: string | null
  avatar_url:   string | null
  total:        number
  rank:         number
  level?:       number
  levelName?:   string
  badges?:      LeaderboardBadge[]
  equipment?:   LeaderboardEquipment & ApiEquipment
}

const TABS: { id: RankedSport; label: string; emoji: string; accent: string; available: boolean }[] = [
  { id: 'global',  label: 'Global',        emoji: '⚡', accent: '#A78BFA', available: true },
  { id: 'mundial', label: 'Mundial 2026',  emoji: '🏆', accent: '#FBBF24', available: true },
  { id: 'futbol',  label: 'Ranked Fútbol', emoji: '⚽', accent: '#4ADE80', available: RANKED_FUTBOL_ENABLED },
  { id: 'ufc',     label: 'Ranked UFC',    emoji: '🥊', accent: '#F87171', available: true },
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
    // Solo abrir en Fútbol si la función está encendida; si no, Global
    // (evita aterrizar en una pestaña deshabilitada con clasificación vacía).
    : (activeSport === 'futbol' && RANKED_FUTBOL_ENABLED) ? 'futbol'
    : 'global'

  const [tab, setTab]           = useState<RankedSport>(defaultTab)
  const [entries, setEntries]   = useState<RankedEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [hasLive, setHasLive]   = useState(false)  // true si hay partidos en curso

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

  // Navegación por teclado del tablist (WAI-ARIA): flechas/Home/End se mueven
  // SOLO entre tabs disponibles y trasladan el foco al recién activado.
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const avail = TABS.map((t, i) => ({ t, i })).filter(x => x.t.available)
    const pos = avail.findIndex(x => x.i === idx)
    if (pos === -1) return
    let nextPos = -1
    if (e.key === 'ArrowRight') nextPos = (pos + 1) % avail.length
    else if (e.key === 'ArrowLeft') nextPos = (pos - 1 + avail.length) % avail.length
    else if (e.key === 'Home') nextPos = 0
    else if (e.key === 'End') nextPos = avail.length - 1
    else return
    e.preventDefault()
    const target = avail[nextPos].t
    setTab(target.id)
    if (typeof document !== 'undefined') document.getElementById(`rktab-${target.id}`)?.focus()
  }

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
      <div className="flex gap-1.5 flex-wrap mb-4" role="tablist" aria-label="Clasificación por deporte">
        {TABS.map((t, idx) => (
          <button
            key={t.id}
            id={`rktab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="rkpanel"
            aria-disabled={!t.available || undefined}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => t.available && setTab(t.id)}
            onKeyDown={e => onTabKeyDown(e, idx)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
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

      {/* Leaderboard card (= tabpanel del tablist) */}
      <div
        role="tabpanel"
        id="rkpanel"
        aria-labelledby={`rktab-${tab}`}
        tabIndex={0}
        className="rounded-2xl overflow-hidden focus-visible:outline-none"
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

        {/* Empty */}
        {!loading && entries.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-[12px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              Nadie en el ranking todavía · Sé el primero
            </p>
          </div>
        )}

        {/* Rows */}
        {!loading && entries.length > 0 && (
          <div className="px-4 py-3 flex flex-col gap-2">

            {/* PODIO — top 3 como PlacaRowV3 (showcase premium de la placa) */}
            {entries.slice(0, 3).map((e, i) => {
              const placa = buildPlacaData({
                displayName: e.display_name ?? 'Anónimo',
                handle:      (e.display_name ?? 'takero').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'takero',
                avatarUrl:   e.avatar_url,
                level:       e.level ?? 1,
                levelName:   e.levelName ?? 'Novato',
                equipment:   e.equipment as ApiEquipment | undefined,
                badges:      e.badges,
              })
              return (
                <PlacaRowV3
                  key={e.pid ?? i}
                  placa={placa}
                  rank={e.rank}
                  score={e.total}
                  scoreLabel="pts"
                  sportAccent={accent}
                />
              )
            })}

            {/* Separador si hay más de 3 */}
            {entries.length > 3 && (
              <div className="flex items-center gap-2 px-2 my-1" aria-hidden="true">
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <span style={{ fontSize: 9, color: '#4A4A6A', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em' }}>
                  CLASIFICACIÓN
                </span>
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
              </div>
            )}

            {/* RESTO — filas compactas (4º en adelante) */}
            {entries.slice(3).map((e, idx) => {
              const i = idx + 3
              const eq          = e.equipment
              const frameColor  = eq?.frame?.color
              const cardBg      = eq?.card_bg?.gradient
              const equipBadge  = eq?.badge
              const title       = eq?.title

              const rowBg = cardBg ?? 'rgba(255,255,255,0.015)'
              const rowBorder = frameColor ? `1px solid ${frameColor}` : '1px solid transparent'

              return (
                <div
                  key={e.pid ?? i}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background: rowBg, border: rowBorder }}
                >
                  <span style={{ fontSize: 11, fontWeight: 900, width: 20, textAlign: 'center', color: '#4A4A6A', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                    {e.rank}
                  </span>
                  <Avatar url={e.avatar_url} name={e.display_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-black" style={{ color: '#8A8AAA', fontFamily: 'var(--font-display)' }}>
                        {e.display_name ?? 'Anónimo'}
                      </span>
                      <LeaderboardBadgesRow badges={e.badges} equippedBadge={equipBadge} />
                    </div>
                    <LeaderboardTitleLine title={title} />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <TakaPoint size={11} />
                    <span className="text-[12px] font-black tabular-nums" style={{ color: '#6A6A8A', fontFamily: 'var(--font-display)' }}>
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
