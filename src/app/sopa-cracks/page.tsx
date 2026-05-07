'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { trackGameStart, trackGameComplete } from '@/lib/analytics'
import Header from '@/components/Header'
import LiveStrip from '@/components/LiveStrip'
import Footer from '@/components/Footer'
import ScrollToTop from '@/components/ScrollToTop'

// ── Tipos y datos ─────────────────────────────────────────────

type Cell = { r: number; c: number }
type Placed = { word: string; cells: Cell[] }

interface Puzzle {
  id: string
  title: string
  subtitle: string
  size: number
  words: string[]
}

const PUZZLES: Puzzle[] = [
  {
    id: 'leyendas-laliga',
    title: 'Leyendas de LaLiga',
    subtitle: 'Diez cracks que dejaron huella en España',
    size: 13,
    words: ['MESSI', 'RAUL', 'ZIDANE', 'PUYOL', 'INIESTA', 'XAVI', 'CASILLAS', 'KROOS', 'MODRIC', 'RONALDO'],
  },
  {
    id: 'pichichis-historicos',
    title: 'Pichichis históricos',
    subtitle: 'Goleadores que reinaron en LaLiga',
    size: 13,
    words: ['ZARRA', 'MESSI', 'CRISTIANO', 'BENZEMA', 'SUAREZ', 'FORLAN', 'VILLA', 'AGUERO', 'ETOO'],
  },
  {
    id: 'leyendas-mundiales',
    title: 'Leyendas mundiales',
    subtitle: 'Iconos del fútbol global',
    size: 14,
    words: ['MARADONA', 'PELE', 'CRUYFF', 'BECKENBAUER', 'PLATINI', 'ZICO', 'ROMARIO', 'MALDINI', 'BAGGIO'],
  },
  {
    id: 'champions-goleadores',
    title: 'Reyes de la Champions',
    subtitle: 'Los máximos goleadores de la historia europea',
    size: 13,
    words: ['RONALDO', 'MESSI', 'BENZEMA', 'RAUL', 'MORIENTES', 'HENRY', 'SHEVCHENKO', 'INZAGHI'],
  },
  {
    id: 'porteros-leyenda',
    title: 'Porteros de leyenda',
    subtitle: 'Los mejores guardametas de la historia',
    size: 13,
    words: ['CASILLAS', 'BUFFON', 'NEUER', 'YASHIN', 'ZOFF', 'SCHMEICHEL', 'KAHN', 'SEAMAN'],
  },
  {
    id: 'seleccion-espana',
    title: 'La Roja campeona',
    subtitle: 'Héroes de los Mundiales y Europas de España',
    size: 13,
    words: ['XAVI', 'INIESTA', 'VILLA', 'CASILLAS', 'PUYOL', 'TORRES', 'BUSQUETS', 'FABREGAS', 'RAMOS'],
  },
  {
    id: 'crack-premier',
    title: 'Estrellas de la Premier',
    subtitle: 'Cracks que brillaron en Inglaterra',
    size: 13,
    words: ['HENRY', 'BERGKAMP', 'GERRARD', 'LAMPARD', 'SCHOLES', 'SHEARER', 'GIGGS', 'BECKHAM'],
  },
  {
    id: 'generacion-argentina',
    title: 'Argentina de oro',
    subtitle: 'Mitos del fútbol albiceleste',
    size: 13,
    words: ['MARADONA', 'MESSI', 'BATISTUTA', 'CANIGGIA', 'RIQUELME', 'TEVEZ', 'AGUERO', 'VERON'],
  },
  {
    id: 'entrenadores-historia',
    title: 'Genios del banquillo',
    subtitle: 'Los mejores entrenadores de la historia',
    size: 14,
    words: ['MOURINHO', 'ANCELOTTI', 'GUARDIOLA', 'FERGUSON', 'CAPELLO', 'CRUYFF', 'MICHELS', 'SACCHI'],
  },
  {
    id: 'brasil-magico',
    title: 'Brasil mágico',
    subtitle: 'La Canarinha en estado puro',
    size: 13,
    words: ['PELE', 'RONALDO', 'RONALDINHO', 'ZICO', 'ROMARIO', 'CAFU', 'ROBERTO', 'RIVALDO'],
  },
  {
    id: 'bundesliga-cracks',
    title: 'Leyendas de la Bundesliga',
    subtitle: 'Los mejores de Alemania',
    size: 13,
    words: ['MULLER', 'BECKENBAUER', 'RUMMENIGGE', 'ROBBEN', 'RIBERY', 'LEWANDOWSKI', 'NEUER', 'KAHN'],
  },
  {
    id: 'italia-calcio',
    title: 'El Calcio eterno',
    subtitle: 'Ídolos del fútbol italiano',
    size: 13,
    words: ['MALDINI', 'BUFFON', 'TOTTI', 'DELPIERO', 'BAGGIO', 'BARESI', 'ZOLA', 'PIRLO'],
  },
]

const COLOR_ACCENT = '#6EE7B7'
const COLOR_ACCENT_DIM = '#059669'
const STORAGE_KEY = 'ts_sopa_cracks_state'

// ── Selección de puzzle por semana ────────────────────────────

function getISOWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNr = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

function getCurrentPuzzle(): Puzzle {
  const week = getISOWeek(new Date())
  return PUZZLES[week % PUZZLES.length]
}

// ── Generación del grid ───────────────────────────────────────

const DIRS: ReadonlyArray<[number, number]> = [
  [0, 1],   // →
  [0, -1],  // ←
  [1, 0],   // ↓
  [-1, 0],  // ↑
  [1, 1],   // ↘
  [-1, -1], // ↖
  [1, -1],  // ↙
  [-1, 1],  // ↗
]

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

interface BuiltGrid {
  letters: string[][]
  placed: Placed[]
}

// Mulberry32 — PRNG determinista por seed
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildGrid(puzzle: Puzzle, seed: number): BuiltGrid {
  const N = puzzle.size
  const rand = mulberry32(seed)
  const letters: string[][] = Array.from({ length: N }, () => Array(N).fill(''))
  const placed: Placed[] = []

  // Ordenar por longitud descendente — colocar las largas primero
  const sorted = [...puzzle.words].sort((a, b) => b.length - a.length)

  for (const word of sorted) {
    let placedOk = false
    for (let attempt = 0; attempt < 200 && !placedOk; attempt++) {
      const dir = DIRS[Math.floor(rand() * DIRS.length)]
      const r0 = Math.floor(rand() * N)
      const c0 = Math.floor(rand() * N)

      // Comprobar cabida
      const cells: Cell[] = []
      let fits = true
      for (let i = 0; i < word.length; i++) {
        const r = r0 + dir[0] * i
        const c = c0 + dir[1] * i
        if (r < 0 || r >= N || c < 0 || c >= N) { fits = false; break }
        const existing = letters[r][c]
        if (existing && existing !== word[i]) { fits = false; break }
        cells.push({ r, c })
      }
      if (!fits) continue

      // Colocar
      for (let i = 0; i < word.length; i++) {
        letters[cells[i].r][cells[i].c] = word[i]
      }
      placed.push({ word, cells })
      placedOk = true
    }
  }

  // Rellenar huecos
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!letters[r][c]) {
        letters[r][c] = ALPHABET[Math.floor(rand() * 26)]
      }
    }
  }

  return { letters, placed }
}

// ── Helpers de selección ──────────────────────────────────────

function lineBetween(a: Cell, b: Cell): Cell[] | null {
  const dr = b.r - a.r
  const dc = b.c - a.c
  if (dr === 0 && dc === 0) return [a]

  // Tiene que ser horizontal, vertical o diagonal pura
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null

  const steps = Math.max(Math.abs(dr), Math.abs(dc))
  const sr = Math.sign(dr)
  const sc = Math.sign(dc)
  const cells: Cell[] = []
  for (let i = 0; i <= steps; i++) {
    cells.push({ r: a.r + sr * i, c: a.c + sc * i })
  }
  return cells
}

function cellsToString(cells: Cell[], grid: string[][]): string {
  return cells.map(({ r, c }) => grid[r][c]).join('')
}

function sameCells(a: Cell[], b: Cell[]): boolean {
  if (a.length !== b.length) return false
  // Comparar como conjuntos (la palabra puede coincidir invertida)
  const keyA = [...a].map(c => `${c.r},${c.c}`).sort().join('|')
  const keyB = [...b].map(c => `${c.r},${c.c}`).sort().join('|')
  return keyA === keyB
}

// ── Persistencia ──────────────────────────────────────────────

interface SavedState {
  puzzleId: string
  found: string[]
  bestSeconds: number | null
}

function loadState(puzzleId: string): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { puzzleId, found: [], bestSeconds: null }
    const parsed = JSON.parse(raw) as Record<string, SavedState>
    return parsed[puzzleId] ?? { puzzleId, found: [], bestSeconds: null }
  } catch {
    return { puzzleId, found: [], bestSeconds: null }
  }
}

function saveState(state: SavedState) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: Record<string, SavedState> = raw ? JSON.parse(raw) : {}
    parsed[state.puzzleId] = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch { /* ignore */ }
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Componente principal ──────────────────────────────────────

export default function SopaCracksPage() {
  const puzzle = useMemo(() => getCurrentPuzzle(), [])
  const seed = useMemo(() => {
    let h = 0
    for (const ch of puzzle.id) h = (h * 31 + ch.charCodeAt(0)) | 0
    return h + getISOWeek(new Date())
  }, [puzzle.id])

  const { letters, placed } = useMemo(() => buildGrid(puzzle, seed), [puzzle, seed])

  const [found, setFound] = useState<string[]>([])
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [bestSeconds, setBestSeconds] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [justFound, setJustFound] = useState<string | null>(null)

  // Selección
  const [startCell, setStartCell] = useState<Cell | null>(null)
  const [endCell, setEndCell] = useState<Cell | null>(null)
  const dragging = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)

  // Hidratación
  useEffect(() => {
    const s = loadState(puzzle.id)
    setFound(s.found)
    setBestSeconds(s.bestSeconds)
    setRunning(s.found.length < puzzle.words.length)
    setHydrated(true)
  }, [puzzle.id, puzzle.words.length])

  // Timer
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  // Persistir found
  useEffect(() => {
    if (!hydrated) return
    saveState({ puzzleId: puzzle.id, found, bestSeconds })
  }, [found, bestSeconds, hydrated, puzzle.id])

  const allFound = found.length === puzzle.words.length
  const wonRef = useRef(false)
  useEffect(() => {
    if (allFound && !wonRef.current && hydrated) {
      wonRef.current = true
      setRunning(false)
      trackGameComplete({ game: 'sopa_cracks', score: seconds, total: puzzle.words.length })
      setBestSeconds(prev => {
        const next = prev == null ? seconds : Math.min(prev, seconds)
        return next
      })
    }
  }, [allFound, seconds, hydrated])

  // ── Selección por celda ─────────────────────────────────────

  const currentSelection = useMemo<Cell[] | null>(() => {
    if (!startCell || !endCell) return startCell ? [startCell] : null
    return lineBetween(startCell, endCell)
  }, [startCell, endCell])

  const validateSelection = useCallback((cells: Cell[]) => {
    const word = cellsToString(cells, letters)
    const reversed = [...cells].reverse()
    const reversedWord = cellsToString(reversed, letters)

    for (const p of placed) {
      if (found.includes(p.word)) continue
      const matchesWord = p.word === word || p.word === reversedWord
      if (matchesWord && sameCells(cells, p.cells)) {
        setFound(prev => [...prev, p.word])
        setJustFound(p.word)
        setTimeout(() => setJustFound(null), 1400)
        if (!running && !allFound) { trackGameStart('sopa_cracks'); setRunning(true) }
        return true
      }
    }
    return false
  }, [letters, placed, found, running, allFound])

  const onCellDown = (r: number, c: number) => {
    if (allFound) return
    if (!running) setRunning(true)
    dragging.current = true
    setStartCell({ r, c })
    setEndCell({ r, c })
  }

  const onCellEnter = (r: number, c: number) => {
    if (!dragging.current) return
    setEndCell({ r, c })
  }

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    if (currentSelection && currentSelection.length > 1) {
      validateSelection(currentSelection)
    }
    setStartCell(null)
    setEndCell(null)
  }, [currentSelection, validateSelection])

  useEffect(() => {
    window.addEventListener('mouseup', onPointerUp)
    window.addEventListener('touchend', onPointerUp)
    return () => {
      window.removeEventListener('mouseup', onPointerUp)
      window.removeEventListener('touchend', onPointerUp)
    }
  }, [onPointerUp])

  // Touch — convertir coords a celda
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || !gridRef.current) return
    const t = e.touches[0]
    const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null
    if (!el) return
    const cellAttr = el.getAttribute('data-cell')
    if (!cellAttr) return
    const [r, c] = cellAttr.split(',').map(Number)
    setEndCell({ r, c })
  }

  // Set de celdas resueltas (palabras encontradas)
  const solvedCells = useMemo(() => {
    const set = new Set<string>()
    for (const p of placed) {
      if (found.includes(p.word)) {
        for (const cell of p.cells) set.add(`${cell.r},${cell.c}`)
      }
    }
    return set
  }, [placed, found])

  const selectionSet = useMemo(() => {
    const s = new Set<string>()
    if (currentSelection) {
      for (const cell of currentSelection) s.add(`${cell.r},${cell.c}`)
    }
    return s
  }, [currentSelection])

  const handleReset = () => {
    setFound([])
    setSeconds(0)
    setRunning(false)
    wonRef.current = false
    saveState({ puzzleId: puzzle.id, found: [], bestSeconds })
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <Header />
      <LiveStrip />

      <main className="max-w-[1440px] mx-auto px-6 xl:px-10 pb-24">
        {/* HERO */}
        <div className="relative pt-10 pb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <Link href="/juegos" className="text-[10px] font-black uppercase tracking-widest hover:opacity-100 transition-opacity" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)', opacity: 0.7 }}>
              ← Juegos
            </Link>
            <span style={{ color: '#3A3A52' }}>/</span>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: COLOR_ACCENT, fontFamily: 'var(--font-sport)' }}>
              Sopa de Cracks
            </span>
          </div>
          <h1
            className="font-black leading-none mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
            }}
          >
            {puzzle.title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 520 }}>
            {puzzle.subtitle}. Arrastra desde la primera letra hasta la última para marcar cada nombre.
          </p>
        </div>

        {/* JUEGO */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Grid */}
          <div
            className="rounded-2xl p-4 sm:p-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg,#0F1A14 0%,#0A140E 100%)',
              border: `1px solid ${COLOR_ACCENT_DIM}30`,
            }}
          >
            <div className="absolute -top-20 -left-20 w-72 h-72 blur-3xl opacity-[0.10] pointer-events-none" style={{ background: COLOR_ACCENT_DIM }} />

            {/* HUD */}
            <div className="relative z-10 flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="px-3 py-1.5 rounded-lg flex items-center gap-2"
                  style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${COLOR_ACCENT_DIM}30` }}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke={COLOR_ACCENT} strokeWidth="1.2" />
                    <path d="M7 4v3l2 1.5" stroke={COLOR_ACCENT} strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <span className="text-[12px] font-black tabular-nums" style={{ color: COLOR_ACCENT, fontFamily: 'var(--font-sport)' }}>
                    {fmtTime(seconds)}
                  </span>
                </div>
                <div
                  className="px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span className="text-[11px] font-black" style={{ color: '#9090B0', fontFamily: 'var(--font-sport)' }}>
                    {found.length}/{puzzle.words.length} encontrados
                  </span>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors hover:opacity-90"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#9090B0', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
              >
                Reiniciar
              </button>
            </div>

            {/* Grid letras */}
            <div
              ref={gridRef}
              className="relative z-10 select-none mx-auto"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${puzzle.size}, minmax(0,1fr))`,
                gap: 4,
                maxWidth: puzzle.size * 38,
                touchAction: 'none',
              }}
              onTouchMove={onTouchMove}
              onMouseLeave={() => { /* mantenemos selección, el mouseup global la valida */ }}
            >
              {letters.map((row, r) =>
                row.map((ch, c) => {
                  const key = `${r},${c}`
                  const solved = solvedCells.has(key)
                  const inSelection = selectionSet.has(key)
                  return (
                    <div
                      key={key}
                      data-cell={key}
                      onMouseDown={() => onCellDown(r, c)}
                      onMouseEnter={() => onCellEnter(r, c)}
                      onTouchStart={(e) => { e.preventDefault(); onCellDown(r, c) }}
                      className="aspect-square flex items-center justify-center font-black cursor-pointer transition-colors"
                      style={{
                        background: solved
                          ? `${COLOR_ACCENT_DIM}40`
                          : inSelection
                            ? `${COLOR_ACCENT}30`
                            : 'rgba(255,255,255,0.025)',
                        color: solved ? COLOR_ACCENT : inSelection ? '#F8FFF4' : '#C0C0D8',
                        border: solved
                          ? `1px solid ${COLOR_ACCENT}50`
                          : inSelection
                            ? `1px solid ${COLOR_ACCENT}80`
                            : '1px solid rgba(255,255,255,0.04)',
                        borderRadius: 6,
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(11px, 1.6vw, 16px)',
                        userSelect: 'none',
                      }}
                    >
                      {ch}
                    </div>
                  )
                })
              )}
            </div>

            {justFound && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full pointer-events-none"
                style={{
                  background: `${COLOR_ACCENT_DIM}E0`,
                  color: '#F0FFF4',
                  fontFamily: 'var(--font-sport)',
                  border: `1px solid ${COLOR_ACCENT}`,
                  boxShadow: `0 4px 24px ${COLOR_ACCENT_DIM}80`,
                }}
              >
                <span className="text-[11px] font-black uppercase tracking-widest">✓ {justFound}</span>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4">
            {/* Lista de palabras */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="section-accent" />
                <h2 className="section-label">Cracks por encontrar</h2>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {puzzle.words.map(w => {
                  const ok = found.includes(w)
                  return (
                    <li
                      key={w}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all"
                      style={{
                        background: ok ? `${COLOR_ACCENT_DIM}18` : 'rgba(255,255,255,0.025)',
                        border: ok ? `1px solid ${COLOR_ACCENT_DIM}40` : '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: ok ? COLOR_ACCENT_DIM : 'rgba(255,255,255,0.06)',
                          border: ok ? `1px solid ${COLOR_ACCENT}` : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {ok && (
                          <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#0A140E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span
                        className="text-[11px] font-black tracking-wider truncate"
                        style={{
                          color: ok ? COLOR_ACCENT : '#9090B0',
                          textDecoration: ok ? 'line-through' : 'none',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        {w}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Stats / récord */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="section-accent" />
                <h3 className="section-label">Tu récord</h3>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}>
                    Mejor tiempo
                  </p>
                  <p
                    className="font-black tabular-nums"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: bestSeconds != null ? COLOR_ACCENT : '#3A3A52', letterSpacing: '-0.02em' }}
                  >
                    {bestSeconds != null ? fmtTime(bestSeconds) : '—:—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}>
                    Puntos
                  </p>
                  <p
                    className="font-black tabular-nums"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#9090B0' }}
                  >
                    {found.length * 8}<span style={{ fontSize: 12, color: '#3A3A52' }}>/80</span>
                  </p>
                </div>
              </div>

              {allFound && (
                <div
                  className="mt-4 p-3 rounded-xl text-center"
                  style={{ background: `${COLOR_ACCENT_DIM}18`, border: `1px solid ${COLOR_ACCENT_DIM}50` }}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: COLOR_ACCENT, fontFamily: 'var(--font-sport)' }}>
                    ¡Completado!
                  </p>
                  <p className="text-[11px]" style={{ color: '#9090B0' }}>
                    Has encontrado a los {puzzle.words.length} cracks en {fmtTime(seconds)}.
                  </p>
                </div>
              )}
            </div>

            {/* Próximo puzzle */}
            <div
              className="rounded-2xl p-5 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#5A5A7A', fontFamily: 'var(--font-sport)' }}>
                Próximo puzzle
              </p>
              <p className="text-[11px]" style={{ color: '#9090B0' }}>
                Cada lunes, nuevos cracks por descubrir.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
      <ScrollToTop />
    </div>
  )
}
