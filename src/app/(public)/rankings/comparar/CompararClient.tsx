'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import ScrollToTop from '@/components/ScrollToTop'
import { type RankingEntry } from '@/lib/rankings'
import { getDisplayScore, scoreColor } from '@/lib/rankings-ui'
import { getAllRankingEntries } from '@/lib/rankings-search'
import { getSportStyle } from '@/lib/sports'

// ── Score/color: fuente única en rankings-ui (track-aware) ───────────

const SPORT_EMOJI: Record<string, string> = {
  futbol: '⚽', baloncesto: '🏀', formula1: '🏎️', tenis: '🎾',
  ufc: '🥊', wwe: '🤼', contenido: '✍️',
}

const FACTOR_DEFS = [
  { key: 'rendimiento', label: 'Rendimiento', pct: '40%', color: '#22c55e' },
  { key: 'contexto',    label: 'Contexto',    pct: '20%', color: '#60a5fa' },
  { key: 'mediatico',   label: 'Mediático',   pct: '25%', color: '#f59e0b' },
  { key: 'narrativa',   label: 'Narrativa',   pct: '15%', color: '#c084fc' },
] as const
type FactorKey = typeof FACTOR_DEFS[number]['key']

const DEFAULT_FACTORS: Record<FactorKey, number> = {
  rendimiento: 0, contexto: 0, mediatico: 0, narrativa: 0,
}

const COLOR_A = '#7C3AED'  // morado Taka
const COLOR_B = '#22d3ee'  // cyan

// ── Selector con buscador ─────────────────────────────────────────────
function EntryPicker({
  label, value, onChange, allEntries, accent, oppositeId, oppositeSport, sameSportOnly,
}: {
  label: string
  value: RankingEntry | undefined
  onChange: (e: RankingEntry) => void
  allEntries: RankingEntry[]
  accent: string
  oppositeId?: string
  oppositeSport?: string
  sameSportOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const filtered = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const q = norm(query.trim())
    let base = q
      ? allEntries.filter(e =>
          norm(e.name).includes(q) ||
          norm(e.subtitle).includes(q) ||
          e.id.includes(q)
        )
      : allEntries
    base = base.filter(e => e.id !== oppositeId)
    if (sameSportOnly && oppositeSport) {
      base = base.filter(e => e.sport === oppositeSport)
    }
    return base.slice(0, 80)
  }, [query, allEntries, oppositeId, oppositeSport, sameSportOnly])

  const sportEmoji = value?.sport ? SPORT_EMOJI[value.sport] ?? '🏅' : '🏅'

  return (
    <div className="relative" ref={ref}>
      <p className="text-[8px] font-black uppercase tracking-[0.18em] mb-1.5"
        style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
        {label}
      </p>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:brightness-110"
        style={{
          background: 'var(--bg-card)',
          border: `1px solid ${value ? accent + '40' : 'var(--border)'}`,
          borderLeft: `3px solid ${accent}`,
        }}
      >
        <div className="flex items-center justify-center rounded-xl text-lg flex-shrink-0"
          style={{ width: 36, height: 36, background: `${accent}14`, border: `1px solid ${accent}24` }}>
          {value?.emoji && value.emoji !== value.country ? value.emoji : sportEmoji}
        </div>
        <div className="flex-1 min-w-0">
          {value ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold truncate"
                  style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}>
                  {value.name}
                </span>
                {value.country && <span className="text-[11px]">{value.country}</span>}
              </div>
              <p className="text-[10px] truncate"
                style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>
                {value.subtitle}
              </p>
            </>
          ) : (
            <span className="text-sm" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
              Elegir entry…
            </span>
          )}
        </div>
        {value?.factors && (
          <span className="font-black tabular-nums text-base flex-shrink-0"
            style={{ fontFamily: 'var(--font-display)', color: scoreColor(getDisplayScore(value)) }}>
            {getDisplayScore(value).toFixed(1)}
          </span>
        )}
        <span className="text-xs flex-shrink-0" style={{ color: '#5A5A72' }}>▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl overflow-hidden"
          style={{ background: '#0F0F1A', border: '1px solid var(--border)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
          <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar nombre…"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--bg-base)', color: '#D0D0E0',
                border: '1px solid var(--border)', fontFamily: 'var(--font-sport)',
              }}
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs" style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                Sin resultados
              </p>
            )}
            {filtered.map(e => {
              const sAccent = e.sport ? getSportStyle(e.sport).accent : '#7C3AED'
              const ds = getDisplayScore(e)
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { onChange(e); setOpen(false); setQuery('') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:brightness-125"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <span className="text-base flex-shrink-0"
                    style={{ width: 22, textAlign: 'center' }}>
                    {e.emoji && e.emoji !== e.country
                      ? e.emoji
                      : (e.sport ? SPORT_EMOJI[e.sport] ?? '🏅' : '🏅')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate"
                      style={{ color: '#C0C0D6', fontFamily: 'var(--font-sport)' }}>
                      {e.name}
                    </p>
                    <p className="text-[10px] truncate"
                      style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>
                      {e.subtitle}
                    </p>
                  </div>
                  <span className="font-black tabular-nums text-xs flex-shrink-0"
                    style={{ fontFamily: 'var(--font-display)', color: scoreColor(ds) }}>
                    {ds.toFixed(1)}
                  </span>
                  <span className="w-1 h-5 rounded-full flex-shrink-0" style={{ background: sAccent }} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Radar chart SVG ──────────────────────────────────────────────────
function RadarChart({
  a, b,
}: {
  a: Record<FactorKey, number>
  b: Record<FactorKey, number>
}) {
  const width = 360
  const height = 320
  const cx = width / 2
  const cy = height / 2
  const maxR = 105
  const labelR = 120
  // Orden axes: top, right, bottom, left
  const axes: { key: FactorKey; angle: number }[] = [
    { key: 'rendimiento', angle: -Math.PI / 2 },
    { key: 'contexto',    angle: 0 },
    { key: 'mediatico',   angle: Math.PI / 2 },
    { key: 'narrativa',   angle: Math.PI },
  ]
  const point = (angle: number, value: number) => {
    const r = (Math.max(0, Math.min(100, value)) / 100) * maxR
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const
  }
  const polygon = (vals: Record<FactorKey, number>) =>
    axes.map(({ key, angle }) => point(angle, vals[key]).join(',')).join(' ')

  const rings = [25, 50, 75, 100]

  // Descripción a11y: "A: rendimiento 85, contexto 70, mediático 90, narrativa 60.
  // B: rendimiento 80, contexto 75, mediático 85, narrativa 65."
  const describe = (label: string, vals: Record<FactorKey, number>) =>
    `${label}: rendimiento ${Math.round(vals.rendimiento)}, contexto ${Math.round(vals.contexto)}, mediático ${Math.round(vals.mediatico)}, narrativa ${Math.round(vals.narrativa)}`
  const ariaLabel = `Radar 4 factores. ${describe('A', a)}. ${describe('B', b)}.`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full max-w-[360px] h-auto"
      role="img"
      aria-label={ariaLabel}
      style={{ overflow: 'visible' }}
    >
      {/* Rings */}
      {rings.map(v => (
        <polygon
          key={v}
          points={axes.map(({ angle }) => point(angle, v).join(',')).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}
      {/* Axes */}
      {axes.map(({ key, angle }) => {
        const [x2, y2] = point(angle, 100)
        return (
          <line key={key} x1={cx} y1={cy} x2={x2} y2={y2}
            stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        )
      })}
      {/* Polygon A (morado, fill suave) */}
      <polygon points={polygon(a)} fill={COLOR_A} fillOpacity={0.18}
        stroke={COLOR_A} strokeWidth={2.25} strokeOpacity={1}
        strokeLinejoin="round" />
      {/* Polygon B (cyan, encima sólo trazo + fill mínimo, así no se traga al A) */}
      <polygon points={polygon(b)} fill={COLOR_B} fillOpacity={0.1}
        stroke={COLOR_B} strokeWidth={2.25} strokeOpacity={1}
        strokeDasharray="4 3" strokeLinejoin="round" />
      {/* Vertices */}
      {axes.map(({ key, angle }) => {
        const [ax, ay] = point(angle, a[key])
        const [bx, by] = point(angle, b[key])
        return (
          <g key={key}>
            <circle cx={bx} cy={by} r={3} fill={COLOR_B} />
            <circle cx={ax} cy={ay} r={3} fill={COLOR_A} />
          </g>
        )
      })}
      {/* Labels */}
      {axes.map(({ key, angle }) => {
        const [lx, ly] = point(angle, labelR)
        const def = FACTOR_DEFS.find(f => f.key === key)!
        return (
          <text
            key={key}
            x={lx}
            y={ly}
            textAnchor={Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : (Math.cos(angle) > 0 ? 'start' : 'end')}
            dominantBaseline={Math.abs(Math.sin(angle)) < 0.1 ? 'middle' : (Math.sin(angle) > 0 ? 'hanging' : 'auto')}
            fontFamily="var(--font-sport)"
            fontSize="10"
            fontWeight="700"
            fill={def.color}
            style={{ letterSpacing: '0.08em' }}
          >
            {def.label.toUpperCase()}
          </text>
        )
      })}
    </svg>
  )
}

// ── Página ──────────────────────────────────────────────────────────
export default function CompararClient({ dbEntries = [] }: { dbEntries?: RankingEntry[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const idA = searchParams.get('a') ?? ''
  const idB = searchParams.get('b') ?? ''

  // Merge static + DB entries, deduplicando por id (DB prevalece para entries actualizadas)
  const allEntries = useMemo(() => {
    const staticEntries = getAllRankingEntries()
    if (!dbEntries.length) return staticEntries
    const dbMap = new Map(dbEntries.map(e => [e.id, e]))
    const merged = staticEntries.map(e => dbMap.get(e.id) ?? e)
    // Añadir DB entries que no están en estáticos
    for (const e of dbEntries) {
      if (!merged.find(m => m.id === e.id)) merged.push(e)
    }
    return merged.sort((a, b) => b.score - a.score)
  }, [dbEntries])

  const entryA = useMemo(() => allEntries.find(e => e.id === idA), [allEntries, idA])
  const entryB = useMemo(() => allEntries.find(e => e.id === idB), [allEntries, idB])

  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const [sameSportOnly, setSameSportOnly] = useState(false)

  function setEntry(slot: 'a' | 'b', entry: RankingEntry) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(slot, entry.id)
    router.replace(`/rankings/comparar?${params.toString()}`, { scroll: false })
  }

  function swap() {
    if (!entryA && !entryB) return
    const params = new URLSearchParams()
    if (entryB) params.set('a', entryB.id)
    if (entryA) params.set('b', entryA.id)
    router.replace(`/rankings/comparar?${params.toString()}`, { scroll: false })
  }

  async function share() {
    if (typeof window === 'undefined') return
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Comparador · Índice Taka', url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareState('copied')
        setTimeout(() => setShareState('idle'), 1800)
      }
    } catch { /* user cancel — silent */ }
  }

  const factorsA: Record<FactorKey, number> = entryA?.factors ?? DEFAULT_FACTORS
  const factorsB: Record<FactorKey, number> = entryB?.factors ?? DEFAULT_FACTORS

  const scoreA = entryA ? getDisplayScore(entryA) : 0
  const scoreB = entryB ? getDisplayScore(entryB) : 0
  const delta = scoreA - scoreB

  const accentA = entryA?.sport ? getSportStyle(entryA.sport).accent : COLOR_A
  const accentB = entryB?.sport ? getSportStyle(entryB.sport).accent : COLOR_B

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-[11px]"
          style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
          <Link href="/rankings" className="hover:brightness-150 transition-all"
            style={{ color: '#7C3AED' }}>
            ← Rankings
          </Link>
          <span style={{ color: '#3A3A52' }}>/</span>
          <span>Comparador</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-1.5"
            style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)' }}>
            Comparador <span style={{ color: '#7C3AED' }}>Taka</span>
          </h1>
          <p className="text-xs sm:text-sm"
            style={{ color: '#6A6A82', fontFamily: 'var(--font-sport)' }}>
            Enfrenta dos entries del Índice Taka. Radar de los 4 factores,
            desglose objetivo y delta total.
          </p>
        </div>

        {/* Toggle filtro contextual */}
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setSameSportOnly(s => !s)}
            disabled={!entryA?.sport && !entryB?.sport}
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all hover:brightness-125 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: sameSportOnly ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
              color: sameSportOnly ? '#C4B5FD' : '#5A5A72',
              border: sameSportOnly ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.06)',
              fontFamily: 'var(--font-sport)',
            }}
            title="Restringir el otro selector al mismo deporte"
          >
            {sameSportOnly ? '✓ ' : ''}Solo mismo deporte
          </button>
        </div>

        {/* Selectores */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-4 items-end mb-8">
          <EntryPicker
            label="Entry A"
            value={entryA}
            onChange={e => setEntry('a', e)}
            allEntries={allEntries}
            accent={COLOR_A}
            oppositeId={entryB?.id}
            oppositeSport={entryB?.sport}
            sameSportOnly={sameSportOnly}
          />
          <button
            type="button"
            onClick={swap}
            disabled={!entryA && !entryB}
            className="self-end h-[58px] md:h-auto md:py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-125 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'var(--bg-card)', color: '#A0A0B8',
              border: '1px solid var(--border)', fontFamily: 'var(--font-sport)',
            }}
            title="Intercambiar A ↔ B"
          >
            ⇄
          </button>
          <EntryPicker
            label="Entry B"
            value={entryB}
            onChange={e => setEntry('b', e)}
            allEntries={allEntries}
            accent={COLOR_B}
            oppositeId={entryA?.id}
            oppositeSport={entryA?.sport}
            sameSportOnly={sameSportOnly}
          />
        </div>

        {/* Resultado: vacío vs comparativa */}
        {(!entryA || !entryB) ? (
          <div className="rounded-2xl text-center py-12 px-6"
            style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}>
            <p className="text-4xl mb-3">⚖️</p>
            <p className="text-sm font-bold mb-1"
              style={{ color: '#A0A0B8', fontFamily: 'var(--font-sport)' }}>
              Elige dos entries para comparar
            </p>
            <p className="text-[11px]"
              style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
              Funciona con jugadores, clubes, entrenadores, creadores y periodistas.
            </p>
          </div>
        ) : (
          <>
            {/* Cabecera con scores grandes */}
            <div className="grid grid-cols-3 gap-3 mb-6 items-stretch">
              <CompareHeaderCard entry={entryA} accent={accentA} side="a" />
              <div className="flex flex-col items-center justify-center px-2">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-1.5"
                  style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                  Delta
                </p>
                <p className="font-black tabular-nums text-2xl sm:text-3xl"
                  style={{
                    color: delta === 0 ? '#6A6A82' : delta > 0 ? COLOR_A : COLOR_B,
                    fontFamily: 'var(--font-display)',
                  }}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                </p>
                <p className="text-[9px] uppercase tracking-widest mt-1.5"
                  style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>
                  {delta === 0 ? 'Empate' : delta > 0 ? 'Gana A' : 'Gana B'}
                </p>
              </div>
              <CompareHeaderCard entry={entryB} accent={accentB} side="b" />
            </div>

            {/* Radar + leyenda */}
            <div className="rounded-2xl p-5 sm:p-6 mb-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-3"
                style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                Radar · 4 factores objetivos
              </p>
              <div className="flex flex-col items-center gap-4">
                <RadarChart a={factorsA} b={factorsB} />
                <div className="flex items-center gap-5 text-[10px] font-bold"
                  style={{ fontFamily: 'var(--font-sport)' }}>
                  <span className="flex items-center gap-1.5" style={{ color: COLOR_A }}>
                    <span className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ background: COLOR_A, opacity: 0.85 }} />
                    {entryA.name}
                  </span>
                  <span className="flex items-center gap-1.5" style={{ color: COLOR_B }}>
                    <span className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ background: COLOR_B, opacity: 0.85 }} />
                    {entryB.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabla de factores */}
            <div className="rounded-2xl p-5 sm:p-6 mb-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-4"
                style={{ color: '#5A5A72', fontFamily: 'var(--font-sport)' }}>
                Desglose factor a factor
              </p>
              <div className="flex flex-col gap-3">
                {FACTOR_DEFS.map(({ key, label, pct, color }) => {
                  const va = factorsA[key]
                  const vb = factorsB[key]
                  const d = va - vb
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold"
                          style={{ color: color, fontFamily: 'var(--font-sport)' }}>
                          {label} <span style={{ color: '#3A3A4A' }}>{pct}</span>
                        </span>
                        <span className="text-[10px] tabular-nums font-bold"
                          style={{ color: d === 0 ? '#5A5A72' : d > 0 ? COLOR_A : COLOR_B,
                            fontFamily: 'var(--font-display)' }}>
                          {d > 0 ? '+' : ''}{d}
                        </span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                        <FactorBar value={va} accent={COLOR_A} />
                        <span className="text-[10px] tabular-nums font-bold w-7 text-right"
                          style={{ color: '#A0A0B8', fontFamily: 'var(--font-display)' }}>
                          {va}
                        </span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-2 items-center mt-1">
                        <FactorBar value={vb} accent={COLOR_B} />
                        <span className="text-[10px] tabular-nums font-bold w-7 text-right"
                          style={{ color: '#A0A0B8', fontFamily: 'var(--font-display)' }}>
                          {vb}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Total */}
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: '#A0A0B8', fontFamily: 'var(--font-sport)' }}>
                    Índice Taka · Total
                  </span>
                  <span className="text-[10px] tabular-nums font-bold"
                    style={{ color: delta === 0 ? '#5A5A72' : delta > 0 ? COLOR_A : COLOR_B,
                      fontFamily: 'var(--font-display)' }}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black tabular-nums text-lg"
                    style={{ color: scoreColor(scoreA), fontFamily: 'var(--font-display)' }}>
                    {scoreA.toFixed(1)}
                  </span>
                  <span className="text-[10px]" style={{ color: '#3A3A52' }}>vs</span>
                  <span className="font-black tabular-nums text-lg"
                    style={{ color: scoreColor(scoreB), fontFamily: 'var(--font-display)' }}>
                    {scoreB.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Compartir */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={share}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:brightness-125"
                style={{
                  background: shareState === 'copied' ? 'rgba(34,197,94,0.12)' : 'rgba(124,58,237,0.12)',
                  color: shareState === 'copied' ? '#22c55e' : '#C4B5FD',
                  border: `1px solid ${shareState === 'copied' ? 'rgba(34,197,94,0.3)' : 'rgba(124,58,237,0.3)'}`,
                  fontFamily: 'var(--font-sport)',
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {shareState === 'copied' ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Link copiado
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M6 10l4-4M5.5 11l-1 1a2.5 2.5 0 1 1-3.5-3.5l1-1M10.5 5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                      Compartir comparativa
                    </>
                  )}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <ScrollToTop />
    </div>
  )
}

// ── Subcomponentes locales ───────────────────────────────────────────
function CompareHeaderCard({
  entry, accent, side,
}: {
  entry: RankingEntry; accent: string; side: 'a' | 'b'
}) {
  const ds = getDisplayScore(entry)
  const sportEmoji = entry.sport ? SPORT_EMOJI[entry.sport] ?? '🏅' : '🏅'
  const avatar = entry.emoji && entry.emoji !== entry.country ? entry.emoji : sportEmoji
  const sideColor = side === 'a' ? COLOR_A : COLOR_B
  return (
    <div className="rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: `3px solid ${sideColor}`,
      }}>
      <span className="text-[8px] font-black uppercase tracking-[0.2em] mb-2"
        style={{ color: sideColor, fontFamily: 'var(--font-sport)' }}>
        {side.toUpperCase()}
      </span>
      <div className="flex items-center justify-center rounded-2xl text-2xl mb-2"
        style={{ width: 52, height: 52, background: `${accent}14`, border: `1px solid ${accent}24` }}>
        {avatar}
      </div>
      <p className="text-xs sm:text-sm font-bold leading-tight line-clamp-2 mb-0.5"
        style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}>
        {entry.name}
      </p>
      <p className="text-[10px] line-clamp-1 mb-2"
        style={{ color: '#4A4A5E', fontFamily: 'var(--font-sport)' }}>
        {entry.subtitle}
      </p>
      <span className="font-black tabular-nums text-2xl sm:text-3xl leading-none"
        style={{ color: scoreColor(ds), fontFamily: 'var(--font-display)' }}>
        {ds.toFixed(1)}
      </span>
    </div>
  )
}

function FactorBar({ value, accent }: { value: number; accent: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: accent, opacity: 0.85 }}
      />
    </div>
  )
}
