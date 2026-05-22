'use client'

// Form de suscripción a la newsletter — opt-in simple con consentimiento
// explícito. El checkbox es obligatorio (RGPD). Estados: idle/sending/ok/
// already/error. Reset tras 4s en éxito para que el usuario no vea estado
// pegado al volver a la home.

import { useState } from 'react'

type Status = 'idle' | 'sending' | 'ok' | 'already' | 'error'

interface Props {
  source?: string         // 'footer' | 'sobre' | etc — para analítica posterior
  variant?: 'inline' | 'stacked'
}

export default function NewsletterForm({ source = 'web', variant = 'stacked' }: Props) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<Status>('idle')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'sending') return
    if (!consent) { setStatus('error'); return }
    setStatus('sending')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent: true, source }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setStatus('error')
        return
      }
      setStatus(data.alreadySubscribed ? 'already' : 'ok')
      setEmail('')
      setConsent(false)
      // Reset al estado idle tras unos segundos
      setTimeout(() => setStatus('idle'), 4000)
    } catch {
      setStatus('error')
    }
  }

  const message =
    status === 'ok'      ? '¡Listo! Te avisaremos cuando salga el primer envío.'
    : status === 'already' ? 'Este email ya está suscrito. Gracias.'
    : status === 'error' && !consent ? 'Necesitamos tu consentimiento para suscribirte.'
    : status === 'error' ? 'No hemos podido suscribirte. Inténtalo de nuevo.'
    : ''

  const messageColor =
    status === 'ok' || status === 'already' ? '#86EFAC'
    : status === 'error' ? '#FCA5A5'
    : 'var(--text-muted)'

  return (
    <form
      onSubmit={onSubmit}
      className={variant === 'inline' ? 'flex flex-col sm:flex-row gap-2 sm:gap-3' : 'flex flex-col gap-3'}
      style={{ maxWidth: 480 }}
      aria-label="Suscribirse a la newsletter de TakaSports"
    >
      <div className={variant === 'inline' ? 'flex-1' : ''}>
        <label htmlFor="ts-newsletter-email" className="sr-only">Correo electrónico</label>
        <input
          id="ts-newsletter-email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={status === 'sending'}
          className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        />
      </div>
      <button
        type="submit"
        disabled={status === 'sending' || !email || !consent}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
        style={{
          padding: '10px 18px',
          background: status === 'sending' || !email || !consent ? 'rgba(124,58,237,0.4)' : 'var(--purple)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-sport)',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: status === 'sending' || !email || !consent ? 'not-allowed' : 'pointer',
          transition: 'background var(--duration-fast) var(--ease-standard)',
          flexShrink: 0,
        }}
      >
        {status === 'sending' ? 'Enviando…' : 'Suscribirme'}
      </button>

      <label
        className={variant === 'inline' ? 'sm:basis-full flex items-start gap-2 cursor-pointer' : 'flex items-start gap-2 cursor-pointer'}
        style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.4 }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          required
          className="mt-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]"
          style={{ flexShrink: 0, accentColor: 'var(--purple)' }}
        />
        <span>
          Acepto recibir comunicaciones de TakaSports y consiento el tratamiento de mi email
          según la{' '}
          <a
            href="/privacidad"
            style={{ color: 'var(--purple-light)', textDecoration: 'underline' }}
          >
            política de privacidad
          </a>
          .
        </span>
      </label>

      {message && (
        <p
          role="status"
          aria-live="polite"
          style={{
            color: messageColor,
            fontSize: 13,
            fontFamily: 'var(--font-sport)',
            fontWeight: 600,
          }}
        >
          {message}
        </p>
      )}
    </form>
  )
}
