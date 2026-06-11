// Página de baja del newsletter. Llega aquí el usuario que hace click en
// el "Darse de baja" del email. El servidor verifica el token y desmarca
// directamente (sin necesidad de un click extra del usuario — el click ya
// es el consentimiento de baja). Si el token es inválido, mostramos error
// amistoso con CTA a contacto.

import type { Metadata } from 'next'
import Link from 'next/link'
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

interface SP { token?: string | string[] }

async function process(token: string): Promise<'ok' | 'invalid' | 'unavailable' | 'error'> {
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

export default async function NewsletterBajaPage(
  { searchParams }: { searchParams: Promise<SP> },
) {
  const sp = await searchParams
  const token = Array.isArray(sp.token) ? sp.token[0] : (sp.token ?? '')
  const status = token ? await process(token) : 'invalid'

  const title =
    status === 'ok'         ? 'Te has dado de baja'
    : status === 'invalid'  ? 'Enlace no válido'
    : status === 'unavailable' ? 'Sin conexión a base de datos'
    : 'Algo no fue bien'

  const message =
    status === 'ok'         ? 'No volverás a recibir nuestra newsletter. Si fue un error, puedes volver a suscribirte desde el pie de cualquier página.'
    : status === 'invalid'  ? 'El enlace que has seguido no es válido o ha caducado. Escríbenos a hola@takasportsmedia.com y te damos de baja a mano.'
    : status === 'unavailable' ? 'Hemos tenido un problema temporal procesando tu baja. Inténtalo en unos minutos o escríbenos a hola@takasportsmedia.com.'
    : 'No hemos podido procesar tu baja. Escríbenos a hola@takasportsmedia.com y lo hacemos a mano.'

  const accent = status === 'ok' ? '#86EFAC' : '#FCA5A5'

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="section-label" style={{ color: accent, marginBottom: 12 }}>
          Newsletter
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
            href="mailto:hola@takasportsmedia.com"
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
