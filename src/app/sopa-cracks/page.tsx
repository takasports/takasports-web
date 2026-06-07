'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { trackGameStart, trackGameComplete } from '@/lib/analytics'
import GameLayout from '@/components/games/GameLayout'
import { recordPlay, currentWeekISO, type GamePlay } from '@/lib/games-store'
import { madridWeekNumber } from '@/lib/taka-time'
import { trackGameEvent } from '@/lib/games-telemetry'
import { addXp, xpForSopacracks } from '@/lib/meta-progression'
import { reportPlay } from '@/lib/missions'
import ShareResultButton from '@/components/games/ShareResultButton'
import PostGameResultModal from '@/components/games/PostGameResultModal'
import GameCoinsToast from '@/components/games/GameCoinsToast'
import MyPositionBanner from '@/components/games/MyPositionBanner'
import { type Player } from '@/lib/players-catalog'
import { PUZZLES, findPlayerForWord, moveCursor, type Puzzle } from '@/lib/sopa-puzzles'
import { CountryFlag } from '@/components/icons/GameIcons'

// ── Tipos y datos ─────────────────────────────────────────────

type Cell = { r: number; c: number }
type Placed = { word: string; cells: Cell[]; intruder?: boolean }

const COLOR_ACCENT = '#6EE7B7'
const COLOR_ACCENT_DIM = '#059669'
const COLOR_HINT = '#FCD34D'
const STORAGE_KEY = 'ts_sopa_cracks_state'
const HINT_PENALTY_SECONDS = 30
const TIME_ATTACK_LIMIT = 3 * 60   // 3 minutos
const INTRUDER_BONUS_PTS = 20      // Bonus visual al encontrar la intrusa
const POINTS_PER_WORD = 10         // Escala única de puntos por palabra: sidebar, recordPlay y modal final
const COLOR_INTRUDER = '#A78BFA'   // violeta, distinto del verde clásico

// ── Selección de puzzle por semana ────────────────────────────

// Semana ISO en hora Taka (Madrid), fuente única en taka-time.
function getISOWeek(d: Date): number {
  return madridWeekNumber(d)
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

  // Lista de palabras + intrusa (si la hay) marcada con flag.
  const toPlace: Array<{ word: string; intruder: boolean }> = [
    ...puzzle.words.map(w => ({ word: w, intruder: false })),
    ...(puzzle.intruder ? [{ word: puzzle.intruder, intruder: true }] : []),
  ]
  // Ordenar por longitud descendente — colocar las largas primero
  const sorted = toPlace.sort((a, b) => b.word.length - a.word.length)

  for (const item of sorted) {
    const { word } = item
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
      placed.push(item.intruder ? { word, cells, intruder: true } : { word, cells })
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
  const staticPuzzle = useMemo(() => getCurrentPuzzle(), [])
  const [featuredPuzzle, setFeaturedPuzzle] = useState<Puzzle | null>(null)
  const puzzle = featuredPuzzle ?? staticPuzzle

  // Tema destacado de la semana inyectado por la redacción. Si no hay,
  // seguimos con el pool estático sin que se note.
  useEffect(() => {
    let cancelled = false
    const wk = currentWeekISO()
    fetch(`/api/sopa-cracks/featured?week=${wk}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled) return
        const p = j?.puzzle
        if (!p || !Array.isArray(p.words) || p.words.length < 5) return
        setFeaturedPuzzle({
          id:       `featured-${wk}`,
          title:    String(p.title ?? 'Tema semanal'),
          subtitle: String(p.subtitle ?? ''),
          size:     typeof p.size === 'number' && p.size >= 10 && p.size <= 16 ? p.size : 13,
          words:    p.words.filter((w: unknown): w is string => typeof w === 'string'),
          intruder: typeof p.intruder === 'string' ? p.intruder : undefined,
          playerIds: (p.playerIds && typeof p.playerIds === 'object') ? p.playerIds as Record<string, string> : undefined,
        })
      })
      .catch(() => { /* silencioso */ })
    return () => { cancelled = true }
  }, [])
  const seed = useMemo(() => {
    let h = 0
    for (const ch of puzzle.id) h = (h * 31 + ch.charCodeAt(0)) | 0
    return h + getISOWeek(new Date())
  }, [puzzle.id])

  const { letters, placed } = useMemo(() => buildGrid(puzzle, seed), [puzzle, seed])

  // Palabras realmente colocadas en el grid (buildGrid descarta las que no
  // caben). El completado, el conteo y la puntuación se calculan sobre ESTAS,
  // no sobre puzzle.words, para que un featured con una palabra que no entra
  // nunca deje el puzzle inalcanzable.
  const activeWords = useMemo(() => {
    const placedSet = new Set(placed.filter(p => !p.intruder).map(p => p.word))
    return puzzle.words.filter(w => placedSet.has(w))
  }, [placed, puzzle.words])

  const [found, setFound] = useState<string[]>([])
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [bestSeconds, setBestSeconds] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [justFound, setJustFound] = useState<string | null>(null)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [revealedFirstCells, setRevealedFirstCells] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  // 8.1 mini-bio: popover con el jugador asociado a la palabra recién encontrada
  const [playerInfo, setPlayerInfo] = useState<{ player: Player; word: string; intruder: boolean } | null>(null)
  const playerInfoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 8.2 intrusa: marcamos cuándo se encontró y la mostramos en la sidebar
  const [intruderFound, setIntruderFound] = useState(false)
  // 8.3 contrarreloj
  const [timeAttack, setTimeAttack] = useState(false)
  const [timeOver, setTimeOver] = useState(false)
  // Monedas acreditadas al Ranked tras recordPlay (auto-dismiss 5s en
  // GameCoinsToast; null = sin respuesta o sin coins por idempotencia/cap).
  const [awardedCoins, setAwardedCoins] = useState<number | null>(null)

  // Selección
  const [startCell, setStartCell] = useState<Cell | null>(null)
  const [endCell, setEndCell] = useState<Cell | null>(null)
  // Cursor de teclado (a11y): celda enfocada para navegación con flechas.
  const [cursor, setCursor] = useState<Cell>({ r: 0, c: 0 })
  const dragging = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)
  // Marca que el fin de partida ya se contabilizó para el puzzle activo.
  const wonRef = useRef(false)

  // Hidratación + reset de ronda al cambiar de puzzle.
  // El featured llega tras el mount, así que puzzle.id cambia en caliente:
  // cargamos el progreso guardado de ESE puzzle y devolvemos a cero todo el
  // estado de la ronda (cronómetro, pistas, intrusa, selección, contrarreloj)
  // para que no queden pegados los valores del puzzle anterior.
  useEffect(() => {
    const s = loadState(puzzle.id)
    setFound(s.found)
    setBestSeconds(s.bestSeconds)
    setRunning(s.found.length < activeWords.length)
    setSeconds(0)
    setPaused(false)
    setHintsUsed(0)
    setRevealedFirstCells(new Set())
    setIntruderFound(false)
    setTimeOver(false)
    setTimeAttack(false)
    setJustFound(null)
    setPlayerInfo(null)
    setStartCell(null)
    setEndCell(null)
    setCursor({ r: 0, c: 0 })
    wonRef.current = false
    setHydrated(true)
  }, [puzzle.id, activeWords.length])

  // Timer
  useEffect(() => {
    if (!running || paused) return
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [running, paused])

  const togglePause = useCallback(() => {
    setPaused(p => {
      const next = !p
      trackGameEvent({ gameId: 'sopacracks', event: next ? 'abandoned' : 'started', period: currentWeekISO(), meta: { paused: next } })
      return next
    })
  }, [])

  const useHint = useCallback(() => {
    if (paused) return
    const unfound = placed.filter(p => !found.includes(p.word))
    if (unfound.length === 0) return
    const pick = unfound[Math.floor(Math.random() * unfound.length)]
    const firstCell = pick.cells[0]
    const key = `${firstCell.r},${firstCell.c}`
    setRevealedFirstCells(prev => {
      if (prev.has(key)) return prev
      const next = new Set(prev); next.add(key); return next
    })
    setHintsUsed(h => h + 1)
    setSeconds(s => s + HINT_PENALTY_SECONDS)
    if (!running) {
      trackGameStart('sopa_cracks')
      trackGameEvent({ gameId: 'sopacracks', event: 'started', period: currentWeekISO() })
      setRunning(true)
    }
    trackGameEvent({ gameId: 'sopacracks', event: 'shared', period: currentWeekISO(), meta: { kind: 'hint', word: pick.word } })
  }, [placed, found, running, paused])

  // Persistir found
  useEffect(() => {
    if (!hydrated) return
    saveState({ puzzleId: puzzle.id, found, bestSeconds })
  }, [found, bestSeconds, hydrated, puzzle.id])

  const allFound = found.length === activeWords.length
  // En contrarreloj puede acabar antes (timeOver) o al encontrar todo
  const roundDone = allFound || timeOver

  // Detener cronómetro y disparar fin de partida cuando la ronda termina.
  // En modo contrarreloj, "ganar" no requiere todas las palabras: el ranking
  // semanal usa el periodo distinto para no mezclarse con la modalidad normal.
  useEffect(() => {
    if (roundDone && !wonRef.current && hydrated) {
      wonRef.current = true
      setRunning(false)
      const foundCount = found.length
      trackGameComplete({ game: 'sopa_cracks', score: seconds, total: activeWords.length })
      if (allFound) {
        setBestSeconds(prev => prev == null ? seconds : Math.min(prev, seconds))
      }

      // Sync con games-store. En contrarreloj el periodo se diferencia para
      // no contaminar el leaderboard normal (mismo cronómetro pero meta opuesta).
      const period = timeAttack ? `${currentWeekISO()}-TA` : currentWeekISO()
      const score = (timeAttack ? foundCount : activeWords.length) * POINTS_PER_WORD
      recordPlay({
        gameId:     'sopacracks',
        period,
        score,
        payload:    {
          found:      foundCount,
          total:      activeWords.length,
          seconds,
          intruder:   intruderFound,
          timeAttack,
        },
        durationMs: seconds * 1000,
      }).then(r => { if (r.awarded > 0) setAwardedCoins(r.awarded) })
        .catch(() => { /* sin toast — el resto del flujo no se afecta */ })
      addXp('sopacracks', xpForSopacracks(foundCount) + (intruderFound ? INTRUDER_BONUS_PTS : 0))
      reportPlay('sopacracks', { score })
      trackGameEvent({ gameId: 'sopacracks', event: 'completed', period, meta: { seconds, intruder: intruderFound, timeAttack, found: foundCount } })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundDone, hydrated])

  // Cronómetro de cuenta atrás en modo contrarreloj
  useEffect(() => {
    if (!timeAttack || !running || paused) return
    if (seconds >= TIME_ATTACK_LIMIT) setTimeOver(true)
  }, [timeAttack, running, paused, seconds])

  // Limpieza del timer del popover en unmount
  useEffect(() => () => {
    if (playerInfoTimeoutRef.current) clearTimeout(playerInfoTimeoutRef.current)
  }, [])

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
      // La intrusa se "completa" una sola vez (intruderFound) y las normales
      // entran en el array found una sola vez también.
      const alreadyFound = p.intruder ? intruderFound : found.includes(p.word)
      if (alreadyFound) continue

      const matchesWord = p.word === word || p.word === reversedWord
      if (matchesWord && sameCells(cells, p.cells)) {
        if (p.intruder) {
          setIntruderFound(true)
          // Bonus XP por encontrar la intrusa
          addXp('sopacracks', INTRUDER_BONUS_PTS)
        } else {
          setFound(prev => [...prev, p.word])
        }
        setJustFound(p.word)
        // Mini-bio (8.1): popover con el jugador asociado
        const player = findPlayerForWord(p.word, puzzle.playerIds)
        if (player) {
          if (playerInfoTimeoutRef.current) clearTimeout(playerInfoTimeoutRef.current)
          setPlayerInfo({ player, word: p.word, intruder: !!p.intruder })
          playerInfoTimeoutRef.current = setTimeout(() => setPlayerInfo(null), 4000)
        }
        setTimeout(() => setJustFound(null), 1400)
        if (!running && !allFound) {
          trackGameStart('sopa_cracks')
          trackGameEvent({ gameId: 'sopacracks', event: 'started', period: currentWeekISO() })
          setRunning(true)
        }
        return true
      }
    }
    return false
  }, [letters, placed, found, running, allFound, intruderFound, puzzle.playerIds])

  // Bifurcación de input:
  //  - Mouse/pen: drag continuo (down → enter celdas → up).
  //  - Touch: dos taps (primer tap = inicio, segundo tap = fin y valida).
  // Esto se decide por e.pointerType en cada gesto, no por feature detection,
  // así que un híbrido (laptop con pantalla táctil) funciona como cada usuario
  // prefiera momento a momento.

  const onCellDown = (e: React.PointerEvent, r: number, c: number) => {
    if (allFound || paused) return
    if (!running) setRunning(true)

    if (e.pointerType === 'touch') {
      // Modo tap-to-select
      if (!startCell) {
        // Primer tap: marca el inicio
        setStartCell({ r, c })
        setEndCell({ r, c })
        return
      }
      // Tap en la misma celda: cancela
      if (startCell.r === r && startCell.c === c) {
        setStartCell(null)
        setEndCell(null)
        return
      }
      // Segundo tap: cierra selección y valida (si los dos puntos forman línea)
      const sel = lineBetween(startCell, { r, c })
      if (sel && sel.length > 1) {
        validateSelection(sel)
        setStartCell(null)
        setEndCell(null)
      } else {
        // No forman línea válida (diagonal inexacta, etc.): tomamos el nuevo tap
        // como nuevo inicio en lugar de descartar el gesto.
        setStartCell({ r, c })
        setEndCell({ r, c })
      }
      return
    }

    // Modo drag (mouse/pen)
    dragging.current = true
    setStartCell({ r, c })
    setEndCell({ r, c })
  }

  const onCellEnter = (e: React.PointerEvent, r: number, c: number) => {
    if (e.pointerType === 'touch') return    // touch no usa hover
    if (!dragging.current || paused) return
    setEndCell({ r, c })
  }

  // Teclado (a11y): flechas mueven el cursor/foco; Enter o Espacio marca el
  // inicio y luego el final (igual que el doble tap táctil); Escape cancela el
  // inicio. Aditivo: no altera el camino de puntero.
  const onCellKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    const k = e.key
    if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault()
      const next = moveCursor({ r, c }, k, puzzle.size)
      setCursor(next)
      if (startCell) setEndCell(next)   // previsualiza la línea desde el inicio
      gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next.r},${next.c}"]`)?.focus()
      return
    }
    if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
      e.preventDefault()
      if (allFound || paused) return
      if (!running) setRunning(true)
      if (!startCell) { setStartCell({ r, c }); setEndCell({ r, c }); return }
      if (startCell.r === r && startCell.c === c) { setStartCell(null); setEndCell(null); return }
      const sel = lineBetween(startCell, { r, c })
      if (sel && sel.length > 1) { validateSelection(sel); setStartCell(null); setEndCell(null) }
      else { setStartCell({ r, c }); setEndCell({ r, c }) }
      return
    }
    if (k === 'Escape' && startCell) { e.preventDefault(); setStartCell(null); setEndCell(null) }
  }

  const onPointerUp = useCallback(() => {
    // Si no hay drag en curso (ej: tap-mode touch), no resetear nada.
    if (!dragging.current) return
    dragging.current = false
    if (currentSelection && currentSelection.length > 1) {
      validateSelection(currentSelection)
    }
    setStartCell(null)
    setEndCell(null)
  }, [currentSelection, validateSelection])

  useEffect(() => {
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [onPointerUp])

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
    setPaused(false)
    setHintsUsed(0)
    setRevealedFirstCells(new Set())
    setIntruderFound(false)
    setTimeOver(false)
    setPlayerInfo(null)
    wonRef.current = false
    saveState({ puzzleId: puzzle.id, found: [], bestSeconds })
  }

  const toggleTimeAttack = () => {
    // Sólo permitimos cambiar de modo antes de empezar o tras reiniciar
    if (running || roundDone) return
    setTimeAttack(t => !t)
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <GameLayout accent="#6EE7B7" accentDim="#34D399">
      <>
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
            {puzzle.subtitle}. Arrastra desde la primera letra hasta la última para marcar cada nombre, o usa las flechas del teclado y Enter (inicio y final).
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
              <div className="flex items-center gap-3 flex-wrap">
                <div
                  className="px-3 py-1.5 rounded-lg flex items-center gap-2"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: `1px solid ${timeAttack ? `${COLOR_INTRUDER}80` : `${COLOR_ACCENT_DIM}30`}`,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke={timeAttack ? COLOR_INTRUDER : COLOR_ACCENT} strokeWidth="1.2" />
                    <path d="M7 4v3l2 1.5" stroke={timeAttack ? COLOR_INTRUDER : COLOR_ACCENT} strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <span className="text-[12px] font-black tabular-nums" style={{ color: timeAttack ? COLOR_INTRUDER : COLOR_ACCENT, fontFamily: 'var(--font-sport)' }}>
                    {timeAttack
                      ? fmtTime(Math.max(0, TIME_ATTACK_LIMIT - seconds))
                      : fmtTime(seconds)}
                  </span>
                </div>
                <div
                  className="px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <span className="text-[11px] font-black" style={{ color: '#9090B0', fontFamily: 'var(--font-sport)' }}>
                    {found.length}/{activeWords.length} encontrados
                  </span>
                </div>
                {puzzle.intruder && intruderFound && (
                  <div
                    className="px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5"
                    style={{ background: `${COLOR_INTRUDER}18`, border: `1px solid ${COLOR_INTRUDER}50` }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: COLOR_INTRUDER, fontFamily: 'var(--font-sport)' }}>
                      🎯 Intrusa
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={useHint}
                  disabled={allFound || paused}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  style={{ background: `${COLOR_HINT}14`, color: COLOR_HINT, border: `1px solid ${COLOR_HINT}40`, fontFamily: 'var(--font-sport)' }}
                  title={`Revela la primera letra de una palabra (+${HINT_PENALTY_SECONDS}s)`}
                >
                  💡 Pista +{HINT_PENALTY_SECONDS}s
                  {hintsUsed > 0 && (
                    <span className="text-[9px] px-1 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.4)', color: COLOR_HINT }}>×{hintsUsed}</span>
                  )}
                </button>
                <button
                  onClick={togglePause}
                  disabled={!running || allFound}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: paused ? `${COLOR_ACCENT_DIM}20` : 'rgba(255,255,255,0.04)', color: paused ? COLOR_ACCENT : '#9090B0', border: paused ? `1px solid ${COLOR_ACCENT_DIM}60` : '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
                  aria-label={paused ? 'Reanudar' : 'Pausar'}
                >
                  {paused ? '▶ Reanudar' : '⏸ Pausa'}
                </button>
                <button
                  onClick={toggleTimeAttack}
                  disabled={running || roundDone}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: timeAttack ? `${COLOR_INTRUDER}25` : 'rgba(255,255,255,0.04)',
                    color: timeAttack ? COLOR_INTRUDER : '#9090B0',
                    border: timeAttack ? `1px solid ${COLOR_INTRUDER}60` : '1px solid rgba(255,255,255,0.06)',
                    fontFamily: 'var(--font-sport)',
                  }}
                  title="Modo contrarreloj: 3 minutos para encontrar el máximo de palabras"
                  aria-pressed={timeAttack}
                >
                  {timeAttack ? '⚡ Contrarreloj 3:00' : '⚡ Contrarreloj'}
                </button>
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="lg:hidden text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors hover:opacity-90"
                  style={{ background: expanded ? `${COLOR_ACCENT_DIM}20` : 'rgba(255,255,255,0.04)', color: expanded ? COLOR_ACCENT : '#9090B0', border: expanded ? `1px solid ${COLOR_ACCENT_DIM}60` : '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
                  aria-pressed={expanded}
                  title="Cuadrícula más grande (se desplaza horizontalmente)"
                >
                  {expanded ? '⊟ 1×' : '⊞ Lupa'}
                </button>
                <button
                  onClick={handleReset}
                  className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors hover:opacity-90"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#9090B0', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
                >
                  Reiniciar
                </button>
              </div>
            </div>

            {/* Grid letras */}
            <div
              className="relative z-10"
              style={expanded ? { overflowX: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' } : undefined}
            >
              <style>{`.sopa-grid [data-cell]:focus-visible{outline:2px solid ${COLOR_ACCENT};outline-offset:-2px;border-radius:6px}`}</style>
              <div
                ref={gridRef}
                role="grid"
                aria-label="Sopa de letras. Usa las flechas para moverte por la cuadrícula y Enter para marcar el inicio y el final de cada nombre."
                className="sopa-grid select-none mx-auto"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${puzzle.size}, minmax(0,1fr))`,
                  gap: 3,
                  width: expanded ? puzzle.size * 44 : '100%',
                  maxWidth: expanded ? 'none' : puzzle.size * 38,
                  minWidth: expanded ? puzzle.size * 44 : undefined,
                  touchAction: 'none',
                  filter: paused ? 'blur(8px)' : undefined,
                  transition: 'filter 0.2s',
                }}
                onPointerLeave={() => { /* mantenemos selección, el pointerup global la valida */ }}
              >
                {letters.map((row, r) => (
                  <div key={`row-${r}`} role="row" style={{ display: 'contents' }}>
                    {row.map((ch, c) => {
                    const key = `${r},${c}`
                    const solved = solvedCells.has(key)
                    const inSelection = selectionSet.has(key)
                    const hinted = revealedFirstCells.has(key) && !solved
                    return (
                      <div
                        key={key}
                        data-cell={key}
                        role="gridcell"
                        aria-label={`Fila ${r + 1}, columna ${c + 1}, letra ${ch}${solved ? ', encontrada' : ''}`}
                        aria-selected={solved}
                        tabIndex={cursor.r === r && cursor.c === c ? 0 : -1}
                        onPointerDown={(e) => { e.preventDefault(); onCellDown(e, r, c) }}
                        onPointerEnter={(e) => onCellEnter(e, r, c)}
                        onKeyDown={(e) => onCellKeyDown(e, r, c)}
                        onFocus={() => setCursor(cur => (cur.r === r && cur.c === c ? cur : { r, c }))}
                        className="aspect-square flex items-center justify-center font-black cursor-pointer transition-colors"
                        style={{
                          background: solved
                            ? `${COLOR_ACCENT_DIM}40`
                            : hinted
                              ? `${COLOR_HINT}28`
                              : inSelection
                                ? `${COLOR_ACCENT}30`
                                : 'rgba(255,255,255,0.025)',
                          color: solved ? COLOR_ACCENT : hinted ? COLOR_HINT : inSelection ? '#F8FFF4' : '#C0C0D8',
                          border: solved
                            ? `1px solid ${COLOR_ACCENT}50`
                            : hinted
                              ? `1px solid ${COLOR_HINT}`
                              : inSelection
                                ? `1px solid ${COLOR_ACCENT}80`
                                : '1px solid rgba(255,255,255,0.04)',
                          boxShadow: hinted ? `0 0 12px ${COLOR_HINT}55` : undefined,
                          borderRadius: 6,
                          fontFamily: 'var(--font-display)',
                          fontSize: expanded ? '18px' : 'clamp(12px, 3.2vw, 16px)',
                          userSelect: 'none',
                        }}
                      >
                        {ch}
                      </div>
                    )
                  })}
                  </div>
                ))}
              </div>
            </div>

            {/* Pause overlay */}
            {paused && (
              <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'rgba(10,20,14,0.55)', backdropFilter: 'blur(2px)' }}>
                <button
                  onClick={togglePause}
                  className="px-6 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest"
                  style={{ background: `linear-gradient(135deg, ${COLOR_ACCENT_DIM}, #047857)`, color: '#F0FFF4', boxShadow: `0 8px 24px ${COLOR_ACCENT_DIM}80`, fontFamily: 'var(--font-sport)' }}
                >
                  ▶ Reanudar
                </button>
              </div>
            )}

            {playerInfo ? (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto max-w-[min(92%,420px)]"
                style={{
                  background: playerInfo.intruder
                    ? `linear-gradient(135deg, ${COLOR_INTRUDER}E0, #4c1d95)`
                    : `linear-gradient(135deg, ${COLOR_ACCENT_DIM}E0, #064e3b)`,
                  color: '#F0FFF4',
                  fontFamily: 'var(--font-sport)',
                  border: `1px solid ${playerInfo.intruder ? COLOR_INTRUDER : COLOR_ACCENT}`,
                  boxShadow: `0 8px 28px ${playerInfo.intruder ? `${COLOR_INTRUDER}80` : `${COLOR_ACCENT_DIM}80`}`,
                  borderRadius: 16,
                }}
              >
                <div className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0"
                    style={{ background: 'rgba(0,0,0,0.35)', color: '#fff', fontFamily: 'var(--font-display)', border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    {playerInfo.player.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 inline-flex items-center gap-1">
                      {playerInfo.intruder ? '🎯 Palabra intrusa' : '✓ Encontrado'}
                      {playerInfo.intruder && <span className="opacity-70">· +{INTRUDER_BONUS_PTS} XP</span>}
                    </p>
                    <p className="text-sm font-black truncate inline-flex items-center gap-1.5 w-full" style={{ fontFamily: 'var(--font-display)' }}>
                      <CountryFlag country={playerInfo.player.country} width={14} />
                      <span className="truncate">{playerInfo.player.name}</span>
                    </p>
                    <p className="text-[11px] truncate opacity-80">
                      {playerInfo.player.club} · {playerInfo.player.era === 'current' ? 'En activo' : 'Leyenda'}
                    </p>
                  </div>
                  <button
                    onClick={() => setPlayerInfo(null)}
                    aria-label="Cerrar"
                    className="text-xs opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: '#fff' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : justFound ? (
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
            ) : null}
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
                {activeWords.map(w => {
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
              {puzzle.intruder && (
                <div
                  className="mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg"
                  style={{
                    background: intruderFound ? `${COLOR_INTRUDER}1E` : 'rgba(255,255,255,0.02)',
                    border: `1px dashed ${intruderFound ? COLOR_INTRUDER : 'rgba(255,255,255,0.12)'}`,
                  }}
                >
                  <span aria-hidden className="text-base leading-none">🎯</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: intruderFound ? COLOR_INTRUDER : '#9090B0', fontFamily: 'var(--font-sport)' }}>
                      Palabra intrusa (bonus)
                    </p>
                    <p
                      className="text-[11px] font-black tracking-wider truncate"
                      style={{
                        color: intruderFound ? COLOR_INTRUDER : '#5A5A7A',
                        fontFamily: 'var(--font-display)',
                        textDecoration: intruderFound ? 'line-through' : 'none',
                      }}
                    >
                      {intruderFound ? puzzle.intruder : '??? · escondida en el grid'}
                    </p>
                  </div>
                  {intruderFound && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.3)', color: COLOR_INTRUDER, fontFamily: 'var(--font-sport)' }}>
                      +{INTRUDER_BONUS_PTS} XP
                    </span>
                  )}
                </div>
              )}
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
                    {found.length * POINTS_PER_WORD}<span style={{ fontSize: 12, color: '#3A3A52' }}>/{activeWords.length * POINTS_PER_WORD}</span>
                  </p>
                </div>
              </div>

              {hintsUsed > 0 && (
                <p className="mt-3 text-[10px] flex items-center gap-1.5" style={{ color: COLOR_HINT, fontFamily: 'var(--font-sport)' }}>
                  💡 {hintsUsed} pista{hintsUsed > 1 ? 's' : ''} usada{hintsUsed > 1 ? 's' : ''} · +{hintsUsed * HINT_PENALTY_SECONDS}s
                </p>
              )}

              {allFound && !timeAttack && (
                <div
                  className="mt-4 p-3 rounded-xl text-center"
                  style={{ background: `${COLOR_ACCENT_DIM}18`, border: `1px solid ${COLOR_ACCENT_DIM}50` }}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: COLOR_ACCENT, fontFamily: 'var(--font-sport)' }}>
                    ¡Completado!
                  </p>
                  <p className="text-[11px]" style={{ color: '#9090B0' }}>
                    Has encontrado a los {activeWords.length} cracks en {fmtTime(seconds)}.
                  </p>
                </div>
              )}
              {timeAttack && roundDone && (
                <div
                  className="mt-4 p-3 rounded-xl text-center"
                  style={{ background: `${COLOR_INTRUDER}18`, border: `1px solid ${COLOR_INTRUDER}50` }}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: COLOR_INTRUDER, fontFamily: 'var(--font-sport)' }}>
                    {allFound ? '¡Pleno antes de tiempo!' : '¡Tiempo!'}
                  </p>
                  <p className="text-[11px]" style={{ color: '#9090B0' }}>
                    {found.length}/{activeWords.length} encontrados en {fmtTime(Math.min(seconds, TIME_ATTACK_LIMIT))}.
                  </p>
                </div>
              )}
            </div>

            {/* Ranking semanal */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="section-accent" />
                  <h3 className="section-label">Clasificación semanal</h3>
                </div>
                <Link
                  href="/juegos/leaderboard/sopacracks"
                  className="text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-80"
                  style={{ color: COLOR_ACCENT, fontFamily: 'var(--font-sport)' }}
                >
                  Ver →
                </Link>
              </div>
              <MyPositionBanner gameId="sopacracks" period={currentWeekISO()} accent={COLOR_ACCENT} />
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

      {allFound && (
        <PostGameResultModal
          gameId="sopacracks"
          period={currentWeekISO()}
          accent="#6EE7B7"
          leaderboardSlug="sopacracks"
          onClose={() => { /* abre una vez por semana */ }}
          play={{
            game_id:     'sopacracks',
            period:      currentWeekISO(),
            score:       activeWords.length * POINTS_PER_WORD,
            payload:     { found: activeWords.length, total: activeWords.length, seconds },
            duration_ms: seconds * 1000,
          } as GamePlay}
        />
      )}

      <GameCoinsToast
        awarded={awardedCoins}
        accent="#6EE7B7"
        onDismiss={() => setAwardedCoins(null)}
      />
      </>
    </GameLayout>
  )
}
