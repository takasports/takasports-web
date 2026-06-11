'use client'

// /perfil/[userId] — Perfil público de predicciones Ranked.
// Accesible sin login. Muestra:
//   · Avatar + nombre + badges
//   · Stats del Mundial (picks/acertos/pts)
//   · Historial de picks resueltos (solo partidos ya jugados)
//   · Botón "Compartir" y CTA a /predicciones

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import ScrollToTop from '@/components/ScrollToTop'
import { BadgeIcon, hasBadgeIcon } from '@/components/icons/badges/BadgeIcon'
import { PublicPlacaCard } from '@/components/placa/PublicPlacaCard'

const GOLD   = '#FBBF24'
const GOLD2  = '#F59E0B'

// ── Flag emojis (subconjunto del Mundial) ──────────────────────────
const FLAGS: Record<string, string> = {
  'Argentina':'🇦🇷','Brazil':'🇧🇷','Mexico':'🇲🇽','México':'🇲🇽',
  'United States':'🇺🇸','USA':'🇺🇸','Canada':'🇨🇦','Colombia':'🇨🇴',
  'Spain':'🇪🇸','France':'🇫🇷','Germany':'🇩🇪','Portugal':'🇵🇹',
  'Netherlands':'🇳🇱','Italy':'🇮🇹','England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Croatia':'🇭🇷',
  'Morocco':'🇲🇦','Senegal':'🇸🇳','Japan':'🇯🇵','South Korea':'🇰🇷',
  'Australia':'🇦🇺','Saudi Arabia':'🇸🇦','Ecuador':'🇪🇨','Uruguay':'🇺🇾',
  'South Africa':'🇿🇦',
}
function flag(t: string | null) { return t ? (FLAGS[t] ?? '🏴') : '🏳️' }

// ── Tipos ────────────────────────────────────────────────────────────
interface PublicProfile {
  user_id:      string
  display_name: string | null
  avatar_url:   string | null
  badges: {
    id: string; name: string; emoji: string
    color: string; bg: string; rarity: string
  }[]
  stats: {
    mundial: { total: number; correct: number; accuracy: number; pts: number }
  }
  picks: {
    event_id: string; pick: '1'|'X'|'2'|null; is_correct: boolean|null
    pts: number; team_home: string|null; team_away: string|null
    event_date: string|null; result: { winner:'1'|'X'|'2'; home_score?:number; away_score?:number }|null
    featured: boolean
  }[]
}

const RARITY_LABEL: Record<string, string> = {
  legendary: 'Legendario', epic: 'Épico', rare: 'Raro', common: 'Común',
}

// ── Componente principal ─────────────────────────────────────────────
export default function PublicProfilePage() {
  const params = useParams<{ userId: string }>()
  const userId = params.userId

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading]  = useState(true)
  const [error,   setError]    = useState<string | null>(null)
  const [copied,  setCopied]   = useState(false)

  useEffect(() => {
    if (!userId) return
    fetch(`/api/ranked/profile/${userId}`)
      .then(r => r.ok ? r.json() as Promise<PublicProfile> : Promise.reject(r.status))
      .then(data => { setProfile(data); setLoading(false) })
      .catch(code => {
        setError(code === 404 ? 'Usuario no encontrado.' : 'Error cargando el perfil.')
        setLoading(false)
      })
  }, [userId])

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: `Perfil de ${profile?.display_name ?? 'Takero'} — TakaSports`, url }) }
      catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  // ── OG image URL para "Compartir imagen" ──
  const ogUrl = profile
    ? `/api/og/mundial-stats?name=${encodeURIComponent(profile.display_name ?? 'Takero')}&picks=${profile.stats.mundial.total}&correct=${profile.stats.mundial.correct}&pts=${profile.stats.mundial.pts}`
    : null

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-10">

        {/* ── Loading ──────────────────────────────────────────── */}
        {loading && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: `2px solid ${GOLD}20`, borderTopColor: GOLD }} />
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────── */}
        {error && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <span style={{ fontSize: 48 }}>🏴</span>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{error}</p>
            <Link href="/predicciones" style={{ color: GOLD, fontSize: 13, fontFamily: 'var(--font-sport)' }}>
              → Ver predicciones
            </Link>
          </div>
        )}

        {/* ── Perfil ───────────────────────────────────────────── */}
        {profile && !loading && (
          <div className="flex flex-col gap-8">

            {/* PLACA PERSONAL pública — render real desde /api/placa/[userId] */}
            <PublicPlacaCard userId={userId} />

            {/* Header del perfil */}
            <div
              className="rounded-2xl p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(0,0,0,0) 100%)',
                border: `1px solid ${GOLD}20`,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                  background: profile.avatar_url ? 'transparent' : `${GOLD}18`,
                  border: `2px solid ${GOLD}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {profile.avatar_url
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28 }}>👤</span>
                }
              </div>

              {/* Nombre + badges */}
              <div style={{ flex: 1 }}>
                <h1
                  style={{
                    fontSize: 26, fontWeight: 900, color: '#F0F0F8',
                    fontFamily: 'var(--font-display)', letterSpacing: '-0.02em',
                    marginBottom: 6,
                  }}
                >
                  {profile.display_name ?? 'Takero'}
                </h1>

                {/* Badges */}
                {profile.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.badges.map(b => (
                      <span
                        key={b.id}
                        title={`${b.name} · ${RARITY_LABEL[b.rarity] ?? b.rarity}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 8px', borderRadius: 'var(--radius-md)',
                          background: b.bg, border: `1px solid ${b.color}35`,
                          fontSize: 11, fontWeight: 700, color: b.color,
                          fontFamily: 'var(--font-sport)',
                        }}
                      >
                        {hasBadgeIcon(b.id)
                          ? <BadgeIcon id={b.id} size={12} strokeWidth={1.7} />
                          : b.emoji}
                        {b.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Botones de compartir */}
              <div className="flex gap-2 flex-shrink-0">
                {ogUrl && (
                  <a
                    href={ogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ver imagen de stats"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '8px 14px', borderRadius: 10,
                      background: `${GOLD}12`, border: `1px solid ${GOLD}30`,
                      color: GOLD2, fontSize: 11, fontWeight: 900,
                      fontFamily: 'var(--font-sport)', textDecoration: 'none',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}
                  >
                    🖼 Stats
                  </a>
                )}
                <button
                  onClick={handleShare}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '8px 14px', borderRadius: 10,
                    background: copied ? 'rgba(74,222,128,0.12)' : `${GOLD}12`,
                    border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : `${GOLD}30`}`,
                    color: copied ? '#4ADE80' : GOLD2,
                    fontSize: 11, fontWeight: 900, cursor: 'pointer',
                    fontFamily: 'var(--font-sport)',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}
                >
                  {copied ? '✓ Copiado' : '↗ Compartir'}
                </button>
              </div>
            </div>

            {/* Stats del Mundial */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="section-accent" />
                <h2 className="section-label" style={{ fontFamily: 'var(--font-sport)' }}>
                  MUNDIAL 2026
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Picks',     value: profile.stats.mundial.total,    color: GOLD,       suffix: '' },
                  { label: 'Acertos',   value: profile.stats.mundial.correct,  color: '#4ADE80',  suffix: '' },
                  { label: 'Precisión', value: profile.stats.mundial.accuracy, color: '#F0F0F8',  suffix: '%' },
                  { label: 'Puntos',    value: profile.stats.mundial.pts,      color: '#A78BFA',  suffix: '' },
                ].map(s => (
                  <div
                    key={s.label}
                    className="rounded-xl p-4 flex flex-col gap-1"
                    style={{
                      background: `${s.color}08`,
                      border: `1px solid ${s.color}20`,
                    }}
                  >
                    <span style={{ fontSize: 32, fontWeight: 900, color: s.color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                      {s.value.toLocaleString('es-ES')}{s.suffix}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial de picks */}
            {profile.picks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="section-accent" />
                  <h2 className="section-label" style={{ fontFamily: 'var(--font-sport)' }}>
                    HISTORIAL DE PICKS
                  </h2>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                    (solo partidos jugados)
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {profile.picks.map(pick => {
                    const pickLabel = pick.pick === '1' ? pick.team_home : pick.pick === '2' ? pick.team_away : 'Empate'
                    const scoreStr  = pick.result ? `${pick.result.home_score ?? '?'}–${pick.result.away_score ?? '?'}` : null

                    return (
                      <div
                        key={pick.event_id}
                        className="rounded-xl px-4 py-3 flex items-center gap-3"
                        style={{
                          background: pick.is_correct
                            ? 'rgba(74,222,128,0.04)'
                            : 'rgba(255,255,255,0.015)',
                          border: `1px solid ${pick.is_correct ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)'}`,
                        }}
                      >
                        {/* Equipos */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 18 }}>{flag(pick.team_home)}</span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)' }}>vs</span>
                          <span style={{ fontSize: 18 }}>{flag(pick.team_away)}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sport)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {pick.team_home} vs {pick.team_away}
                          </span>
                        </div>

                        {/* Score final */}
                        {scoreStr && (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-sport)', flexShrink: 0 }}>
                            {scoreStr}
                          </span>
                        )}

                        {/* Pick del usuario */}
                        <span
                          style={{
                            fontSize: 10, fontWeight: 900, flexShrink: 0,
                            padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                            fontFamily: 'var(--font-sport)',
                            background: pick.is_correct ? 'rgba(74,222,128,0.12)' : 'rgba(239,68,68,0.08)',
                            border: `1px solid ${pick.is_correct ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.2)'}`,
                            color: pick.is_correct ? '#4ADE80' : '#FCA5A5',
                          }}
                        >
                          {pickLabel}
                        </span>

                        {/* Puntos */}
                        {pick.pts > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-sport)', flexShrink: 0 }}>
                            +{pick.pts}
                          </span>
                        )}

                        {/* Featured */}
                        {pick.featured && (
                          <span title="Partido destacado" style={{ fontSize: 12, flexShrink: 0 }}>⭐</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* CTA → predicciones */}
            <div
              className="rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
              style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20` }}
            >
              <span style={{ fontSize: 36 }}>🏆</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 900, color: '#F0F0F8', fontFamily: 'var(--font-sport)', marginBottom: 4 }}>
                  ¿Puedes superarlo?
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
                  Predice el Mundial 2026 y compite en el ranking global.
                </p>
              </div>
              <Link
                href="/predicciones"
                style={{
                  flexShrink: 0, padding: '10px 22px', borderRadius: 'var(--radius-card)',
                  background: GOLD, color: '#000',
                  fontSize: 12, fontWeight: 900, textDecoration: 'none',
                  fontFamily: 'var(--font-sport)', letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Predecir ahora →
              </Link>
            </div>

          </div>
        )}
      </div>

      <ScrollToTop />
    </div>
  )
}
