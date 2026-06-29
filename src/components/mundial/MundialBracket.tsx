'use client'

// Cuadro de eliminatorias del Mundial 2026 (la pestaña "Cuadro" de Estadísticas).
// Diseño HÍBRIDO: en móvil un selector de ronda + tarjetas grandes; en escritorio
// la LLAVE con líneas conectoras (16avos → Final), reordenada por árbol para que
// cada par de cruces quede junto al partido que alimenta. Misma fuente de datos
// para las dos vistas (/api/mundial/bracket → buildBracket).

import { Fragment, useEffect, useMemo, useState } from 'react'
import { treeOrderedRounds, type Bracket, type BracketMatch, type BracketSide, type BracketRoundId } from '@/lib/mundial-bracket'

const ACCENT = '#f59e0b'
const WIN_BG = 'rgba(245,158,11,0.10)'
const LINE = 'rgba(245,158,11,0.32)' // líneas de la llave

const ROUND_SHORT: Record<BracketRoundId, string> = {
  r32: '16avos', r16: 'Octavos', qf: 'Cuartos', sf: 'Semis', third: '3er puesto', final: 'Final',
}

function kickoff(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  })
}

// ── Bandera en chip circular (o marcador "?" para un hueco sin definir) ───────
function Crest({ side, dim }: { side: BracketSide; dim?: boolean }) {
  if (side.isPlaceholder) {
    return (
      <span
        className="shrink-0 inline-flex items-center justify-center rounded-full text-[11px] font-black"
        style={{ width: 24, height: 24, color: 'var(--text-muted)', border: '1px dashed var(--border)' }}
      >
        ?
      </span>
    )
  }
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center rounded-full text-[14px] leading-none"
      style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', opacity: dim ? 0.55 : 1 }}
    >
      {side.flag}
    </span>
  )
}

// ── Fila de una selección dentro de una tarjeta ──────────────────────────────
function SideRow({ side, resolved }: { side: BracketSide; resolved: boolean }) {
  const loser = resolved && !side.isWinner && !side.isPlaceholder
  return (
    <div
      className="px-2.5 py-2 flex items-center gap-2"
      style={{ background: side.isWinner ? WIN_BG : 'transparent' }}
    >
      <Crest side={side} dim={loser} />
      <span
        className="flex-1 text-[13px] truncate"
        style={{
          fontWeight: side.isWinner ? 800 : 600,
          color: side.isPlaceholder ? 'var(--text-muted)' : 'var(--text-primary)',
          opacity: loser ? 0.7 : 1,
        }}
      >
        {side.name}
      </span>
      {side.isWinner && <span style={{ color: ACCENT, fontSize: 12 }}>✓</span>}
      <span
        className="text-[14px] tabular-nums font-black text-right shrink-0"
        style={{ minWidth: 16, color: side.isWinner ? ACCENT : 'var(--text-secondary)', opacity: loser ? 0.7 : 1 }}
      >
        {side.score ?? ''}
      </span>
    </div>
  )
}

// ── Tarjeta de un cruce ──────────────────────────────────────────────────────
function MatchCard({ m, featured }: { m: BracketMatch; featured?: boolean }) {
  const resolved = m.status === 'resolved'
  const live = m.status === 'closed' // empezado, sin resolver
  const borderC = live ? 'rgba(239,68,68,0.5)' : featured ? `${ACCENT}66` : resolved ? `${ACCENT}33` : 'var(--border)'
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: featured ? `${ACCENT}0d` : 'rgba(255,255,255,0.025)',
        border: `1px solid ${borderC}`,
        boxShadow: featured ? `0 0 0 1px ${ACCENT}22` : 'none',
      }}
    >
      <div className="px-2.5 pt-1.5 pb-1 flex items-center gap-1.5">
        {live && (
          <span style={{ width: 6, height: 6, borderRadius: 99, background: '#ef4444', display: 'inline-block' }} />
        )}
        <span
          className="text-[9px] font-black uppercase tracking-wider"
          style={{ color: live ? '#ef4444' : 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
        >
          {live ? 'En juego' : resolved ? 'Final' : kickoff(m.dateISO)}
        </span>
      </div>
      <SideRow side={m.home} resolved={resolved} />
      <div style={{ height: 1, background: 'var(--border)' }} />
      <SideRow side={m.away} resolved={resolved} />
    </div>
  )
}

// Progreso del torneo (resueltos / total)
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: ACCENT, borderRadius: 99 }} />
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
        const live = data.rounds.find(r => r.matches.some(m => m.status !== 'resolved'))
        setActiveRound(live?.id ?? data.rounds[0]?.id ?? null)
        setState('ready')
      })
      .catch(() => alive && setState('error'))
    return () => { alive = false }
  }, [])

  const rounds = useMemo(() => bracket?.rounds.filter(r => r.matches.length > 0) ?? [], [bracket])
  const treeRounds = useMemo(() => treeOrderedRounds(rounds), [rounds])

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
  const third = bracket.rounds.find(r => r.id === 'third' && r.matches.length > 0)
  const maxMatches = Math.max(...treeRounds.map(r => r.matches.length), 1)
  const bracketMinH = maxMatches * 80 + 54 // 54px = cabecera de columna

  return (
    <div className="pt-1">
      {/* Cabecera con progreso */}
      <div className="px-1 mb-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <h3 className="text-[13px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-sport)' }}>
              Cuadro de eliminatorias
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Camino al título · Mundial 2026
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider shrink-0" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
            {bracket.resolvedCount}/{bracket.totalCount} jugados
          </span>
        </div>
        <ProgressBar done={bracket.resolvedCount} total={bracket.totalCount} />
      </div>

      {/* ── MÓVIL: selector de ronda + tarjetas (orden cronológico) ── */}
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
        <div className="flex items-center justify-between px-1 pt-2 pb-1">
          <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
            {active.label}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {active.matches.length} {active.matches.length === 1 ? 'partido' : 'partidos'}
          </span>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          {active.matches.map(m => <MatchCard key={m.id} m={m} featured={active.id === 'final'} />)}
        </div>
      </div>

      {/* ── ESCRITORIO: llave por árbol con líneas conectoras ── */}
      <div className="hidden md:block overflow-x-auto scrollbar-hide pb-2">
        <div className="tk-bracket" style={{ minHeight: bracketMinH }}>
          {treeRounds.map((r, i) => (
            <Fragment key={r.id}>
              <div className="tk-round">
                <div className="tk-head">
                  {r.id === 'final' && <div className="tk-trophy">🏆</div>}
                  <div className="tk-head-label">{r.label}</div>
                  <div className="tk-head-count">{r.matches.length} {r.matches.length === 1 ? 'partido' : 'partidos'}</div>
                  <div className="tk-head-rule" />
                </div>
                <div className="tk-matches">
                  {r.matches.map(m => (
                    <div key={m.id} className="tk-match">
                      <MatchCard m={m} featured={r.id === 'final'} />
                    </div>
                  ))}
                </div>
              </div>
              {i < treeRounds.length - 1 && (
                <div className="tk-conn">
                  {Array.from({ length: treeRounds[i + 1].matches.length }).map((_, k) => (
                    <div key={k} className="tk-conn-item" />
                  ))}
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {third && (
          <div className="tk-third">
            <div className="tk-third-label">🥉 {third.label}</div>
            <div style={{ width: 226, padding: '0 4px' }}>
              <MatchCard m={third.matches[0]} />
            </div>
          </div>
        )}

        <style jsx>{`
          .tk-bracket { display: flex; align-items: stretch; min-width: max-content; }
          .tk-round { display: flex; flex-direction: column; width: 226px; padding: 0 4px; }
          .tk-head { height: 54px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 4px; }
          .tk-trophy { font-size: 18px; line-height: 1; margin-bottom: 2px; }
          .tk-head-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.14em; color: ${ACCENT}; font-family: var(--font-sport); }
          .tk-head-count { font-size: 9px; font-weight: 700; color: var(--text-muted); margin-top: 2px; }
          .tk-head-rule { width: 26px; height: 2px; background: ${ACCENT}66; border-radius: 2px; margin-top: 6px; }
          .tk-matches { flex: 1; display: flex; flex-direction: column; justify-content: space-around; }
          .tk-match { position: relative; }
          .tk-round:not(:last-of-type) .tk-match::after { content: ''; position: absolute; left: 100%; top: 50%; width: 6px; height: 2px; background: ${LINE}; transform: translateY(-50%); }
          .tk-conn { display: flex; flex-direction: column; justify-content: space-around; width: 14px; padding-top: 54px; }
          .tk-conn-item { flex: 1; margin: 25% 0; position: relative; border: 2px solid ${LINE}; border-left: none; border-radius: 0 7px 7px 0; }
          .tk-conn-item::after { content: ''; position: absolute; top: 50%; left: 100%; width: 6px; height: 2px; background: ${LINE}; transform: translateY(-50%); }
          .tk-third { margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--border); display: flex; flex-direction: column; align-items: center; gap: 8px; }
          .tk-third-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-secondary); font-family: var(--font-sport); }
        `}</style>
      </div>
    </div>
  )
}
