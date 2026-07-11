'use client'

// Página propia de la Liga Taka (ranking general de usuarios) — F4·T5 paso 5.
// Reúne TODOS los puntos (juegos + predicciones + misiones + racha + insignias)
// en una sola clasificación. Consume /api/ranked/leaderboard?sport=global y
// /api/ranked/me-position (tu rank si tienes sesión).
//
// Reutiliza el lenguaje visual del RankedLeaderboard embebido: podio con
// PlacaRowV3, filas compactas, rayo TakaPoint, vidrio Taka.

import { useState, useEffect, useCallback, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import TakaPoint from '@/components/TakaPoint'
import { LeaderboardBadgesRow, LeaderboardTitleLine } from '@/components/badges/LeaderboardBadgeChip'
import type { LeaderboardBadge, LeaderboardEquipment } from '@/lib/leaderboard-badges'
import { PlacaRowV3 } from '@/components/placa/PlacaRowV3'
import { buildPlacaData, type ApiEquipment } from '@/components/placa/adapter'
import { RankedCategoryIcon } from '@/components/icons/GameIcons'

type RankedSport = 'global' | 'mundial' | 'ufc'

interface RankedEntry {
  pid:          string
  display_name: string | null
  avatar_url:   string | null
  total:        number
  rank:         number
  level?:       number
  levelName?:   string
  badges?:      LeaderboardBadge[]
  equipment?:   LeaderboardEquipment & ApiEquipment
}

interface MePosition {
  rank:      number | null
  total?:    number
  pid?:      string
  level?:    number
  levelName?: string
  of?:       number
}

const TABS: { id: RankedSport; label: string }[] = [
  { id: 'global',  label: 'Global' },
  { id: 'mundial', label: 'Mundial' },
  { id: 'ufc',     label: 'UFC' },
]

const ACCENT = '#A78BFA'

const LEVEL_COLORS: Record<number, string> = {
  1: '#94a3b8', 2: '#60a5fa', 3: '#22d3ee', 4: '#34d399', 5: '#a78bfa',
  6: '#f97316', 7: '#ef4444', 8: '#fbbf24', 9: '#fb7185',
}

function initials(name: string | null): string {
  return (name ?? '?').slice(0, 2).toUpperCase()
}

function Avatar({ url, name, size = 28 }: { url: string | null; name: string | null; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name ?? ''}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.32, fontWeight: 900, color: ACCENT, fontFamily: 'var(--font-display)' }}>{initials(name)}</span>
    </div>
  )
}

const EARN_WAYS: { emoji: string; label: string; hint: string; href: string }[] = [
  { emoji: '🎮', label: 'Juegos',       hint: '1–12', href: '/juegos' },
  { emoji: '🔮', label: 'Predicciones', hint: '3–6',  href: '/predicciones' },
  { emoji: '🎯', label: 'Misiones',     hint: '2–10', href: '/juegos' },
  { emoji: '🔥', label: 'Racha',        hint: 'hitos', href: '/juegos' },
  { emoji: '🏅', label: 'Insignias',    hint: '+50',  href: '/perfil' },
]

export default function LigaTakaBoard() {
  const [sport, setSport]     = useState<RankedSport>('global')
  const [entries, setEntries] = useState<RankedEntry[]>([])
  const [me, setMe]           = useState<MePosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasLive, setHasLive] = useState(false)

  const load = useCallback(async (s: RankedSport) => {
    setLoading(true)
    try {
      const [lbRes, meRes] = await Promise.all([
        fetch(`/api/ranked/leaderboard?sport=${s}&limit=100`, { cache: 'no-store' }),
        fetch(`/api/ranked/me-position?sport=${s}`, { cache: 'no-store' }),
      ])
      const lb = lbRes.ok ? await lbRes.json() as { entries: RankedEntry[]; has_live?: boolean } : { entries: [] }
      setEntries(lb.entries ?? [])
      setHasLive(lb.has_live ?? false)
      setMe(meRes.ok ? await meRes.json() as MePosition : null)
    } catch {
      setEntries([])
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(sport) }, [sport, load])

  // Auto-refresh cada 60s cuando hay eventos en curso.
  useEffect(() => {
    if (!hasLive) return
    const id = setInterval(() => { void load(sport) }, 60_000)
    return () => clearInterval(id)
  }, [hasLive, sport, load])

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    let next = -1
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    setSport(TABS[next].id)
    if (typeof document !== 'undefined') document.getElementById(`ltab-${TABS[next].id}`)?.focus()
  }

  const podium = entries.slice(0, 3)
  const rest   = entries.slice(3)
  const seasonCount = me?.of ?? entries.length

  return (
    <div className="max-w-[720px] mx-auto px-4 sm:px-6 pt-4 pb-16">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: ACCENT, fontFamily: 'var(--font-sport)' }}>
        TakaSports · Ranking general
      </p>
      <div className="flex items-center gap-3">
        <TakaPoint size={34} />
        <h2 className="text-[40px] leading-none font-black uppercase tracking-tight" style={{ fontFamily: 'var(--font-sport)', color: '#F0F0F8' }}>
          Liga Taka
        </h2>
      </div>
      <p className="text-[13.5px] leading-relaxed mt-3" style={{ color: 'var(--text-secondary, #9797A8)' }}>
        Todos tus puntos en una sola clasificación: <span style={{ color: '#ECECF5', fontWeight: 600 }}>juegos, predicciones, misiones, racha e insignias</span>. Sube de nivel y compite con toda la comunidad.
      </p>
      {seasonCount > 0 && (
        <span className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest"
          style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.28)', color: '#6EE7B7', fontFamily: 'var(--font-sport)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 8px #34D399' }} />
          {seasonCount} {seasonCount === 1 ? 'takero' : 'takeros'} compitiendo
        </span>
      )}

      {/* ── Filtro de deporte ────────────────────────────────── */}
      <div className="flex gap-1.5 mt-6" role="tablist" aria-label="Ámbito del ranking">
        {TABS.map((t, idx) => (
          <button
            key={t.id}
            id={`ltab-${t.id}`}
            role="tab"
            aria-selected={sport === t.id}
            tabIndex={sport === t.id ? 0 : -1}
            onClick={() => setSport(t.id)}
            onKeyDown={e => onTabKeyDown(e, idx)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            style={{
              background: sport === t.id ? `${ACCENT}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${sport === t.id ? `${ACCENT}50` : 'rgba(255,255,255,0.06)'}`,
              color: sport === t.id ? ACCENT : 'var(--text-muted, #5C5C70)',
              fontFamily: 'var(--font-sport)',
            }}
          >
            <span className="inline-flex"><RankedCategoryIcon sport={t.id} size={13} /></span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tu posición ──────────────────────────────────────── */}
      {me && me.rank != null && (
        <div className="mt-6">
          <SectionLabel>Tu posición</SectionLabel>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mt-3"
            style={{
              background: `linear-gradient(120deg, ${ACCENT}22, ${ACCENT}08)`,
              border: `1px solid ${ACCENT}66`,
              boxShadow: `0 10px 30px ${ACCENT}22`,
            }}>
            <span className="font-black tabular-nums text-center" style={{ fontFamily: 'var(--font-sport)', fontSize: 22, color: '#C4B5FD', width: 44 }}>
              #{me.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-black flex items-center gap-2" style={{ color: '#ECECF5', fontFamily: 'var(--font-display)' }}>
                Tú
                <span className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded" style={{ background: ACCENT, color: '#16061f', fontFamily: 'var(--font-sport)' }}>TÚ</span>
              </p>
              <p className="text-[11px] font-black uppercase tracking-wide mt-0.5" style={{ color: LEVEL_COLORS[me.level ?? 1], fontFamily: 'var(--font-sport)' }}>
                Nivel {me.level ?? 1} · {me.levelName ?? 'Novato'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <TakaPoint size={15} />
              <span className="font-black tabular-nums" style={{ fontSize: 18, color: '#C4B5FD', fontFamily: 'var(--font-display)' }}>
                {(me.total ?? 0).toLocaleString('es-ES')}
              </span>
            </div>
          </div>
        </div>
      )}
      {me && me.rank == null && me.pid && (
        <div className="mt-6 px-4 py-3 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[12.5px]" style={{ color: 'var(--text-secondary, #9797A8)' }}>
            Aún no tienes puntos. <Link href="/juegos" style={{ color: '#C4B5FD', fontWeight: 700 }}>Empieza a jugar →</Link>
          </p>
        </div>
      )}

      {/* ── Podio ────────────────────────────────────────────── */}
      {!loading && podium.length > 0 && (
        <div className="mt-7">
          <SectionLabel>Podio</SectionLabel>
          <div className="flex flex-col gap-2 mt-3">
            {podium.map((e, i) => {
              const placa = buildPlacaData({
                displayName: e.display_name ?? 'Anónimo',
                handle:      (e.display_name ?? 'takero').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'takero',
                avatarUrl:   e.avatar_url,
                level:       e.level ?? 1,
                levelName:   e.levelName ?? 'Novato',
                equipment:   e.equipment as ApiEquipment | undefined,
                badges:      e.badges,
              })
              return (
                <PlacaRowV3
                  key={e.pid || i}
                  placa={placa}
                  rank={e.rank}
                  score={e.total}
                  scoreLabel="pts"
                  sportAccent={ACCENT}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Clasificación ────────────────────────────────────── */}
      {loading && (
        <div className="mt-7 flex flex-col gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-11 rounded-xl animate-pulse" style={{ background: `${ACCENT}08` }} />
          ))}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="mt-8 px-5 py-12 text-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[13px]" style={{ color: 'var(--text-muted, #5C5C70)', fontFamily: 'var(--font-sport)' }}>
            Nadie en el ranking todavía · Sé el primero
          </p>
        </div>
      )}

      {!loading && rest.length > 0 && (
        <div className="mt-6">
          <SectionLabel>Clasificación</SectionLabel>
          <div className="flex flex-col gap-1.5 mt-3">
            {rest.map((e) => {
              const isMe = !!me?.pid && e.pid === me.pid
              const eq         = e.equipment
              const equipBadge = eq?.badge
              const title      = eq?.title
              return (
                <div
                  key={e.pid || e.rank}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                  style={{
                    background: isMe ? `${ACCENT}1A` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isMe ? `${ACCENT}55` : 'rgba(255,255,255,0.04)'}`,
                  }}
                >
                  <span className="font-black tabular-nums text-center" style={{ width: 24, fontSize: 14, color: isMe ? '#C4B5FD' : '#5C5C70', fontFamily: 'var(--font-sport)' }}>
                    {e.rank}
                  </span>
                  <Avatar url={e.avatar_url} name={e.display_name} size={26} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-black" style={{ color: isMe ? '#ECECF5' : '#B8B8CC', fontFamily: 'var(--font-display)' }}>
                        {isMe ? `${e.display_name ?? 'Tú'} · tú` : (e.display_name ?? 'Anónimo')}
                      </span>
                      <LeaderboardBadgesRow badges={e.badges} equippedBadge={equipBadge} />
                    </div>
                    <LeaderboardTitleLine title={title} />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <TakaPoint size={12} />
                    <span className="text-[13px] font-black tabular-nums" style={{ color: isMe ? '#C4B5FD' : '#8A8AA6', fontFamily: 'var(--font-display)' }}>
                      {e.total.toLocaleString('es-ES')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Cómo sumar puntos ────────────────────────────────── */}
      <div className="mt-9 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-[13px] font-black uppercase tracking-widest" style={{ fontFamily: 'var(--font-sport)', color: '#ECECF5' }}>
          Cómo sumar puntos
        </h3>
        <p className="text-[12px] leading-relaxed mt-1 mb-3.5" style={{ color: 'var(--text-secondary, #9797A8)' }}>
          Una sola moneda. Cada acción suma a tu Liga Taka y te sube de nivel.
        </p>
        <div className="flex flex-wrap gap-2">
          {EARN_WAYS.map(w => (
            <Link
              key={w.label}
              href={w.href}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#ECECF5' }}
            >
              <span className="text-[14px]">{w.emoji}</span>
              {w.label}
              <span style={{ color: 'var(--text-muted, #5C5C70)', fontWeight: 600 }}>{w.hint}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ width: 3, height: 13, borderRadius: 3, background: ACCENT }} />
      <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted, #5C5C70)', fontFamily: 'var(--font-sport)' }}>
        {children}
      </span>
      <span className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}
