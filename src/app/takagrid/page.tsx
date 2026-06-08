'use client'

import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'
import GameOnboarding from '@/components/games/GameOnboarding'
import { searchPlayers, fuzzySearchPlayers, getPlayerById, type Player } from '@/lib/players-catalog'
import { getDailyPuzzle, isValidAnswer, getValidAnswers, type CellCoord, type GridPuzzle } from '@/lib/takagrid-puzzles'
import { TrophyIcon, StarIcon, ClapIcon, FlexIcon, FireIcon, CountryFlag } from '@/components/icons/GameIcons'
import { recordPlay, currentDayISO, type GamePlay } from '@/lib/games-store'
import { madridParts, madridDayISO } from '@/lib/taka-time'
import { trackGameEvent } from '@/lib/games-telemetry'
import { addXp, xpForTakagrid } from '@/lib/meta-progression'
import { reportPlay } from '@/lib/missions'
import { collectPlayer } from '@/lib/album'
import MyPositionBanner from '@/components/games/MyPositionBanner'

// ── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = 'ts_takagrid_state'
const STREAK_KEY = 'ts_takagrid_streak'
const HARD_PREF_KEY = 'ts_takagrid_hard_mode'
const ACCENT = '#FDBA74'
const ACCENT_DIM = '#EA580C'
const HINT_COLOR = '#FCD34D'

// Últimas N fechas (YYYY-MM-DD, hora Madrid) para el archivo de puzzles.
// Mediodía UTC como ancla → sin bordes de medianoche/DST al restar días.
function recentArchiveDates(count = 7): string[] {
  const t = madridParts()
  const base = Date.UTC(t.year, t.month - 1, t.day, 12)
  return Array.from({ length: count }, (_, i) => madridDayISO(new Date(base - (i + 1) * 86400000)))
}

function archiveDateLabel(iso: string, idx: number): string {
  if (idx === 0) return 'Ayer'
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' }).format(dt)
}

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
  hardMode?: boolean
  pistaCell?: CellCoord | null
  pistaLetter?: string | null
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

// Inicial más común entre los apellidos de los jugadores válidos de una
// celda. Usado por la Pista (un solo uso por puzzle): muestra una letra
// sin destapar al jugador concreto.
function pickHintLetter(validForCell: Player[]): string | null {
  if (!validForCell || validForCell.length === 0) return null
  const counts = new Map<string, number>()
  for (const p of validForCell) {
    const last = p.name.trim().split(/\s+/).pop() ?? ''
    if (!last) continue
    const ch = last[0].toUpperCase()
    counts.set(ch, (counts.get(ch) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  let best: { ch: string; n: number } | null = null
  for (const [ch, n] of counts) {
    if (!best || n > best.n) best = { ch, n }
  }
  return best?.ch ?? null
}

function loadHardPref(): boolean {
  try { return localStorage.getItem(HARD_PREF_KEY) === '1' } catch { return false }
}
function saveHardPref(v: boolean) {
  try { localStorage.setItem(HARD_PREF_KEY, v ? '1' : '0') } catch { /* ignore */ }
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
  const [pending, setPending] = useState<Player | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const rowCond = puzzle.rows[cell.row]
  const colCond = puzzle.cols[cell.col]

  // Foco inicial en el buscador, bloqueo de scroll y devolución del foco a la
  // celda que abrió el diálogo al cerrarse (mount/unmount).
  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      prevFocused?.focus?.()
    }
  }, [])

  // Teclado: Escape cierra (o cancela la confirmación) y Tab queda atrapado
  // dentro del diálogo (no se escapa al fondo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pending) setPending(null)
        else onClose()
        return
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])'),
        ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending])

  const results = useMemo(() =>
    searchPlayers(query, { excludeIds: usedIds, limit: 40 }),
  [query, usedIds])

  const fuzzyResults = useMemo(() =>
    results.length === 0 && query.trim().length >= 3
      ? fuzzySearchPlayers(query, { excludeIds: usedIds, limit: 5 })
      : [],
  [results.length, query, usedIds])

  const posLabel = (p: Player['position']) =>
    p === 'GK' ? 'Portero' : p === 'DEF' ? 'Defensa' : p === 'MID' ? 'Centrocampista' : 'Delantero'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Elegir jugador para ${rowCond.label} y ${colCond.label}`}
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
            <p className="text-[9px]" style={{ color: validCount <= 3 ? ACCENT : '#9090A4', fontFamily: 'var(--font-sport)' }}>
              {validCount === 0 ? '⚠️ Ninguno en catálogo — prueba igualmente' : validCount === 1 ? '🔥 Solo 1 jugador en catálogo' : validCount <= 3 ? `🔥 Solo ${validCount} en catálogo` : `${validCount} jugadores posibles en catálogo`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}>
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
            <div className="px-2 py-4">
              <p className="text-sm text-center mb-3" style={{ color: 'var(--text-muted)' }}>
                Sin resultados exactos para &ldquo;{query}&rdquo;
              </p>
              {fuzzyResults.length > 0 && (
                <>
                  <p className="px-2 mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                    ¿Quisiste decir…?
                  </p>
                  <ul className="flex flex-col gap-1">
                    {fuzzyResults.map(p => (
                      <li key={p.id}>{renderPlayerRow(p, () => setPending(p), posLabel)}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map(p => (
                <li key={p.id}>{renderPlayerRow(p, () => setPending(p), posLabel)}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Confirmation footer */}
        {pending && (
          <div className="p-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${ACCENT_DIM}50`, background: `${ACCENT_DIM}10` }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-center" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
              Confirmar selección · 1 intento por celda
            </p>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${ACCENT_DIM}, #9a3412)`, color: '#fff', fontFamily: 'var(--font-display)' }}>
                {pending.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1 min-w-0">
                {/* Club y país omitidos para no desvelar la respuesta */}
                <p className="text-sm font-black truncate" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                  {pending.name}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{posLabel(pending.position)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPending(null)}
                className="py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-sport)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { onSelect(pending); setPending(null) }}
                className="py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest"
                style={{ background: `linear-gradient(135deg, ${ACCENT_DIM}, #9a3412)`, color: '#fff', fontFamily: 'var(--font-sport)', boxShadow: `0 4px 16px ${ACCENT_DIM}40` }}
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function renderPlayerRow(p: Player, onClick: () => void, posLabel: (pos: Player['position']) => string) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left hover:bg-white/5"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0"
        style={{ background: `${ACCENT_DIM}28`, color: ACCENT, border: `1px solid ${ACCENT_DIM}40`, fontFamily: 'var(--font-display)' }}
      >
        {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
      </div>
      <div className="flex-1 min-w-0">
        {/* Club y bandera se omiten para no desvelar la respuesta */}
        <p className="text-sm font-black truncate" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
          {p.name}
        </p>
        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{posLabel(p.position)}</p>
      </div>
      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0" style={{
        background: p.era === 'current' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
        color: p.era === 'current' ? '#4ade80' : '#5A5A7A',
        fontFamily: 'var(--font-sport)',
      }}>
        {p.era === 'current' ? 'Activo' : 'Leyenda'}
      </span>
    </button>
  )
}

// ── Grid cell ─────────────────────────────────────────────────────

interface GridCellProps {
  cell: CellState
  onClick: () => void
  isFinished: boolean
  hintLetter?: string | null
  pickingHint?: boolean
  rowLabel: string
  colLabel: string
}

function GridCell({ cell, onClick, isFinished, hintLetter, pickingHint, rowLabel, colLabel }: GridCellProps) {
  const player = cell.playerId ? getPlayerById(cell.playerId) : null
  const canClick = !cell.locked && !isFinished

  if (player) {
    return (
      <div
        role="img"
        aria-label={`${rowLabel} y ${colLabel}: ${player.name}, correcto`}
        className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 text-center"
        style={{ background: `linear-gradient(135deg, ${ACCENT_DIM}30, ${ACCENT_DIM}10)`, border: `1px solid ${ACCENT}60`, minHeight: 90 }}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black"
          style={{ background: `linear-gradient(135deg, ${ACCENT_DIM}, #9a3412)`, color: '#fff', fontFamily: 'var(--font-display)' }}>
          {player.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
        </div>
        <p className="text-[10px] font-black leading-tight flex items-center justify-center gap-1 w-full min-w-0" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
          <CountryFlag country={player.country} width={12} />
          <span className="truncate">{player.name.split(' ').slice(-1)[0]}</span>
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
        role="img"
        aria-label={`${rowLabel} y ${colLabel}: ${cell.wrong}, no válido`}
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

  const hinted = !!hintLetter
  return (
    <button
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      aria-label={hinted ? `Elegir jugador para ${rowLabel} y ${colLabel}. Pista: empieza por ${hintLetter}` : `Elegir jugador para ${rowLabel} y ${colLabel}`}
      className="flex flex-col items-center justify-center gap-1 rounded-xl transition-all disabled:opacity-40"
      style={{
        background: hinted ? `${HINT_COLOR}12` : 'rgba(255,255,255,0.03)',
        border: hinted
          ? `1px solid ${HINT_COLOR}66`
          : pickingHint
            ? `1px dashed ${HINT_COLOR}88`
            : canClick ? `1px dashed ${ACCENT_DIM}60` : '1px solid rgba(255,255,255,0.05)',
        minHeight: 90,
        cursor: canClick ? 'pointer' : 'default',
        boxShadow: hinted ? `0 0 10px ${HINT_COLOR}33` : undefined,
      }}
    >
      {hinted ? (
        <>
          <span className="text-2xl font-black leading-none" style={{ color: HINT_COLOR, fontFamily: 'var(--font-display)' }}>
            {hintLetter}
          </span>
          <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: HINT_COLOR, fontFamily: 'var(--font-sport)' }}>
            Empieza por…
          </span>
        </>
      ) : (
        <>
          <span style={{ color: ACCENT_DIM, opacity: 0.6, fontSize: 22 }}>+</span>
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {pickingHint ? 'Elige aquí' : 'Elegir'}
          </span>
        </>
      )}
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

              <MyPositionBanner gameId="takagrid" period={dayKey} accent={ACCENT} />

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
              <p className="text-[10px]" style={{ color: '#9090A4', fontFamily: 'var(--font-sport)' }}>Nuevo puzzle mañana</p>
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
  const [hardMode, setHardMode] = useState(false)
  const [pistaCell, setPistaCell] = useState<CellCoord | null>(null)
  const [pistaLetter, setPistaLetter] = useState<string | null>(null)
  const [awaitingPistaCell, setAwaitingPistaCell] = useState(false)

  const { puzzle, dayKey } = useMemo(() => getDailyPuzzle(), [])
  const validAnswers = useMemo(() => getValidAnswers(puzzle), [puzzle])

  // Hydrate
  useEffect(() => {
    const stored = loadState()
    if (stored && stored.dayKey === dayKey.key) {
      setGrid(stored.grid)
      setFinished(stored.finished)
      setPistaCell(stored.pistaCell ?? null)
      setPistaLetter(stored.pistaLetter ?? null)
      // hardMode del puzzle si quedó persistido, o pref global
      setHardMode(stored.hardMode ?? loadHardPref())
      if (stored.finished) setTimeout(() => setShowResult(true), 400)
    } else {
      setHardMode(loadHardPref())
    }
    setStreakState(loadStreak())
    setHydrated(true)
    trackGameEvent({ gameId: 'takagrid', event: 'started', period: dayKey.key })
  }, [dayKey.key])

  // Persist grid + pista + hard mode (per-puzzle)
  useEffect(() => {
    if (!hydrated) return
    saveState({ dayKey: dayKey.key, grid, finished, hardMode, pistaCell, pistaLetter })
  }, [hydrated, dayKey.key, grid, finished, hardMode, pistaCell, pistaLetter])

  const solved = useMemo(() => countSolved(grid), [grid])
  const usedIds = useMemo(() => grid.flat().map(c => c.playerId).filter((id): id is string => !!id), [grid])

  const handleCellClick = useCallback((row: 0|1|2, col: 0|1|2) => {
    if (finished || grid[row][col].locked) return
    // En modo "esperando pista", el siguiente click destapa la inicial en
    // lugar de abrir la búsqueda de jugador.
    if (awaitingPistaCell && !pistaCell) {
      const letter = pickHintLetter(validAnswers[row][col])
      if (letter) {
        setPistaCell({ row, col })
        setPistaLetter(letter)
      }
      setAwaitingPistaCell(false)
      return
    }
    setActiveCell({ row, col })
  }, [finished, grid, awaitingPistaCell, pistaCell, validAnswers])

  const toggleHardMode = useCallback(() => {
    setHardMode(prev => {
      const next = !prev
      saveHardPref(next)
      return next
    })
  }, [])

  const requestPista = useCallback(() => {
    if (finished || pistaCell) return
    setAwaitingPistaCell(a => !a)
  }, [finished, pistaCell])

  const handleSelectPlayer = useCallback((player: Player) => {
    if (!activeCell) return
    const { row, col } = activeCell
    const valid = isValidAnswer(player, puzzle, { row, col })
    if (valid) collectPlayer(player.id, 'takagrid')

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
        const score = solvedCount * (hardMode ? 20 : 10)
        void recordPlay({
          gameId:  'takagrid',
          period,
          score,
          payload: { solved: solvedArr, hardMode },
        })
        addXp('takagrid', xpForTakagrid(solvedCount) + (hardMode ? 15 : 0))
        reportPlay('takagrid', { score, solved: solvedCount })
        trackGameEvent({ gameId: 'takagrid', event: 'completed', period, meta: { solved: solvedCount, hardMode } })

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
  }, [activeCell, puzzle, dayKey.key, hardMode])

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <GameOnboarding
        storageKey="ts-onboarded-takagrid"
        accent={ACCENT}
        ctaFinal="Empezar el grid"
        steps={[
          { emoji: '🟧', title: 'Resuelve el grid del día', body: 'Cada celda pide un jugador que cumpla AMBAS condiciones de su fila y columna.' },
          { emoji: '🔍', title: 'Búscalos por nombre', body: 'Toca una celda, escribe parte del nombre y elige de la lista. Si hay match válido, queda en verde.' },
          { emoji: '🔥', title: 'Perfecto = 9/9', body: 'Resolver las nueve celdas suma a tu racha diaria. Cada día hay un grid nuevo.' },
        ]}
      />

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
            {!finished && (
              <>
                <button
                  onClick={toggleHardMode}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition-opacity hover:opacity-90"
                  style={{
                    background: hardMode ? 'rgba(248,113,113,0.18)' : 'rgba(255,255,255,0.04)',
                    color: hardMode ? '#FCA5A5' : 'var(--text-muted)',
                    border: hardMode ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    fontFamily: 'var(--font-sport)',
                  }}
                  title={hardMode ? 'Sin pistas de catálogo · doble puntos' : 'Activar modo hard'}
                  aria-pressed={hardMode}
                >
                  {hardMode ? '🔥 Hard ×2' : '⚡ Modo Hard'}
                </button>
                <button
                  onClick={requestPista}
                  disabled={!!pistaCell}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: awaitingPistaCell ? `${HINT_COLOR}25` : `${HINT_COLOR}12`,
                    color: HINT_COLOR,
                    border: `1px solid ${HINT_COLOR}40`,
                    fontFamily: 'var(--font-sport)',
                  }}
                  title={pistaCell ? 'Pista ya gastada en este puzzle' : awaitingPistaCell ? 'Pincha una celda para destapar la inicial' : 'Destapa la inicial común de los válidos de una celda'}
                >
                  💡 {pistaCell ? 'Pista usada' : awaitingPistaCell ? 'Elige celda…' : 'Pista'}
                </button>
              </>
            )}
          </div>

          {/* Grid */}
          {hydrated && (
            <div className="w-full" style={{ maxWidth: 560 }}>
              {/* Column headers */}
              <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: 'clamp(46px,14vw,72px) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)' }}>
                <div />
                {puzzle.cols.map((col, c) => (
                  <div key={c} className="rounded-xl px-1 py-2 flex flex-col items-center justify-center text-center gap-0.5 min-h-[56px]"
                    style={{ background: `${ACCENT_DIM}12`, border: `1px solid ${ACCENT_DIM}25` }}>
                    <span className="text-base leading-none">{col.emoji}</span>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-tight break-words" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                      {col.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rows */}
              {puzzle.rows.map((row, r) => (
                <div key={r} className="grid gap-2 mb-2" style={{ gridTemplateColumns: 'clamp(46px,14vw,72px) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)' }}>
                  {/* Row header */}
                  <div className="rounded-xl px-1 py-2 flex flex-col items-center justify-center text-center gap-0.5 min-h-[90px]"
                    style={{ background: `${ACCENT_DIM}12`, border: `1px solid ${ACCENT_DIM}25` }}>
                    <span className="text-base leading-none">{row.emoji}</span>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-tight break-words" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                      {row.label}
                    </span>
                  </div>
                  {/* Cells */}
                  {puzzle.cols.map((_, c) => {
                    const isHintCell = pistaCell && pistaCell.row === r && pistaCell.col === c
                    return (
                      <GridCell
                        key={c}
                        cell={grid[r][c]}
                        rowLabel={row.label}
                        colLabel={puzzle.cols[c].label}
                        onClick={() => handleCellClick(r as 0|1|2, c as 0|1|2)}
                        isFinished={finished}
                        hintLetter={isHintCell ? pistaLetter : null}
                        pickingHint={awaitingPistaCell && !pistaCell}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Hints section — oculta en modo Hard */}
          {hydrated && !hardMode && (
            <div className="w-full rounded-2xl p-4" style={{ maxWidth: 560, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                Jugadores posibles por celda
              </p>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'clamp(46px,14vw,72px) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)' }}>
                <div />
                {puzzle.cols.map((col, c) => (
                  <div key={c} className="text-center">
                    <span className="text-[9px] font-black uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                      {col.emoji}
                    </span>
                  </div>
                ))}
                {puzzle.rows.map((row, r) => (
                  <Fragment key={`hint-row-${r}`}>
                    <div className="flex items-center">
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
                  </Fragment>
                ))}
              </div>
              <p className="text-[9px] mt-2" style={{ color: '#9090A4', fontFamily: 'var(--font-sport)' }}>
                Número de jugadores en nuestro catálogo que encajan. En rojo = ninguno en el catálogo (busca igualmente, puede que lo tengamos).
              </p>
            </div>
          )}
        </div>

        {/* Puzzles anteriores (archivo) — repaso libre, no cuenta para racha/ranking */}
        {hydrated && (
          <section className="mt-14 max-w-[560px] mx-auto w-full">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
              <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                Puzzles anteriores
              </h2>
            </div>
            <p className="text-[11px] mb-3.5" style={{ color: 'var(--text-muted)' }}>
              Repasa o entrena con los grids de días pasados. El archivo es libre: no cuenta para tu racha ni el ranking.
            </p>
            <div className="flex flex-wrap gap-2">
              {recentArchiveDates(7).map((iso, i) => (
                <Link
                  key={iso}
                  href={`/takagrid/${iso}`}
                  className="text-[11px] font-black px-3 py-1.5 rounded-xl transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#C8C8D8', border: '1px solid rgba(255,255,255,0.07)', fontFamily: 'var(--font-sport)' }}
                >
                  {archiveDateLabel(iso, i)}
                </Link>
              ))}
            </div>
          </section>
        )}
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
