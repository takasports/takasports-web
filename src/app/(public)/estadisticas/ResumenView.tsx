'use client'

// Vista RESUMEN (landing cross-sport) de /estadisticas. Extraído del monolito.

import React from 'react'
import type { BlockMeta, LivePlayerData, LiveStandingsData } from './live-data'
import { FreshnessBadge, MedalBadge } from './StatCards'
import { StatIcon } from './sports-config'

// ─────────────────────────────────────────────────────────────────
// RESUMEN — landing cross-sport con lo más relevante de cada deporte
// ─────────────────────────────────────────────────────────────────
export interface SummaryCard {
  sportId: string
  sportLabel: string
  icon: string   // clave de StatIcon ('globe', 'football'…) — tanda v3, fuera emojis
  accent: string
  title: string
  metric: string
  rows: { rank: number; name: string; sub: string; value: string; flag?: string }[]
  meta?: BlockMeta
  sectionTarget?: string
  gender?: 'm' | 'f'
}

export function buildSummaryCards(
  liveData: LiveStandingsData | null,
  livePlayerData: LivePlayerData | null,
): SummaryCard[] {
  const cards: SummaryCard[] = []
  const meta = liveData?.meta ?? {}

  // 🌍 Mundial 2026: clasificados destacados (primero — evento estrella)
  if (liveData?.worldCupQualified?.length) {
    cards.push({
      sportId: 'mundial', sportLabel: 'Mundial 2026', icon: 'globe', accent: '#f59e0b',
      title: 'Mundial 2026 · Clasificados', metric: 'Grupo',
      rows: liveData.worldCupQualified.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value, flag: r.flag,
      })),
      meta: meta.worldCupQualified,
      sectionTarget: 'clasificados',
    })
  }

  // ⚽ Goleadores LaLiga (ESPN, vivo)
  // Fix: league id is 'esp.1', not 'laliga'
  const laliga = livePlayerData?.leagues.find(l => l.id === 'esp.1')
  if (laliga && laliga.goals.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'LaLiga', icon: 'football', accent: '#22c55e',
      title: 'Goleadores LaLiga', metric: 'Goles',
      rows: laliga.goals.slice(0, 5).map((p, i) => ({
        rank: i + 1, name: p.name, sub: p.team, value: String(p.value),
      })),
      meta: { status: 'live', source: 'ESPN · LaLiga', fetchedAt: liveData?.updatedAt ?? '' },
      sectionTarget: 'jugadores',
    })
  }

  // ⚽ Clasificación LaLiga
  const laligaTable = liveData?.football?.find(f => f.id === 'tabla-laliga')
  if (laligaTable && laligaTable.rows.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'LaLiga', icon: 'football', accent: '#22c55e',
      title: 'Clasificación LaLiga', metric: 'Pts',
      rows: laligaTable.rows.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta['tabla-laliga'] ?? meta['football'],
      sectionTarget: 'competiciones',
    })
  }

  // ⚽ Clasificación Premier League
  const premierTable = liveData?.football?.find(f => f.id === 'tabla-premier')
  if (premierTable && premierTable.rows.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'Premier League', icon: 'football', accent: '#6C2D91',
      title: 'Clasificación Premier', metric: 'Pts',
      rows: premierTable.rows.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta['tabla-premier'] ?? meta['football'],
      sectionTarget: 'competiciones',
    })
  }

  // 🏀 NBA scoring leaders
  if (liveData?.nbaScoring?.length) {
    cards.push({
      sportId: 'baloncesto', sportLabel: 'NBA', icon: 'basketball', accent: '#ef4444',
      title: 'NBA · Anotadores', metric: 'PPG',
      rows: liveData.nbaScoring.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value,
      })),
      meta: meta.nbaScoring,
      sectionTarget: 'jugadores',
    })
  }

  // 🏀 NBA Conferencia Este
  if (liveData?.nbaEast?.length) {
    cards.push({
      sportId: 'baloncesto', sportLabel: 'NBA Este', icon: 'basketball', accent: '#ef4444',
      title: 'NBA · Conferencia Este', metric: 'V-D',
      rows: liveData.nbaEast.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta.nbaEast,
      sectionTarget: 'equipos',
    })
  }

  // 🏀 NBA Conferencia Oeste
  if (liveData?.nbaWest?.length) {
    cards.push({
      sportId: 'baloncesto', sportLabel: 'NBA Oeste', icon: 'basketball', accent: '#f59e0b',
      title: 'NBA · Conferencia Oeste', metric: 'V-D',
      rows: liveData.nbaWest.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value,
      })),
      meta: meta.nbaWest,
      sectionTarget: 'equipos',
    })
  }

  // 🏎️ F1 pilotos
  if (liveData?.f1Drivers?.length) {
    cards.push({
      sportId: 'f1', sportLabel: 'Fórmula 1', icon: 'f1', accent: '#f97316',
      title: 'F1 · Mundial Pilotos', metric: 'Pts',
      rows: liveData.f1Drivers.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.f1Drivers,
      sectionTarget: 'pilotos',
    })
  }

  // 🎾 ATP top
  if (liveData?.atpRanking?.length) {
    cards.push({
      sportId: 'tenis', sportLabel: 'ATP', icon: 'tennis', accent: '#84cc16',
      title: 'Tenis · ATP Ranking', metric: 'Pts',
      rows: liveData.atpRanking.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.atpRanking,
      sectionTarget: 'atp',
    })
  }

  // 🎾 WTA top
  if (liveData?.wtaRanking?.length) {
    cards.push({
      sportId: 'tenis', sportLabel: 'WTA', icon: 'tennis', accent: '#d946ef',
      title: 'Tenis · WTA Ranking', metric: 'Pts',
      rows: liveData.wtaRanking.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.wtaRanking,
      sectionTarget: 'wta',
    })
  }

  // ⚽ Femenino: goleadoras
  if (liveData?.womenGoals?.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'Liga F', icon: 'football', accent: '#ec4899',
      title: 'Liga F · Goleadoras', metric: 'Goles',
      rows: liveData.womenGoals.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value,
      })),
      meta: meta.womenGoals,
      sectionTarget: 'jugadores',
      gender: 'f',
    })
  }

  // 🏎️ F1 Sprint Wins (si hay sprints en el calendario)
  if (liveData?.f1Sprints?.length) {
    cards.push({
      sportId: 'f1', sportLabel: 'F1', icon: 'f1', accent: '#f97316',
      title: 'F1 · Sprint Wins', metric: 'Vic',
      rows: liveData.f1Sprints.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.f1Sprints,
      sectionTarget: 'sprints-f1',
    })
  }

  // 🏍️ MotoGP: pilotos top
  if (liveData?.motogpRiders?.length) {
    cards.push({
      sportId: 'motogp', sportLabel: 'MotoGP', icon: 'moto', accent: '#dc2626',
      title: 'MotoGP · Mundial Pilotos', metric: 'Pts',
      rows: liveData.motogpRiders.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.abbr, value: r.value, flag: r.flag,
      })),
      meta: meta.motogpRiders,
      sectionTarget: 'pilotos-motogp',
    })
  }

  // 🥊 UFC P4P top
  if (liveData?.ufcP4P?.length) {
    cards.push({
      sportId: 'ufc', sportLabel: 'UFC', icon: 'ufc', accent: '#f97316',
      title: 'UFC · Pound for Pound', metric: 'Pos.',
      rows: liveData.ufcP4P.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: `#${r.rank}`, flag: r.flag,
      })),
      meta: meta.ufcP4P,
      sectionTarget: 'ranking-ufc',
    })
  }

  // 🌍 Ranking Mundial Elo (selecciones)
  if (liveData?.fifaRanking?.length) {
    cards.push({
      sportId: 'futbol', sportLabel: 'Selecciones', icon: 'globe', accent: '#3b82f6',
      title: 'Ranking Mundial · Elo', metric: 'Pts',
      rows: liveData.fifaRanking.slice(0, 5).map(r => ({
        rank: r.rank, name: r.name, sub: r.sub, value: r.value, flag: r.flag,
      })),
      meta: meta.fifaRanking,
      sectionTarget: 'selecciones',
    })
  }

  return cards
}

export function ResumenCard({ card, onOpen }: { card: SummaryCard; onOpen: () => void }) {
  return (
    <button onClick={onOpen}
      className="text-left rounded-2xl overflow-hidden transition-all hover:brightness-110 active:scale-[0.99] w-full"
      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${card.accent}20`, borderTop: '1px solid rgba(255,255,255,0.16)', cursor: 'pointer' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5"
        style={{ borderBottom: `1px solid ${card.accent}15`, background: `${card.accent}08` }}>
        <div className="flex items-center gap-2 min-w-0">
          {/* Cuadrado tintado con bisel (idioma de los acordeones); el icono se aclara
              hacia blanco para que los acentos oscuros (morado Premier) no se apaguen. */}
          <span className="inline-flex items-center justify-center flex-shrink-0"
            style={{
              width: 24, height: 24, borderRadius: 7,
              background: `color-mix(in srgb, ${card.accent} 20%, transparent)`,
              border: `1px solid color-mix(in srgb, ${card.accent} 38%, transparent)`,
              color: `color-mix(in srgb, ${card.accent} 72%, #fff)`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px -2px rgba(0,0,0,0.5)',
            }}>
            <StatIcon k={card.icon} size={14} />
          </span>
          <h3 className="font-black text-[13px] truncate"
            style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {card.title}
          </h3>
        </div>
        <FreshnessBadge isLive={card.meta?.status === 'live'} meta={card.meta} />
      </div>
      {/* Rows */}
      <div className="flex flex-col px-4 py-2">
        {card.rows.map((r, idx) => (
          <div key={r.rank} className="flex items-center gap-2 py-1.5"
            style={{ borderBottom: idx < card.rows.length - 1 ? '1px solid rgba(255,255,255,0.035)' : 'none' }}>
            <div className="w-6 flex-shrink-0"><MedalBadge rank={r.rank} /></div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              {r.flag && <span className="text-[11px] leading-none flex-shrink-0">{r.flag}</span>}
              <span className="font-semibold text-[12px] truncate" style={{ color: r.rank === 1 ? '#F0F0FF' : '#B8B8D0', fontFamily: 'var(--font-display)' }}>
                {r.name}
              </span>
              {r.sub && (
                <span className="text-[10px] truncate hidden sm:block" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                  · {r.sub}
                </span>
              )}
            </div>
            <span className="font-black tabular-nums text-[13px] flex-shrink-0"
              style={{ color: r.rank === 1 ? card.accent : '#6060A0', fontFamily: 'var(--font-display)' }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      {/* Footer CTA */}
      <div className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          {card.metric}
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"
          style={{ color: card.accent, fontFamily: 'var(--font-sport)' }}>
          Ver todo
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4h5M4 1.5l2.5 2.5L4 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </div>
    </button>
  )
}

export function ResumenView({
  liveData, livePlayerData, lastUpdated, onPickSport,
}: {
  liveData: LiveStandingsData | null
  livePlayerData: LivePlayerData | null
  lastUpdated: Date | null
  onPickSport: (sportId: string, sectionId?: string, gender?: 'm' | 'f') => void
}) {
  const cards = React.useMemo(
    () => buildSummaryCards(liveData, livePlayerData),
    [liveData, livePlayerData],
  )
  const liveCount = cards.filter(c => c.meta?.status === 'live').length
  const histCount = cards.filter(c => c.meta?.status === 'historical').length

  if (!liveData) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
        Cargando datos en vivo…
      </div>
    )
  }

  return (
    <div>
      {/* Status bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {liveCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(74,222,128,0.10)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', fontFamily: 'var(--font-sport)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
            {liveCount} en vivo
          </span>
        )}
        {histCount > 0 && (
          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
            style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)', fontFamily: 'var(--font-sport)' }}>
            {histCount} snapshot
          </span>
        )}
        {lastUpdated && (
          <span className="text-[10px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
            · {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="py-12 text-center" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          Aún no hay datos cargados. Refresca en unos segundos.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c, i) => (
            <ResumenCard key={`${c.sportId}-${c.title}-${i}`} card={c}
              onOpen={() => onPickSport(c.sportId, c.sectionTarget, c.gender)} />
          ))}
        </div>
      )}
    </div>
  )
}
