'use client'

// ── MundialClient ────────────────────────────────────────────────────────
// Interfaz de predicciones para el Mundial 2026.
// Estética dorada. Matches agrupados por fecha.
// Pick 1 / X / 2 — bloqueado una vez iniciado el partido.
// Muestra puntos acreditados si el partido ya se resolvió.

import { useCallback, useEffect, useMemo, useState } from 'react'
import TakaPoint from '@/components/TakaPoint'

// ── Types ────────────────────────────────────────────────────────────────

interface RankedEvent {
  id:          string
  sport:       string
  competition: string
  event_date:  string
  team_home:   string | null
  team_away:   string | null
  featured:    boolean
  status:      'open' | 'closed' | 'resolved'
  result:      { winner: '1' | 'X' | '2'; home_score?: number; away_score?: number } | null
  meta:        { group?: string; venue?: string; city?: string }
}

interface PredictionRow {
  event_id:       string
  prediction:     { pick: '1' | 'X' | '2' }
  points_awarded: number | null
  is_correct:     boolean | null
}

type PredMap = Record<string, PredictionRow>

// ── Flag emojis ──────────────────────────────────────────────────────────

const FLAGS: Record<string, string> = {
  // Americas
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'México': '🇲🇽', 'Mexico': '🇲🇽',
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Canada': '🇨🇦',
  'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 'Peru': '🇵🇪', 'Chile': '🇨🇱',
  'Uruguay': '🇺🇾', 'Venezuela': '🇻🇪', 'Paraguay': '🇵🇾', 'Bolivia': '🇧🇴',
  'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳', 'Panama': '🇵🇦',
  'Jamaica': '🇯🇲', 'Trinidad and Tobago': '🇹🇹',
  // Europe
  'Spain': '🇪🇸', 'France': '🇫🇷', 'Germany': '🇩🇪', 'Portugal': '🇵🇹',
  'Netherlands': '🇳🇱', 'Italy': '🇮🇹', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷',
  'Belgium': '🇧🇪', 'Denmark': '🇩🇰', 'Austria': '🇦🇹', 'Switzerland': '🇨🇭',
  'Poland': '🇵🇱', 'Serbia': '🇷🇸', 'Turkey': '🇹🇷', 'Romania': '🇷🇴',
  'Czech Republic': '🇨🇿', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Hungary': '🇭🇺',
  'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮', 'Ukraine': '🇺🇦', 'Greece': '🇬🇷',
  'Albania': '🇦🇱', 'Georgia': '🇬🇪', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  // Africa
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬',
  'Ghana': '🇬🇭', 'Cameroon': '🇨🇲', 'Ivory Coast': '🇨🇮', 'Tunisia': '🇹🇳',
  'South Africa': '🇿🇦', 'Algeria': '🇩🇿', 'Mali': '🇲🇱', 'Congo': '🇨🇩',
  // Asia
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Australia': '🇦🇺', 'Iran': '🇮🇷',
  'Saudi Arabia': '🇸🇦', 'Qatar': '🇶🇦', 'China': '🇨🇳', 'Indonesia': '🇮🇩',
  'Jordan': '🇯🇴', 'Iraq': '🇮🇶', 'Uzbekistan': '🇺🇿', 'Bahrain': '🇧🇭',
  'Oman': '🇴🇲', 'Palestine': '🇵🇸',
  // Other
  'New Zealand': '🇳🇿',
}

function flag(team: string | null): string {
  if (!team) return '🏳️'
  return FLAGS[team] ?? '🏴'
}

// ── Date helpers ─────────────────────────────────────────────────────────

const DAYS_ES   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

function toDateLabel(iso: string): string {
  const d = new Date(iso)
  const day  = DAYS_ES[d.getUTCDay()]
  const date = d.getUTCDate()
  const mon  = MONTHS_ES[d.getUTCMonth()]
  return `${day} ${date} ${mon}`
}

function toTimeLabel(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm} UTC`
}

// ── Constants ────────────────────────────────────────────────────────────

const GOLD   = '#FBBF24'
const GOLD2  = '#F59E0B'
const GOLD_D = '#92400E'

// ── Sub-components ───────────────────────────────────────────────────────

function PickButton({
  label,
  sublabel,
  active,
  correct,
  wrong,
  disabled,
  onClick,
}: {
  label:     string
  sublabel?: string
  active:    boolean
  correct:   boolean
  wrong:     boolean
  disabled:  boolean
  onClick:   () => void
}) {
  let bg     = 'rgba(255,255,255,0.03)'
  let border = 'rgba(255,255,255,0.08)'
  let color  = 'rgba(255,255,255,0.35)'

  if (correct) {
    bg = 'rgba(74,222,128,0.15)'; border = 'rgba(74,222,128,0.4)'; color = '#4ADE80'
  } else if (wrong) {
    bg = 'rgba(239,68,68,0.1)'; border = 'rgba(239,68,68,0.3)'; color = 'rgba(239,68,68,0.6)'
  } else if (active) {
    bg = `${GOLD}18`; border = `${GOLD}60`; color = GOLD
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '8px 4px',
        borderRadius: 10,
        background: bg,
        border: `1.5px solid ${border}`,
        color,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'var(--font-sport)',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 900 }}>{label}</span>
      {sublabel && (
        <span style={{ fontSize: 8, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {sublabel}
        </span>
      )}
    </button>
  )
}

function MatchCard({
  event,
  pred,
  submitting,
  onPick,
}: {
  event:      RankedEvent
  pred:       PredictionRow | undefined
  submitting: boolean
  onPick:     (eventId: string, pick: '1' | 'X' | '2') => void
}) {
  const myPick    = pred?.prediction?.pick ?? null
  const isOpen    = event.status === 'open'
  const isClosed  = event.status === 'closed'
  const isResolved = event.status === 'resolved'
  const winner    = event.result?.winner ?? null
  const pts       = pred?.points_awarded ?? null

  const picks: { label: string; sub: string; val: '1' | 'X' | '2' }[] = [
    { label: '1', sub: 'Local', val: '1' },
    { label: 'X', sub: 'Empate', val: 'X' },
    { label: '2', sub: 'Visit.', val: '2' },
  ]

  return (
    <div
      style={{
        background: event.featured
          ? 'linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(245,158,11,0.04) 100%)'
          : 'rgba(255,255,255,0.018)',
        border: `1px solid ${event.featured ? `${GOLD}30` : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header: ciudad + hora + featured badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {(event.meta?.group || event.meta?.city) && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              padding: '2px 6px',
              borderRadius: 6,
              background: `${GOLD}14`,
              border: `1px solid ${GOLD}25`,
              color: GOLD2,
              fontFamily: 'var(--font-sport)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {event.meta.group || event.meta.city}
          </span>
        )}
        {event.featured && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              padding: '2px 6px',
              borderRadius: 6,
              background: `${GOLD}20`,
              border: `1px solid ${GOLD}40`,
              color: GOLD,
              fontFamily: 'var(--font-sport)',
              letterSpacing: '0.06em',
            }}
          >
            ⭐ DOBLE PUNTOS
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)' }}>
          {isResolved && event.result
            ? `${event.result.home_score ?? '?'} – ${event.result.away_score ?? '?'}`
            : isClosed
            ? '🔴 En curso'
            : toTimeLabel(event.event_date)}
        </span>
      </div>

      {/* Teams */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Home */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span style={{ fontSize: 22 }}>{flag(event.team_home)}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: '#F0F0F8',
              fontFamily: 'var(--font-sport)',
              lineHeight: 1.2,
            }}
          >
            {event.team_home ?? '—'}
          </span>
        </div>

        {/* VS */}
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)' }}>
          vs
        </span>

        {/* Away */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontSize: 22 }}>{flag(event.team_away)}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: '#F0F0F8',
              fontFamily: 'var(--font-sport)',
              textAlign: 'right',
              lineHeight: 1.2,
            }}
          >
            {event.team_away ?? '—'}
          </span>
        </div>
      </div>

      {/* Pick buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        {picks.map(p => {
          const isActive  = myPick === p.val
          const isCorrect = isResolved && winner === p.val && isActive
          const isWrong   = isResolved && isActive && !isCorrect
          const isWinRow  = isResolved && winner === p.val && !isActive

          return (
            <PickButton
              key={p.val}
              label={p.label}
              sublabel={p.sub}
              active={isActive}
              correct={isCorrect || isWinRow}
              wrong={isWrong}
              disabled={!isOpen || !!myPick || submitting}
              onClick={() => onPick(event.id, p.val)}
            />
          )
        })}
      </div>

      {/* Points earned */}
      {isResolved && myPick && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pts != null && pts > 0 ? (
            <>
              <TakaPoint size={13} />
              <span style={{ fontSize: 11, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-sport)' }}>
                +{pts} pts
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-sport)' }}>
                ¡Acertaste!
              </span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sport)' }}>
              Fallaste — el resultado fue {winner === '1' ? event.team_home : winner === '2' ? event.team_away : 'Empate'}
            </span>
          )}
        </div>
      )}

      {/* Estado si no hay pick y partido no abierto */}
      {!myPick && !isOpen && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)' }}>
          {isClosed ? 'Predicciones cerradas' : 'Sin predicción'}
        </span>
      )}
    </div>
  )
}

// ── Countdown helper ─────────────────────────────────────────────────────

function daysUntilKickoff(): number | null {
  const kickoff = new Date('2026-06-11T19:00:00Z')
  const now     = new Date()
  if (now >= kickoff) return null
  return Math.ceil((kickoff.getTime() - now.getTime()) / 86_400_000)
}

// ── Main component ───────────────────────────────────────────────────────

export default function MundialClient() {
  const [events,     setEvents]     = useState<RankedEvent[]>([])
  const [preds,      setPreds]      = useState<PredMap>({})
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // ── Fetch events + predictions ───────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [evRes, predRes] = await Promise.all([
        fetch('/api/ranked/events?sport=mundial'),
        fetch('/api/ranked/predictions?sport=mundial'),
      ])
      const evData   = await evRes.json()   as { events?: RankedEvent[] }
      const predData = await predRes.json() as { predictions?: PredMap }
      setEvents(evData.events  ?? [])
      setPreds(predData.predictions ?? {})
    } catch {
      setError('Error cargando partidos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Submit pick ──────────────────────────────────────────────────
  const handlePick = useCallback(async (eventId: string, pick: '1' | 'X' | '2') => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res  = await fetch('/api/ranked/predictions', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ event_id: eventId, pick }),
      })
      if (res.status === 401) {
        setError('Inicia sesión para predecir.')
        return
      }
      if (res.status === 409) {
        await load()
        return
      }
      if (!res.ok) throw new Error('error')
      const data = await res.json() as { prediction?: { event_id: string; prediction: { pick: '1'|'X'|'2' } } }
      if (data.prediction) {
        setPreds(prev => ({
          ...prev,
          [eventId]: {
            event_id:       eventId,
            prediction:     data.prediction!.prediction,
            points_awarded: null,
            is_correct:     null,
          },
        }))
      }
    } catch {
      setError('No se pudo guardar la predicción.')
    } finally {
      setSubmitting(false)
    }
  }, [submitting, load])

  // ── Group events by date ─────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; events: RankedEvent[] }>()
    for (const ev of events) {
      const key = toDateKey(ev.event_date)
      if (!map.has(key)) map.set(key, { label: toDateLabel(ev.event_date), events: [] })
      map.get(key)!.events.push(ev)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [events])

  // ── Stats banner ─────────────────────────────────────────────────
  const totalPts   = Object.values(preds).reduce((acc, p) => acc + (p.points_awarded ?? 0), 0)
  const myPicks    = Object.keys(preds).length
  const openCount  = events.filter(e => e.status === 'open').length
  const daysLeft   = daysUntilKickoff()

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden mt-4 mb-6 px-6 py-8 flex flex-col gap-3"
        style={{
          background: 'linear-gradient(135deg, #1C1200 0%, #241800 50%, #1A1100 100%)',
          border: `1px solid ${GOLD}25`,
        }}
      >
        {/* Glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 20% 50%, ${GOLD}08 0%, transparent 60%)`,
          }}
        />
        <div className="relative flex items-center gap-3 flex-wrap">
          <span style={{ fontSize: 40 }}>🏆</span>
          <div>
            <h1
              className="font-black leading-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                color: GOLD,
                letterSpacing: '-0.02em',
              }}
            >
              Mundial 2026
            </h1>
            <p style={{ color: GOLD_D, fontSize: 12, fontFamily: 'var(--font-sport)', marginTop: 2 }}>
              USA · Canada · Mexico · 11 Jun – Jul 2026
            </p>
          </div>

          {/* Countdown badge */}
          {daysLeft !== null && (
            <div
              className="ml-auto flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl"
              style={{
                background: `${GOLD}18`,
                border: `1px solid ${GOLD}35`,
              }}
            >
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: GOLD,
                  fontFamily: 'var(--font-display)',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}
              >
                {daysLeft}
              </span>
              <span style={{ fontSize: 8, color: GOLD_D, fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {daysLeft === 1 ? 'día' : 'días'}
              </span>
            </div>
          )}
          {/* Stats inline — solo tras el primer pick o cuando el torneo arrancó */}
          {myPicks > 0 && daysLeft === null && (
            <div
              className="ml-auto flex items-center gap-3 px-4 py-2 rounded-xl"
              style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}25` }}
            >
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                  {myPicks}
                </p>
                <p style={{ fontSize: 9, color: GOLD_D, fontFamily: 'var(--font-sport)' }}>picks</p>
              </div>
              {totalPts > 0 && (
                <>
                  <span style={{ color: `${GOLD}30`, fontSize: 12 }}>·</span>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 16, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                      {totalPts}
                    </p>
                    <p style={{ fontSize: 9, color: GOLD_D, fontFamily: 'var(--font-sport)' }}>pts</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Puntos info strip */}
        <div className="relative flex items-center gap-4 flex-wrap">
          {[
            { icon: '⚽', text: 'Resultado correcto', pts: '3 pts' },
            { icon: '⭐', text: 'Partido destacado', pts: '6 pts' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-1.5">
              <span style={{ fontSize: 12 }}>{item.icon}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)' }}>
                {item.text}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: GOLD,
                  fontFamily: 'var(--font-sport)',
                  background: `${GOLD}14`,
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                {item.pts}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontFamily: 'var(--font-sport)' }}
        >
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', opacity: 0.6, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-16">
          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{ border: `2px solid ${GOLD}20`, borderTopColor: GOLD }}
          />
        </div>
      )}

      {/* ── Empty state (no debería verse, hay 104 fixtures) ─── */}
      {!loading && events.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span style={{ fontSize: 52 }}>🏆</span>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.2rem, 2.5vw, 1.8rem)',
              color: GOLD,
              letterSpacing: '-0.02em',
            }}
          >
            Cargando partidos…
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, maxWidth: 360 }}>
            Los fixtures del Mundial se están sincronizando. Recarga en unos segundos.
          </p>
        </div>
      )}

      {/* ── Match groups ─────────────────────────────────────── */}
      {!loading && grouped.length > 0 && (
        <div className="flex flex-col gap-8">
          {grouped.map(([dateKey, { label, events: dayEvents }]) => (
            <section key={dateKey}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: GOLD2,
                    fontFamily: 'var(--font-sport)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {label}
                </span>
                <div style={{ flex: 1, height: 1, background: `${GOLD}15` }} />
                <span
                  style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.2)',
                    fontFamily: 'var(--font-sport)',
                  }}
                >
                  {dayEvents.filter(e => e.status === 'open').length} pendientes
                </span>
              </div>

              {/* Match cards grid */}
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
              >
                {dayEvents.map(ev => (
                  <MatchCard
                    key={ev.id}
                    event={ev}
                    pred={preds[ev.id]}
                    submitting={submitting}
                    onPick={handlePick}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Footer note ───────────────────────────────────────── */}
      {!loading && openCount > 0 && (
        <p
          className="text-center mt-10"
          style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)' }}
        >
          Las predicciones se bloquean al inicio de cada partido · Sin cambios una vez guardadas
        </p>
      )}
    </div>
  )
}
