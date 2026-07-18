'use client'

// Tarjetas y acordeones de bloques de estadísticas (UI). Extraído del monolito.

import React, { useContext, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { PodiumMedal } from '@/components/icons/GameIcons'
import { StatBlockBoundary } from '@/components/StatBlockBoundary'
import { trackStatsBlockOpen, trackStatsGroupOpen } from '@/lib/analytics'
import type { MetricGroup, StatBlock, StatRow } from './stats-types'
import { TeamLeagueContext } from './sports-config'
import { LIVE_PLAYER_BLOCK_IDS, applyLivePlayerToBlock, getBlockMeta, type BlockMeta, type LivePlayerData } from './live-data'

export function TrendArrow({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (!trend || trend === 'flat') return <span className="inline-block w-4" aria-hidden />
  const color = trend === 'up' ? '#4ade80' : '#f87171'
  const arrow = trend === 'up' ? '▲' : '▼'
  return (
    <span className="inline-block text-[10px] font-black w-4 text-center leading-none"
      style={{ color }}
      aria-label={trend === 'up' ? 'Tendencia al alza' : 'Tendencia a la baja'}>
      {arrow}
    </span>
  )
}

export function MedalBadge({ rank }: { rank: number }) {
  if (rank <= 3) return <PodiumMedal position={rank} size={18} />
  return (
    <span className="font-black tabular-nums text-xs w-5 text-center" style={{ color: '#3A3A52', fontFamily: 'var(--font-display)' }}>
      {rank}
    </span>
  )
}

export function PlaceholderBlockCard({ block, accent }: { block: StatBlock; accent: string }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)', opacity: 0.7 }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <span className="section-accent" style={{ background: accent, opacity: 0.4 }} />
          <h3 className="font-black text-sm" style={{ color: '#6060A0', fontFamily: 'var(--font-display)' }}>
            {block.title}
          </h3>
          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ background: 'rgba(124,58,237,0.12)', color: '#7C6EBA', border: '1px solid rgba(124,58,237,0.25)', fontFamily: 'var(--font-sport)' }}>
            PRÓXIMAMENTE
          </span>
        </div>
        <span className="text-[10px] font-black" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>{block.metric}</span>
      </div>
      <div className="px-5 py-8 flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
          style={{ background: `${accent}10`, border: `1px solid ${accent}20` }}>
          🔒
        </div>
        <p className="text-xs text-center" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
          Integración de datos en desarrollo
        </p>
      </div>
    </div>
  )
}

export function formatFetchedAt(iso?: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', timeZone: 'Europe/Madrid' })
  } catch { return '' }
}

export function BlockJsonLd({ block, rows, isLive }: { block: StatBlock; rows: StatRow[]; isLive?: boolean }) {
  // Emit a structured ItemList per stats block so search engines can parse rankings.
  // Solo para bloques realmente EN VIVO: no inyectamos a Google rankings obsoletos
  // ni el fallback hardcodeado (no mentir / evita rich-results incorrectos).
  if (!isLive || !rows.length || block.placeholder) return null
  const json = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: block.title,
    numberOfItems: rows.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: rows.slice(0, 10).map(r => ({
      '@type': 'ListItem',
      position: r.rank,
      name: `${r.name}${r.team ? ` (${r.team})` : ''}`,
    })),
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
}

export function FreshnessBadge({ isLive, meta }: { isLive?: boolean; meta?: BlockMeta }) {
  // Priority: 1) live → green  2) stale → amber  3) historical → grey  4) unavailable → red  5) no info → nothing
  const base = 'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded'
  const fetchedAt = formatFetchedAt(meta?.fetchedAt)
  const sourceTitle = meta?.source ? `Fuente: ${meta.source}${fetchedAt ? ` · Actualizado ${fetchedAt}` : ''}` : ''
  if (isLive) {
    return (
      <span className={base} title={sourceTitle || 'Datos en vivo'}
        role="status"
        aria-label={`Datos en vivo${meta?.source ? ` desde ${meta.source}` : ''}${fetchedAt ? `, actualizados ${fetchedAt}` : ''}`}
        style={{ background: 'rgba(74,222,128,0.14)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.32)', fontFamily: 'var(--font-sport)' }}>
        ● LIVE
      </span>
    )
  }
  if (meta?.status === 'stale') {
    return (
      <span className={base} title={sourceTitle}
        role="status"
        aria-label={`Datos del día${meta.asOf ? `, ${meta.asOf}` : ''}${fetchedAt ? `, actualizados ${fetchedAt}` : ''}`}
        style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.30)', fontFamily: 'var(--font-sport)' }}>
        Hoy · {meta.asOf ?? '—'}
      </span>
    )
  }
  if (meta?.status === 'historical') {
    return (
      <span className={base} title={sourceTitle}
        role="status"
        aria-label={`Datos históricos${meta.asOf ? ` ${meta.asOf}` : ''}${meta.source ? ` desde ${meta.source}` : ''}`}
        style={{ background: 'rgba(148,163,184,0.10)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.25)', fontFamily: 'var(--font-sport)' }}>
        Hist · {meta.asOf ?? '—'}
      </span>
    )
  }
  if (meta?.status === 'unavailable') {
    return (
      <span className={base} title={sourceTitle || meta.source}
        role="status"
        aria-label={`Datos no disponibles${meta.source ? ` (${meta.source})` : ''}`}
        style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.28)', fontFamily: 'var(--font-sport)' }}>
        No disponible
      </span>
    )
  }
  return null
}


export function PlayoffSeriesCard({ block, accent, isLive, meta }: {
  block: StatBlock; accent: string; isLive?: boolean; meta?: BlockMeta
}) {
  if (block.placeholder) return <PlaceholderBlockCard block={block} accent={accent} />

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)' }}>
      <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="section-accent" style={{ background: accent }} />
          <h3 className="font-black text-sm" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {block.title}
          </h3>
          <FreshnessBadge isLive={isLive} meta={meta} />
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest flex-shrink-0" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
          SERIE
        </span>
      </div>

      <div className="flex flex-col">
        {block.rows.length === 0 && (
          <p className="px-5 py-8 text-center text-[11px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
            Sin partidos de playoffs activos
          </p>
        )}
        {block.rows.map((row, i) => {
          const isActive = row.extra?.Estado === 'En juego'
          const serieText = row.extra?.Serie ?? ''
          return (
            <div key={i}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.025]"
              style={{
                borderBottom: i < block.rows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                background: isActive ? `${accent}06` : 'transparent',
                borderLeft: isActive ? `3px solid ${accent}50` : '3px solid transparent',
              }}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px]" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                  {row.name}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                  {serieText}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <div>
                  <div className="font-black text-sm tabular-nums" style={{ color: isActive ? accent : '#8080A0', fontFamily: 'var(--font-display)' }}>
                    {row.value}
                  </div>
                  <div className="text-[10px]" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                    {row.sub}
                  </div>
                </div>
                {isActive && (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'var(--font-sport)' }}>
                    LIVE
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function StatBlockCard({ block, accent, expanded, onToggle, leagueFilter, isLive, meta, isFav, onToggleFav }: {
  block: StatBlock; accent: string; expanded: boolean; onToggle: () => void; leagueFilter?: string; isLive?: boolean; meta?: BlockMeta
  isFav?: boolean; onToggleFav?: () => void
}) {
  if (block.placeholder) return <PlaceholderBlockCard block={block} accent={accent} />

  const teamLeague = React.useContext(TeamLeagueContext)
  const filteredRows = leagueFilter && leagueFilter !== 'General'
    ? block.rows.filter(r => teamLeague[r.team ?? ''] === leagueFilter)
    : block.rows
  const displayRows = expanded ? filteredRows : filteredRows.slice(0, 5)
  const hasExtra = filteredRows[0]?.extra && Object.keys(filteredRows[0].extra).length > 0
  const extraKeys = hasExtra ? Object.keys(filteredRows[0]!.extra!) : []

  const onShare = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/estadisticas#${block.id}` : `#${block.id}`
    const top = displayRows.slice(0, 3).map(r => `${r.rank}. ${r.name}${r.team ? ` (${r.team})` : ''} — ${r.value}`).join('\n')
    const text = `${block.title}\n${top}\n\nVía TakaSports`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: block.title, text, url })
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`)
      }
    } catch { /* user cancelled */ }
  }

  return (
    <section id={block.id} aria-labelledby={`${block.id}-title`} className="rounded-2xl overflow-hidden scroll-mt-24" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '1px solid rgba(255,255,255,0.16)' }}>
      <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <span className="section-accent" style={{ background: accent }} />
          <h3 id={`${block.id}-title`} className="font-black text-sm truncate" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            <a href={`#${block.id}`} className="hover:underline focus:underline outline-none" aria-label={`Enlazar a ${block.title}`}>{block.title}</a>
          </h3>
          <FreshnessBadge isLive={isLive} meta={meta} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onToggleFav && (
            <button onClick={onToggleFav} aria-label={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              className="text-[13px] leading-none px-1.5 py-1 rounded transition-opacity hover:opacity-80"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isFav ? '#fbbf24' : '#3A3A52' }}>
              {isFav ? '★' : '☆'}
            </button>
          )}
          <button onClick={onShare} aria-label="Compartir bloque"
            className="text-[12px] leading-none px-1.5 py-1 rounded transition-opacity hover:opacity-80"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5A5A72' }}>
            ⤴
          </button>
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: accent, fontFamily: 'var(--font-sport)' }}>
            {block.metric}
          </span>
        </div>
      </div>

      <div className="px-5 pt-2 pb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
        style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="w-8 flex-shrink-0">#</span>
        <span className="flex-1">Nombre</span>
        {extraKeys.slice(0, 2).map(k => (
          <span key={k} className="hidden lg:block w-14 text-right">{k}</span>
        ))}
        <span className="w-14 text-right">{block.metric}</span>
        <span className="w-5 flex-shrink-0" />
      </div>

      <div className="flex flex-col">
        {displayRows.length === 0 && (
          <div className="px-5 py-6 text-center" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
            <p className="text-[12px] font-semibold mb-1">
              {meta?.status === 'unavailable'
                ? 'Datos no disponibles ahora'
                : leagueFilter && leagueFilter !== 'General'
                ? `Sin datos para ${leagueFilter}`
                : 'Sin datos disponibles'}
            </p>
            {meta?.fetchedAt && (
              <p className="text-[10px]" style={{ color: '#3A3A52' }}>
                Última comprobación: {formatFetchedAt(meta.fetchedAt)}
              </p>
            )}
            {meta?.source && (
              <p className="text-[10px] mt-0.5" style={{ color: '#3A3A52' }}>{meta.source}</p>
            )}
          </div>
        )}
        {displayRows.map((row, i) => (
          <div key={row.rank}
            className="flex items-center gap-2 px-5 py-2.5 transition-colors hover:bg-white/[0.025]"
            style={{
              borderBottom: i < displayRows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
              background: row.rank <= 3 ? `linear-gradient(to right, ${accent}06 0%, transparent 100%)` : 'transparent',
              borderLeft: row.rank <= 3 ? `3px solid ${accent}50` : '3px solid transparent',
            }}
          >
            <div className="w-8 flex-shrink-0 flex items-center"><MedalBadge rank={row.rank} /></div>
            {row.logo && (
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                <Image src={row.logo} alt={row.name} width={26} height={26} unoptimized
                  style={{ objectFit: 'contain', width: 26, height: 26 }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {row.flag && <span className="text-xs leading-none flex-shrink-0">{row.flag}</span>}
                {row.href ? (
                  <Link href={row.href}
                    className="font-semibold text-[13px] truncate hover:underline focus:underline outline-none"
                    style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                    {row.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-[13px] truncate" style={{ color: '#E0E0F0', fontFamily: 'var(--font-display)' }}>
                    {row.name}
                  </span>
                )}
              </div>
              {(row.team || row.sub) && (
                <span className="block text-[11px] truncate" style={{ color: '#7A7A92', fontFamily: 'var(--font-sport)' }}>
                  {row.team}{row.team && row.sub ? ' · ' : ''}{row.sub}
                </span>
              )}
            </div>
            {extraKeys.slice(0, 2).map(k => (
              <span key={k} className="hidden lg:block w-14 text-right text-[11px] tabular-nums font-semibold"
                style={{ color: '#6060A0', fontFamily: 'var(--font-display)' }}>
                {row.extra?.[k] ?? '—'}
              </span>
            ))}
            <span className="w-14 text-right font-black tabular-nums"
              style={{ color: row.rank <= 3 ? accent : '#8080A0', fontFamily: 'var(--font-display)', fontSize: row.rank === 1 ? 16 : 14 }}>
              {row.value}
            </span>
            <div className="w-5 flex-shrink-0 flex items-center justify-end">
              <TrendArrow trend={row.trend} />
            </div>
          </div>
        ))}
      </div>

      {filteredRows.length > 5 && (
        <button onClick={onToggle}
          className="w-full px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-70"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: accent, fontFamily: 'var(--font-sport)', background: 'none', cursor: 'pointer' }}>
          {expanded ? 'Ver menos ↑' : `Ver todos (${filteredRows.length}) ↓`}
        </button>
      )}
      <BlockJsonLd block={block} rows={displayRows} isLive={isLive} />
    </section>
  )
}

export function MetricGroupAccordion({ group, accent, expanded, onToggle, expandedBlocks, onToggleBlock, leagueFilter, livePlayerData, liveMeta, favorites, onToggleFav, hideUnavailable }: {
  group: MetricGroup
  accent: string
  expanded: boolean
  onToggle: () => void
  expandedBlocks: Record<string, boolean>
  onToggleBlock: (id: string) => void
  leagueFilter?: string
  livePlayerData?: LivePlayerData | null
  liveMeta?: Record<string, BlockMeta>
  favorites?: Set<string>
  onToggleFav?: (id: string) => void
  hideUnavailable?: boolean
}) {
  // Hide pure placeholder blocks (no live data injected, no rows).
  // When hideUnavailable is on, also drop blocks whose meta says 'unavailable'.
  const visibleBlocks = group.blocks.filter(b => {
    if (b.placeholder && b.rows.length === 0) return false
    if (hideUnavailable) {
      const m = getBlockMeta(b.id, liveMeta)
      if (m?.status === 'unavailable') return false
    }
    return true
  })

  if (visibleBlocks.length === 0) return null

  // Apply live player data to group blocks, preserving isLive per block
  const liveVisibleBlocks = visibleBlocks.map(b => {
    if (livePlayerData && LIVE_PLAYER_BLOCK_IDS.has(b.id)) {
      return applyLivePlayerToBlock(b, livePlayerData, leagueFilter)
    }
    return { block: b, isLive: false }
  })

  const dataCount = liveVisibleBlocks.filter(({ block: b }) => !b.placeholder).length
  const soonCount = liveVisibleBlocks.filter(({ block: b }) => b.placeholder).length
  const liveCount = liveVisibleBlocks.filter(({ isLive }) => isLive).length

  return (
    <div className="mb-3">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:brightness-110"
        style={{ background: expanded ? `${accent}10` : 'rgba(255,255,255,0.03)', border: expanded ? `1px solid ${accent}30` : '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
        <div className="flex items-center gap-3">
          <span className="text-lg leading-none">{group.icon}</span>
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: expanded ? accent : '#9090B0', fontFamily: 'var(--font-sport)' }}>
              {group.label}
            </p>
            {group.description && (
              <p className="text-[10px] mt-0.5 hidden sm:block" style={{ color: '#4A4A62', fontFamily: 'var(--font-sport)' }}>
                {group.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {liveCount > 0 && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', fontFamily: 'var(--font-sport)' }}>
              {liveCount} live
            </span>
          )}
          {dataCount - liveCount > 0 && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#5A5A72', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}>
              {dataCount - liveCount} tabla{dataCount - liveCount !== 1 ? 's' : ''}
            </span>
          )}
          {soonCount > 0 && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.1)', color: '#7C6EBA', border: '1px solid rgba(124,58,237,0.2)', fontFamily: 'var(--font-sport)' }}>
              +{soonCount} prox.
            </span>
          )}
          <span className="font-black text-xs" style={{ color: expanded ? accent : '#4A4A6A' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {liveVisibleBlocks.map(({ block, isLive }) => (
            <StatBlockBoundary key={block.id} blockId={block.id}>
              <StatBlockCard
                block={block}
                accent={accent}
                expanded={!!expandedBlocks[block.id]}
                onToggle={() => onToggleBlock(block.id)}
                leagueFilter={leagueFilter}
                isLive={isLive}
                meta={getBlockMeta(block.id, liveMeta)}
                isFav={favorites?.has(block.id)}
                onToggleFav={onToggleFav ? () => onToggleFav(block.id) : undefined}
              />
            </StatBlockBoundary>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────
// IDs of blocks that get replaced with live standings/ESPN data
