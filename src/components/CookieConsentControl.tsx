'use client'

// Control de gestión del consentimiento de cookies (Sprint 1 incompleto).
// Muestra el estado actual y permite revocar o restablecer la decisión.
// Si revocas, el ConsentBanner reaparecerá en la próxima carga.

import { useEffect, useState } from 'react'

const CONSENT_KEY = 'taka-consent-v1'

type Status = 'pending' | 'accepted' | 'rejected' | 'unknown'

interface StoredConsent {
  decision?: 'accepted' | 'rejected'
  at?: string
  version?: number
}

function readStatus(): { status: Exclude<Status, 'pending'>; at?: string } {
  if (typeof window === 'undefined') return { status: 'unknown' }
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY)
    if (!raw) return { status: 'unknown' }
    const parsed = JSON.parse(raw) as StoredConsent
    if (parsed?.decision === 'accepted' || parsed?.decision === 'rejected') {
      return { status: parsed.decision, at: parsed.at }
    }
    return { status: 'unknown' }
  } catch {
    return { status: 'unknown' }
  }
}

export default function CookieConsentControl() {
  const [status, setStatus] = useState<Status>('pending')
  const [at, setAt] = useState<string | undefined>(undefined)

  useEffect(() => {
    const next = readStatus()
    setStatus(next.status)
    setAt(next.at)
  }, [])

  const reset = () => {
    try { window.localStorage.removeItem(CONSENT_KEY) } catch { /* ignore */ }
    // Recargamos para que el banner reaparezca y los trackers no sigan cargados
    // si la decisión anterior era "accepted".
    window.location.reload()
  }

  if (status === 'pending') return null

  const statusLabel =
    status === 'accepted' ? 'Aceptaste'
      : status === 'rejected' ? 'Rechazaste'
        : 'No has decidido todavía'

  const statusColor =
    status === 'accepted' ? '#86EFAC'
      : status === 'rejected' ? '#FCA5A5'
        : 'var(--text-muted)'

  const fmtDate = at
    ? new Date(at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div
      className="not-prose mt-4 rounded-2xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        padding: 'var(--space-md) var(--space-lg)',
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="section-label"
          style={{ marginBottom: 4 }}
        >
          Tu decisión actual
        </p>
        <p style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5 }}>
          <strong style={{ color: statusColor }}>{statusLabel}</strong>
          {status !== 'unknown' && ' las cookies analíticas (Google Analytics + Microsoft Clarity).'}
          {fmtDate && (
            <>
              {' '}
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                · guardado el {fmtDate}
              </span>
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          background: 'rgba(255,255,255,0.08)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-sport)',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'background var(--duration-fast) var(--ease-standard)',
        }}
      >
        Cambiar mi decisión
      </button>
    </div>
  )
}
