'use client'

// Cliente de la página de archivo de TakaGrid. UI más sencilla que la del
// puzzle del día: sin pistas de catálogo, sin un-solo-intento, sin
// persistencia. Sirve para repasar puzzles pasados y entrenar.

import { useMemo, useState } from 'react'
import { CountryFlag } from '@/components/icons/GameIcons'
import { searchPlayers, getPlayerById, type Player } from '@/lib/players-catalog'
import {
  isValidAnswer,
  type CellCoord,
  type GridPuzzle,
  type DayKey,
} from '@/lib/takagrid-puzzles'

const ACCENT = '#FDBA74'
const ACCENT_DIM = '#EA580C'

interface CellState {
  playerId: string | null
  wrong: boolean
}

function emptyGrid(): CellState[][] {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, (): CellState => ({ playerId: null, wrong: false })),
  )
}

interface Props {
  puzzle: GridPuzzle
  dayKey: DayKey
  validAnswers: Player[][][]
}

export default function ArchivePuzzleClient({ puzzle, dayKey, validAnswers }: Props) {
  const [grid, setGrid] = useState<CellState[][]>(emptyGrid)
  const [activeCell, setActiveCell] = useState<CellCoord | null>(null)
  const [revealAll, setRevealAll] = useState(false)

  const solved = useMemo(
    () => grid.flat().filter(c => c.playerId !== null).length,
    [grid],
  )
  const usedIds = useMemo(
    () => grid.flat().map(c => c.playerId).filter((id): id is string => !!id),
    [grid],
  )

  const handlePick = (player: Player) => {
    if (!activeCell) return
    const { row, col } = activeCell
    const ok = isValidAnswer(player, puzzle, { row, col })
    setGrid(prev => prev.map((r, ri) => r.map((c, ci) => {
      if (ri !== row || ci !== col) return c
      return ok ? { playerId: player.id, wrong: false } : { playerId: null, wrong: true }
    })))
    setActiveCell(null)
  }

  return (
    <>
      <div className="pt-4 pb-6">
        <div className="flex items-center gap-2.5 mb-2 flex-wrap">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
          <span
            className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}
          >
            TakaGrid · Archivo · {dayKey.key}
          </span>
          <span
            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
          >
            No cuenta para racha ni ranking
          </span>
        </div>
        <h1
          className="font-black leading-tight mb-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)',
            color: '#F8F8FF',
            letterSpacing: '-0.02em',
          }}
        >
          Rejuega el grid del {dayKey.key}.
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 520 }}>
          Modo libre: sin un-solo-intento ni penalizaciones. Si te bloqueas, destapa todas las soluciones con el botón.
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
          <button
            onClick={() => setRevealAll(r => !r)}
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
          >
            {revealAll ? 'Ocultar soluciones' : 'Mostrar soluciones'}
          </button>
          <button
            onClick={() => setGrid(emptyGrid())}
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
          >
            Reiniciar
          </button>
        </div>

        {/* Grid */}
        <div className="w-full" style={{ maxWidth: 560 }}>
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

          {puzzle.rows.map((row, r) => (
            <div key={r} className="grid gap-2 mb-2" style={{ gridTemplateColumns: 'clamp(46px,14vw,72px) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)' }}>
              <div className="rounded-xl px-1 py-2 flex flex-col items-center justify-center text-center gap-0.5 min-h-[90px]"
                style={{ background: `${ACCENT_DIM}12`, border: `1px solid ${ACCENT_DIM}25` }}>
                <span className="text-base leading-none">{row.emoji}</span>
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-tight break-words" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
                  {row.label}
                </span>
              </div>
              {puzzle.cols.map((_, c) => {
                const cell = grid[r][c]
                return (
                  <ArchiveCell
                    key={c}
                    cell={cell}
                    revealHint={revealAll ? validAnswers[r][c] : null}
                    onClick={() => setActiveCell({ row: r as 0|1|2, col: c as 0|1|2 })}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {activeCell && (
        <ArchiveSearchModal
          rowLabel={puzzle.rows[activeCell.row].label}
          rowEmoji={puzzle.rows[activeCell.row].emoji}
          colLabel={puzzle.cols[activeCell.col].label}
          colEmoji={puzzle.cols[activeCell.col].emoji}
          usedIds={usedIds}
          onSelect={handlePick}
          onClose={() => setActiveCell(null)}
        />
      )}
    </>
  )
}

// ── Cell ─────────────────────────────────────────────────────────

function ArchiveCell({
  cell, revealHint, onClick,
}: {
  cell: CellState
  revealHint: Player[] | null
  onClick: () => void
}) {
  const player = cell.playerId ? getPlayerById(cell.playerId) : null

  if (player) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 text-center transition-transform hover:scale-[1.02]"
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
      </button>
    )
  }

  if (revealHint) {
    return (
      <div
        className="rounded-xl p-2 text-left flex flex-col gap-1"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', minHeight: 90 }}
      >
        <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          {revealHint.length} válidos
        </p>
        {revealHint.length === 0 ? (
          <p className="text-[10px]" style={{ color: '#EF4444' }}>— sin datos</p>
        ) : (
          revealHint.slice(0, 3).map(p => (
            <p key={p.id} className="text-[10px] font-black truncate flex items-center gap-1" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
              <CountryFlag country={p.country} width={10} />
              <span className="truncate">{p.name}</span>
            </p>
          ))
        )}
      </div>
    )
  }

  if (cell.wrong) {
    return (
      <button
        onClick={onClick}
        className="rounded-xl p-2 text-center flex flex-col items-center justify-center"
        style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', minHeight: 90 }}
      >
        <span className="text-[10px] font-black" style={{ color: '#FCA5A5', fontFamily: 'var(--font-sport)' }}>Reintenta</span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="rounded-xl p-2 text-center flex flex-col items-center justify-center gap-1.5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px dashed ${ACCENT_DIM}60`,
        minHeight: 90,
      }}
    >
      <span style={{ color: ACCENT_DIM, opacity: 0.6, fontSize: 22 }}>+</span>
      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
        Elegir
      </span>
    </button>
  )
}

// ── Search modal ────────────────────────────────────────────────

function ArchiveSearchModal({
  rowLabel, rowEmoji, colLabel, colEmoji, usedIds, onSelect, onClose,
}: {
  rowLabel: string
  rowEmoji?: string
  colLabel: string
  colEmoji?: string
  usedIds: string[]
  onSelect: (player: Player) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(
    () => searchPlayers(query, { excludeIds: usedIds, limit: 30 }),
    [query, usedIds],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_DIM}40`, maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
              Archivo · sin penalización
            </p>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2 py-1 rounded-lg text-[12px] font-black" style={{ background: `${ACCENT_DIM}20`, border: `1px solid ${ACCENT_DIM}40`, color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                {rowEmoji} {rowLabel}
              </span>
              <span className="text-[10px] font-black" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>Y</span>
              <span className="px-2 py-1 rounded-lg text-[12px] font-black" style={{ background: `${ACCENT_DIM}20`, border: `1px solid ${ACCENT_DIM}40`, color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                {colEmoji} {colLabel}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }} aria-label="Cerrar">✕</button>
        </div>
        <div className="p-4 pb-2">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nombre del jugador…"
            className="w-full px-3 py-2.5 rounded-xl bg-transparent outline-none text-sm"
            style={{ background: 'rgba(0,0,0,0.3)', color: '#F0F0F5', border: '1px solid rgba(255,255,255,0.06)' }}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin resultados para &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => onSelect(p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0"
                      style={{ background: `${ACCENT_DIM}28`, color: ACCENT, border: `1px solid ${ACCENT_DIM}40`, fontFamily: 'var(--font-display)' }}>
                      {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate flex items-center gap-1.5" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
                        <CountryFlag country={p.country} width={16} />
                        <span className="truncate">{p.name}</span>
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{p.club}</p>
                    </div>
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
