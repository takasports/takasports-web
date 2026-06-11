'use client'

// Lista de onces guardados por el usuario. Cada uno se puede borrar o
// "cargar" en Mi Once vía query param ?load=ID (lo gestiona el page de
// /mionce restaurando formación + slots).

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CountryFlag } from '@/components/icons/GameIcons'
import {
  deleteLineup,
  loadSavedLineups,
  onSavedLineupsChange,
  SAVED_LINEUP_LIMIT,
  type SavedLineup,
} from '@/lib/mionce-saved'
import { getPlayerById } from '@/lib/players-catalog'

const ACCENT = '#93C5FD'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  } catch { return '' }
}

export default function OncesClient() {
  const [lineups, setLineups] = useState<SavedLineup[] | null>(null)

  useEffect(() => {
    setLineups(loadSavedLineups())
    return onSavedLineupsChange(() => setLineups(loadSavedLineups()))
  }, [])

  if (!lineups) {
    return <div className="rounded-2xl h-[200px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }} aria-hidden />
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/perfil"
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-colors hover:text-white"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}
        >
          ← Volver al perfil
        </Link>
      </div>

      <h1
        className="font-black leading-tight mb-2"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
          color: '#F8F8FF',
          letterSpacing: '-0.02em',
        }}
      >
        Tus onces guardados.
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', maxWidth: 560 }}>
        Snapshots de tus mejores alineaciones desde Mi Once. Se quedan aquí aunque
        cambie el reto de la semana. Tope: {SAVED_LINEUP_LIMIT} guardados.
      </p>

      {lineups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {lineups.map(l => <LineupCard key={l.id} lineup={l} />)}
        </div>
      )}
    </>
  )
}

function LineupCard({ lineup }: { lineup: SavedLineup }) {
  const filled = Object.values(lineup.slots).filter(Boolean).length
  const players = Object.values(lineup.slots)
    .map(id => getPlayerById(id))
    .filter((p): p is NonNullable<ReturnType<typeof getPlayerById>> => !!p)
    .slice(0, 11)

  const confirmDelete = () => {
    if (typeof window !== 'undefined' && window.confirm(`Borrar "${lineup.name}"?`)) {
      deleteLineup(lineup.id)
    }
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
            {lineup.formation} · {formatDate(lineup.createdAt)}
          </p>
          <h3 className="text-base font-black truncate" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
            {lineup.name}
          </h3>
          {lineup.challengeTitle && (
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {lineup.challengeTitle}
            </p>
          )}
        </div>
        <span
          className="text-[10px] font-black px-2 py-0.5 rounded inline-flex items-center gap-1"
          style={{ background: filled === 11 ? 'rgba(74,222,128,0.12)' : 'rgba(252,211,77,0.10)', color: filled === 11 ? '#86EFAC' : '#FCD34D', border: `1px solid ${filled === 11 ? 'rgba(74,222,128,0.25)' : 'rgba(252,211,77,0.25)'}`, fontFamily: 'var(--font-sport)' }}
        >
          {filled}/11
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {players.map(p => (
          <span
            key={p.id}
            className="text-[10px] font-black px-1.5 py-0.5 rounded inline-flex items-center gap-1 truncate max-w-[140px]"
            style={{ background: 'rgba(147,197,253,0.08)', color: '#F0F0F5', border: '1px solid rgba(147,197,253,0.18)', fontFamily: 'var(--font-display)' }}
          >
            <CountryFlag country={p.country} width={10} />
            <span className="truncate">{p.name.split(' ').slice(-1)[0]}</span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/mionce?load=${encodeURIComponent(lineup.id)}`}
          className="flex-1 text-center py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
          style={{ background: 'rgba(147,197,253,0.10)', color: ACCENT, border: '1px solid rgba(147,197,253,0.30)', fontFamily: 'var(--font-sport)' }}
        >
          Cargar en Mi Once
        </Link>
        <button
          onClick={confirmDelete}
          className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
          style={{ background: 'rgba(248,113,113,0.08)', color: '#FCA5A5', border: '1px solid rgba(248,113,113,0.22)', fontFamily: 'var(--font-sport)' }}
          aria-label="Borrar"
        >
          Borrar
        </button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{ background: 'var(--bg-card)', border: '1px dashed rgba(255,255,255,0.08)' }}
    >
      <div className="text-4xl mb-3">⚽</div>
      <p className="text-base font-black mb-2" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
        Aún no has guardado ningún once
      </p>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)', maxWidth: 360, marginInline: 'auto' }}>
        Arma un XI en Mi Once, pulsa <strong style={{ color: '#FCD34D' }}>📒 Guardar</strong> y aparecerá aquí.
      </p>
      <Link
        href="/mionce"
        className="inline-flex px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest"
        style={{ background: 'rgba(147,197,253,0.16)', color: ACCENT, border: `1px solid rgba(147,197,253,0.32)`, fontFamily: 'var(--font-sport)' }}
      >
        Ir a Mi Once
      </Link>
    </div>
  )
}
