'use client'

import { useState, useEffect, useCallback } from 'react'
import ResearchPanel from './ResearchPanel'

type Category =
  | 'jugadores' | 'jugadoras' | 'clubes' | 'clubes_femenino'
  | 'entrenadores' | 'creadores' | 'periodistas' | 'luchadoras_ufc'
  | 'creadores_wwe' | 'sub21' | 'latam' | 'concacaf'

interface Entry {
  id: string
  category: string
  name: string
  subtitle: string
  rank: number
  score: number
  trend: string
  insight: string | null
  active: boolean
  editorial_locked: boolean
  score_prev: number | null
  // raw DB cols para mostrar breakdown
  rank_auto: number | null
  rank_manual: number | null
  score_auto: number | null
  score_manual: number | null
  insight_auto: string | null
  insight_manual: string | null
  editorial_boost: number | null
  editorial_note: string | null
}

// Las categorías que SIGUEN vivas. 'entrenadores' está retirada
// (RETIRED_CATEGORIES en curate-active-entries) y 'latam'/'concacaf' están
// congeladas: se dejaron de curar, así que ofrecerlas para editar era invitar a
// tocar datos que ningún proceso vuelve a mirar.
//
// El producto enseña TRES pistas (Deportistas · Equipos · Contenido); estas son
// las categorías de base que las alimentan.
const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'jugadores',      label: 'Jugadores'      },
  { id: 'jugadoras',      label: 'Jugadoras'      },
  { id: 'sub21',          label: 'Sub-21'         },
  { id: 'luchadoras_ufc', label: 'UFC Fem.'       },
  { id: 'clubes',         label: 'Clubes'         },
  { id: 'clubes_femenino',label: 'Clubes Fem.'    },
  { id: 'creadores',      label: 'Creadores'      },
  { id: 'periodistas',    label: 'Periodistas'    },
  { id: 'creadores_wwe',  label: 'WWE'            },
]

const TREND_ICONS: Record<string, string> = {
  up2: '↑↑', up: '↑', flat: '→', down: '↓', down2: '↓↓',
}
const TREND_COLORS: Record<string, string> = {
  up2: '#22c55e', up: '#86efac', flat: '#5A5A72', down: '#f87171', down2: '#ef4444',
}

// ── Panel de edición inline ───────────────────────────────────────────────
function EditPanel({
  entry,
  onClose,
  onSaved,
}: {
  entry: Entry
  onClose: () => void
  onSaved: () => void
}) {
  const [rank,          setRank]          = useState(String(entry.rank_manual ?? entry.rank_auto ?? entry.rank ?? ''))
  const [score,         setScore]         = useState(String(entry.score_manual ?? entry.score_auto ?? entry.score ?? ''))
  const [insight,       setInsight]       = useState(entry.insight_manual ?? entry.insight_auto ?? entry.insight ?? '')
  const [editBoost,     setEditBoost]     = useState(String(entry.editorial_boost ?? ''))
  const [editNote,      setEditNote]      = useState(entry.editorial_note ?? '')
  const [locked,        setLocked]        = useState(entry.editorial_locked ?? false)
  const [saving,        setSaving]        = useState(false)
  const [status,        setStatus]        = useState('')

  async function save() {
    setSaving(true)
    setStatus('')
    const overrides: Record<string, unknown> = {}
    if (rank.trim())       overrides.rank    = Number(rank)
    if (score.trim())      overrides.score   = Number(score)
    if (insight.trim())    overrides.insight = insight.trim()
    if (editBoost.trim())  overrides.editorialBoost = Number(editBoost)
    if (editNote.trim())   overrides.editorialNote  = editNote.trim()
    overrides.locked = locked

    try {
      const res = await fetch('/api/rankings/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: entry.id, category: entry.category, overrides }),
      })
      if (!res.ok) {
        const err = await res.json()
        setStatus('Error: ' + (err.error ?? res.status))
      } else {
        setStatus('✓ Guardado')
        setTimeout(() => { onSaved(); onClose() }, 800)
      }
    } catch (e) {
      setStatus('Error de red')
    } finally {
      setSaving(false)
    }
  }

  async function clearOverride(field: string) {
    setSaving(true)
    const res = await fetch(
      `/api/rankings/override?id=${entry.id}&category=${entry.category}&field=${field}`,
      { method: 'DELETE', credentials: 'same-origin' }
    )
    if (res.ok) { setStatus('✓ Override eliminado'); setTimeout(() => { onSaved(); onClose() }, 700) }
    else setStatus('Error al limpiar')
    setSaving(false)
  }

  // Retirada editorial. Escribe `suppressed`, NO `active`.
  //
  // El botón decía «permanente» pero solo apagaba `active`, que es propiedad de
  // curate-active-entries y se recalcula entero cada domingo: quien retirabas
  // reaparecía a los pocos días sin que nadie entendiera por qué. `suppressed`
  // (migración 116) es la columna que ningún automatismo toca.
  async function toggleActive() {
    setSaving(true)
    setStatus('')
    const readmitir = entry.active === false
    try {
      const qs = new URLSearchParams({ id: entry.id, category: entry.category })
      if (readmitir) qs.set('deshacer', '1')
      const res = await fetch(`/api/rankings/entry?${qs}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) { const err = await res.json(); setStatus('Error: ' + (err.error ?? res.status)) }
      else { setStatus(readmitir ? '✓ Readmitido' : '✓ Retirado'); setTimeout(() => { onSaved(); onClose() }, 700) }
    } catch { setStatus('Error de red') }
    finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-1.5 rounded-lg text-xs outline-none'
  const inputSty = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#D0D0E0', fontFamily: 'var(--font-sport)' } as React.CSSProperties

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: '#0F0F1A', border: '1px solid rgba(124,58,237,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-0.5"
              style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
              Override editorial
            </p>
            <h2 className="text-base font-black" style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)' }}>
              {entry.name}
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              {entry.subtitle}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Valores actuales */}
        <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          <div>Rank auto: <span style={{ color: '#A0A0B8' }}>#{entry.rank_auto ?? '—'}</span></div>
          <div>Rank manual: <span style={{ color: '#C4B5FD' }}>#{entry.rank_manual ?? '—'}</span></div>
          <div>Score auto: <span style={{ color: '#A0A0B8' }}>{entry.score_auto ?? '—'}</span></div>
          <div>Score manual: <span style={{ color: '#C4B5FD' }}>{entry.score_manual ?? '—'}</span></div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        {/* Campos editables */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest mb-1"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>Rank</label>
            <div className="flex gap-2">
              <input type="number" value={rank} onChange={e => setRank(e.target.value)}
                className={inputCls} style={inputSty} placeholder="e.g. 5" />
              {entry.rank_manual !== null && (
                <button onClick={() => clearOverride('rank')} style={{ color: '#f87171', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>✕</button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest mb-1"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>Score (0–100)</label>
            <div className="flex gap-2">
              <input type="number" value={score} onChange={e => setScore(e.target.value)}
                className={inputCls} style={inputSty} placeholder="e.g. 87.5" min={0} max={100} step={0.5} />
              {entry.score_manual !== null && (
                <button onClick={() => clearOverride('score')} style={{ color: '#f87171', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>✕</button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest mb-1"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>Insight editorial</label>
            <div className="flex gap-2">
              <textarea value={insight} onChange={e => setInsight(e.target.value)} rows={2}
                className={inputCls} style={{ ...inputSty, resize: 'vertical' }}
                placeholder="Frase editorial…" />
              {entry.insight_manual !== null && (
                <button onClick={() => clearOverride('insight')} style={{ color: '#f87171', background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-start' }}>✕</button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-1"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>Boost editorial</label>
              <input type="number" value={editBoost} onChange={e => setEditBoost(e.target.value)}
                className={inputCls} style={inputSty} placeholder="-15 a +15" min={-15} max={15} step={0.5} />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-1"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>Nota boost</label>
              <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)}
                className={inputCls} style={inputSty} placeholder="Razón…" />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setLocked(l => !l)}
              className="w-9 h-5 rounded-full flex items-center transition-all"
              style={{ background: locked ? '#7C3AED' : 'rgba(255,255,255,0.08)', padding: '2px' }}>
              <div className="w-4 h-4 rounded-full transition-all"
                style={{ background: '#fff', transform: locked ? 'translateX(16px)' : 'translateX(0)' }} />
            </div>
            <span className="text-[11px] font-semibold" style={{ color: locked ? '#C4B5FD' : 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              Bloquear del cron (editorial_locked)
            </span>
          </label>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            style={{
              background: saving ? 'rgba(124,58,237,0.1)' : 'rgba(124,58,237,0.2)',
              color: '#C4B5FD', border: '1px solid rgba(124,58,237,0.4)',
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sport)',
            }}>
            {saving ? 'Guardando…' : 'Guardar override'}
          </button>
          <button
            onClick={() => clearOverride('all')}
            disabled={saving}
            className="py-2 px-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            style={{
              background: 'rgba(239,68,68,0.08)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontFamily: 'var(--font-sport)',
            }}>
            Reset
          </button>
        </div>

        {/* Activar / Desactivar */}
        <button
          onClick={toggleActive}
          disabled={saving}
          className="py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          style={{
            background: entry.active ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.1)',
            color: entry.active ? '#f87171' : '#22c55e',
            border: `1px solid ${entry.active ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.3)'}`,
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sport)',
          }}>
          {entry.active ? '⊘ Retirar del ranking — permanente' : '✓ Activar — mostrar en el ranking'}
        </button>

        {status && (
          <p className="text-center text-xs font-semibold"
            style={{ color: status.startsWith('✓') ? '#22c55e' : '#f87171', fontFamily: 'var(--font-sport)' }}>
            {status}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Fila de entry ─────────────────────────────────────────────────────────
function EntryRow({ entry, onRefresh }: { entry: Entry; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const hasOverride = entry.rank_manual !== null || entry.score_manual !== null || entry.insight_manual !== null
  const trend = entry.trend ?? 'flat'

  return (
    <>
      <tr
        onClick={() => setEditing(true)}
        className="cursor-pointer transition-colors"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: entry.active === false ? 0.5 : 1 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Rank */}
        <td className="py-2.5 px-3 text-center" style={{ width: 52 }}>
          <span className="text-xs font-black tabular-nums"
            style={{ color: entry.rank <= 3 ? '#C4B5FD' : 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
            #{entry.rank}
          </span>
          {entry.rank_manual !== null && (
            <span className="block text-[9px]" style={{ color: '#A78BFA' }}>✏️</span>
          )}
        </td>
        {/* Name */}
        <td className="py-2.5 px-2">
          <div className="flex items-center gap-2">
            {entry.editorial_locked && <span title="Bloqueado del cron" style={{ fontSize: 11 }}>🔒</span>}
            {hasOverride && !entry.editorial_locked && <span title="Override activo" style={{ fontSize: 11 }}>✏️</span>}
            <div>
              <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#D0D0E0', fontFamily: 'var(--font-sport)' }}>
                {entry.name}
                {entry.active === false && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                    inactivo
                  </span>
                )}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                {entry.subtitle}
              </p>
            </div>
          </div>
        </td>
        {/* Score */}
        <td className="py-2.5 px-3 text-right" style={{ width: 72 }}>
          <span className="text-sm font-black tabular-nums"
            style={{ color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
            {Number(entry.score).toFixed(1)}
          </span>
          {entry.score_manual !== null && (
            <span className="block text-[9px]" style={{ color: '#A78BFA' }}>manual</span>
          )}
        </td>
        {/* Trend */}
        <td className="py-2.5 px-3 text-center" style={{ width: 44 }}>
          <span className="text-xs font-black" style={{ color: TREND_COLORS[trend] ?? 'var(--text-muted)' }}>
            {TREND_ICONS[trend] ?? '→'}
          </span>
        </td>
        {/* Insight */}
        <td className="py-2.5 px-2 hidden md:table-cell" style={{ maxWidth: 280 }}>
          <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
            {entry.insight ?? '—'}
          </p>
        </td>
      </tr>
      {editing && (
        <EditPanel
          entry={entry}
          onClose={() => setEditing(false)}
          onSaved={onRefresh}
        />
      )}
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function RankingsAdmin() {
  const [vista, setVista]         = useState<'listado' | 'alta'>('listado')
  const [category, setCategory]   = useState<Category>('jugadores')
  const [entries,  setEntries]    = useState<Entry[]>([])
  const [loading,  setLoading]    = useState(false)
  const [source,   setSource]     = useState<'db' | 'static' | 'error'>('db')
  const [search,   setSearch]     = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/rankings/admin-list?category=${category}${showInactive ? '&includeInactive=1' : ''}`,
        { credentials: 'same-origin' },
      )
      if (!res.ok) { setSource('error'); setEntries([]); return }
      const data = await res.json()
      setEntries(data.entries ?? [])
      setSource(data.source ?? 'db')
    } catch {
      setSource('error')
    } finally {
      setLoading(false)
    }
  }, [category, showInactive])

  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? entries.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.subtitle.toLowerCase().includes(search.toLowerCase())
      )
    : entries

  const lockedCount   = entries.filter(e => e.editorial_locked).length
  const overrideCount = entries.filter(e => e.rank_manual !== null || e.score_manual !== null).length

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', padding: '24px' }}>
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1"
          style={{ color: '#A78BFA', fontFamily: 'var(--font-sport)' }}>
          Panel editorial
        </p>
        <h1 className="text-2xl font-black mb-1"
          style={{ color: '#E8E8F0', fontFamily: 'var(--font-display)' }}>
          Índice Taka <span style={{ color: '#A78BFA' }}>Admin</span>
        </h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          Haz click en cualquier entry para editar su posición, score, insight o bloquearlo del cron.
        </p>
      </div>

      <div className="max-w-5xl mx-auto mb-5 flex gap-2">
        {([['listado', 'Listado'], ['alta', '+ Alta por investigación']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className="px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all"
            style={{
              background: vista === id ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
              color: vista === id ? '#C4B5FD' : 'var(--text-muted)',
              border: vista === id ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.07)',
              cursor: 'pointer', fontFamily: 'var(--font-sport)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {vista === 'alta' && (
        <div className="max-w-5xl mx-auto">
          <ResearchPanel />
        </div>
      )}

      <div className="max-w-5xl mx-auto" style={{ display: vista === 'listado' ? undefined : 'none' }}>
        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4 pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setCategory(cat.id); setSearch('') }}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
              style={{
                background: category === cat.id ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                color: category === cat.id ? '#C4B5FD' : 'var(--text-muted)',
                border: category === cat.id ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.07)',
                cursor: 'pointer', fontFamily: 'var(--font-sport)',
              }}>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Stats + búsqueda */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex gap-3 text-[10px]" style={{ fontFamily: 'var(--font-sport)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{entries.length} entries</span>
            {overrideCount > 0 && <span style={{ color: '#C4B5FD' }}>✏️ {overrideCount} overrides</span>}
            {lockedCount > 0   && <span style={{ color: '#A78BFA' }}>🔒 {lockedCount} locked</span>}
            <span style={{ color: source === 'db' ? '#22c55e' : source === 'static' ? '#f59e0b' : '#f87171' }}>
              {source === 'db' ? '● DB' : source === 'static' ? '● Estático' : '● Error'}
            </span>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="ml-auto px-3 py-1.5 rounded-full text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#D0D0E0', fontFamily: 'var(--font-sport)', width: 180 }}
          />
          <button
            onClick={() => setShowInactive(v => !v)}
            className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
            style={{
              background: showInactive ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.06)',
              color: showInactive ? '#f87171' : '#8E8E9E',
              border: showInactive ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', fontFamily: 'var(--font-sport)',
            }}>
            {showInactive ? '● Inactivos' : '○ Inactivos'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#8E8E9E', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontFamily: 'var(--font-sport)' }}>
            {loading ? '…' : '↻'}
          </button>
        </div>

        {/* Tabla */}
        <div className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg-card)' }}>
          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              Cargando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
              {source === 'error' ? 'Error conectando con la DB — verifica SUPABASE_SERVICE_ROLE_KEY' : 'Sin entries'}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['#', 'Entry', 'Score', 'Trend', 'Insight'].map(h => (
                    <th key={h} className="py-2 px-3 text-left text-[9px] font-black uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <EntryRow key={entry.id + entry.category} entry={entry} onRefresh={load} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Instrucciones */}
        <div className="mt-6 rounded-xl p-4 text-[11px] leading-relaxed"
          style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.1)', color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          <p><span style={{ color: '#9B7CF6' }}>✏️ Override</span> — sobreescribe el valor automático del cron. La vista <code style={{ color: '#C4B5FD' }}>ranking_view</code> aplica <code>COALESCE(manual, auto)</code>.</p>
          <p className="mt-1"><span style={{ color: '#9B7CF6' }}>🔒 Locked</span> — el cron nunca toca esa entry. Útil para posiciones que quieres fijar indefinidamente.</p>
          <p className="mt-1"><span style={{ color: '#9B7CF6' }}>Reset</span> — elimina todos los overrides de una entry. Vuelve al valor automático del cron.</p>
          <p className="mt-1"><span style={{ color: '#f87171' }}>⊘ Retirar</span> — saca la entry del ranking de forma permanente (<code style={{ color: '#C4B5FD' }}>active=false</code> + <code style={{ color: '#C4B5FD' }}>suppressed=true</code>): ni la curación semanal ni el cron de creadores pueden devolverla. Usa <span style={{ color: '#f87171' }}>○/● Inactivos</span> arriba para verlas y reactivarlas — reactivar levanta el candado.</p>
          <p className="mt-1">Acceso: tu email debe estar en <code style={{ color: '#C4B5FD' }}>ADMIN_EMAILS</code> y debes estar logueado en TakaSports.</p>
        </div>
      </div>
    </div>
  )
}
