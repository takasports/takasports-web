'use client'

// Hub "Tu día Taka": cuatro tiles con el estado de los juegos activos para
// el periodo actual. Pendiente vs hecho, link directo a cada juego y CTA
// al primer pendiente. Quiniela queda fuera de este panel (se gestiona en
// su propia card hero).

import Link from 'next/link'
import type { ComponentType } from 'react'
import { useMyPlayedGames } from '@/hooks/useMyPlayedGames'
import { getGamePeriod } from '@/lib/games-periods'
import type { GameId } from '@/lib/games-store'
import { IconCrackQuiz, IconTakaGrid, IconSopaCracks, IconMiOnce } from '@/components/games/GameVisuals'
import { CheckIcon } from '@/components/icons/GameIcons'

interface Tile {
  id: GameId
  name: string
  Icon: ComponentType<{ size?: number }>
  accent: string
  href: string
}

const TILES: Tile[] = [
  { id: 'crackquiz',  name: 'CrackQuiz',     Icon: IconCrackQuiz,  accent: '#FCD34D', href: '/crackquiz' },
  { id: 'takagrid',   name: 'TakaGrid',      Icon: IconTakaGrid,   accent: '#FDBA74', href: '/takagrid' },
  { id: 'sopacracks', name: 'Sopa de Cracks', Icon: IconSopaCracks, accent: '#6EE7B7', href: '/sopa-cracks' },
  { id: 'mionce',     name: 'Mi Once',       Icon: IconMiOnce,     accent: '#93C5FD', href: '/mionce' },
]

function fmtCountdown(ms: number): string {
  if (ms <= 0) return ''
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h >= 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`
  }
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

export default function TuDiaTaka() {
  const played = useMyPlayedGames()
  const doneCount = TILES.filter(t => played.has(t.id)).length
  const firstPending = TILES.find(t => !played.has(t.id))

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="section-accent" />
          <h3 className="section-label">Tu día Taka</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: doneCount === TILES.length ? '#86EFAC' : 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {doneCount}/{TILES.length} hechos
          </span>
          {firstPending && (
            <Link
              href={firstPending.href}
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition-opacity hover:opacity-80"
              style={{ background: `${firstPending.accent}18`, color: firstPending.accent, border: `1px solid ${firstPending.accent}30`, fontFamily: 'var(--font-sport)' }}
            >
              Ir al primer pendiente →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TILES.map(t => <DayTile key={t.id} tile={t} played={played.has(t.id)} />)}
      </div>
    </div>
  )
}

function DayTile({ tile, played }: { tile: Tile; played: boolean }) {
  const period = getGamePeriod(tile.id)
  const isDaily = period.cadence === 'daily'
  const countdown = fmtCountdown(period.nextResetMs)
  const periodLabel = isDaily ? 'Hoy' : 'Esta semana'

  return (
    <Link
      href={tile.href}
      className="rounded-xl p-3 flex flex-col gap-2 transition-all hover:scale-[1.02]"
      style={{
        background: played
          ? `${tile.accent}10`
          : 'rgba(255,255,255,0.025)',
        border: `1px solid ${played ? `${tile.accent}40` : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="leading-none inline-flex" aria-hidden style={{ color: tile.accent }}>
          <tile.Icon size={22} />
        </span>
        {played ? (
          <span
            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded inline-flex items-center gap-1"
            style={{ background: 'rgba(74,222,128,0.12)', color: '#86EFAC', border: '1px solid rgba(74,222,128,0.25)', fontFamily: 'var(--font-sport)' }}
          >
            <CheckIcon size={10} /> Hecho
          </span>
        ) : (
          <span
            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(252,211,77,0.10)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.25)', fontFamily: 'var(--font-sport)' }}
          >
            Pendiente
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black truncate" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
          {tile.name}
        </p>
        <p className="text-[10px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          <span>{periodLabel}</span>
          {countdown && (
            <>
              <span aria-hidden>·</span>
              <span style={{ color: tile.accent }}>{played ? `próx. ${countdown}` : `cierra en ${countdown}`}</span>
            </>
          )}
        </p>
      </div>
    </Link>
  )
}
