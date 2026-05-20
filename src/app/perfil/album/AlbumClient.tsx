'use client'

// Listado de cromos (jugadores colocados correctamente) agrupados por país.
// Datos en localStorage (ts_album). Si no hay nada, render motivacional.

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CountryFlag } from '@/components/icons/GameIcons'
import { getAlbumEntries, onAlbumChange, type AlbumEntry } from '@/lib/album'
import { getPlayerById, type Player } from '@/lib/players-catalog'

const ACCENT = '#FCD34D'
const ACCENT_DIM = '#F59E0B'

interface Card {
  player: Player
  entry: AlbumEntry
}

export default function AlbumClient() {
  const [entries, setEntries] = useState<AlbumEntry[] | null>(null)

  useEffect(() => {
    setEntries(getAlbumEntries())
    return onAlbumChange(() => setEntries(getAlbumEntries()))
  }, [])

  const cards: Card[] = useMemo(() => {
    if (!entries) return []
    return entries
      .map(e => ({ player: getPlayerById(e.playerId), entry: e }))
      .filter((x): x is Card => !!x.player)
  }, [entries])

  const byCountry: Record<string, Card[]> = useMemo(() => {
    const out: Record<string, Card[]> = {}
    for (const c of cards) {
      const k = c.player.country
      ;(out[k] ?? (out[k] = [])).push(c)
    }
    // ordenar por nombre dentro de cada país
    Object.values(out).forEach(arr => arr.sort((a, b) => a.player.name.localeCompare(b.player.name)))
    return out
  }, [cards])

  const totalUnique  = cards.length
  const totalCaught  = cards.reduce((acc, c) => acc + c.entry.count, 0)
  const fromTakagrid = cards.filter(c => c.entry.sources.includes('takagrid')).length
  const fromMionce   = cards.filter(c => c.entry.sources.includes('mionce')).length

  if (!entries) {
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
        Tu álbum de cracks.
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)', maxWidth: 560 }}>
        Cada vez que aciertas un jugador en TakaGrid o Mi Once entra a tu colección.
        Sin límites, sin pagar, sin trampas: solo los que de verdad has puesto bien.
      </p>

      {cards.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <Stat label="Cromos únicos" value={totalUnique} accent={ACCENT} />
            <Stat label="Total aciertos" value={totalCaught} accent="#86EFAC" />
            <Stat label="Desde TakaGrid" value={fromTakagrid} accent="#FDBA74" />
            <Stat label="Desde Mi Once"  value={fromMionce}   accent="#93C5FD" />
          </div>

          {Object.entries(byCountry)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([country, list]) => (
              <section key={country} className="mb-8">
                <h2 className="text-sm font-black uppercase tracking-widest mb-3 inline-flex items-center gap-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                  <CountryFlag country={country} width={18} />
                  <span>{country}</span>
                  <span className="text-[10px]" style={{ color: '#3A3A52' }}>{list.length}</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {list.map(c => <CardTile key={c.player.id} card={c} />)}
                </div>
              </section>
            ))}
        </>
      )}
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>{label}</p>
      <p className="text-2xl font-black" style={{ color: accent, fontFamily: 'var(--font-display)' }}>{value}</p>
    </div>
  )
}

function CardTile({ card }: { card: Card }) {
  const { player, entry } = card
  return (
    <div
      className="rounded-xl p-3 flex flex-col items-center text-center gap-1.5 transition-transform hover:scale-[1.02]"
      style={{ background: `linear-gradient(135deg, ${ACCENT_DIM}18, rgba(255,255,255,0.02))`, border: `1px solid ${ACCENT_DIM}30` }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black"
        style={{ background: `linear-gradient(135deg, ${ACCENT_DIM}, #92400e)`, color: '#fff', fontFamily: 'var(--font-display)', boxShadow: `0 4px 16px ${ACCENT_DIM}55` }}
      >
        {player.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
      </div>
      <p className="text-[11px] font-black truncate w-full inline-flex items-center justify-center gap-1" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
        <CountryFlag country={player.country} width={11} />
        <span className="truncate">{player.name}</span>
      </p>
      <p className="text-[9px] truncate w-full" style={{ color: 'var(--text-muted)' }}>{player.club}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded" style={{
          background: player.era === 'current' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
          color: player.era === 'current' ? '#4ade80' : '#5A5A7A',
          fontFamily: 'var(--font-sport)',
        }}>
          {player.era === 'current' ? 'Activo' : 'Leyenda'}
        </span>
        {entry.count > 1 && (
          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded" style={{
            background: `${ACCENT}18`,
            color: ACCENT,
            fontFamily: 'var(--font-sport)',
          }}>
            ×{entry.count}
          </span>
        )}
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
      <div className="text-4xl mb-3">📒</div>
      <p className="text-base font-black mb-2" style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}>
        Tu álbum está vacío
      </p>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)', maxWidth: 360, marginInline: 'auto' }}>
        Cada acierto en TakaGrid o Mi Once añade un cromo a tu colección. Empieza por uno:
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Link
          href="/takagrid"
          className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest"
          style={{ background: `${ACCENT_DIM}28`, color: ACCENT, border: `1px solid ${ACCENT_DIM}40`, fontFamily: 'var(--font-sport)' }}
        >
          Ir a TakaGrid
        </Link>
        <Link
          href="/mionce"
          className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest"
          style={{ background: 'rgba(147,197,253,0.16)', color: '#93C5FD', border: '1px solid rgba(147,197,253,0.32)', fontFamily: 'var(--font-sport)' }}
        >
          Ir a Mi Once
        </Link>
      </div>
    </div>
  )
}
