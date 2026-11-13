import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'
import { IOS_URL, PLAZAS_LIBRES } from '@/lib/android-beta'
import AndroidSteps from './AndroidSteps'

// Página para apuntarse a la prueba cerrada de la app de Android.
//
// Google exige 12 testers durante 14 días antes de abrir la app a todos, y
// entrar en una prueba cerrada son tres pantallas de Google distintas (grupo,
// aceptar la prueba, instalar). Aquí se explica cada una enseñando el botón
// que hay que tocar, porque es justo donde la gente se pierde.
//
// noindex: es una página de transición. Cuando la app salga a producción se
// sustituye por un enlace directo a Play.

export const metadata: Metadata = {
  title: 'App de Taka para Android — acceso anticipado',
  description:
    'Prueba la app de TakaSports en Android antes del lanzamiento. Gratis, en 2 minutos y en tres pasos.',
  alternates: { canonical: `${SITE_URL}/android` },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Prueba la app de Taka en Android antes que nadie',
    description: 'Acceso anticipado gratis a la app de TakaSports en Google Play.',
    url: `${SITE_URL}/android`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
}

const FAQ = [
  {
    q: '¿Por qué tres pasos?',
    a: 'Mientras la app está en prueba, Google solo deja instalarla a quien está en la lista. Cuando se abra a todos, bastará con buscarla en Play Store.',
  },
  {
    q: '¿Cuesta algo?',
    a: 'No. Es gratis: la misma Taka de la web con noticias, calendario, rankings y juegos.',
  },
  {
    q: '¿Puedo salirme?',
    a: 'Sí, cuando quieras: desinstálala o sal del grupo.',
  },
]

const FACTS = [
  { valor: String(PLAZAS_LIBRES), texto: PLAZAS_LIBRES === 1 ? 'plaza libre' : 'plazas libres', hot: true },
  { valor: '2 min', texto: 'para unirte', hot: false },
  { valor: '0 €', texto: 'siempre gratis', hot: false },
]

export default function AndroidPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 mb-4"
          style={{
            fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--accent-action)', background: 'rgba(255,77,46,0.12)',
          }}
        >
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-action)' }} />
          Acceso anticipado · Android
        </span>
        <h1
          className="mb-3"
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, textTransform: 'uppercase',
            fontSize: 'clamp(34px, 9vw, 48px)', lineHeight: 0.98,
          }}
        >
          Prueba la app de Taka antes que nadie
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          Estamos abriendo la app en Google Play. Buscamos un grupo fundador que la pruebe antes del
          lanzamiento. Es gratis y te lleva 2 minutos.
        </p>

        <div className="grid grid-cols-3 gap-2 mt-5">
          {FACTS.map(f => (
            <div
              key={f.texto}
              className="rounded-xl text-center px-2 py-2.5"
              style={{
                background: f.hot ? 'rgba(255,77,46,0.08)' : 'var(--bg-card)',
                border: `1px solid ${f.hot ? 'rgba(255,77,46,0.5)' : 'var(--border)'}`,
              }}
            >
              <b
                className="block"
                style={{
                  fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900, lineHeight: 1,
                  color: f.hot ? 'var(--accent-action)' : 'var(--text-primary)',
                }}
              >
                {f.valor}
              </b>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{f.texto}</span>
            </div>
          ))}
        </div>

        <AndroidSteps />

        <h2
          className="mt-10 mb-1"
          style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}
        >
          Preguntas
        </h2>
        <div>
          {FAQ.map(f => (
            <div key={f.q} className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{f.q}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>{f.a}</p>
            </div>
          ))}
        </div>

        <p className="mt-5" style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>
          ¿Algo falla? Escríbenos a{' '}
          <a href="mailto:contacto@takasportsmedia.com?subject=App%20de%20Android" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>
            contacto@takasportsmedia.com
          </a>
          .<br />
          ¿Tienes iPhone?{' '}
          <a href={IOS_URL} style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>
            Taka ya está en la App Store
          </a>
          .
        </p>
      </div>
    </div>
  )
}
