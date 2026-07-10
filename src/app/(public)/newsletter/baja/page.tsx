// Página de baja del newsletter. Llega aquí el usuario que hace click en el
// "Darse de baja" del email.
//
// IMPORTANTE (seguridad): la baja NO se ejecuta al abrir la página (GET). Los
// escáneres de email corporativos (Outlook Safe Links, proxies antivirus)
// siguen automáticamente todos los enlaces de un correo con un GET, y eso daba
// de baja a la gente sin un clic real. Por eso el GET solo muestra un botón
// "Confirmar baja" y es el POST (Server Action) el que desmarca. RFC 8058.

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { adminSupabase } from '@/lib/supabase-admin'
import { verifyUnsubscribeToken } from '@/lib/newsletter-token'
import { SITE_URL } from '@/lib/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Baja de la newsletter',
  description: 'Confirmación de baja de la newsletter de TakaSports.',
  alternates: { canonical: `${SITE_URL}/newsletter/baja` },
  robots: { index: false, follow: false },
}

type Status = 'ok' | 'invalid' | 'unavailable' | 'error'
interface SP { token?: string | string[]; done?: string | string[] }

async function process(token: string): Promise<Status> {
  const email = verifyUnsubscribeToken(token)
  if (!email) return 'invalid'

  const supa = adminSupabase()
  if (!supa) return 'unavailable'

  const { error } = await supa
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('email', email)
    .is('unsubscribed_at', null)

  if (error) return 'error'
  return 'ok'
}

// Server Action: SOLO aquí (POST, tras el clic del usuario) se ejecuta la baja.
async function confirmUnsubscribe(formData: FormData): Promise<void> {
  'use server'
  const token = String(formData.get('token') ?? '')
  const status: Status = token ? await process(token) : 'invalid'
  redirect(`/newsletter/baja?done=${status}`)
}

function Shell({
  accent,
  label,
  title,
  message,
  children,
}: {
  accent: string
  label: string
  title: string
  message: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="section-label" style={{ color: accent, marginBottom: 12 }}>
          {label}
        </p>
        <h1
          className="font-black"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            color: '#F8F8FF',
            letterSpacing: '-0.02em',
            marginBottom: 14,
          }}
        >
          {title}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.55 }}>
          {message}
        </p>
        {children}
        <div className="mt-8 flex gap-3 flex-wrap">
          <Link
            href="/"
            style={{
              padding: '10px 18px',
              background: 'var(--purple)',
              color: '#fff',
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-sport)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Volver al inicio
          </Link>
          <a
            href="mailto:contacto@takasportsmedia.com"
            style={{
              padding: '10px 18px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-sport)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Contacto
          </a>
        </div>
      </div>
    </div>
  )
}

export default async function NewsletterBajaPage(
  { searchParams }: { searchParams: Promise<SP> },
) {
  const sp = await searchParams
  const token = Array.isArray(sp.token) ? sp.token[0] : (sp.token ?? '')
  const done = (Array.isArray(sp.done) ? sp.done[0] : sp.done) as Status | undefined

  // ── Resultado (venimos del POST con ?done=) ──────────────────────────────
  if (done) {
    const title =
      done === 'ok'          ? 'Te has dado de baja'
      : done === 'invalid'   ? 'Enlace no válido'
      : done === 'unavailable' ? 'Sin conexión a base de datos'
      : 'Algo no fue bien'
    const message =
      done === 'ok'          ? 'No volverás a recibir nuestra newsletter. Si fue un error, puedes volver a suscribirte desde el pie de cualquier página.'
      : done === 'invalid'   ? 'El enlace que has seguido no es válido o ha caducado. Escríbenos a contacto@takasportsmedia.com y te damos de baja a mano.'
      : done === 'unavailable' ? 'Hemos tenido un problema temporal procesando tu baja. Inténtalo en unos minutos o escríbenos a contacto@takasportsmedia.com.'
      : 'No hemos podido procesar tu baja. Escríbenos a contacto@takasportsmedia.com y lo hacemos a mano.'
    return <Shell accent={done === 'ok' ? '#86EFAC' : '#FCA5A5'} label="Newsletter" title={title} message={message} />
  }

  // ── Sin token → enlace inválido (no ejecutamos nada) ─────────────────────
  if (!token) {
    return (
      <Shell
        accent="#FCA5A5"
        label="Newsletter"
        title="Enlace no válido"
        message="El enlace que has seguido no es válido o ha caducado. Escríbenos a contacto@takasportsmedia.com y te damos de baja a mano."
      />
    )
  }

  // ── Confirmación (GET con token): NO ejecuta la baja, solo ofrece el botón ─
  return (
    <Shell
      accent="#C4B5FD"
      label="Newsletter"
      title="¿Confirmar tu baja?"
      message="Pulsa el botón para dejar de recibir la newsletter de TakaSports. No recibirás más correos nuestros."
    >
      <form action={confirmUnsubscribe} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          style={{
            padding: '11px 22px',
            background: '#EF4444',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-sport)',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Confirmar baja
        </button>
      </form>
    </Shell>
  )
}
