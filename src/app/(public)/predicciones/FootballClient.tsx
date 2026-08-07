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
import { groupIntoFechas, fechaProgress, formatCountdown, todayKey, plenoBonus } from '@/components/ranked/soccer/fecha'
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
/* El corte diagonal del CTA solo tiene sentido cuando la franja es una BARRA
   horizontal. En móvil el botón pasa a ocupar el ancho completo debajo, y ahí
   la diagonal se comería una esquina sin significar nada. */
@media (min-width: 640px) {
  .fecha-cta { clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%); }
}
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
        // Sin sesión. Antes esto mandaba a Google directamente y el pick se
        // perdía por el camino: el usuario volvía logueado y con la Fecha en
        // blanco, teniendo que acordarse de lo que había elegido. Lo dejamos
        // en el mismo buzón que usa el picker de las noticias, así que al
        // aterrizar se aplica solo.
        const ev = events.find(e => e.id === eventId)
        if (ev) {
          try {
            sessionStorage.setItem('porra:pendingPick', JSON.stringify({
              home: ev.team_home, away: ev.team_away, pick, ts: Date.now(),
            }))
          } catch { /* sin sessionStorage: se pierde, no es crítico */ }
        }
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
  }, [submitting, load, events])

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
  // El reloj corre cada segundo para las cuentas atrás, pero el agrupado en
  // Fechas solo cambia de minuto en minuto (etiquetas "Hoy"/"Mañana" y qué
  // cierre es el próximo). Anclándolo al minuto nos ahorramos rehacer el
  // agrupado —con su formateo de fechas por partido— sesenta veces por minuto.
  const nowMinute = Math.floor(nowMs / 60_000)

  // Las Fechas ya pasadas no se listan: la sección es "qué se juega ahora",
  // no un archivo. El historial vive en el perfil y en la Liga Taka.
  const fechas = useMemo(() => {
    const at = new Date(nowMinute * 60_000)
    const today = todayKey(at)
    return groupIntoFechas(events, at).filter(f => f.dateKey >= today)
  }, [events, nowMinute])

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

      {/* ═══ Franja de emisión ═══
          Sustituye al héroe propio que tenía esta vista. La página ya abre con
          la cabecera «PREDICCIONES · La Señal»; un segundo héroe justo debajo
          hacía que todo empezara dos veces y competía con el primero. Esto es
          una barra de estado de emisión: día, cuenta atrás, premio y la acción. */}
      {nextFecha ? (
        <div
          // En móvil se apila: la barra horizontal deja de serlo y el CTA baja a
          // ancho completo. Con `flex-wrap` a secas, el botón se estiraba a lo
          // alto ocupando media pantalla y el día se partía en tres líneas.
          className="tk-glass-tint tk-glass-spine mt-4 mb-7 overflow-hidden flex flex-col sm:flex-row sm:items-stretch"
          style={{ ['--ga' as string]: T.accent, borderRadius: 'var(--radius-card)' }}
        >
          <div className="flex-1 min-w-0 flex items-center gap-4 sm:gap-5 px-4 sm:px-5 py-4 flex-wrap">
            <div className="min-w-0">
              <p className="whitespace-nowrap" style={{
                fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900,
                color: '#F4F4FA', letterSpacing: '-0.01em', lineHeight: 1, textTransform: 'capitalize',
              }}>{nextFecha.label}</p>
              <p style={{ fontFamily: 'var(--font-sport)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                {nextFecha.events.length} {nextFecha.events.length === 1 ? 'partido destacado' : 'partidos destacados'}
                {(() => {
                  const p = fechaProgress(nextFecha, predictedIds)
                  return p.done > 0 ? ` · ${p.done} de ${p.total} pronosticados` : ''
                })()}
              </p>
            </div>

            {nextFecha.firstLockAt && (
              <>
                <span aria-hidden className="self-stretch w-px my-0.5" style={{ background: 'rgba(255,255,255,0.09)' }} />
                <div className="whitespace-nowrap">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 900, color: 'var(--color-warning)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCountdown(nextFecha.firstLockAt - nowMs)}
                  </p>
                  <p style={{ fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>
                    <LockIcon size={8} className="inline-block align-middle mr-1" />cierra
                  </p>
                </div>
              </>
            )}

            {plenoBonus(nextFecha.events.length) > 0 && (
              <>
                <span aria-hidden className="self-stretch w-px my-0.5" style={{ background: 'rgba(255,255,255,0.09)' }} />
                <div className="whitespace-nowrap">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 900, color: T.accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    +{plenoBonus(nextFecha.events.length)}
                  </p>
                  <p style={{ fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>
                    pleno
                  </p>
                </div>
              </>
            )}

            {loggedIn && totalPts > 0 && (
              <>
                <span aria-hidden className="self-stretch w-px my-0.5" style={{ background: 'rgba(255,255,255,0.09)' }} />
                <div className="flex items-center gap-1.5">
                  <TakaPoint size={14} />
                  <span style={{ fontFamily: 'var(--font-sport)', fontSize: 12, fontWeight: 900, color: '#A78BFA' }}>{totalPts} pts</span>
                </div>
              </>
            )}
          </div>

          {nextFecha.featured && (
            <a
              href={`#fecha-${nextFecha.dateKey}`}
              className="fecha-cta flex items-center justify-center px-6 py-3 sm:py-0"
              style={{
                background: T.accent, color: '#04140C',
                fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 12,
                letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none',
              }}
            >
              <StarIcon size={11} className="inline-block align-middle mr-1.5" />
              {nextFecha.featured.team_home} - {nextFecha.featured.team_away}
            </a>
          )}
        </div>
      ) : (
        <div className="mt-4 mb-8 py-10 px-6 text-center" style={{
          borderRadius: 'var(--radius-card)',
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.08)',
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 900, color: '#F0F4F1', letterSpacing: '-0.01em' }}>
            Sin Fecha abierta
          </p>
          <p className="mx-auto mt-2" style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 430, lineHeight: 1.5 }}>
            Solo publicamos días con partidos que merezcan la pena. Volvemos en cuanto
            arranquen las ligas — mientras, la cartelera de UFC sí está abierta.
          </p>
        </div>
      )}

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
        const pleno = plenoBonus(fecha.events.length)
        return (
          <section key={fecha.dateKey} id={`fecha-${fecha.dateKey}`} className="mb-9 scroll-mt-24">
            {/* Cabecera de la Fecha — banderín de retransmisión (`cal-pennant`),
                la misma primitiva que separa los días en /calendario. */}
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <h2 className="cal-pennant" style={{
                fontFamily: 'var(--font-headline)', fontSize: 17,
                letterSpacing: '0.06em', lineHeight: 1, textTransform: 'uppercase',
                padding: '7px 16px 13px', background: T.accent, color: '#04140C',
              }}>{fecha.label}</h2>
              <span style={{ flex: 1, height: 1, minWidth: 20, background: 'linear-gradient(to right, rgba(255,255,255,0.14), transparent)' }} />
              {/* El pleno se anuncia ANTES de jugar: un premio que solo se
                  descubre al cobrarlo no empuja a completar la Fecha. */}
              {pleno > 0 && (
                <span
                  className="cal-live-tag"
                  title={`Acierta los ${fecha.events.length} partidos de esta Fecha y te llevas ${pleno} puntos extra`}
                  style={{
                    fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
                    letterSpacing: '0.09em', textTransform: 'uppercase', padding: '5px 11px',
                    background: 'rgba(167,139,250,0.13)',
                    border: '1px solid rgba(167,139,250,0.34)',
                    color: '#C4B5FD',
                  }}
                >
                  Pleno +{pleno}
                </span>
              )}
              <span className="cal-live-tag" style={{
                fontFamily: 'var(--font-sport)', fontSize: 10, fontWeight: 900,
                letterSpacing: '0.09em', textTransform: 'uppercase', padding: '5px 11px',
                background: complete ? `${T.accent}1F` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${complete ? `${T.accent}55` : 'rgba(255,255,255,0.09)'}`,
                color: complete ? T.accent : 'var(--text-muted)',
              }}>
                {complete ? '✓ Fecha completa' : `${prog.done} / ${prog.total}`}
              </span>
            </div>

            {/* Dos columnas en escritorio: el arte del torneo respira y la Fecha
                entera se ve de un vistazo, que es lo que empuja a completarla.
                El Partido del Día ocupa el ancho completo por jerarquía. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* El Partido del Día ABRE la Fecha. Por hora de saque puede caer
                  en mitad de la lista, y una tarjeta a doble ancho encajada
                  entre dos filas de la rejilla parece un fallo de maquetación,
                  no una jerarquía. El resto sigue en orden cronológico. */}
              {[...fecha.events]
                .sort((a, b) =>
                  (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
                  a.event_date.localeCompare(b.event_date),
                )
                .map((ev, i) => (
                <div key={ev.id} className={ev.featured ? 'lg:col-span-2' : undefined}>
                  <MatchCard
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
                </div>
              ))}
            </div>
          </section>
        )
      })}

    </div>
  )
}
