'use client'

// «¿Te mandamos cada noche los partidos de mañana?» — la oferta de la página de
// día (punto 4.9 del plan, maqueta aprobada el 29/10/2026). Suscribe el
// navegador al tema `agenda` (AGENDA_TOPIC en lib/agenda-noche) y el cron
// /api/cron/agenda-noche avisa a las 22:00 de la zona del lector.
//
// A diferencia del aviso de las noticias, ofrece algo concreto y diario: quien
// busca «partidos de hoy» lo vuelve a buscar mañana.
//
// El primer render es SIEMPRE el estado «sin activar», igual que el HTML del
// servidor: si el navegador ya lo tiene, cambia el texto al montar, sin
// cambiar el tamaño del bloque.

import { useEffect, useRef, useState } from 'react'
import { getPublicKey, getPushTopics, isPushSupported, removePushTopic, subscribeToPush } from '@/lib/push-client'
import { trackPushSubscribe, trackPushUnsubscribe } from '@/lib/analytics'

const TOPIC = 'agenda'
const ACENTO = '#A78BFA'

type Estado = 'off' | 'on' | 'recien'

export default function AgendaNocheCta() {
  const ref = useRef<HTMLElement>(null)
  const [estado, setEstado] = useState<Estado>('off')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [cuando, setCuando] = useState('mañana')

  useEffect(() => {
    // Misma condición que el script de AgendaNoche, para las navegaciones
    // internas, donde ese script no llega a ejecutarse.
    const puede = isPushSupported() && !!getPublicKey() && Notification.permission !== 'denied'
    const hueco = ref.current?.closest<HTMLElement>('[data-agenda]')
    if (!puede) { if (hueco) hueco.hidden = true; return }
    let vivo = true
    void getPushTopics().then(t => { if (vivo && t.includes(TOPIC)) setEstado('on') })
    return () => { vivo = false }
  }, [])

  const activar = async () => {
    setBusy(true)
    setMsg(null)
    const res = await subscribeToPush([TOPIC])
    if (res.ok) {
      setCuando(new Date().getHours() < 22 ? 'esta noche' : 'mañana')
      setEstado('recien')
      trackPushSubscribe({ source: 'dia' })
    } else {
      setMsg(res.error === 'denied'
        ? 'Tu navegador ha bloqueado los avisos. Puedes permitirlos desde el candado de la barra de direcciones.'
        : 'No se ha podido activar. Inténtalo de nuevo en un momento.')
    }
    setBusy(false)
  }

  const quitar = async () => {
    setBusy(true)
    const res = await removePushTopic(TOPIC)
    if (res.ok) {
      setEstado('off')
      setMsg('Hecho, ya no te lo mandamos.')
      trackPushUnsubscribe({ source: 'dia' })
    } else {
      setMsg('No se ha podido quitar. Inténtalo de nuevo en un momento.')
    }
    setBusy(false)
  }

  const activo = estado !== 'off'
  const titulo = estado === 'recien'
    ? `Listo: ${cuando} a las 22:00 te llega el primero`
    : estado === 'on'
      ? 'Te mandamos cada noche los partidos de mañana'
      : '¿Te mandamos cada noche los partidos de mañana?'
  const texto = msg ?? (activo
    ? 'Un aviso al día con los partidos grandes, la hora y dónde verlos. Puedes quitarlo cuando quieras.'
    : 'Un aviso a las 22:00 con los partidos grandes, la hora y dónde verlos. Uno al día y sin correo.')

  return (
    <aside
      ref={ref}
      aria-label="Los partidos de mañana, cada noche"
      className="flex flex-col gap-3 rounded-2xl px-4 py-4"
      style={{ background: 'var(--bg-card)', border: `1px solid ${activo ? `${ACENTO}73` : 'var(--border)'}` }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid flex-shrink-0 place-items-center rounded-xl"
          style={{ width: 42, height: 42, background: `${ACENTO}1F`, color: ACENTO, fontSize: 20, lineHeight: 1 }}
        >
          {activo ? '🔔' : '🌙'}
        </span>
        <div className="min-w-0">
          <p
            className="mb-0.5 text-[16px] font-black leading-tight"
            style={{ color: '#F0F0F5', fontFamily: 'var(--font-display)' }}
          >
            {titulo}
          </p>
          <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }} aria-live="polite">
            {texto}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={activo ? quitar : activar}
        disabled={busy}
        className="rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 sm:self-start sm:px-6"
        style={{
          fontFamily: 'var(--font-sport)',
          background: activo ? 'transparent' : ACENTO,
          color: activo ? 'var(--text-muted)' : '#0B0B12',
          border: activo ? '1px solid var(--border)' : `1px solid ${ACENTO}`,
        }}
      >
        {busy ? '…' : activo ? 'Quitar el aviso' : 'Avísame cada noche'}
      </button>
    </aside>
  )
}
