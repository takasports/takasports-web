'use client'

// ── MundialClient ────────────────────────────────────────────────────────
// Interfaz de predicciones para el Mundial 2026.
// Estética dorada. Matches agrupados por fecha.
// Pick 1 / X / 2 — bloqueado una vez iniciado el partido.
// Muestra puntos acreditados si el partido ya se resolvió.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  let color  = 'rgba(255,255,255,0.4)'
  let subColor = 'rgba(255,255,255,0.2)'

  if (correct) {
    bg = 'rgba(74,222,128,0.15)'; border = 'rgba(74,222,128,0.4)'; color = '#4ADE80'; subColor = 'rgba(74,222,128,0.6)'
  } else if (wrong) {
    bg = 'rgba(239,68,68,0.1)'; border = 'rgba(239,68,68,0.3)'; color = 'rgba(239,68,68,0.5)'; subColor = 'rgba(239,68,68,0.35)'
  } else if (active) {
    bg = `${GOLD}18`; border = `${GOLD}60`; color = GOLD; subColor = GOLD2
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
        justifyContent: 'center',
        gap: 3,
        padding: '10px 6px',
        borderRadius: 12,
        background: bg,
        border: `1.5px solid ${border}`,
        color,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'var(--font-sport)',
        minWidth: 0,
        minHeight: 52,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      {sublabel && (
        <span style={{ fontSize: 8, color: subColor, textTransform: 'uppercase', letterSpacing: '0.06em', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
  const myPick     = pred?.prediction?.pick ?? null
  const isOpen     = event.status === 'open'
  const isClosed   = event.status === 'closed'
  const isResolved = event.status === 'resolved'
  const winner     = event.result?.winner ?? null
  const pts        = pred?.points_awarded ?? null
  const [shared,   setShared] = useState(false)

  const picks: { label: string; sub: string; val: '1' | 'X' | '2' }[] = [
    { label: 'Local', sub: event.team_home ?? '', val: '1' },
    { label: 'X', sub: 'Empate', val: 'X' },
    { label: 'Visita', sub: event.team_away ?? '', val: '2' },
  ]

  return (
    <div
      style={{
        background: event.featured
          ? `linear-gradient(135deg, ${GOLD}09 0%, ${GOLD}04 50%, transparent 100%)`
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${event.featured ? `${GOLD}35` : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: event.featured ? `0 0 20px ${GOLD}08` : 'none',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Header: grupo + featured badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 20 }}>
        {event.featured && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              padding: '2px 7px',
              borderRadius: 6,
              background: `linear-gradient(90deg, ${GOLD}28 0%, ${GOLD}18 100%)`,
              border: `1px solid ${GOLD}45`,
              color: GOLD,
              fontFamily: 'var(--font-sport)',
              letterSpacing: '0.07em',
            }}
          >
            ⭐ DOBLE PUNTOS
          </span>
        )}
        {(event.meta?.group || event.meta?.city) && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.35)',
              fontFamily: 'var(--font-sport)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            {event.meta.group || event.meta.city}
          </span>
        )}
        {isClosed && (
          <span style={{ fontSize: 9, color: '#EF4444', fontFamily: 'var(--font-sport)', fontWeight: 900, letterSpacing: '0.06em' }}>
            🔴 EN VIVO
          </span>
        )}
      </div>

      {/* Teams — centered layout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Home team */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <span style={{ fontSize: 30, lineHeight: 1 }}>{flag(event.team_home)}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: '#F0F0F8',
              fontFamily: 'var(--font-sport)',
              lineHeight: 1.2,
              textAlign: 'right',
            }}
          >
            {event.team_home ?? '—'}
          </span>
        </div>

        {/* Center: VS / score / live */}
        <div
          style={{
            width: 56,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {isResolved && event.result ? (
            <>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 900,
                  color: GOLD,
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {event.result.home_score ?? '?'}–{event.result.away_score ?? '?'}
              </span>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Final
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-sport)', fontWeight: 900, letterSpacing: '0.1em' }}>
                VS
              </span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)', textAlign: 'center', lineHeight: 1.3 }}>
                {toTimeLabel(event.event_date)}
              </span>
            </>
          )}
        </div>

        {/* Away team */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
          <span style={{ fontSize: 30, lineHeight: 1 }}>{flag(event.team_away)}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: '#F0F0F8',
              fontFamily: 'var(--font-sport)',
              lineHeight: 1.2,
              textAlign: 'left',
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
              disabled={!isOpen || submitting}
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

      {/* Share pick — visible cuando hay pick pero el partido aún no cerró */}
      {myPick && isOpen && (
        <button
          onClick={async () => {
            await sharePick(event.team_home, event.team_away, myPick)
            setShared(true)
            setTimeout(() => setShared(false), 3000)
          }}
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 8,
            background: `${GOLD}10`,
            border: `1px solid ${GOLD}25`,
            color: GOLD_D,
            fontSize: 9,
            fontWeight: 900,
            fontFamily: 'var(--font-sport)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          {shared ? '✓ Copiado' : '↗ Compartir pick'}
        </button>
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

// ── Share helper ─────────────────────────────────────────────────────────

async function sharePick(teamHome: string | null, teamAway: string | null, pick: '1' | 'X' | '2') {
  const pickLabel = pick === '1' ? `${teamHome ?? 'Local'}` : pick === '2' ? `${teamAway ?? 'Visita'}` : 'Empate'
  const text = `Predigo: ${pickLabel} en ${teamHome ?? '?'} vs ${teamAway ?? '?'} — ¿Quién acierta más? 🏆`
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Mi predicción en TakaSports', text, url: 'https://takasportsmedia.com/predicciones' })
    } catch { /* user cancelled */ }
  } else {
    await navigator.clipboard.writeText(`${text} takasportsmedia.com/predicciones`)
  }
}

// ── Countdown helpers ─────────────────────────────────────────────────────

function daysUntilKickoff(): number | null {
  const kickoff = new Date('2026-06-11T19:00:00Z')
  const now     = new Date()
  if (now >= kickoff) return null
  return Math.ceil((kickoff.getTime() - now.getTime()) / 86_400_000)
}

/** Devuelve tiempo hasta el próximo evento open (en ms), o null si ya empezó el torneo */
function msUntilNextOpen(events: RankedEvent[]): number | null {
  const now   = Date.now()
  const opens = events
    .filter(e => e.status === 'open')
    .map(e => new Date(e.event_date).getTime())
    .filter(t => t > now)
    .sort((a, b) => a - b)
  if (opens.length === 0) return null
  const ms = opens[0] - now
  // Solo mostramos si el partido es en menos de 24h (urgencia real)
  return ms < 86_400_000 ? ms : null
}

function formatCountdown(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Main component ───────────────────────────────────────────────────────

export default function MundialClient() {
  const [events,     setEvents]     = useState<RankedEvent[]>([])
  const [preds,      setPreds]      = useState<PredMap>({})
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [showLogin,  setShowLogin]  = useState(false)
  const [tick,       setTick]       = useState(0)   // fuerza re-render para countdown
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Tick cada segundo para countdown de próximo partido
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

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
        setShowLogin(true)
        return
      }
      if (res.status === 409) {
        await load()
        return
      }
      if (!res.ok) throw new Error('error')
      const data = await res.json() as { prediction?: { event_id: string; prediction: { pick: '1'|'X'|'2' } } }
      if (data.prediction) {
        // Actualiza el pick en el estado local (insert o update)
        setPreds(prev => ({
          ...prev,
          [eventId]: {
            ...(prev[eventId] ?? {}),
            event_id:       eventId,
            prediction:     data.prediction!.prediction,
            points_awarded: prev[eventId]?.points_awarded ?? null,
            is_correct:     prev[eventId]?.is_correct     ?? null,
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

  // ── Stats + countdown ────────────────────────────────────────────
  const totalPts    = Object.values(preds).reduce((acc, p) => acc + (p.points_awarded ?? 0), 0)
  const myPicks     = Object.keys(preds).length
  const openCount   = events.filter(e => e.status === 'open').length
  const daysLeft    = daysUntilKickoff()
  // tick hace que se recalcule cada segundo (solo importa cuando nextMatchMs !== null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextMatchMs = useMemo(() => msUntilNextOpen(events), [events, tick])

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden mt-4 mb-8"
        style={{
          background: 'linear-gradient(160deg, #080500 0%, #160E00 40%, #0C0700 100%)',
          border: `1px solid ${GOLD}20`,
        }}
      >
        {/* Campo de fútbol SVG — watermark derecho */}
        <svg
          className="absolute pointer-events-none select-none"
          style={{ right: -8, bottom: -8, width: 260, height: 190, opacity: 0.055 }}
          viewBox="0 0 400 280" fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="4" y="4" width="392" height="272" stroke="white" strokeWidth="2.5"/>
          <line x1="200" y1="4" x2="200" y2="276" stroke="white" strokeWidth="2.5"/>
          <circle cx="200" cy="140" r="42" stroke="white" strokeWidth="2.5"/>
          <circle cx="200" cy="140" r="4" fill="white"/>
          <rect x="4" y="88" width="62" height="104" stroke="white" strokeWidth="2"/>
          <rect x="4" y="112" width="24" height="56" stroke="white" strokeWidth="2"/>
          <rect x="334" y="88" width="62" height="104" stroke="white" strokeWidth="2"/>
          <rect x="372" y="112" width="24" height="56" stroke="white" strokeWidth="2"/>
          <path d="M62 88 A42 42 0 0 1 62 192" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M338 88 A42 42 0 0 0 338 192" stroke="white" strokeWidth="2" fill="none"/>
        </svg>

        {/* Textura de césped (franjas horizontales) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              transparent, transparent 28px,
              rgba(255,255,255,0.012) 28px, rgba(255,255,255,0.012) 56px
            )`,
          }}
        />

        {/* Glow áureo izquierda-centro */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -80,
            left: '20%',
            width: 360,
            height: 360,
            background: `radial-gradient(ellipse, ${GOLD}0D 0%, transparent 60%)`,
          }}
        />

        {/* Content */}
        <div className="relative px-6 pt-7 pb-6 flex flex-col gap-5">

          {/* Fila superior: título + countdown */}
          <div className="flex items-start justify-between gap-4 flex-wrap">

            {/* Título */}
            <div className="flex flex-col gap-2">
              <p style={{ fontSize: 9, fontWeight: 900, fontFamily: 'var(--font-sport)', color: GOLD_D, textTransform: 'uppercase', letterSpacing: '0.18em' }}>
                ⚽ Predicciones · Qatar 2022 sucesor
              </p>
              <div className="flex items-end gap-3">
                <span style={{ fontSize: 46, lineHeight: 1 }}>🏆</span>
                <div>
                  <h1
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(2rem, 5vw, 3.4rem)',
                      fontWeight: 900,
                      color: GOLD,
                      letterSpacing: '-0.03em',
                      lineHeight: 0.88,
                    }}
                  >
                    MUNDIAL
                  </h1>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1.1rem, 2.8vw, 1.9rem)',
                      fontWeight: 900,
                      color: 'rgba(255,255,255,0.12)',
                      letterSpacing: '0.1em',
                      lineHeight: 1,
                    }}
                  >
                    2026
                  </p>
                </div>
              </div>

              {/* Host nations */}
              <div className="flex items-center gap-0 flex-wrap mt-1">
                {[
                  { emoji: '🇺🇸', name: 'USA' },
                  { emoji: '🇨🇦', name: 'CANADA' },
                  { emoji: '🇲🇽', name: 'MEXICO' },
                ].map(({ emoji, name }, i) => (
                  <div key={name} className="flex items-center">
                    {i > 0 && (
                      <span style={{ color: `${GOLD}28`, fontSize: 10, margin: '0 8px' }}>·</span>
                    )}
                    <span style={{ fontSize: 16 }}>{emoji}</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        color: 'rgba(255,255,255,0.35)',
                        fontFamily: 'var(--font-sport)',
                        letterSpacing: '0.1em',
                        marginLeft: 5,
                      }}
                    >
                      {name}
                    </span>
                  </div>
                ))}
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-sport)', marginLeft: 14 }}>
                  11 Jun – 19 Jul 2026
                </span>
              </div>
            </div>

            {/* Countdown badge */}
            {(daysLeft !== null || nextMatchMs !== null) && (
              <div
                className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}1C 0%, ${GOLD}0A 100%)`,
                  border: `1.5px solid ${GOLD}32`,
                  padding: '14px 22px',
                  minWidth: 88,
                  boxShadow: `0 0 32px ${GOLD}10`,
                }}
              >
                {daysLeft !== null ? (
                  <>
                    <span
                      style={{
                        fontSize: 46,
                        fontWeight: 900,
                        color: GOLD,
                        fontFamily: 'var(--font-display)',
                        lineHeight: 1,
                        letterSpacing: '-0.04em',
                      }}
                    >
                      {daysLeft}
                    </span>
                    <span style={{ fontSize: 8, color: GOLD_D, fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 3 }}>
                      {daysLeft === 1 ? 'día' : 'días'}
                    </span>
                  </>
                ) : nextMatchMs !== null ? (
                  <>
                    <span
                      style={{
                        fontSize: 26,
                        fontWeight: 900,
                        color: GOLD,
                        fontFamily: 'var(--font-display)',
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {formatCountdown(nextMatchMs)}
                    </span>
                    <span style={{ fontSize: 8, color: GOLD_D, fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>
                      próximo pick
                    </span>
                  </>
                ) : null}
              </div>
            )}

            {/* Stats inline — solo tras el primer pick o cuando el torneo arrancó */}
            {myPicks > 0 && daysLeft === null && (
              <div
                className="flex items-center gap-5 px-5 py-3 rounded-2xl"
                style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}22` }}
              >
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 22, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                    {myPicks}
                  </p>
                  <p style={{ fontSize: 9, color: GOLD_D, fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>picks</p>
                </div>
                {totalPts > 0 && (
                  <>
                    <div style={{ width: 1, height: 28, background: `${GOLD}20` }} />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 22, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                        {totalPts}
                      </p>
                      <p style={{ fontSize: 9, color: GOLD_D, fontFamily: 'var(--font-sport)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>pts</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        {/* Puntos info strip + share stats */}
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

          {/* Compartir mis stats — solo cuando hay picks resueltos con puntos */}
          {totalPts > 0 && (
            <a
              href={`/api/og/mundial-stats?picks=${myPicks}&correct=${Object.values(preds).filter(p => p.is_correct).length}&pts=${totalPts}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 8,
                background: `${GOLD}12`,
                border: `1px solid ${GOLD}28`,
                color: GOLD_D,
                fontSize: 9,
                fontWeight: 900,
                fontFamily: 'var(--font-sport)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              🖼 Compartir mis stats
            </a>
          )}
        </div>
        </div>{/* end content wrapper */}
      </div>{/* end hero */}

      {/* ── Login CTA ─────────────────────────────────────────── */}
      {showLogin && (
        <div
          className="mb-4 px-5 py-4 rounded-2xl flex flex-col gap-3"
          style={{ background: 'rgba(251,191,36,0.06)', border: `1px solid ${GOLD}30` }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>🏆</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 900, color: GOLD, fontFamily: 'var(--font-sport)' }}>
                Inicia sesión para predecir
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sport)', marginTop: 1 }}>
                Crea una cuenta gratis y compite en el Mundial 2026
              </p>
            </div>
            <button
              onClick={() => setShowLogin(false)}
              style={{ marginLeft: 'auto', opacity: 0.4, background: 'none', border: 'none', color: '#F0F0F8', cursor: 'pointer', fontSize: 16 }}
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2">
            <a
              href="/auth/login"
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '9px 16px',
                borderRadius: 10,
                background: `${GOLD}20`,
                border: `1px solid ${GOLD}50`,
                color: GOLD,
                fontSize: 11,
                fontWeight: 900,
                fontFamily: 'var(--font-sport)',
                textDecoration: 'none',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Iniciar sesión
            </a>
            <a
              href="/auth/register"
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '9px 16px',
                borderRadius: 10,
                background: GOLD,
                border: `1px solid ${GOLD}`,
                color: '#000',
                fontSize: 11,
                fontWeight: 900,
                fontFamily: 'var(--font-sport)',
                textDecoration: 'none',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Crear cuenta gratis
            </a>
          </div>
        </div>
      )}

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
              <div className="flex items-center gap-3 mb-4">
                <div
                  style={{
                    width: 3,
                    height: 20,
                    borderRadius: 2,
                    background: `linear-gradient(to bottom, ${GOLD}, ${GOLD2}50)`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: '#F0F0F8',
                    fontFamily: 'var(--font-sport)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {label}
                </span>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${GOLD}18, transparent)` }} />
                {dayEvents.filter(e => e.status === 'open').length > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: GOLD2,
                      fontFamily: 'var(--font-sport)',
                      background: `${GOLD}10`,
                      padding: '2px 8px',
                      borderRadius: 10,
                      border: `1px solid ${GOLD}1E`,
                    }}
                  >
                    {dayEvents.filter(e => e.status === 'open').length} pendientes
                  </span>
                )}
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
