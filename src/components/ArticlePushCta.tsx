'use client'

// Avisos por Web Push al final de un artículo.
//
// Por qué aquí: la infraestructura de Web Push llevaba montada desde hace
// meses y solo se ofrecía dentro de /juegos, así que los lectores que llegan a
// una noticia —que son la mayoría del tráfico— no veían nunca la opción.
// Resultado medido el 13/08/2026: 0 suscripciones push y 2 de newsletter con
// ~2.470 visitas al mes desde búsqueda. Pedir un correo tiene mucha fricción
// para quien acaba de aterrizar; un clic, no.
//
// El aviso se ata al DEPORTE del artículo (no a "TakaSports" en general)
// porque es lo que el lector acaba de demostrar que le interesa, y así el
// envío puede segmentarse después sin volver a pedir permiso.
//
// Si el navegador no soporta push o el deploy no tiene claves VAPID, no se
// pinta nada: un bloque muerto al final del artículo es peor que ninguno.

import { useEffect, useState } from 'react'
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from '@/lib/push-client'
import { trackPushSubscribe, trackPushUnsubscribe } from '@/lib/analytics'

interface Props {
  /** Slug del deporte del artículo: 'futbol', 'nba'… Segmenta el topic. */
  sport?: string
  /** Etiqueta legible del deporte, para el copy. */
  sportLabel?: string
  /** Color de acento del deporte, el mismo que usa la ficha. */
  accent?: string
}

export default function ArticlePushCta({
  sport,
  sportLabel,
  accent = '#7C3AED',
}: Props) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { void getPushStatus().then(setStatus) }, [])

  // Sin soporte del navegador o sin VAPID en el servidor → no se monta nada.
  if (!status || !status.supported || !status.configured) return null
  // Permiso ya denegado en el navegador: tampoco. Se veía en la captura del
  // componente real —un botón «Bloqueado» inerte al final de cada artículo—, y
  // desde aquí no hay forma de revertirlo: hay que ir a los ajustes del
  // navegador. Ofrecer algo que no se puede aceptar es peor que no ofrecerlo.
  if (status.permission === 'denied') return null

  const subscribed = status.subscribed
  const tema = sportLabel ? sportLabel.toLowerCase() : 'deporte'

  const handleClick = async () => {
    setBusy(true)
    setMsg(null)
    if (subscribed) {
      await unsubscribeFromPush()
      setMsg('Ya no te avisaremos.')
      trackPushUnsubscribe({ source: 'articulo', sport })
    } else {
      // 'noticias' es el topic ancho; el del deporte permite segmentar luego.
      const topics = sport ? ['noticias', `noticias:${sport}`] : ['noticias']
      const res = await subscribeToPush(topics)
      if (!res.ok) {
        setMsg(
          res.error === 'denied'
            ? 'Tu navegador ha bloqueado los avisos. Puedes permitirlos desde el candado de la barra de direcciones.'
            : 'No se ha podido activar. Inténtalo de nuevo en un momento.'
        )
      } else {
        setMsg(`Hecho. Te avisamos de lo importante ${sportLabel ? `de ${tema}` : ''}.`)
        trackPushSubscribe({ source: 'articulo', sport })
      }
    }
    setStatus(await getPushStatus())
    setBusy(false)
  }

  return (
    <aside
      aria-label="Avisos de última hora"
      className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl px-5 py-4 mt-10"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${subscribed ? `${accent}40` : 'var(--border)'}`,
      }}
    >
      <span
        aria-hidden="true"
        className="flex-shrink-0 grid place-items-center rounded-xl"
        style={{
          width: 42, height: 42,
          background: `${accent}1A`,
          color: accent,
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        {subscribed ? '🔔' : '📣'}
      </span>

      <div className="flex-1 min-w-0">
        <p
          className="font-black text-[15px] mb-0.5"
          style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}
        >
          {subscribed
            ? `Avisos activados${sportLabel ? ` · ${sportLabel}` : ''}`
            : `¿Te avisamos de la última hora${sportLabel ? ` de ${tema}` : ''}?`}
        </p>
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {msg ?? (subscribed
            ? 'Solo lo importante. Puedes desactivarlos cuando quieras.'
            : 'Un aviso en el móvil cuando pase algo que merezca la pena. Sin correo, un clic.')}
        </p>
      </div>

      <button
        onClick={handleClick}
        disabled={busy}
        className="flex-shrink-0 text-[11px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          fontFamily: 'var(--font-sport)',
          background: subscribed ? 'transparent' : accent,
          color: subscribed ? 'var(--text-muted)' : '#0B0B12',
          border: subscribed ? '1px solid var(--border)' : `1px solid ${accent}`,
        }}
        aria-pressed={subscribed}
      >
        {busy ? '…' : subscribed ? 'Desactivar' : 'Avísame'}
      </button>
    </aside>
  )
}
