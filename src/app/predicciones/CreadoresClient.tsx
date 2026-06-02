'use client'

// ── CreadoresClient ───────────────────────────────────────────────────────
// UI de Ligas de Creadores Ranked.
//
// Diferencias con Ligas Privadas:
//   · Acceso libre — sin código de invitación
//   · Branding del creador (logo, nombre, slug)
//   · Galería pública con todas las ligas disponibles
//   · Capacidad mayor (definida por el creador, no cap de 15)
//
// Flujo:
//   1. Ver galería de ligas de creadores
//   2. Click "Unirse" → POST /api/ranked/leagues/[id]/join (sin código)
//   3. Click "Ver ranking" → leaderboard interno desplegable

import { useCallback, useEffect, useState } from 'react'
import TakaPoint from '@/components/TakaPoint'

// ── Types ─────────────────────────────────────────────────────────────────

interface CreatorLeague {
  id:           string
  name:         string
  sport:        string
  creator_slug: string | null
  sponsor_name: string | null
  sponsor_logo: string | null
  max_members:  number
  member_count: number
  is_member:    boolean
}

interface LeaderboardEntry {
  user_id:      string
  display_name: string | null
  avatar_url:   string | null
  total:        number
  rank:         number
}

// ── Helpers ───────────────────────────────────────────────────────────────

const SPORT_META: Record<string, { label: string; emoji: string; accent: string }> = {
  mundial: { label: 'Mundial 2026', emoji: '🏆', accent: '#FBBF24' },
  ufc:     { label: 'Ranked UFC',   emoji: '🥊', accent: '#F87171' },
  futbol:  { label: 'Ranked Fútbol',emoji: '⚽', accent: '#4ADE80' },
  global:  { label: 'Global',       emoji: '⚡', accent: '#A78BFA' },
}
function sportMeta(sport: string) {
  return SPORT_META[sport] ?? { label: sport, emoji: '🏟️', accent: '#A78BFA' }
}

// ── Animations ────────────────────────────────────────────────────────────

const ANIMATIONS = `
  @keyframes cFadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
  .c-card { animation: cFadeInUp 0.38s ease-out both }
`

// ── LeagueLeaderboard (inline) ────────────────────────────────────────────

function LeagueLeaderboard({
  leagueId, myUserId,
}: {
  leagueId:  string
  myUserId:  string | null
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/ranked/leagues/${leagueId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((d: { leaderboard?: LeaderboardEntry[] } | null) => {
        if (d?.leaderboard) setEntries(d.leaderboard)
      })
      .finally(() => setLoading(false))
  }, [leagueId])

  const MEDAL = ['🥇', '🥈', '🥉']

  if (loading) return (
    <div style={{ padding: '16px', textAlign: 'center' }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sport)' }}>Cargando ranking…</span>
    </div>
  )

  if (!entries.length) return (
    <div style={{ padding: '20px 16px', textAlign: 'center' }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)' }}>
        Aún sin predicciones resueltas · Sé el primero en puntuar
      </span>
    </div>
  )

  return (
    <div style={{ padding: '6px 0' }}>
      {entries.slice(0, 20).map((entry, i) => {
        const isMe = entry.user_id === myUserId
        return (
          <div key={entry.user_id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 16px',
            background: isMe ? 'rgba(167,139,250,0.06)' : 'transparent',
            borderLeft: isMe ? '2px solid rgba(167,139,250,0.5)' : '2px solid transparent',
          }}>
            <span style={{
              fontSize: i < 3 ? 14 : 9, fontWeight: 900, minWidth: 20, textAlign: 'center',
              color: i < 3 ? undefined : 'rgba(255,255,255,0.3)',
              fontFamily: 'var(--font-display)',
            }}>
              {i < 3 ? MEDAL[i] : entry.rank}
            </span>

            {/* Avatar */}
            {entry.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={entry.avatar_url} alt="" width={24} height={24}
                  style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(167,139,250,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: '#A78BFA' }}>
                    {(entry.display_name ?? '?').slice(0, 2).toUpperCase()}
                  </span>
                </div>
            }

            <span style={{
              flex: 1, fontSize: 12, fontWeight: isMe ? 900 : 600,
              color: isMe ? '#F0F0F8' : 'rgba(255,255,255,0.6)',
              fontFamily: 'var(--font-display)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {entry.display_name ?? 'Anónimo'}{isMe ? ' (tú)' : ''}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <TakaPoint size={10} />
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 900,
                color: isMe ? '#C4B5FD' : 'rgba(255,255,255,0.55)',
              }}>
                {entry.total}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── CreatorCard ───────────────────────────────────────────────────────────

function CreatorCard({
  league,
  myUserId,
  onJoin,
}: {
  league:   CreatorLeague
  myUserId: string | null
  onJoin:   (id: string) => void
}) {
  const [expanded,  setExpanded]  = useState(false)
  const [joining,   setJoining]   = useState(false)
  const [isMember,  setIsMember]  = useState(league.is_member)
  const [memberCount, setMemberCount] = useState(league.member_count)

  const meta = sportMeta(league.sport)

  async function handleJoin() {
    if (!myUserId) { window.location.href = '/auth'; return }
    setJoining(true)
    try {
      const res = await fetch(`/api/ranked/leagues/${league.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        setIsMember(true)
        setMemberCount(c => c + 1)
        setExpanded(true)
        onJoin(league.id)
      }
    } finally {
      setJoining(false)
    }
  }

  const isFull = memberCount >= league.max_members

  return (
    <div
      className="c-card"
      style={{
        borderRadius: 20,
        background: expanded
          ? `linear-gradient(145deg, ${meta.accent}10 0%, rgba(10,6,20,0.8) 100%)`
          : 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(10,6,20,0.5) 100%)',
        border: `1.5px solid ${expanded ? `${meta.accent}30` : 'rgba(255,255,255,0.07)'}`,
        overflow: 'hidden',
        transition: 'border-color 0.2s ease, background 0.2s ease',
      }}
    >
      {/* Card header */}
      <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>

        {/* Creator logo / avatar */}
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0, overflow: 'hidden',
          background: `${meta.accent}14`,
          border: `1.5px solid ${meta.accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {league.sponsor_logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={league.sponsor_logo} alt={league.sponsor_name ?? ''} width={48} height={48}
                style={{ width: 48, height: 48, objectFit: 'cover' }} />
            : <span style={{ fontSize: 22 }}>{meta.emoji}</span>
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 900,
            color: '#F0F0F8', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {league.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {league.sponsor_name && (
              <span style={{
                fontSize: 10, color: meta.accent, fontFamily: 'var(--font-sport)',
                fontWeight: 700, letterSpacing: '0.05em',
              }}>
                🎙️ {league.sponsor_name}
              </span>
            )}
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9 }}>·</span>
            <span style={{
              fontSize: 9, color: 'rgba(255,255,255,0.35)',
              fontFamily: 'var(--font-sport)', letterSpacing: '0.04em',
            }}>
              {meta.emoji} {meta.label}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9 }}>·</span>
            <span style={{
              fontSize: 9, color: isFull ? '#EF4444' : 'rgba(255,255,255,0.3)',
              fontFamily: 'var(--font-sport)',
            }}>
              👥 {memberCount.toLocaleString('es-ES')}{league.max_members < 9999 ? `/${league.max_members}` : ''}
            </span>
          </div>
        </div>

        {/* Action */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {!isMember ? (
            <button
              onClick={handleJoin}
              disabled={joining || isFull}
              style={{
                padding: '8px 16px', borderRadius: 20, cursor: isFull ? 'default' : 'pointer',
                background: isFull ? 'rgba(255,255,255,0.04)' : `${meta.accent}18`,
                border: `1px solid ${isFull ? 'rgba(255,255,255,0.08)' : `${meta.accent}45`}`,
                color: isFull ? 'rgba(255,255,255,0.25)' : meta.accent,
                fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                opacity: joining ? 0.6 : 1, transition: 'all 0.15s ease',
              }}
            >
              {joining ? '…' : isFull ? 'Llena' : '+ Unirse'}
            </button>
          ) : (
            <span style={{
              fontSize: 9, color: '#4ADE80', fontFamily: 'var(--font-sport)',
              fontWeight: 700, letterSpacing: '0.08em',
            }}>
              ✓ MIEMBRO
            </span>
          )}
          {(isMember || expanded) && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                fontSize: 9, color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                background: 'none', border: 'none', fontFamily: 'var(--font-sport)',
                letterSpacing: '0.06em', padding: 0,
              }}
            >
              {expanded ? '▲ ocultar' : '▼ ranking'}
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard desplegable */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${meta.accent}15` }}>
          <LeagueLeaderboard leagueId={league.id} myUserId={myUserId} />
        </div>
      )}
    </div>
  )
}

// ── CreadoresClient (main) ────────────────────────────────────────────────

export default function CreadoresClient() {
  const [leagues,    setLeagues]    = useState<CreatorLeague[]>([])
  const [loading,    setLoading]    = useState(true)
  const [myUserId,   setMyUserId]   = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [ligasRes, meRes] = await Promise.all([
        fetch('/api/ranked/leagues/creators', { cache: 'no-store' }),
        fetch('/api/ranked/me', { cache: 'no-store' }),
      ])
      if (ligasRes.ok) {
        const { leagues: arr } = await ligasRes.json() as { leagues: CreatorLeague[] }
        setLeagues(arr ?? [])
      }
      if (meRes.ok) {
        const me = await meRes.json() as { user_id?: string }
        if (me.user_id) setMyUserId(me.user_id)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <>
      <style>{ANIMATIONS}</style>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(167,139,250,0.06) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(167,139,250,0.08)',
        padding: '28px 0 20px',
      }}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 text-center">
          <div style={{ fontSize: 44, marginBottom: 8 }}>🎙️</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)',
            fontWeight: 900, letterSpacing: '-0.03em',
            color: '#F0F0F8', lineHeight: 1,
          }}>
            Ligas de Creadores
          </h1>
          <p style={{
            marginTop: 8, color: 'rgba(255,255,255,0.4)', fontSize: 13,
            maxWidth: 400, margin: '8px auto 0',
          }}>
            Únete a la liga de tu creador favorito y compite con su comunidad.
            Ranking propio, branding exclusivo.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-6">

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse" style={{ height: 90, borderRadius: 20, background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        )}

        {!loading && leagues.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 16px' }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🎙️</span>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900,
              color: 'rgba(255,255,255,0.4)',
            }}>
              Próximamente
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, marginTop: 8, maxWidth: 320, margin: '8px auto 0' }}>
              Los primeros creadores se incorporarán en breve.
              Síguenos en redes para enterarte antes que nadie.
            </p>
          </div>
        )}

        {!loading && leagues.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}>
            {leagues.map((league, i) => (
              <div key={league.id} style={{ animationDelay: `${i * 0.07}s` }}>
                <CreatorCard
                  league={league}
                  myUserId={myUserId}
                  onJoin={() => { /* optimistic ya hecho en el card */ }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
