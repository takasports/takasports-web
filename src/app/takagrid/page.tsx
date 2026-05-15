'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import { searchPlayers, getPlayerById, type Player } from '@/lib/players-catalog'
import { getDailyPuzzle, isValidAnswer, getValidAnswers, type CellCoord, type GridPuzzle } from '@/lib/takagrid-puzzles'
import { TrophyIcon, StarIcon, ClapIcon, FlexIcon, FireIcon, CountryFlag } from '@/components/icons/GameIcons'
import { recordPlay, currentDayISO, type GamePlay } from '@/lib/games-store'
import { trackGameEvent } from '@/lib/games-telemetry'
import ShareResultButton from '@/components/games/ShareResultButton'

// ── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = 'ts_takagrid_state'
const STREAK_KEY = 'ts_takagrid_streak'
const ACCENT = '#FDBA74'
const ACCENT_DIM = '#EA580C'

// ── Types ────────────────────────────────────────────────────────

interface CellState {
  playerId: string | null
  wrong: string | null
  locked: boolean
}

type GridState = CellState[][]

interface StoredState {
  dayKey: string
  grid: GridState
  finished: boolean
}

interface StreakState {
  streak: number
  bestStreak: number
  lastFinishedDate: string
  history: Array<{ dayKey: string; solved: number }>
}

// ── Helpers ──────────────────────────────────────────────────────

function emptyGrid(): GridState {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, (): CellState => ({ playerId: null, wrong: null, locked: false }))
  )
}

function loadState(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveState(s: StoredState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

function loadStreak(): StreakState {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    return raw ? JSON.parse(raw) : { streak: 0, bestStreak: 0, lastFinishedDate: '', history: [] }
  } catch { return { streak: 0, bestStreak: 0, lastFinishedDate: '', history: [] } }
}

function saveStreak(s: StreakState) {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

function isYesterday(dateStr: string, todayStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00Z')
  const t = new Date(todayStr + 'T12:00:00Z')
  return t.getTime() - d.getTime() === 86400000
}

// ── Share image ───────────────────────────────────────────────────

async function generateGridImage(
  grid: GridState, puzzle: GridPuzzle, solved: number, dayKey: string
): Promise<Blob> {
  const W = 560, H = 620
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = '#09090F'
  ctx.fillRect(0, 0, W, H)

  // Glow
  const glow = ctx.createRadialGradient(W / 2, 80, 0, W / 2, 80, 280)
  glow.addColorStop(0, 'rgba(234,88,12,0.18)')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Header
  ctx.fillStyle = ACCENT
  ctx.font = `900 13px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('TAKAGRID · TAKASPORTSMEDIA.COM', W / 2, 32)
  ctx.fillStyle = '#F0F0F5'
  ctx.font = `900 28px sans-serif`
  ctx.fillText(`${solved}/9 celdas acertadas`, W / 2, 68)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.font = `400 13px sans-serif`
  ctx.fillText(dayKey, W / 2, 90)

  // Grid
  const CELL = 110, GAP = 8, TOP = 110, LEFT = 80, HEADER = 80

  // Col headers
  puzzle.cols.forEach((col, c) => {
    const x = LEFT + HEADER + c * (CELL + GAP) + GAP + CELL / 2
    ctx.fillStyle = 'rgba(234,88,12,0.15)'
    roundRect(ctx, LEFT + HEADER + c * (CELL + GAP) + GAP, TOP, CELL, HEADER - 8, 12)
    ctx.fill()
    ctx.fillStyle = ACCENT
    ctx.font = `900 11px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(col.label.toUpperCase().substring(0, 12), x, TOP + HEADER / 2 + 4)
  })

  // Row headers + cells
  puzzle.rows.forEach((row, r) => {
    const y = TOP + HEADER + r * (CELL + GAP) + GAP

    // Row header
    ctx.fillStyle = 'rgba(234,88,12,0.15)'
    roundRect(ctx, LEFT, y, HEADER - 8, CELL, 12)
    ctx.fill()
    ctx.fillStyle = ACCENT
    ctx.font = `900 10px sans-serif`
    ctx.textAlign = 'center'
    const words = row.label.split(' ')
    words.slice(0, 2).forEach((w, wi) => {
      ctx.fillText(w.substring(0, 10), LEFT + (HEADER - 8) / 2, y + CELL / 2 - 6 + wi * 16)
    })

    // Cells
    puzzle.cols.forEach((_, c) => {
      const cell = grid[r][c]
      const cx = LEFT + HEADER + c * (CELL + GAP) + GAP
      const player = cell.playerId ? getPlayerById(cell.playerId) : null

      if (player) {
        ctx.fillStyle = 'rgba(234,88,12,0.25)'
        roundRect(ctx, cx, y, CELL, CELL, 14)
        ctx.fill()
        ctx.strokeStyle = `${ACCENT}80`
        ctx.lineWidth = 1.5
        roundRect(ctx, cx, y, CELL, CELL, 14)
        ctx.stroke()

        // Player circle
        const grad = ctx.createRadialGradient(cx + CELL / 2, y + 40, 0, cx + CELL / 2, y + 40, 24)
        grad.addColorStop(0, ACCENT_DIM)
        grad.addColorStop(1, '#7c2d12')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(cx + CELL / 2, y + 40, 24, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.font = `900 12px sans-serif`
        ctx.textAlign = 'center'
        const initials = player.name.split(' ').map(w => w[0]).slice(0, 2).join('')
        ctx.fillText(initials, cx + CELL / 2, y + 45)

        ctx.fillStyle = '#F0F0F5'
        ctx.font = `700 10px sans-serif`
        const lastName = player.name.split(' ').pop() ?? player.name
        ctx.fillText(lastName.substring(0, 12), cx + CELL / 2, y + 78)
      } else if (cell.wrong !== null) {
        ctx.fillStyle = 'rgba(220,38,38,0.12)'
        roundRect(ctx, cx, y, CELL, CELL, 14)
        ctx.fill()
        ctx.strokeStyle = 'rgba(220,38,38,0.4)'
        ctx.lineWidth = 1.5
        roundRect(ctx, cx, y, CELL, CELL, 14)
        ctx.stroke()
        ctx.fillStyle = '#EF4444'
        ctx.font = `900 24px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('✗', cx + CELL / 2, y + CELL / 2 + 8)
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        roundRect(ctx, cx, y, CELL, CELL, 14)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        roundRect(ctx, cx, y, CELL, CELL, 14)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.font = `400 20px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('—', cx + CELL / 2, y + CELL / 2 + 7)
      }
    })
  })

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.font = `400 11px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('takasportsmedia.com', W / 2, H - 18)

  return new Promise(res => canvas.toBlob(b => res(b!), 'image/png'))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function countSolved(grid: GridState): number {
  return grid.flat().filter(c => c.playerId !== null).length
}

// ── Icons ────────────────────────────────────────────────────────

function IconClose() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
}

function IconSearch() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
}

function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3.5 3.5 5.5-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function IconBack() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 7H3M6.5 3.5L3 7l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function IconShare() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="11" cy="3" r="1.8" stroke="currentColor" strokeWidth="1.3"/><circle cx="3" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.3"/><circle cx="11" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.3"/><path d="M9.5 4L4.5 6.2M4.5 7.8L9.5 10" stroke="currentColor" strokeWidth="1.3"/></svg>
}

// ── Search modal ──────────────────────────────────────────────────

interface SearchModalProps {
  cell: CellCoord
  puzzle: GridPuzzle
  usedIds: string[]
  validCount: number
  onSelect: (player: Player) => void
  onClose: () => void
}

function SearchModal({ cell, puzzle, usedIds, validCount, onSelect, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const rowCond = puzzle.rows[cell.row]
  const colCond = puzzle.cols[cell.col]

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const results = useMemo(() =>
    searchPlayers(query, { excludeIds: usedIds, limit: 40 }),
  [query, usedIds])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_DIM}40`, maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              El jugador debe cumplir <strong style={{ color: ACCENT }}>ambas</strong> condiciones:
            </p>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: `${ACCENT_DIM}20`, border: `1px solid ${ACCENT_DIM}40` }}>
                <span className="text-base leading-none">{rowCond.emoji}</span>
                <span className="text-[12px] font-black" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>{rowCond.label}</span>
              </div>
              <span className="text-[10px] font-black" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>Y</span>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: `${ACCENT_DIM}20`, border: `1px solid ${ACCENT_DIM}40` }}>
                <span className="text-base leading-none">{colCond.emoji}</span>
                <span className="text-[12px] font-black" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>{colCond.label}</span>
              </div>
            </div>
            <p className="text-[9px]" style={{ color: validCount <= 3 ? ACCENT : '#3A3A52', fontFamily: 'var(--font-sport)' }}>
              {validCount === 0 ? '⚠️ Ninguno en catálogo — prueba igualmente' : validCount === 1 ? '🔥 Solo 1 jugador en catálogo' : validCount <= 3 ? `🔥 Solo ${validCount} en catálogo` : `${validCount} jugadores posibles en catálogo`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
            <IconClose />
          </button>
        </div>

        {/* Input */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ color: 'var(--text-muted)' }}><IconSearch /></span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Nombre del jugador…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: '#F0F0F5' }}
            />
            {query && <button onClick={() => setQuery('')} style={{ color: 'var(--text-muted)' }}><IconClose /></button>}
          </div>
        </div>

        {/* Warning */}
        <div className="px-4 pb-2">
          <p className="text-[10px] px-3 py-2 rounded-lg" style={{ background: 'rgba(234,88,12,0.08)', color: ACCENT, border: `1px solid ${ACCENT_DIM}20`, fontFamily: 'var(--font-sport)' }}>
            ⚠️ Solo tienes un intento por celda. Piénsalo bien.
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin resultados para "{query}"</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => onSelect(p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left hover:bg-white/5"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0"
                      style={{ background: `${ACCENT_DIM}28`, color: ACCENT, border: `1px solid ${ACCENT_DIM}40`, fontFamily: 'var(--font-display)' }}
                    >
                      {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate flex items-center gap-1.5" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                        <CountryFlag country={p.country} width={16} />
                        <span className="truncate">{p.name}</span>
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{p.club}</p>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0" style={{
                      background: p.era === 'current' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                      color: p.era === 'current' ? '#4ade80' : '#5A5A7A',
                      fontFamily: 'var(--font-sport)',
                    }}>
                      {p.era === 'current' ? 'Activo' : 'Leyenda'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Grid cell ─────────────────────────────────────────────────────

interface GridCellProps {
  cell: CellState
  onClick: () => void
  isFinished: boolean
}

function GridCell({ cell, onClick, isFinished }: GridCellProps) {
  const player = cell.playerId ? getPlayerById(cell.playerId) : null
  const canClick = !cell.locked && !isFinished

  if (player) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 text-center"
        style={{ background: `linear-gradient(135deg, ${ACCENT_DIM}30, ${ACCENT_DIM}10)`, border: `1px solid ${ACCENT}60`, minHeight: 90 }}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black"
          style={{ background: `linear-gradient(135deg, ${ACCENT_DIM}, #9a3412)`, color: '#fff', fontFamily: 'var(--font-display)' }}>
          {player.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
        </div>
        <p className="text-[10px] font-black leading-tight flex items-center justify-center gap-1" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
          <CountryFlag country={player.country} width={12} />
          <span>{player.name.split(' ').slice(-1)[0]}</span>
        </p>
        <span className="text-[8px]" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
          <IconCheck />
        </span>
      </div>
    )
  }

  if (cell.wrong !== null) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 text-center"
        style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', minHeight: 90 }}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)' }}>
          <span style={{ color: '#EF4444' }}><IconClose /></span>
        </div>
        <p className="text-[9px] font-black leading-tight" style={{ color: '#EF4444', fontFamily: 'var(--font-display)' }}>
          {cell.wrong}
        </p>
        <p className="text-[8px]" style={{ color: 'rgba(239,68,68,0.6)', fontFamily: 'var(--font-sport)' }}>No válido</p>
      </div>
    )
  }

  return (
    <button
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all disabled:opacity-40"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: canClick ? `1px dashed ${ACCENT_DIM}60` : '1px solid rgba(255,255,255,0.05)',
        minHeight: 90,
        cursor: canClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ color: ACCENT_DIM, opacity: 0.6, fontSize: 22 }}>+</span>
      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
        Elegir
      </span>
    </button>
  )
}

// ── Result overlay ────────────────────────────────────────────────

function ResultOverlay({ solved, grid, puzzle, dayKey, validAnswers, streak, onClose }: {
  solved: number; grid: GridState; puzzle: GridPuzzle; dayKey: string
  validAnswers: Player[][][]; streak: number; onClose: () => void
}) {
  const [tab, setTab] = useState<'result' | 'reveal'>('result')
  const [sharingImg, setSharingImg] = useState(false)
  const ResultIcon = solved === 9 ? TrophyIcon : solved >= 6 ? StarIcon : solved >= 3 ? ClapIcon : FlexIcon
  const resultColor = solved === 9 ? '#FCD34D' : solved >= 6 ? '#FDBA74' : solved >= 3 ? '#FB923C' : '#86EFAC'
  const msg = solved === 9 ? '¡Perfecto! 9/9' : solved >= 6 ? `Muy bien! ${solved}/9` : solved >= 3 ? `Bien! ${solved}/9` : `${solved}/9 — ¡Mañana mejor!`

  const handleShare = async () => {
    const rows = grid.map(row =>
      row.map(c => c.playerId ? '🟧' : c.wrong !== null ? '🟥' : '⬛').join('')
    ).join('\n')
    const streakLine = streak >= 2 ? `🔥 Racha: ${streak} días\n` : ''
    const text = `TakaGrid ${dayKey}\n${msg}\n${streakLine}\n${rows}\n\ntakasportsmedia.com`
    try {
      if (navigator.share) await navigator.share({ title: 'TakaGrid', text })
      else await navigator.clipboard.writeText(text)
      trackGameEvent({ gameId: 'takagrid', event: 'shared', period: dayKey, meta: { via: 'text' } })
    } catch { await navigator.clipboard.writeText(text).catch(() => {}) }
  }

  const handleShareImage = async () => {
    setSharingImg(true)
    try {
      const blob = await generateGridImage(grid, puzzle, solved, dayKey)
      const file = new File([blob], `takagrid-${dayKey}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `TakaGrid ${dayKey}` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `takagrid-${dayKey}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch { /* ignore */ }
    setSharingImg(false)
  }

  const hasMissed = grid.flat().some(c => !c.playerId)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden" style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_DIM}50`, maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {(['result', 'reveal'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors"
              style={{
                color: tab === t ? ACCENT : 'var(--text-muted)',
                background: tab === t ? `${ACCENT_DIM}12` : 'transparent',
                borderBottom: tab === t ? `2px solid ${ACCENT}` : '2px solid transparent',
                fontFamily: 'var(--font-sport)',
              }}>
              {t === 'result' ? 'Resultado' : 'Respuestas'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">
          {tab === 'result' ? (
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <div className="flex justify-center" style={{ color: resultColor }}><ResultIcon size={64} /></div>
              <div>
                <h2 className="font-black text-2xl" style={{ fontFamily: 'var(--font-display)', color: '#F0F0F5' }}>{msg}</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>TakaGrid · {dayKey}</p>
              </div>

              {/* Mini grid */}
              <div className="grid grid-cols-3 gap-1.5">
                {grid.flat().map((c, i) => (
                  <div key={i} className="w-12 h-12 rounded-lg flex items-center justify-center text-lg"
                    style={{ background: c.playerId ? `${ACCENT_DIM}30` : c.wrong !== null ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)', border: c.playerId ? `1px solid ${ACCENT}60` : c.wrong !== null ? '1px solid rgba(220,38,38,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                    {c.playerId ? '🟧' : c.wrong !== null ? '🟥' : '⬛'}
                  </div>
                ))}
              </div>

              {streak >= 2 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl w-full justify-center"
                  style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                  <span style={{ color: '#FB923C' }}><FireIcon size={16} /></span>
                  <span className="text-[11px] font-black" style={{ color: '#FB923C', fontFamily: 'var(--font-sport)' }}>
                    ¡Racha de {streak} días!
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 w-full">
                <button onClick={handleShare} className="py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                  style={{ background: `linear-gradient(135deg,${ACCENT_DIM},#9a3412)`, color: '#fff', fontFamily: 'var(--font-sport)', boxShadow: `0 4px 16px ${ACCENT_DIM}40` }}>
                  <IconShare /> Texto
                </button>
                <button onClick={handleShareImage} disabled={sharingImg} className="py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                  style={{ background: `${ACCENT_DIM}25`, color: ACCENT, border: `1px solid ${ACCENT_DIM}50`, fontFamily: 'var(--font-sport)', opacity: sharingImg ? 0.6 : 1 }}>
                  📸 Imagen
                </button>
                {hasMissed ? (
                  <button onClick={() => setTab('reveal')} className="py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}>
                    Resp. →
                  </button>
                ) : (
                  <div />
                )}
              </div>
              <p className="text-[10px]" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>Nuevo puzzle mañana</p>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                Jugadores válidos por celda
              </p>
              {puzzle.rows.map((rowCond, r) => (
                <div key={r} className="mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                    {rowCond.emoji} {rowCond.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {puzzle.cols.map((colCond, c) => {
                      const cell = grid[r][c]
                      const examples = validAnswers[r][c].slice(0, 3)
                      const solved = !!cell.playerId
                      return (
                        <div key={c} className="rounded-xl p-2" style={{
                          background: solved ? `${ACCENT_DIM}15` : 'rgba(255,255,255,0.03)',
                          border: solved ? `1px solid ${ACCENT}40` : '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <p className="text-[8px] font-black uppercase tracking-widest mb-1.5" style={{ color: solved ? ACCENT : 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                            {colCond.emoji} {colCond.label}
                          </p>
                          {examples.length === 0 ? (
                            <p className="text-[9px]" style={{ color: '#EF4444' }}>— sin datos</p>
                          ) : (
                            <ul className="flex flex-col gap-0.5">
                              {examples.map(p => (
                                <li key={p.id} className="text-[9px] font-black truncate flex items-center gap-1" style={{ color: solved ? '#F0F0F5' : 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-display)' }}>
                                  <CountryFlag country={p.country} width={11} />
                                  <span className="truncate">{p.name}</span>
                                </li>
                              ))}
                              {validAnswers[r][c].length > 3 && (
                                <li className="text-[8px]" style={{ color: '#3A3A52', fontFamily: 'var(--font-sport)' }}>
                                  +{validAnswers[r][c].length - 3} más
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 pt-0">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-sport)' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function TakaGridPage() {
  const [hydrated, setHydrated] = useState(false)
  const [grid, setGrid] = useState<GridState>(emptyGrid)
  const [finished, setFinished] = useState(false)
  const [activeCell, setActiveCell] = useState<CellCoord | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [streakState, setStreakState] = useState<StreakState>({ streak: 0, bestStreak: 0, lastFinishedDate: '', history: [] })

  const { puzzle, dayKey } = useMemo(() => getDailyPuzzle(), [])
  const validAnswers = useMemo(() => getValidAnswers(puzzle), [puzzle])

  // Hydrate
  useEffect(() => {
    const stored = loadState()
    if (stored && stored.dayKey === dayKey.key) {
      setGrid(stored.grid)
      setFinished(stored.finished)
      if (stored.finished) setTimeout(() => setShowResult(true), 400)
    }
    setStreakState(loadStreak())
    setHydrated(true)
    trackGameEvent({ gameId: 'takagrid', event: 'started', period: dayKey.key })
  }, [dayKey.key])

  // Persist grid
  useEffect(() => {
    if (!hydrated) return
    saveState({ dayKey: dayKey.key, grid, finished })
  }, [hydrated, dayKey.key, grid, finished])

  const solved = useMemo(() => countSolved(grid), [grid])
  const usedIds = useMemo(() => grid.flat().map(c => c.playerId).filter((id): id is string => !!id), [grid])

  const handleCellClick = useCallback((row: 0|1|2, col: 0|1|2) => {
    if (finished || grid[row][col].locked) return
    setActiveCell({ row, col })
  }, [finished, grid])

  const handleSelectPlayer = useCallback((player: Player) => {
    if (!activeCell) return
    const { row, col } = activeCell
    const valid = isValidAnswer(player, puzzle, { row, col })

    setGrid(prev => {
      const next = prev.map(r => r.map(c => ({ ...c })))
      next[row][col] = valid
        ? { playerId: player.id, wrong: null, locked: true }
        : { playerId: null, wrong: player.name, locked: true }
      return next
    })
    setActiveCell(null)

    setGrid(current => {
      const allLocked = current.flat().every(c => c.locked)
      if (allLocked) {
        setFinished(true)
        // Update streak
        const solvedCount = current.flat().filter(c => c.playerId !== null).length

        // Sync con backend unificado. payload.solved = bool[9] row-major.
        const solvedArr = current.flat().map(c => c.playerId !== null)
        const period = currentDayISO()
        void recordPlay({
          gameId:  'takagrid',
          period,
          score:   solvedCount * 10,
          payload: { solved: solvedArr },
        })
        trackGameEvent({ gameId: 'takagrid', event: 'completed', period, meta: { solved: solvedCount } })

        const prev = loadStreak()
        const alreadyToday = prev.lastFinishedDate === dayKey.key
        if (!alreadyToday) {
          const wasYesterday = isYesterday(prev.lastFinishedDate, dayKey.key)
          const newStreak = wasYesterday ? prev.streak + 1 : 1
          const next: StreakState = {
            streak: newStreak,
            bestStreak: Math.max(prev.bestStreak, newStreak),
            lastFinishedDate: dayKey.key,
            history: [{ dayKey: dayKey.key, solved: solvedCount }, ...prev.history.slice(0, 29)],
          }
          saveStreak(next)
          setStreakState(next)
        }
        setTimeout(() => setShowResult(true), 600)
      }
      return current
    })
  }, [activeCell, puzzle, dayKey.key])

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-24">
        {/* Breadcrumb */}
        <div className="pt-6 sm:pt-8">
          <Link href="/juegos" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-colors hover:text-white" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            <IconBack /> Volver a juegos
          </Link>
        </div>

        {/* Hero */}
        <div className="pt-4 pb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
              TakaGrid · Diario · {dayKey.key}
            </span>
          </div>
          <h1 className="font-black leading-tight mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', color: '#F8F8FF', letterSpacing: '-0.02em' }}>
            Conecta jugador con club.
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 520 }}>
            Encuentra el jugador que cumple la fila <strong style={{ color: '#F0F0F5' }}>(club)</strong> y la columna <strong style={{ color: '#F0F0F5' }}>(categoría)</strong>. Solo tienes un intento por celda.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          {/* Score strip */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>{solved}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>/9</span>
            </div>
            <div className="h-1.5 w-32 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full transition-all duration-500" style={{ width: `${(solved / 9) * 100}%`, background: `linear-gradient(90deg, ${ACCENT_DIM}, ${ACCENT})` }} />
            </div>
            {streakState.streak >= 2 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl"
                style={{ background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.25)' }}>
                <span style={{ color: '#FB923C' }}><FireIcon size={14} /></span>
                <span className="text-[11px] font-black" style={{ color: '#FB923C', fontFamily: 'var(--font-sport)' }}>
                  {streakState.streak} días
                </span>
              </div>
            )}
            {finished && (
              <button onClick={() => setShowResult(true)} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                style={{ background: `${ACCENT_DIM}20`, color: ACCENT, border: `1px solid ${ACCENT_DIM}40`, fontFamily: 'var(--font-sport)' }}>
                <IconShare /> Resultado
              </button>
            )}
          </div>

          {/* Grid */}
          {hydrated && (
            <div className="w-full" style={{ maxWidth: 560 }}>
              {/* Column headers */}
              <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: 'clamp(56px,18vw,80px) 1fr 1fr 1fr' }}>
                <div />
                {puzzle.cols.map((col, c) => (
                  <div key={c} className="rounded-xl px-1 py-2 flex flex-col items-center justify-center text-center gap-0.5 min-h-[56px]"
                    style={{ background: `${ACCENT_DIM}12`, border: `1px solid ${ACCENT_DIM}25` }}>
                    <span className="text-base leading-none">{col.emoji}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest leading-tight" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                      {col.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {puzzle.rows.map((row, r) => (
                <div key={r} className="grid gap-2 mb-2" style={{ gridTemplateColumns: 'clamp(56px,18vw,80px) 1fr 1fr 1fr' }}>
                  {/* Row header */}
                  <div className="rounded-xl px-1 py-2 flex flex-col items-center justify-center text-center gap-0.5 min-h-[90px]"
                    style={{ background: `${ACCENT_DIM}12`, border: `1px solid ${ACCENT_DIM}25` }}>
                    <span className="text-base leading-none">{row.emoji}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest leading-tight" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                      {row.label}
                    </span>
                  </div>
                  {/* Cells */}
                  {puzzle.cols.map((_, c) => (
                    <GridCell
                      key={c}
                      cell={grid[r][c]}
                      onClick={() => handleCellClick(r as 0|1|2, c as 0|1|2)}
                      isFinished={finished}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Hints section */}
          {hydrated && (
            <div className="w-full rounded-2xl p-4" style={{ maxWidth: 560, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                Jugadores posibles por celda
              </p>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'clamp(56px,18vw,80px) 1fr 1fr 1fr' }}>
                <div />
                {puzzle.cols.map((col, c) => (
                  <div key={c} className="text-center">
                    <span className="text-[9px] font-black uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                      {col.emoji}
                    </span>
                  </div>
                ))}
                {puzzle.rows.map((row, r) => (
                  <>
                    <div key={`row-${r}`} className="flex items-center">
                      <span className="text-[9px] font-black uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{row.emoji}</span>
                    </div>
                    {[0, 1, 2].map(c => {
                      const count = validAnswers[r][c].length
                      return (
                        <div key={`hint-${r}-${c}`} className="rounded-lg px-2 py-1 text-center"
                          style={{ background: count === 0 ? 'rgba(220,38,38,0.08)' : count <= 3 ? `${ACCENT_DIM}12` : 'rgba(255,255,255,0.03)', border: count === 0 ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-[10px] font-black" style={{ color: count === 0 ? '#EF4444' : count <= 3 ? ACCENT : 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                            {count === 0 ? '—' : count}
                          </span>
                        </div>
                      )
                    })}
                  </>
                ))}
              </div>
              <p className="text-[9px] mt-2" style={{ color: '#2A2A40', fontFamily: 'var(--font-sport)' }}>
                Número de jugadores en nuestro catálogo que encajan. En rojo = ninguno en el catálogo (busca igualmente, puede que lo tengamos).
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Search modal */}
      {activeCell && (
        <SearchModal
          cell={activeCell}
          puzzle={puzzle}
          usedIds={usedIds}
          validCount={validAnswers[activeCell.row][activeCell.col].length}
          onSelect={handleSelectPlayer}
          onClose={() => setActiveCell(null)}
        />
      )}

      {/* Result overlay */}
      {showResult && (
        <ResultOverlay
          solved={solved}
          grid={grid}
          puzzle={puzzle}
          dayKey={dayKey.key}
          validAnswers={validAnswers}
          streak={streakState.streak}
          onClose={() => setShowResult(false)}
        />
      )}

      <Footer />
      <ScrollToTop />
    </div>
  )
}
