'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Ranked Fútbol — la vista de JORNADAS.
//
// La unidad de juego es la SEMANA (lun-dom): cada Jornada trae 7-9 partidos
// destacados y UN Partidazo que vale x2. La selección la hace el servidor
// (cron sync-football); aquí solo se agrupa por `meta.week_key` —nunca se
// recalcula— y se pinta, con sub-cabeceras por día dentro de cada Jornada.
//
// Dos reglas de encuadre, porque esta vista llegó a mostrar diecinueve
// tarjetas de golpe repartidas en tres "Jornadas":
//   · Se pintan como mucho DOS Jornadas: la de ahora y la siguiente. Lo que
//     venga después no se puede pronosticar mejor por verlo con dos semanas de
//     antelación, solo alarga la página.
//   · Dentro de cada Jornada, lo cerrado no compite con lo abierto: los
//     partidos que ya no admiten pick bajan a un bloque plegado al final. A
//     mitad de semana son la mayoría, y mezclados hacían que la pantalla fuera
//     larguísima sin que se distinguiera dónde quedaba algo por hacer.
//
// Y se puede jugar SIN CUENTA: los picks de invitado viven en localStorage
// (components/ranked/soccer/guest-picks) con la misma forma que los del
// servidor, así que la UI no distingue. Al entrar se suben solos. Ver `send`.
//
// Comparte componentes con el archivo del Mundial vía components/ranked/soccer.
// El cliente del Mundial todavía tiene los suyos propios: se unifica cuando ese
// archivo se retire (no se refactoriza un producto congelado mientras se
// construye el nuevo).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import MatchCard from '@/components/ranked/soccer/MatchCard'
import JornadaReminderOptIn from '@/components/ranked/soccer/JornadaReminderOptIn'
import GuestSaveBar from '@/components/ranked/soccer/GuestSaveBar'
import JornadaLeaderboard from '@/components/ranked/soccer/JornadaLeaderboard'
import type { Consensus } from '@/components/ranked/soccer/ConsensusBar'
import {
  readGuestPicks, saveGuestPick, clearGuestPicks, pruneGuestPicks, toPredMap,
} from '@/components/ranked/soccer/guest-picks'
import { groupIntoJornadas, jornadaProgress, formatCountdown, thisWeekKey, plenoBonus, weekKeyOf, jornadaStreak, jornadaComplete, hasCaptain } from '@/components/ranked/soccer/jornada'
import {
  FOOTBALL_THEME, SOCCER_POINTS,
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

/** Cuántas Jornadas se pintan a la vez: la de ahora y la siguiente. */
const MAX_VISIBLE_JORNADAS = 2

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

// ─────────────────────────────────────────────────────────────────────────────
// Cómo se puntúa, escrito. Estaba en ninguna parte: ni aquí ni en el hub había
// una sola línea que dijera cuánto vale acertar, y las tarjetas solo enseñan
// el premio del partido que estás mirando. Sin esto, la sección pide
// pronósticos sin decir a cambio de qué, que es lo que la hacía ilegible.
//
// Los números salen de SOCCER_POINTS (espejo de la migración 128) para que
// este cartel no pueda prometer un reparto distinto del que hace el servidor.
// ─────────────────────────────────────────────────────────────────────────────
function ScoringStrip({ pleno, matches }: { pleno: number; matches: number }) {
  const rules: { pts: string; label: string; hint?: string }[] = [
    { pts: `${SOCCER_POINTS.TENDENCY}`, label: 'acertar 1 · X · 2' },
    { pts: `×${SOCCER_POINTS.CAPTAIN_MULTIPLIER}`, label: 'tu capitán', hint: 'el partido que elijas, uno por Jornada' },
    { pts: `${SOCCER_POINTS.EXACT}`, label: 'clavar el marcador', hint: 'o 0 — sustituye a tu pick' },
    ...(pleno > 0 ? [{ pts: `+${pleno}`, label: 'pleno de la Jornada', hint: `o +${plenoBonus(matches, 1)} fallando uno` }] : []),
  ]

  return (
    <div
      className="mb-7 flex flex-wrap items-stretch gap-x-6 gap-y-3 px-4 sm:px-5 py-3"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 900,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--text-muted)', alignSelf: 'center',
      }}>Cómo se puntúa</span>
      {rules.map(r => (
        <div key={r.label} className="min-w-0">
          <p style={{ fontFamily: 'var(--font-sport)', fontSize: 12, lineHeight: 1.3, color: 'var(--text-secondary)' }}>
            <strong style={{
              fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 900,
              color: T.accent, marginRight: 6,
            }}>{r.pts}</strong>
            {r.label}
          </p>
          {r.hint && (
            <p style={{
              fontFamily: 'var(--font-sport)', fontSize: 10, lineHeight: 1.3,
              color: 'var(--text-muted)', marginTop: 1,
            }}>{r.hint}</p>
          )}
        </div>
      ))}
    </div>
  )
}

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
  // Arranca en 0, NO en `Date.now()`: leer el reloj en el primer render hace
  // que servidor y navegador discrepen. Hoy no se nota porque la Jornada llega
  // por fetch y en SSR solo hay esqueleto —nada de esto se pinta—, pero el día
  // que estos datos se sirvan desde el servidor sería un fallo de hidratación
  // (#418) que tira la página entera. El efecto de abajo lo pone en hora al
  // montar y el tick de 1s lo mantiene.
  const [nowMs,      setNowMs]      = useState(0)
  // Hay picks de invitado guardados. Solo dice SI hay (para decidir si se
  // monta la barra y si toca subirlos); cuántos son se cuenta abajo, contra
  // los partidos que se pueden jugar ahora.
  const [hasGuestPicks, setHasGuestPicks] = useState(false)
  const [signingIn,  setSigningIn]  = useState(false)
  const [consensus,  setConsensus]  = useState<Record<string, Consensus>>({})
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
    const evs   = evData.events ?? []
    const authed = predData.reason !== 'no_session'
    setEvents(evs)
    setLoggedIn(authed)

    if (authed) {
      setPreds(predData.predictions ?? {})
      setHasGuestPicks(false)
      return
    }
    // Sin sesión, los picks los pone el almacén local. Se podan contra los
    // partidos de la Jornada actual: si no, el almacén acumula partidos de
    // hace meses y la barra de invitado cuenta picks que ya no existen.
    const guest = pruneGuestPicks(new Set(evs.map(e => e.id)))
    setPreds(toPredMap(guest))
    setHasGuestPicks(Object.keys(guest).length > 0)
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { await fetchCore() }
    catch { setError('No se pudieron cargar las Jornadas. Inténtalo de nuevo.') }
    finally { setLoading(false) }
  }, [fetchCore])

  useEffect(() => { void load() }, [load])

  // Un solo reloj para toda la vista: si cada tarjeta llevara el suyo, las
  // cuentas atrás se irían desincronizando entre sí.
  useEffect(() => {
    // En hora YA al montar: si esperásemos al primer tick, la cuenta atrás
    // pasaría un segundo entero con el valor inicial.
    setNowMs(Date.now())
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
    captain?: boolean,
  ) => {
    if (submitting) return

    // ── Invitado: se juega en local y no se molesta a nadie ─────────────────
    // Antes esto iba al servidor, volvía 401 y disparaba Google en el acto: la
    // cuenta se pedía en el primer toque, antes de que la sección hubiera dado
    // nada a cambio. Ahora el pick se guarda aquí y la cuenta se ofrece en la
    // barra de abajo, por lo que da.
    if (loggedIn === false) {
      saveGuestPick(eventId, pick, exactScore, captain)
      const guest = readGuestPicks()
      setPreds(toPredMap(guest))
      setHasGuestPicks(Object.keys(guest).length > 0)
      return
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { event_id: eventId, pick }
      if (exactScore) body.exactScore = exactScore
      if (captain !== undefined) body.captain = captain
      const res = await fetch('/api/ranked/predictions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) {
        // Creíamos tener sesión y no la hay (caducó entre medias). No se
        // arrastra al usuario a Google en mitad de la Jornada: el pick se
        // guarda como invitado y la barra de abajo le ofrece volver a entrar.
        saveGuestPick(eventId, pick, exactScore, captain)
        setLoggedIn(false)
        const guest = readGuestPicks()
        setPreds(toPredMap(guest))
        setHasGuestPicks(Object.keys(guest).length > 0)
        return
      }
      // 409 = el partido ya no admite pick (cerrado o dentro de la hora de
      // bloqueo). Ya no hay cupo de marcadores exactos que agotar, así que
      // cualquier 409 significa "se te pasó el plazo": se recarga para que la
      // tarjeta pase a su estado real en vez de dejar un botón que no responde.
      if (res.status === 409) { await load(); return }
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
  }, [submitting, load, loggedIn])

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
  // Ya no hace falta tener sesión: `send` sabe guardarlo como invitado, que es
  // justo lo que quiere alguien que viene de un artículo y aún no tiene cuenta.
  // Antes se descartaba en ese caso, porque aplicarlo habría disparado el login
  // nada más aterrizar. La clave se limpia siempre — un pick de hace días no
  // debe revivir en otra visita.
  const pendingConsumed = useRef(false)
  useEffect(() => {
    if (pendingConsumed.current || loading || loggedIn === null) return
    let raw: string | null = null
    try { raw = sessionStorage.getItem('porra:pendingPick') } catch { return }
    if (!raw) return
    pendingConsumed.current = true
    try { sessionStorage.removeItem('porra:pendingPick') } catch { /* */ }

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

  // ── Entrar llevándose lo jugado ────────────────────────────────────────────
  // El pick ya está en localStorage antes de salir hacia Google, así que da
  // igual cuánto tarde el rodeo del OAuth o si el usuario se arrepiente a medias:
  // al volver sigue ahí. La subida la hace el efecto de abajo.
  const handleSignIn = useCallback(async () => {
    if (signingIn) return
    setSigningIn(true)
    const sb = createClient()
    if (!sb) { setSigningIn(false); setError('Login no disponible ahora mismo.'); return }
    try {
      await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/predicciones` },
      })
    } catch {
      setSigningIn(false)
      setError('No se pudo abrir el login.')
    }
  }, [signingIn])

  // ── Subir los picks de invitado en cuanto hay sesión ───────────────────────
  // Se suben de uno en uno porque la API es por evento. Los que ya no admiten
  // pick (se cerraron mientras el usuario se registraba) devuelven 409 y se
  // descartan sin ruido: no se puede hacer nada con ellos y avisar solo sería
  // estropear el momento de haber entrado.
  const syncing = useRef(false)
  useEffect(() => {
    if (!loggedIn || loading || syncing.current) return
    const guest = readGuestPicks()
    const ids = Object.keys(guest)
    if (ids.length === 0) return
    syncing.current = true

    void (async () => {
      let subidos = 0
      let falloDeRed = false
      for (const eventId of ids) {
        const g = guest[eventId]
        if (!g?.pick) continue
        try {
          const body: Record<string, unknown> = { event_id: eventId, pick: g.pick }
          if (g.exactScore) body.exactScore = g.exactScore
          const r = await fetch('/api/ranked/predictions', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (r.ok) subidos++
        } catch {
          // Solo la red merece reintento. Un rechazo del servidor (el partido
          // se cerró mientras se registraba) es definitivo.
          falloDeRed = true
        }
      }
      // Se conserva el almacén únicamente si algo se quedó sin intentar por
      // red; si no, se limpia aunque no subiera nada — reintentar en cada carga
      // unos picks que el servidor ya rechazó no los va a aceptar nunca.
      if (!falloDeRed) {
        clearGuestPicks()
        setHasGuestPicks(false)
      }
      if (subidos > 0) {
        await load()
        try { window.dispatchEvent(new Event('taka:badge-check')) } catch { /* */ }
      }
      syncing.current = false
    })()
  }, [loggedIn, loading, load])

  const handleExactSet = useCallback((eventId: string, exact: { home: number; away: number } | null) => {
    const currentPick = preds[eventId]?.prediction?.pick
    if (!currentPick) return
    void send(eventId, currentPick, exact)
  }, [preds, send])

  // ── Capitán ────────────────────────────────────────────────────────────────
  // Solo hay uno por Jornada, así que marcar este implica quitárselo al que lo
  // tuviera. Se refleja aquí mismo en vez de esperar a que vuelva el servidor:
  // si no, durante el viaje se verían dos capitanes a la vez y el usuario
  // volvería a tocar. Quien manda sigue siendo el servidor —lo hace también en
  // su lado, por si hay dos pestañas abiertas—; esto es solo no mentir mientras.
  const handleCaptain = useCallback((eventId: string, captain: boolean) => {
    const currentPick = preds[eventId]?.prediction?.pick
    if (!currentPick) return
    const suSemana = weekKeyOf(events.find(e => e.id === eventId) ?? { event_date: '' } as SoccerEvent)
    const deLaSemana = new Set(events.filter(e => weekKeyOf(e) === suSemana).map(e => e.id))

    setPreds(prev => {
      const next: PredMap = {}
      for (const [id, row] of Object.entries(prev)) {
        const esOtroDeLaSemana = id !== eventId && deLaSemana.has(id)
        const debeSer = id === eventId ? captain : (esOtroDeLaSemana ? false : row.prediction.captain === true)
        const pred = { ...row.prediction }
        if (debeSer) pred.captain = true; else delete pred.captain
        next[id] = { ...row, prediction: pred }
      }
      return next
    })
    void send(eventId, currentPick, preds[eventId]?.prediction?.exactScore ?? null, captain)
  }, [preds, send, events])

  // ── Derivados ──────────────────────────────────────────────────────────────
  // El reloj corre cada segundo para las cuentas atrás, pero el agrupado en
  // Jornadas solo cambia de minuto en minuto (etiquetas "Hoy"/"Mañana" en las
  // sub-cabeceras de día y qué cierre es el próximo). Anclándolo al minuto nos
  // ahorramos rehacer el agrupado sesenta veces por minuto.
  const nowMinute = Math.floor(nowMs / 60_000)

  // Las Jornadas de semanas ya pasadas no se listan: la sección es "qué se
  // juega ahora", no un archivo. El historial vive en el perfil y en la Liga
  // Taka. Y del futuro, solo la siguiente — ver la cabecera del archivo.
  const jornadas = useMemo(() => {
    const at = new Date(nowMinute * 60_000)
    const week = thisWeekKey(at)
    return groupIntoJornadas(events, at)
      .filter(j => j.weekKey >= week)
      .slice(0, MAX_VISIBLE_JORNADAS)
  }, [events, nowMinute])

  const predictedIds = useMemo(() => new Set(Object.keys(preds)), [preds])

  // ── Consenso de la comunidad ───────────────────────────────────────────────
  // Se pide por Jornada visible, no por partido. La tarjeta solo lo enseña en
  // los que el usuario ya ha pronosticado; traerlo entero de una vez evita
  // nueve peticiones y que el reparto aparezca a trozos.
  const semanasVisibles = useMemo(
    () => jornadas.map(j => j.weekKey).join(','),
    [jornadas],
  )
  useEffect(() => {
    if (!semanasVisibles) return
    let cancelado = false
    void (async () => {
      const partes = await Promise.all(
        semanasVisibles.split(',').map(async wk => {
          try {
            const r = await fetch(`/api/ranked/consensus?week=${encodeURIComponent(wk)}`)
            if (!r.ok) return {}
            const d = await r.json() as { consensus?: Record<string, Consensus> }
            return d.consensus ?? {}
          } catch { return {} }
        }),
      )
      if (!cancelado) setConsensus(Object.assign({}, ...partes))
    })()
    return () => { cancelado = true }
  }, [semanasVisibles])

  // Jornadas seguidas jugadas. Solo con sesión: la de un invitado se evaporaría
  // al cambiar de navegador, y una racha que se pierde sola no motiva, irrita.
  const racha = useMemo(
    () => (loggedIn ? jornadaStreak(events, predictedIds) : 0),
    [loggedIn, events, predictedIds],
  )

  // Lo que el usuario puede pronosticar AHORA MISMO en esta pantalla: los
  // partidos abiertos de todas las Jornadas visibles. Es el universo del que
  // habla la barra de invitado — contar sus picks sobre una Jornada y el total
  // sobre otra daba cosas como "16 de 7".
  const pendingIds = useMemo(
    () => new Set(jornadas.flatMap(j => j.pending.map(e => e.id))),
    [jornadas],
  )

  // ¿Ya ha apostado alguna vez al marcador? Se mira sobre lo que tiene vivo:
  // si tiene una apuesta en curso, ya conoce la mecánica y el consejo sobra.
  const hasActiveExact = useMemo(() => {
    const liveIds = new Set(events.filter(e => e.status !== 'resolved').map(e => e.id))
    return Object.keys(preds).some(id => liveIds.has(id) && preds[id]?.prediction?.exactScore)
  }, [events, preds])

  // El consejo del marcador exacto se enseña una sola vez, en el primer partido
  // pronosticado que aún se pueda apostar.
  const tooltipEventId = useMemo<string | null>(() => {
    if (exactTipDismissed || hasActiveExact) return null
    for (const j of jornadas) {
      for (const ev of j.pending) {
        const p = preds[ev.id]?.prediction
        if (p?.pick && !p?.exactScore) return ev.id
      }
    }
    return null
  }, [jornadas, preds, exactTipDismissed, hasActiveExact])

  // La barra de arriba es "qué puedes hacer ahora", así que apunta a la primera
  // Jornada con partidos abiertos. Si la de esta semana ya está entera cerrada,
  // el usuario tiene que ver la siguiente y su cuenta atrás, no una cabecera sin
  // deadline sobre partidos que ya se jugaron.
  const nextJornada = jornadas.find(j => j.pending.length > 0) ?? jornadas[0] ?? null

  // La Jornada abierta sigue en blanco y hay racha que perder.
  const rachaEnRiesgo = racha >= 2
    && !!nextJornada
    && nextJornada.pending.length > 0
    && nextJornada.pending.every(e => !predictedIds.has(e.id))

  // ── Tu Jornada, mientras se juega ──────────────────────────────────────────
  // El sondeo de directo ya existía y cada tarjeta sabía si su pick seguía
  // vivo, pero en ninguna parte se decía "vas 4 de 7". El domingo por la tarde
  // es cuando la gente volvería, y no había nada que mirar de un vistazo.
  //
  // Cuenta los resueltos por su resultado y los que se están jugando por cómo
  // van AHORA. Es provisional a propósito: un partido empatando a falta de diez
  // minutos vale tanto como un motivo para no soltar el móvil.
  const jornadaEnVivo = useMemo(() => {
    if (!nextJornada || nextJornada.pending.length > 0) return null
    let aciertos = 0, jugados = 0, puntos = 0, enJuego = 0
    for (const ev of nextJornada.events) {
      const pred = preds[ev.id]?.prediction
      if (!pred) continue
      const live = liveScores[ev.id]
      const resuelto = ev.status === 'resolved' ? ev.result?.winner ?? null : null
      const enVivo = live && live.home != null && live.away != null
        ? (live.home > live.away ? '1' : live.away > live.home ? '2' : 'X') as SoccerPick
        : null
      const tendencia = resuelto ?? enVivo
      if (!tendencia) continue
      jugados++
      if (!resuelto) enJuego++
      if (pred.pick !== tendencia) continue
      aciertos++
      const exacto = pred.exactScore
      const goles = resuelto
        ? { home: ev.result?.home_score, away: ev.result?.away_score }
        : { home: live?.home, away: live?.away }
      const clavado = !!exacto && exacto.home === goles.home && exacto.away === goles.away
      const base = exacto ? (clavado ? SOCCER_POINTS.EXACT : 0) : SOCCER_POINTS.TENDENCY
      puntos += pred.captain ? base * SOCCER_POINTS.CAPTAIN_MULTIPLIER : base
    }
    return jugados > 0 ? { aciertos, jugados, puntos, enJuego } : null
  }, [nextJornada, preds, liveScores])
  const totalPts    = Object.values(preds).reduce((a, p) => a + (p.points_awarded ?? 0), 0)

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
          una barra de estado de emisión: semana, cuenta atrás, premio y la acción. */}
      {nextJornada ? (
        <div
          // En móvil se apila: la barra horizontal deja de serlo y el CTA baja a
          // ancho completo. Con `flex-wrap` a secas, el botón se estiraba a lo
          // alto ocupando media pantalla y la etiqueta se partía en tres líneas.
          className="tk-glass-tint tk-glass-spine mt-4 mb-7 overflow-hidden flex flex-col sm:flex-row sm:items-stretch"
          style={{ ['--ga' as string]: T.accent, borderRadius: 'var(--radius-card)' }}
        >
          <div className="flex-1 min-w-0 flex items-center gap-4 sm:gap-5 px-4 sm:px-5 py-4 flex-wrap">
            <div className="min-w-0">
              <p className="whitespace-nowrap" style={{
                fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900,
                color: '#F4F4FA', letterSpacing: '-0.01em', lineHeight: 1, textTransform: 'capitalize',
              }}>{nextJornada.label}</p>
              <p style={{ fontFamily: 'var(--font-sport)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                {nextJornada.events.length} {nextJornada.events.length === 1 ? 'partido destacado' : 'partidos destacados'}
                {(() => {
                  const p = jornadaProgress(nextJornada, predictedIds)
                  const abiertos = nextJornada.pending.length
                  // El "abiertos" solo se dice cuando difiere del total: a
                  // mitad de semana es la diferencia entre "me faltan 3" y "me
                  // quedan 3 que todavía puedo jugar".
                  const cola = abiertos > 0 && abiertos < nextJornada.events.length
                    ? ` · ${abiertos} aún abierto${abiertos === 1 ? '' : 's'}`
                    : ''
                  return `${p.done > 0 ? ` · ${p.done} de ${p.total} pronosticados` : ''}${cola}`
                })()}
              </p>
            </div>

            {jornadaEnVivo && (
              <>
                <span aria-hidden className="self-stretch w-px my-0.5" style={{ background: 'rgba(255,255,255,0.09)' }} />
                <div className="whitespace-nowrap">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 900, color: T.accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {jornadaEnVivo.aciertos} de {jornadaEnVivo.jugados}
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>
                      +{jornadaEnVivo.puntos} pts
                    </span>
                  </p>
                  <p style={{ fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>
                    {jornadaEnVivo.enJuego > 0 ? 'tu jornada · en juego' : 'tu jornada'}
                  </p>
                </div>
              </>
            )}

            {nextJornada.firstLockAt && (
              <>
                <span aria-hidden className="self-stretch w-px my-0.5" style={{ background: 'rgba(255,255,255,0.09)' }} />
                <div className="whitespace-nowrap">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 900, color: 'var(--color-warning)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCountdown(nextJornada.firstLockAt - nowMs)}
                  </p>
                  <p style={{ fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>
                    <LockIcon size={8} className="inline-block align-middle mr-1" />cierra la jornada
                  </p>
                </div>
              </>
            )}

            {plenoBonus(nextJornada.events.length) > 0 && (
              <>
                <span aria-hidden className="self-stretch w-px my-0.5" style={{ background: 'rgba(255,255,255,0.09)' }} />
                <div className="whitespace-nowrap">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 900, color: T.accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    +{plenoBonus(nextJornada.events.length)}
                  </p>
                  <p style={{ fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>
                    pleno
                  </p>
                </div>
              </>
            )}

            {racha >= 2 && (
              <>
                <span aria-hidden className="self-stretch w-px my-0.5" style={{ background: 'rgba(255,255,255,0.09)' }} />
                <div className="whitespace-nowrap" title="Jornadas seguidas en las que has jugado. Una semana sin Jornada no la rompe.">
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 900, color: 'var(--color-warning)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    🔥 {racha}
                  </p>
                  {/* Una racha solo motiva cuando está en juego: mientras la
                      Jornada siga abierta y no haya tocado nada, se le dice. */}
                  <p style={{
                    fontFamily: 'var(--font-sport)', fontSize: 9, fontWeight: 800,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: rachaEnRiesgo ? 'var(--color-warning)' : 'var(--text-muted)', marginTop: 2,
                  }}>
                    {rachaEnRiesgo ? 'no la rompas' : 'seguidas'}
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

          {nextJornada.featured && nextJornada.featuredPlayable && (
            <a
              href={`#jornada-${nextJornada.weekKey}`}
              className="fecha-cta flex items-center justify-center px-6 py-3 sm:py-0"
              style={{
                background: T.accent, color: '#04140C',
                fontFamily: 'var(--font-sport)', fontWeight: 900, fontSize: 12,
                letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none',
              }}
            >
              <StarIcon size={11} className="inline-block align-middle mr-1.5" />
              {nextJornada.featured.team_home} - {nextJornada.featured.team_away}
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
            Sin Jornada abierta
          </p>
          <p className="mx-auto mt-2" style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 430, lineHeight: 1.5 }}>
            Solo publicamos semanas con partidos que merezcan la pena. Volvemos en
            cuanto arranquen las ligas — mientras, la cartelera de UFC sí está abierta.
          </p>
        </div>
      )}

      {nextJornada && (
        <ScoringStrip
          pleno={plenoBonus(nextJornada.events.length)}
          matches={nextJornada.events.length}
        />
      )}

      {error && (
        <div className="mb-6 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)' }}>
          <p style={{ fontFamily: 'var(--font-sport)', fontSize: 12, color: '#FCA5A5' }}>{error}</p>
        </div>
      )}

      {/* Antes del primer pick: se invita, no se exige — se puede jugar sin
          cuenta. A partir del primer pick manda GuestSaveBar, que además dice
          cuántos lleva y dónde están guardados. */}
      {loggedIn === false && !hasGuestPicks && jornadas.length > 0 && (
        <div className="mb-6 rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: `${T.accent}0D`, border: `1px solid ${T.accent}30` }}>
          <span style={{ display: 'inline-flex', color: T.accent }}><LockIcon size={18} /></span>
          <p style={{ flex: 1, fontFamily: 'var(--font-sport)', fontSize: 12, color: 'var(--text-secondary)' }}>
            Puedes pronosticar sin cuenta. Entra cuando quieras guardarlo y competir en la Liga Taka.
          </p>
        </div>
      )}

      {/* ═══ Jornadas ═══ */}
      {jornadas.map((jornada, ji) => {
        const prog = jornadaProgress(jornada, predictedIds)
        const complete = jornadaComplete(jornada, preds)
        // Todo pickeado y sin capitán: el único caso en que la Jornada NO está
        // completa aunque no falte ningún pronóstico. Se dice explícitamente
        // porque es valor esperado que el usuario se estaba dejando en silencio.
        const faltaCapitan = prog.total > 0
          && prog.done === prog.total
          && jornada.pending.length > 0
          && !hasCaptain(jornada, preds)
        const pleno = plenoBonus(jornada.events.length)
        return (
          <section key={jornada.weekKey} id={`jornada-${jornada.weekKey}`} className="mb-10 scroll-mt-24">
            {/* Cabecera de la Jornada — banderín de retransmisión (`cal-pennant`),
                la misma primitiva que separa los días en /calendario. */}
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <h2 className="cal-pennant" style={{
                fontFamily: 'var(--font-headline)', fontSize: 17,
                letterSpacing: '0.06em', lineHeight: 1, textTransform: 'uppercase',
                padding: '7px 16px 13px', background: T.accent, color: '#04140C',
              }}>{jornada.label}</h2>
              <span style={{ flex: 1, height: 1, minWidth: 20, background: 'linear-gradient(to right, rgba(255,255,255,0.14), transparent)' }} />
              {/* El pleno se anuncia ANTES de jugar: un premio que solo se
                  descubre al cobrarlo no empuja a completar la Jornada. */}
              {pleno > 0 && (
                <span
                  className="cal-live-tag"
                  title={`Acierta los ${jornada.events.length} partidos y te llevas ${pleno} puntos extra. Fallando uno, +${plenoBonus(jornada.events.length, 1)}; fallando dos, +${plenoBonus(jornada.events.length, 2)}.`}
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
                background: complete ? `${T.accent}1F` : faltaCapitan ? 'rgba(251,191,36,0.13)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${complete ? `${T.accent}55` : faltaCapitan ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.09)'}`,
                color: complete ? T.accent : faltaCapitan ? 'var(--color-warning)' : 'var(--text-muted)',
              }}>
                {complete ? '✓ Jornada completa'
                  : faltaCapitan ? 'Falta tu capitán'
                  : `${prog.done} / ${prog.total}`}
              </span>
            </div>

            {/* Dónde está ese capitán que falta. La chapa de arriba avisa, pero
                el botón vive dentro de las tarjetas y hay nueve iguales: sin
                esta línea el aviso es un reproche sin instrucciones. */}
            {faltaCapitan && (
              <div
                className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
                style={{
                  borderRadius: 'var(--radius-card)',
                  background: 'rgba(251,191,36,0.07)',
                  border: '1px solid rgba(251,191,36,0.28)',
                }}
              >
                <span aria-hidden style={{ display: 'inline-flex', color: 'var(--color-warning)' }}>
                  <StarIcon size={14} />
                </span>
                <p style={{ fontFamily: 'var(--font-sport)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong style={{ color: '#F4F4FA' }}>Te falta elegir capitán.</strong>{' '}
                  Toca «Hacer capitán» en el partido que quieras doblar — es gratis y solo puedes poner uno.
                </p>
              </div>
            )}

            {/* El Partidazo ABRE la Jornada, a ancho completo, con independencia
                del día en que caiga: en una semana puede ser el partido del
                martes y no tendría jerarquía si esperara su turno cronológico
                entre el resto. El resto de la Jornada va debajo, agrupado por
                día — el ritual diario sigue existiendo dentro de la semana. */}
            {/* El momento de pedir el push: justo después de completar la
                Jornada, no al aterrizar. Ver JornadaReminderOptIn. */}
            {loggedIn && complete && <JornadaReminderOptIn accent={T.accent} />}

            {jornada.featured && jornada.featuredPlayable && (
              <div className="mb-3">
                <MatchCard
                  event={jornada.featured}
                  pred={preds[jornada.featured.id]}
                  submitting={submitting}
                  theme={T}
                  liveScore={liveScores[jornada.featured.id]}
                  onPick={handlePick}
                  onExactSet={handleExactSet}
                  onCaptain={handleCaptain}
                  showExactTooltip={tooltipEventId === jornada.featured.id}
                  onExactTooltipDismiss={dismissExactTip}
                  animDelay={0}
                  nowMs={nowMs}
                  deadlineMs={jornada.firstLockAt}
                  consensus={consensus[jornada.featured.id]}
                />
              </div>
            )}

            {jornada.days.map(day => {
              const rest = jornada.featuredPlayable
                ? day.events.filter(e => e.id !== jornada.featured?.id)
                : day.events
              if (rest.length === 0) return null
              return (
                <div key={day.dateKey} className="mb-3">
                  <p style={{
                    fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 800,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 2,
                  }}>{day.label}</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {rest.map((ev, i) => (
                      <MatchCard
                        key={ev.id}
                        event={ev}
                        pred={preds[ev.id]}
                        submitting={submitting}
                        theme={T}
                        liveScore={liveScores[ev.id]}
                        onPick={handlePick}
                        onExactSet={handleExactSet}
                      onCaptain={handleCaptain}
                        showExactTooltip={tooltipEventId === ev.id}
                        onExactTooltipDismiss={dismissExactTip}
                        animDelay={ji === 0 ? i * 60 : 0}
                        nowMs={nowMs}
                  deadlineMs={jornada.firstLockAt}
                  consensus={consensus[ev.id]}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Los que ya no admiten pick. Plegados por defecto: a mitad de
                semana son la mayoría de la Jornada, y en abierto empujaban lo
                jugable fuera de pantalla. Se abre solo cuando ya no queda nada
                abierto —entonces el bloque ES la Jornada y esconderlo dejaría
                la sección en blanco—. */}
            {jornada.settled.length > 0 && (
              <details open={jornada.pending.length === 0} className="mt-1">
                <summary style={{
                  cursor: 'pointer', listStyle: 'none',
                  fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 800,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--text-muted)', padding: '8px 2px',
                }}>
                  Ya cerrados · {jornada.settled.length}
                  {(() => {
                    const sinPick = jornada.settled.filter(e => !predictedIds.has(e.id)).length
                    return sinPick > 0 ? ` (${sinPick} sin pronosticar)` : ''
                  })()}
                </summary>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-2">
                  {jornada.settled.map(ev => (
                    <MatchCard
                      key={ev.id}
                      event={ev}
                      pred={preds[ev.id]}
                      submitting={submitting}
                      theme={T}
                      liveScore={liveScores[ev.id]}
                      onPick={handlePick}
                      onExactSet={handleExactSet}
                      onCaptain={handleCaptain}
                      animDelay={0}
                      nowMs={nowMs}
                  deadlineMs={jornada.firstLockAt}
                  consensus={consensus[ev.id]}
                    />
                  ))}
                </div>
              </details>
            )}

            {/* Quién va ganando ESTA semana. Solo con la Jornada ya cerrada:
                con todo por jugar sería una lista de ceros. */}
            {jornada.pending.length === 0 && (
              <JornadaLeaderboard weekKey={jornada.weekKey} accent={T.accent} />
            )}
          </section>
        )
      })}

      {loggedIn === false && (
        <GuestSaveBar
          // Ambos números sobre lo MISMO: los partidos abiertos que hay en
          // pantalla. La cabecera de cada Jornada cuenta sus 11 porque ese es
          // el universo del Pleno; aquí se está diciendo "lo que llevas hecho",
          // y los ya cerrados no se pueden hacer.
          picks={[...pendingIds].filter(id => predictedIds.has(id)).length}
          total={pendingIds.size}
          complete={jornadas.every(j => j.pending.length === 0 || jornadaComplete(j, preds))}
          accent={T.accent}
          busy={signingIn}
          onSignIn={handleSignIn}
        />
      )}
    </div>
  )
}
