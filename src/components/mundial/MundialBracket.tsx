'use client'

// Cuadro de eliminatorias del Mundial 2026 (la pestaña "Cuadro" de Estadísticas).
// Diseño HÍBRIDO: en móvil un selector de ronda + tarjetas grandes; en escritorio
// la llave completa por columnas (16avos → Final) con scroll horizontal. Misma
// fuente de datos para las dos vistas (/api/mundial/bracket → buildBracket).

import { useEffect, useMemo, useState } from 'react'
import type { Bracket, BracketMatch, BracketSide, BracketRoundId } from '@/lib/mundial-bracket'

const ACCENT = '#f59e0b'

const ROUND_SHORT: Record<BracketRoundId, string> = {
  r32: '16avos', r16: 'Octavos', qf: 'Cuartos', sf: 'Semis', third: '3er puesto', final: 'Final',
}

function kickoff(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  })
}

// ── Fila de una selección dentro de una tarjeta ──────────────────────────────
function SideRow({ side, resolved }: { side: BracketSide; resolved: boolean }) {
  const loser = resolved && !side.isWinner && !side.isPlaceholder
  return (
    <div
      className="px-3 py-1.5 flex items-center gap-2"
      style={{ opacity: side.isPlaceholder ? 0.55 : loser ? 0.6 : 1 }}
    >
      <span className="text-[15px] leading-none w-5 text-center shrink-0">{side.flag}</span>
      <span
        className="flex-1 text-[13px] truncate"
        style={{
          fontWeight: side.isWinner ? 800 : 600,
          fontStyle: side.isPlaceholder ? 'italic' : 'normal',
          color: side.isPlaceholder ? 'var(--text-muted)' : 'var(--text-primary)',
        }}
      >
        {side.name}
      </span>
      {side.isWinner && <span style={{ color: ACCENT, fontSize: 11 }}>▸</span>}
      <span
        className="text-[13px] tabular-nums font-black text-right shrink-0"
        style={{ minWidth: 14, color: side.isWinner ? ACCENT : 'var(--text-secondary)' }}
      >
        {side.score ?? ''}
      </span>
    </div>
  )
}

// ── Tarjeta de un cruce ──────────────────────────────────────────────────────
function MatchCard({ m }: { m: BracketMatch }) {
  const resolved = m.status === 'resolved'
  const live = m.status === 'closed' // empezado, sin resolver
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${live ? 'rgba(239,68,68,0.4)' : resolved ? `${ACCENT}30` : 'var(--border)'}`,
      }}
    >
      <div className="px-3 pt-1.5 flex items-center justify-between">
        <span
          className="text-[9px] font-black uppercase tracking-wider"
          style={{ color: live ? '#ef4444' : 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
        >
          {live ? '● En juego' : resolved ? 'Final' : kickoff(m.dateISO)}
        </span>
      </div>
      <SideRow side={m.home} resolved={resolved} />
      <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />
      <SideRow side={m.away} resolved={resolved} />
    </div>
  )
}

function RoundHeader({ label }: { label: string }) {
  return (
    <div
      className="text-center text-[10px] font-black uppercase tracking-widest mb-3"
      style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}
    >
      {label}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function MundialBracket() {
  const [bracket, setBracket] = useState<Bracket | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [activeRound, setActiveRound] = useState<BracketRoundId | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/mundial/bracket')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: Bracket) => {
        if (!alive) return
        setBracket(data)
        // Default móvil: la primera ronda con algún partido por jugar (la "actual").
        const live = data.rounds.find(r => r.matches.some(m => m.status !== 'resolved'))
        setActiveRound(live?.id ?? data.rounds[0]?.id ?? null)
        setState('ready')
      })
      .catch(() => alive && setState('error'))
    return () => { alive = false }
  }, [])

  const rounds = useMemo(() => bracket?.rounds.filter(r => r.matches.length > 0) ?? [], [bracket])

  if (state === 'loading') {
    return (
      <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
        Cargando el cuadro…
      </div>
    )
  }
  if (state === 'error' || !bracket || !rounds.length || !bracket.hasStarted) {
    return (
      <div className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>
        <div className="text-2xl mb-2">🗺️</div>
        <p className="text-[13px]">
          {state === 'error'
            ? 'No se pudo cargar el cuadro. Inténtalo de nuevo en un momento.'
            : 'El cuadro de eliminatorias aparecerá en cuanto arranque la fase final.'}
        </p>
      </div>
    )
  }

  const active = rounds.find(r => r.id === activeRound) ?? rounds[0]
  const mainRounds = rounds.filter(r => r.id !== 'third')
  const third = bracket.rounds.find(r => r.id === 'third' && r.matches.length > 0)

  return (
    <div className="pt-1">
      {/* Cabecera */}
      <div className="px-1 mb-3 flex items-center justify-between">
        <h3 className="text-[12px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sport)' }}>
          Cuadro de eliminatorias
        </h3>
        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
          {bracket.resolvedCount}/{bracket.totalCount} jugados
        </span>
      </div>

      {/* ── MÓVIL: selector de ronda + tarjetas ── */}
      <div className="md:hidden">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
          {rounds.map(r => {
            const on = r.id === active.id
            return (
              <button
                key={r.id}
                onClick={() => setActiveRound(r.id)}
                aria-current={on ? 'true' : undefined}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all"
                style={{
                  background: on ? `${ACCENT}1e` : 'rgba(255,255,255,0.03)',
                  color: on ? ACCENT : 'var(--text-muted)',
                  border: `1px solid ${on ? `${ACCENT}45` : 'var(--border)'}`,
                  fontFamily: 'var(--font-sport)',
                }}
              >
                {ROUND_SHORT[r.id]}
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2 pt-1">
          {active.matches.map(m => <MatchCard key={m.id} m={m} />)}
        </div>
      </div>

      {/* ── ESCRITORIO: llave por columnas ── */}
      <div className="hidden md:block overflow-x-auto scrollbar-hide pb-2">
        <div className="flex gap-4 min-w-max items-stretch">
          {mainRounds.map(r => (
            <div key={r.id} className="flex flex-col" style={{ width: 220 }}>
              <RoundHeader label={r.label} />
              <div className="flex-1 flex flex-col justify-around gap-3">
                {r.matches.map(m => <MatchCard key={m.id} m={m} />)}
              </div>
              {/* El 3er puesto cuelga de la columna de la Final */}
              {r.id === 'final' && third && (
                <div className="mt-5 pt-4" style={{ borderTop: '1px dashed var(--border)' }}>
                  <RoundHeader label={third.label} />
                  <MatchCard m={third.matches[0]} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
