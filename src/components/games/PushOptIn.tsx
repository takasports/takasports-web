'use client'

// Toggle compacto para activar / desactivar avisos de juegos por Web Push.
// Si el navegador no soporta o el dominio no tiene VAPID, no se monta nada
// (silencioso para no ensuciar la UI).

import { useEffect, useState } from 'react'
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from '@/lib/push-client'

interface Props {
  accent?: string
}

export default function PushOptIn({ accent = '#93C5FD' }: Props) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => { void getPushStatus().then(setStatus) }, [])

  if (!status) return null
  if (!status.supported) return null

  if (!status.configured) {
    // Hay infra pero faltan VAPID keys en el deploy → render gris discreto
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'var(--font-sport)' }}
        title="Notificaciones aún no configuradas"
      >
        🔕 Avisos · próximamente
      </span>
    )
  }

  const handleClick = async () => {
    setBusy(true)
    setHint(null)
    if (status.subscribed) {
      await unsubscribeFromPush()
      setHint('Avisos desactivados')
    } else {
      const res = await subscribeToPush(['games'])
      if (!res.ok) {
        setHint(
          res.error === 'denied' ? 'Permiso denegado en el navegador'
          : res.error === 'not-configured' ? 'Servidor sin VAPID'
          : 'No se pudo activar'
        )
      } else {
        setHint('¡Listo! Te avisamos cuando haya nuevo puzzle')
      }
    }
    const next = await getPushStatus()
    setStatus(next)
    setBusy(false)
    setTimeout(() => setHint(null), 3500)
  }

  const denied = status.permission === 'denied'
  const subscribed = status.subscribed
  const baseStyle = subscribed
    ? { background: `${accent}18`, color: accent, border: `1px solid ${accent}40` }
    : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <button
        onClick={handleClick}
        disabled={busy || denied}
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ ...baseStyle, fontFamily: 'var(--font-sport)' }}
        aria-pressed={subscribed}
      >
        {denied
          ? '🔕 Avisos bloqueados'
          : subscribed ? '🔔 Avisos activos' : '🔔 Activar avisos'}
      </button>
      {hint && (
        <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sport)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}
