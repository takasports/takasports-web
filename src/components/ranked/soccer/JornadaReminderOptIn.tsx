'use client'

// ─────────────────────────────────────────────────────────────────────────────
// «Que te avisemos antes de que cierre la próxima Jornada».
//
// El cron `football-reminders` lleva funcionando cada 30 minutos desde que se
// montó la sección, agrupando avisos por día de partidos y usando el Partidazo
// como gancho. Notifica a quien tenga el topic `quiniela`… y nadie lo tiene,
// porque /predicciones no pedía el push en ningún sitio. Se pedía en el
// calendario, en los artículos y en los juegos; justo en la única sección con
// una fecha límite semanal, no.
//
// Se pide DESPUÉS de completar la Jornada, no al aterrizar. En ese momento el
// aviso es la continuación natural de lo que el usuario acaba de hacer ("ya has
// jugado esta, te aviso de la siguiente") en vez de un permiso que se pide
// antes de que la sección le haya dado nada. Un permiso denegado es
// irreversible desde la web: solo hay una oportunidad y hay que gastarla bien.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { getPushStatus, subscribeToPush, type PushStatus } from '@/lib/push-client'

/** Topic por el que filtra `football-reminders`. Si cambia allí, cambia aquí:
 *  no coincidir significa suscripciones que no reciben nada, en silencio. */
const TOPIC = 'quiniela'

export default function JornadaReminderOptIn({ accent }: { accent: string }) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSubscribed, setJustSubscribed] = useState(false)

  useEffect(() => { void getPushStatus().then(setStatus) }, [])

  // Sin soporte, sin VAPID en el deploy, o con el permiso ya denegado: no se
  // monta nada. Un botón que no puede funcionar es peor que ninguno.
  if (!status?.supported || !status.configured) return null
  if (status.permission === 'denied') return null
  // Ya suscrito de antes (p. ej. desde los juegos): no hay nada que ofrecer.
  if (status.subscribed && !justSubscribed) return null

  const handle = async () => {
    setBusy(true); setError(null)
    const res = await subscribeToPush([TOPIC])
    if (res.ok) {
      setJustSubscribed(true)
      setStatus(await getPushStatus())
    } else {
      setError(
        res.error === 'denied' ? 'Lo has bloqueado en el navegador.'
        : res.error === 'not-configured' ? 'Avisos aún no disponibles.'
        : 'No se pudo activar.',
      )
    }
    setBusy(false)
  }

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
      style={{
        borderRadius: 'var(--radius-card)',
        background: `${accent}0D`,
        border: `1px solid ${accent}2E`,
      }}
    >
      <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>{justSubscribed ? '🔔' : '⏰'}</span>
      <p style={{ flex: 1, minWidth: 200, fontFamily: 'var(--font-sport)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {justSubscribed
          ? 'Listo. Te avisamos antes de que cierre cada Jornada.'
          : <>Jornada completa. ¿Te avisamos antes de que cierre la próxima?</>}
      </p>
      {!justSubscribed && (
        <button
          type="button"
          onClick={handle}
          disabled={busy}
          style={{
            padding: '6px 14px', borderRadius: 'var(--radius-md)',
            background: accent, color: '#04140C', border: 'none',
            fontFamily: 'var(--font-sport)', fontSize: 11, fontWeight: 900,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Activando…' : 'Avísame'}
        </button>
      )}
      {error && (
        <span style={{ fontFamily: 'var(--font-sport)', fontSize: 11, color: '#FCA5A5' }}>{error}</span>
      )}
    </div>
  )
}
