'use client'

// ── PrivadasClient ────────────────────────────────────────────────────────
// UI de Ligas Privadas Ranked.
//
// Estados:
//   · Sin sesión   → CTA login
//   · Con sesión   → lista de mis ligas + botones crear / unirse con código
//   · Liga abierta → leaderboard interno + share link + salir/eliminar

import { useCallback, useEffect, useState } from 'react'
import { PodiumMedal } from '@/components/icons/GameIcons'
import TakaPoint from '@/components/TakaPoint'

// ── Types ─────────────────────────────────────────────────────────────────

interface RankedLeague {
  id:           string
  name:         string
  sport:        string
  owner_id:     string
  max_members:  number
  invite_code:  string
  created_at:   string
  member_count: number
  is_owner:     boolean
}

interface LeaderboardEntry {
  pid:      string
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

function Avatar({ url, name, size = 28 }: { url: string | null; name: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name ?? ''} width={size} height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  const initials = (name ?? '?').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(167,139,250,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ fontSize: size * 0.32, fontWeight: 900, color: '#A78BFA', fontFamily: 'var(--font-display)' }}>
        {initials}
      </span>
    </div>
  )
}

// ── Animations ────────────────────────────────────────────────────────────

const ANIMATIONS = `
  @keyframes pFadeInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
  .p-card { animation: pFadeInUp 0.35s ease-out both }
`

// ── LeagueCard ────────────────────────────────────────────────────────────

function LeagueCard({
  league, isOpen, onClick,
}: {
  league: RankedLeague
  isOpen: boolean
  onClick: () => void
}) {
  const meta = sportMeta(league.sport)

  return (
    <button
      onClick={onClick}
      className="p-card text-left"
      style={{
        width: '100%',
        padding: '14px 16px',
        borderRadius: 16,
        background: isOpen
          ? `linear-gradient(135deg, ${meta.accent}14 0%, rgba(255,255,255,0.02) 100%)`
          : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${isOpen ? `${meta.accent}40` : 'rgba(255,255,255,0.07)'}`,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      {/* Sport emoji */}
      <span style={{ fontSize: 22, flexShrink: 0 }}>{meta.emoji}</span>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 900,
          color: isOpen ? '#F0F0F8' : 'rgba(255,255,255,0.7)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {league.name}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 2,
        }}>
          <span style={{
            fontSize: 9, color: meta.accent, fontFamily: 'var(--font-sport)',
            fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            {meta.label}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9 }}>·</span>
          <span style={{
            fontSize: 9, color: 'rgba(255,255,255,0.35)',
            fontFamily: 'var(--font-sport)', letterSpacing: '0.05em',
          }}>
            👥 {league.member_count}/{league.max_members}
          </span>
          {league.is_owner && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9 }}>·</span>
              <span style={{ fontSize: 8, color: '#A78BFA', fontFamily: 'var(--font-sport)', letterSpacing: '0.06em' }}>
                CREADOR
              </span>
            </>
          )}
        </div>
      </div>

      {/* Arrow */}
      <span style={{
        fontSize: 12, color: isOpen ? meta.accent : 'rgba(255,255,255,0.2)',
        transition: 'transform 0.15s ease',
        transform: isOpen ? 'rotate(90deg)' : 'none',
      }}>
        ›
      </span>
    </button>
  )
}

// ── LeagueDetail ──────────────────────────────────────────────────────────

function LeagueDetail({
  leagueId,
  onLeave,
  onDelete,
}: {
  leagueId:  string
  onLeave:   () => void
  onDelete:  () => void
}) {
  const [data, setData]   = useState<{ league: RankedLeague & { my_pid: string }; leaderboard: LeaderboardEntry[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ranked/leagues/${leagueId}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as typeof data
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => { void load() }, [load])

  if (loading) return (
    <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'var(--font-sport)' }}>Cargando…</span>
    </div>
  )
  if (!data) return null

  const { league, leaderboard } = data
  const meta    = sportMeta(league.sport)
  const isOwner = league.is_owner
  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/predicciones?liga=${leagueId}&code=${league.invite_code}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }

  async function handleLeave() {
    setLeaving(true)
    try {
      await fetch(`/api/ranked/leagues/${leagueId}/leave`, { method: 'POST' })
      onLeave()
    } finally { setLeaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/ranked/leagues/${leagueId}`, { method: 'DELETE' })
      onDelete()
    } finally { setDeleting(false) }
  }

  return (
    <div style={{
      marginTop: 8, borderRadius: 16,
      background: `linear-gradient(160deg, ${meta.accent}08 0%, rgba(8,0,15,0.4) 100%)`,
      border: `1px solid ${meta.accent}20`,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${meta.accent}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 900, color: '#F0F0F8',
          }}>
            {league.name}
          </div>
          <div style={{
            fontSize: 9, color: meta.accent, fontFamily: 'var(--font-sport)',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2,
          }}>
            {meta.emoji} {meta.label} · 👥 {league.member_count}/{league.max_members}
          </div>
        </div>

        {/* Share button */}
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
            background: copied ? 'rgba(74,222,128,0.12)' : `${meta.accent}12`,
            border: `1px solid ${copied ? 'rgba(74,222,128,0.35)' : `${meta.accent}30`}`,
            color: copied ? '#4ADE80' : meta.accent,
            fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            transition: 'all 0.15s ease', flexShrink: 0,
          }}
        >
          {copied ? '✓ COPIADO' : '🔗 INVITAR'}
        </button>
      </div>

      {/* Invite code */}
      <div style={{
        padding: '10px 16px',
        borderBottom: `1px solid rgba(255,255,255,0.04)`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)', letterSpacing: '0.06em' }}>
          CÓDIGO:
        </span>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 900,
          color: meta.accent, letterSpacing: '0.12em',
        }}>
          {league.invite_code}
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)' }}>
          · Comparte para invitar a amigos
        </span>
      </div>

      {/* Leaderboard */}
      <div style={{ padding: '8px 0' }}>
        {leaderboard.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sport)' }}>
              Sin predicciones resueltas todavía
            </span>
          </div>
        )}
        {leaderboard.map((entry, i) => {
          const isMe = entry.pid === league.my_pid
          return (
            <div
              key={entry.pid}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 16px',
                background: isMe ? `${meta.accent}08` : 'transparent',
                borderLeft: isMe ? `2px solid ${meta.accent}` : '2px solid transparent',
              }}
            >
              {/* Rank */}
              <span style={{
                fontSize: i < 3 ? 14 : 10, fontWeight: 900, minWidth: 20, textAlign: 'center',
                color: i < 3 ? undefined : 'rgba(255,255,255,0.3)',
                fontFamily: 'var(--font-display)',
              }}>
                {i < 3 ? <PodiumMedal position={i + 1} size={15} className="inline-block align-middle" /> : entry.rank}
              </span>

              <Avatar url={entry.avatar_url} name={entry.display_name} size={28} />

              <span style={{
                flex: 1, fontSize: 12, fontWeight: isMe ? 900 : 600,
                color: isMe ? '#F0F0F8' : 'rgba(255,255,255,0.65)',
                fontFamily: 'var(--font-display)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {entry.display_name ?? 'Anónimo'}{isMe ? ' (tú)' : ''}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <TakaPoint size={11} />
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 900,
                  color: isMe ? meta.accent : 'rgba(255,255,255,0.6)',
                }}>
                  {entry.total}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid rgba(255,255,255,0.04)`,
        display: 'flex', justifyContent: 'flex-end', gap: 8,
      }}>
        {!isOwner && (
          <button
            onClick={handleLeave}
            disabled={leaving}
            style={{
              padding: '6px 14px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'rgba(239,68,68,0.6)', fontFamily: 'var(--font-sport)',
              fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
              opacity: leaving ? 0.5 : 1,
            }}
          >
            {leaving ? '…' : 'Salir de la liga'}
          </button>
        )}
        {isOwner && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              padding: '6px 14px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'rgba(239,68,68,0.6)', fontFamily: 'var(--font-sport)',
              fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
            }}
          >
            Eliminar liga
          </button>
        )}
        {isOwner && confirmDelete && (
          <>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', alignSelf: 'center', fontFamily: 'var(--font-sport)' }}>
              ¿Seguro?
            </span>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)',
                fontSize: 9, fontWeight: 900,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '6px 14px', borderRadius: 10, cursor: 'pointer',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                color: '#FCA5A5', fontFamily: 'var(--font-sport)',
                fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
                opacity: deleting ? 0.5 : 1,
              }}
            >
              {deleting ? '…' : 'Sí, eliminar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── CreateModal ───────────────────────────────────────────────────────────

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose:  () => void
  onCreate: (league: RankedLeague) => void
}) {
  const [name,       setName]       = useState('')
  const [sport,      setSport]      = useState('mundial')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const SPORTS = Object.entries(SPORT_META).filter(([k]) => k !== 'global')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/ranked/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sport }),
      })
      const json = await res.json() as { league?: RankedLeague; error?: string; message?: string }
      if (!res.ok) {
        setError(json.message ?? json.error ?? 'Error al crear la liga')
        return
      }
      if (json.league) onCreate(json.league)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      padding: 16,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400, borderRadius: 20,
          background: 'linear-gradient(145deg, #18122B 0%, #100C1E 100%)',
          border: '1.5px solid rgba(167,139,250,0.25)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          padding: 24,
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900,
          color: '#F0F0F8', marginBottom: 20,
        }}>
          🔒 Nueva liga privada
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nombre */}
          <div>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
              NOMBRE DE LA LIGA
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Los Crack de Siempre"
              maxLength={40}
              required
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#F0F0F8', fontFamily: 'var(--font-display)', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Deporte */}
          <div>
            <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              DEPORTE
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SPORTS.map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSport(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px', borderRadius: 20,
                    background: sport === key ? `${meta.accent}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${sport === key ? `${meta.accent}50` : 'rgba(255,255,255,0.08)'}`,
                    color: sport === key ? meta.accent : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', fontFamily: 'var(--font-sport)',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 11, color: '#FCA5A5', fontFamily: 'var(--font-sport)' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button" onClick={onClose}
              style={{
                padding: '9px 18px', borderRadius: 12, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)',
                fontSize: 10, fontWeight: 900,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || name.trim().length < 3}
              style={{
                padding: '9px 20px', borderRadius: 12, cursor: 'pointer',
                background: 'rgba(167,139,250,0.18)', border: '1px solid rgba(167,139,250,0.4)',
                color: '#C4B5FD', fontFamily: 'var(--font-sport)',
                fontSize: 10, fontWeight: 900, letterSpacing: '0.08em',
                opacity: submitting || name.trim().length < 3 ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {submitting ? 'Creando…' : 'Crear liga'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── JoinPanel ─────────────────────────────────────────────────────────────

function JoinPanel({ onJoined }: { onJoined: (id: string) => void }) {
  const [code,       setCode]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed || submitting) return

    // Buscar la liga por código — el API de join necesita el ID
    // Usamos el endpoint de búsqueda por código
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/ranked/leagues/by-code?code=${encodeURIComponent(trimmed)}`)
      const json = await res.json() as { league_id?: string; error?: string; message?: string }
      if (!res.ok || !json.league_id) {
        setError(json.message ?? 'Código no encontrado')
        return
      }
      const joinRes = await fetch(`/api/ranked/leagues/${json.league_id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: trimmed }),
      })
      const joinJson = await joinRes.json() as { ok?: boolean; error?: string; message?: string }
      if (!joinRes.ok) {
        setError(joinJson.message ?? joinJson.error ?? 'Error al unirse')
        return
      }
      setCode('')
      onJoined(json.league_id)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Ej: XKCD4F2A"
          maxLength={12}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
            color: '#F0F0F8', fontFamily: 'var(--font-display)', fontSize: 13,
            outline: 'none', letterSpacing: '0.08em', boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ fontSize: 10, color: '#FCA5A5', marginTop: 4, fontFamily: 'var(--font-sport)' }}>{error}</p>}
      </div>
      <button
        type="submit"
        disabled={submitting || code.trim().length < 6}
        style={{
          padding: '10px 16px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
          background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)',
          color: '#C4B5FD', fontFamily: 'var(--font-sport)',
          fontSize: 10, fontWeight: 900, letterSpacing: '0.06em',
          opacity: submitting || code.trim().length < 6 ? 0.5 : 1,
        }}
      >
        {submitting ? '…' : 'Unirse'}
      </button>
    </form>
  )
}

// ── PrivadasClient (main) ─────────────────────────────────────────────────

export default function PrivadasClient() {
  const [leagues,    setLeagues]    = useState<RankedLeague[]>([])
  const [loading,    setLoading]    = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [openId,     setOpenId]     = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  // Leer ?liga=&code= de la URL para auto-join
  const [autoJoin,   setAutoJoin]   = useState<{ id: string; code: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ranked/leagues', { cache: 'no-store' })
      if (res.status === 401) { setHasSession(false); return }
      setHasSession(true)
      if (res.ok) {
        const { leagues: arr } = await res.json() as { leagues: RankedLeague[] }
        setLeagues(arr ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Auto-join desde URL compartida
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const id = sp.get('liga')
    const code = sp.get('code')
    if (id && code) setAutoJoin({ id, code })
  }, [])

  // Auto-join: si hay params en la URL, hacer join automático al cargar
  useEffect(() => {
    if (!autoJoin || !hasSession) return
    const { id, code } = autoJoin
    setAutoJoin(null)
    fetch(`/api/ranked/leagues/${id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_code: code }),
    }).then(() => {
      void load()
      setOpenId(id)
    }).catch(() => { /* noop */ })
  }, [autoJoin, hasSession, load])

  function handleLeagueCreated(league: RankedLeague) {
    setLeagues(prev => [league, ...prev])
    setShowCreate(false)
    setOpenId(league.id)
  }

  function handleJoined(id: string) {
    void load()
    setOpenId(id)
  }

  function handleLeft(id: string) {
    setLeagues(prev => prev.filter(l => l.id !== id))
    setOpenId(null)
  }

  return (
    <>
      <style>{ANIMATIONS}</style>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleLeagueCreated}
        />
      )}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-6">

        {/* Sin sesión */}
        {!hasSession && !loading && (
          <div style={{
            textAlign: 'center', padding: '48px 16px',
            borderRadius: 20, background: 'rgba(167,139,250,0.04)',
            border: '1px solid rgba(167,139,250,0.12)',
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>🔒</span>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900,
              color: 'rgba(255,255,255,0.7)', marginBottom: 8,
            }}>
              Inicia sesión para ver tus ligas
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 20 }}>
              Crea una liga con hasta 15 amigos y compite por el ranking privado.
            </p>
            <a
              href="/auth"
              style={{
                display: 'inline-block', padding: '10px 28px', borderRadius: 14,
                background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)',
                color: '#C4B5FD', fontFamily: 'var(--font-sport)',
                fontSize: 11, fontWeight: 900, letterSpacing: '0.08em',
                textDecoration: 'none',
              }}
            >
              Entrar
            </a>
          </div>
        )}

        {hasSession && (
          <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Header + CTA */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900,
                  color: '#F0F0F8', letterSpacing: '-0.02em',
                }}>
                  🔒 Ligas Privadas
                </h2>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                  Hasta 15 amigos · ranking propio · cualquier deporte
                </p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                  background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)',
                  color: '#C4B5FD', fontFamily: 'var(--font-sport)',
                  fontSize: 10, fontWeight: 900, letterSpacing: '0.08em',
                }}
              >
                + Crear liga
              </button>
            </div>

            {/* Unirse con código */}
            <div style={{
              padding: '14px 16px', borderRadius: 16,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <p style={{
                fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-sport)',
                letterSpacing: '0.08em', marginBottom: 10,
              }}>
                UNIRSE CON CÓDIGO
              </p>
              <JoinPanel onJoined={handleJoined} />
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse" style={{ height: 60, borderRadius: 16, background: 'rgba(255,255,255,0.04)' }} />
                ))}
              </div>
            )}

            {/* Ligas */}
            {!loading && leagues.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <span style={{ fontSize: 36, display: 'block', marginBottom: 12 }}>🏟️</span>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  Aún no perteneces a ninguna liga. ¡Crea una o únete con un código!
                </p>
              </div>
            )}

            {!loading && leagues.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {leagues.map(league => (
                  <div key={league.id}>
                    <LeagueCard
                      league={league}
                      isOpen={openId === league.id}
                      onClick={() => setOpenId(openId === league.id ? null : league.id)}
                    />
                    {openId === league.id && (
                      <LeagueDetail
                        leagueId={league.id}
                        onLeave={() => handleLeft(league.id)}
                        onDelete={() => handleLeft(league.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
