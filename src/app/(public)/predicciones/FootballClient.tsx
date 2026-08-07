'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Ranked Fútbol — la vista de FECHAS.
//
// La unidad de juego es el DÍA: cada Fecha trae 3-6 partidos destacados y un
// Partido del Día que vale x2. La selección la hace el servidor (cron
// sync-football); aquí solo se agrupa por `meta.date_key` —nunca se recalcula—
// y se pinta.
//
// Comparte componentes con el archivo del Mundial vía components/ranked/soccer.
// El cliente del Mundial todavía tiene los suyos propios: se unifica cuando ese
// archivo se retire (no se refactoriza un producto congelado mientras se
// construye el nuevo).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import MatchCard from '@/components/ranked/soccer/MatchCard'
import { groupIntoFechas, fechaProgress, formatCountdown, todayKey } from '@/components/ranked/soccer/fecha'
import {
  FOOTBALL_THEME, MAX_ACTIVE_EXACT,
  type SoccerEvent, type SoccerPick, type PredMap, type LiveScore,
} from '@/components/ranked/soccer/types'
import { createClient } from '@/lib/supabase'
// Emparejado de nombres tolerante a alias ("PSG" ↔ "Paris Saint-Germain").
// Vive en lib/quiniela por historia; es una utilidad pura y la usan también
// PorraMatchWidget y /api/quiniela — sobrevive a la retirada de ese stack.
import { nameMatch } from '@/lib/quiniela'
import { StarIcon, LockIcon } from '@/components/icons/GameIcons'
import TakaPoint from '@/components/TakaPoint'

const T = FOOTBALL_THEME

const ANIMATIONS = `
@keyframes fCardIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes fFadeInUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
`

function vibrate(ms: number) {
  try { navigator.vibrate?.(ms) } catch { /* sin soporte */ }
}

export default function FootballClient() {
  const [events,     setEvents]     = useState<SoccerEvent[]>([])
  const [preds,      setPreds]      = useState<PredMap>({})
  const [liveScores, setLiveScores] = useState<Record<string, LiveScore>>({})
  const [loading,    setLoading]    = useState(true)
  const [loggedIn,   setLoggedIn]   = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [nowMs,      setNowMs]      = useState(() => Date.now())
  const [exactTipDismissed, setExactTipDismissed] = useState<boolean>(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('futbol:exactTip') === '1' }
    catch { return true }
  })
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const dismissExactTip = useCallback(() => {
    setExactTipDismissed(true)
    try { localStorage.setItem('futbol:exactTip', '1') } catch { /* */ }
  }, [])

  // ── Carga ──────────────────────────────────────────────────────────────────
  const fetchCore = useCallback(async () => {
    const [evRes, predRes] = await Promise.all([
      fetch('/api/ranked/events?sport=futbol'),
      fetch('/api/ranked/predictions?sport=futbol'),
    ])
    const evData   = await evRes.json()   as { events?: SoccerEvent[] }
    const predData = await predRes.json() as { predictions?: PredMap; reason?: string }
    setEvents(evData.events ?? [])
    setPreds(predData.predictions ?? {})
    setLoggedIn(predData.reason !== 'no_session')
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { await fetchCore() }
    catch { setError('No se pudieron cargar las Fechas. Inténtalo de nuevo.') }
    finally { setLoading(false) }
  }, [fetchCore])

  useEffect(() => { void load() }, [load])

  // Un solo reloj para toda la vista: si cada tarjeta llevara el suyo, las
  // cuentas atrás se irían desincronizando entre sí.
  useEffect(() => {
    tickRef.current = setInterval(() => setNowMs(Date.now()), 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  // ── Marcador en vivo ───────────────────────────────────────────────────────
  // Solo se sondea cuando hay (o va a haber en breve) un partido en juego;
  // fuera de esa ventana la vista está en reposo y no gasta llamadas.
  const hasLiveWindow = useMemo(() => events.some(e => {
    if (e.status === 'closed') return true
    if (e.status !== 'open') return false
    const k = Date.parse(e.event_date)
    return k <= nowMs + 2 * 60_000 && k >= nowMs - 3 * 3_600_000
  }), [events, nowMs])

  useEffect(() => {
    if (!hasLiveWindow) { setLiveScores({}); return }
    let cancelled = false
    const poll = async () => {
      try {
        const r = await fetch('/api/ranked/football/live')
        if (r.ok) {
          const d = await r.json() as { live?: Record<string, LiveScore> }
          if (!cancelled) setLiveScores(d.live ?? {})
        }
      } catch { /* silencioso */ }
      try { await fetchCore() } catch { /* silencioso */ }
    }
    void poll()
    const iv = setInterval(poll, 30_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [hasLiveWindow, fetchCore])

  // ── Envío de predicción ────────────────────────────────────────────────────
  const send = useCallback(async (
    eventId: string,
    pick: SoccerPick,
    exactScore: { home: number; away: number } | null,
  ) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { event_id: eventId, pick }
      if (exactScore) body.exactScore = exactScore
      const res = await fetch('/api/ranked/predictions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) {
        const sb = createClient()
        if (sb) {
          await sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/predicciones` },
          })
        }
        return
      }
      if (res.status === 409) {
        const json = await res.json().catch(() => null) as { error?: string; message?: string } | null
        if (json?.error === 'exact_limit') { setError(json.message ?? `Ya tienes ${MAX_ACTIVE_EXACT} marcadores exactos activos.`); return }
        await load(); return
      }
      if (!res.ok) throw new Error('error')
      const data = await res.json() as { prediction?: { prediction: PredMap[string]['prediction'] } }
      if (data.prediction) {
        setPreds(prev => ({
          ...prev,
          [eventId]: {
            ...(prev[eventId] ?? {}),
            event_id: eventId,
            prediction: data.prediction!.prediction,
            points_awarded: prev[eventId]?.points_awarded ?? null,
            is_correct:     prev[eventId]?.is_correct ?? null,
          },
        }))
        try { window.dispatchEvent(new Event('taka:badge-check')) } catch { /* */ }
      }
    } catch { setError('No se pudo guardar la predicción.') }
    finally { setSubmitting(false) }
  }, [submitting, load])

  const handlePick = useCallback((eventId: string, pick: SoccerPick) => {
    vibrate(12)
    void send(eventId, pick, preds[eventId]?.prediction?.exactScore ?? null)
  }, [preds, send])

  // ── Pick que llega desde una noticia ───────────────────────────────────────
  // PorraMatchWidget (el picker que va dentro de los artículos) deja la
  // elección en sessionStorage y manda al usuario aquí. Solo lo recogía el
  // formulario de la quiniela retirada, así que sin esto el pick que el lector
  // acaba de tocar en la noticia se pierde en silencio y el circuito
  // artículo → predicción se rompe.
  //
  // Se aplica únicamente con sesión iniciada: si no, guardar dispararía el
  // login nada más aterrizar, que es una emboscada. La clave se limpia
  // siempre — un pick de hace días no debe revivir en otra visita.
  const pendingConsumed = useRef(false)
  useEffect(() => {
    if (pendingConsumed.current || loading || loggedIn === null) return
    let raw: string | null = null
    try { raw = sessionStorage.getItem('porra:pendingPick') } catch { return }
    if (!raw) return
    pendingConsumed.current = true
    try { sessionStorage.removeItem('porra:pendingPick') } catch { /* */ }
    if (!loggedIn) return

    try {
      const p = JSON.parse(raw) as { home?: string; away?: string; pick?: SoccerPick }
      if (!p?.home || !p?.away || !p?.pick) return
      const target = events.find(e =>
        e.status === 'open' &&
        nameMatch(e.team_home ?? '', p.home!) &&
        nameMatch(e.team_away ?? '', p.away!),
      )
      if (target && !preds[target.id]) void send(target.id, p.pick, null)
    } catch { /* pick corrupto: se descarta */ }
  }, [loading, loggedIn, events, preds, send])

  const handleExactSet = useCallback((eventId: string, exact: { home: number; away: number } | null) => {
    const currentPick = preds[eventId]?.prediction?.pick
    if (!currentPick) return
    void send(eventId, currentPick, exact)
  }, [preds, send])

  // ── Derivados ──────────────────────────────────────────────────────────────
  const now = useMemo(() => new Date(nowMs), [nowMs])

  // Las Fechas ya pasadas no se listan: la sección es "qué se juega ahora",
  // no un archivo. El historial vive en el perfil y en la Liga Taka.
  const fechas = useMemo(() => {
    const today = todayKey(now)
    return groupIntoFechas(events, now).filter(f => f.dateKey >= today)
  }, [events, now])

  const predictedIds = useMemo(() => new Set(Object.keys(preds)), [preds])

  const activeExactCount = useMemo(() => {
    const openIds = new Set(events.filter(e => e.status !== 'resolved').map(e => e.id))
    return Object.keys(preds).filter(id => openIds.has(id) && preds[id]?.prediction?.exactScore).length
  }, [events, preds])

  // El tooltip del marcador exacto se enseña una sola vez, en el primer partido
  // con pick y sin marcador.
  const tooltipEventId = useMemo<string | null>(() => {
    if (exactTipDismissed || activeExactCount > 0) return null
    for (const f of fechas) {
      for (const ev of f.events) {
        if (ev.status !== 'open') continue
        const p = preds[ev.id]?.prediction
        if (p?.pick && !p?.exactScore) return ev.id
      }
    }
    return null
  }, [fechas, preds, exactTipDismissed, activeExactCount])

  const nextFecha = fechas[0] ?? null
  const totalPts  = Object.values(preds).reduce((a, p) => a + (p.points_awarded ?? 0), 0)

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 py-12 flex justify-center">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.08)', borderTopColor: T.accent }} />
      </div>
    )
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 pb-16">
      <style>{ANIMATIONS}</style>

      {/* ═══ Hero de la Fecha ═══ */}
      <div
        className="relative rounded-2xl overflow-hidden mt-4 mb-8"
        style={{
          background: 'radial-gradient(ellipse 90% 120% at 15% 55%, #06210F 0%, #071410 45%, #050B09 100%)',
          border: `1px solid ${T.accent}1F`,
          boxShadow: `0 0 0 1px ${T.accent}0A, 0 32px 80px rgba(0,0,0,0.6)`,
        }}
      >
        <div aria-hidden style={{ position: 'absolute', top: -100, left: '10%', width: 500, height: 500, background: `radial-gradient(ellipse,${T.accent}12 0%,transparent 60%)`, pointerEvents: 'none' }} />

        <div className="relative px-6 py-7">
          <span style={{ fontSize: 9, fontWeight: 900, fontFamily: 'var(--font-sport)', color: `${T.accent}70`, textTransform: 'uppercase', letterSpacing: '0.22em' }}>
            Los partidos que importan, cada día
          </span>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(2.2rem, 5.5vw, 3.6rem)',
            fontWeight: 900, color: T.accent, letterSpacing: '-0.04em', lineHeight: 0.9,
            marginTop: 8, textShadow: `0 0 80px ${T.accent}40`,
          }}>
            LA FECHA
          </h1>

          {nextFecha ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900, color: '#F0F4F1', letterSpacing: '-0.01em', textTransform: 'capitalize' }}>
                  {nextFecha.label}
                </p>
                <p style={{ fontFamily: 'var(--font-sport)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {nextFecha.events.length} {nextFecha.events.length === 1 ? 'partido' : 'partidos'}
                  {(() => {
                    const p = fechaProgress(nextFecha, predictedIds)
                    return p.done > 0 ? ` · ${p.done}/${p.total} pronosticados` : ''
                  })()}
                </p>
              </div>

              {nextFecha.firstLockAt && (
                <div style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.28)' }}>
                  <span style={{ fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 900, color: '#FBBF24' }}>
                    <LockIcon size={10} className="inline-block align-middle mr-1" />
                    cierra en {formatCountdown(nextFecha.firstLockAt - nowMs)}
                  </span>
                </div>
              )}

              {nextFecha.featured && (
                <div style={{ padding: '6px 12px', borderRadius: 999, background: `${T.accent}14`, border: `1px solid ${T.accent}38` }}>
                  <span style={{ fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 900, color: T.accent }}>
                    <StarIcon size={10} className="inline-block align-middle mr-1" />
                    {nextFecha.featured.team_home} - {nextFecha.featured.team_away} · x2
                  </span>
                </div>
              )}

              {loggedIn && totalPts > 0 && (
                <div className="flex items-center gap-1.5">
                  <TakaPoint size={14} />
                  <span style={{ fontFamily: 'var(--font-sport)', fontSize: 12, fontWeight: 900, color: '#A78BFA' }}>{totalPts} pts</span>
                </div>
              )}
            </div>
          ) : (
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460, lineHeight: 1.5 }}>
              No hay Fecha abierta ahora mismo. Solo publicamos días con partidos que merezcan la pena —
              vuelve cuando arranquen las ligas, o prueba la cartelera de UFC.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)' }}>
          <p style={{ fontFamily: 'var(--font-sport)', fontSize: 12, color: '#FCA5A5' }}>{error}</p>
        </div>
      )}

      {loggedIn === false && fechas.length > 0 && (
        <div className="mb-6 rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: `${T.accent}0D`, border: `1px solid ${T.accent}30` }}>
          <span style={{ display: 'inline-flex', color: T.accent }}><LockIcon size={18} /></span>
          <p style={{ flex: 1, fontFamily: 'var(--font-sport)', fontSize: 12, color: 'var(--text-secondary)' }}>
            Entra con tu cuenta para guardar tus picks y competir en la Liga Taka.
          </p>
        </div>
      )}

      {/* ═══ Fechas ═══ */}
      {fechas.map((fecha, fi) => {
        const prog = fechaProgress(fecha, predictedIds)
        const complete = prog.total > 0 && prog.done === prog.total
        return (
          <section key={fecha.dateKey} className="mb-9">
            {/* Cabecera de la Fecha */}
            <div className="flex items-center gap-3 mb-4">
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 900,
                color: '#F0F4F1', letterSpacing: '-0.01em', textTransform: 'capitalize',
              }}>{fecha.label}</h2>
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
              <span style={{
                fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '3px 9px', borderRadius: 999,
                background: complete ? `${T.accent}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${complete ? `${T.accent}40` : 'rgba(255,255,255,0.08)'}`,
                color: complete ? T.accent : 'var(--text-muted)',
              }}>
                {complete ? '✓ Fecha completa' : `${prog.done}/${prog.total}`}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {fecha.events.map((ev, i) => (
                <MatchCard
                  key={ev.id}
                  event={ev}
                  pred={preds[ev.id]}
                  submitting={submitting}
                  theme={T}
                  liveScore={liveScores[ev.id]}
                  onPick={handlePick}
                  onExactSet={handleExactSet}
                  activeExactCount={activeExactCount}
                  showExactTooltip={tooltipEventId === ev.id}
                  onExactTooltipDismiss={dismissExactTip}
                  animDelay={fi === 0 ? i * 60 : 0}
                  nowMs={nowMs}
                />
              ))}
            </div>
          </section>
        )
      })}

      {fechas.length === 0 && !loading && (
        <div className="py-16 text-center">
          <p style={{ fontFamily: 'var(--font-sport)', fontSize: 13, color: 'var(--text-muted)' }}>
            Sin Fechas abiertas. Volvemos en cuanto haya fútbol que merezca destacarse.
          </p>
        </div>
      )}
    </div>
  )
}
