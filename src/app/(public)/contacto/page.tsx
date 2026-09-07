import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/constants'

// Página de contacto.
//
// El correo ya estaba publicado, pero repartido: dentro del aviso legal y en un
// párrafo de /sobre. No había ni una URL de contacto ni un enlace en el pie, así
// que para escribirnos había que leerse la nota legal entera.
//
// Importa más de lo que parece: Google News y Discover valoran que un medio
// diga quién responde y por qué vías, y es de lo poco que se puede arreglar en
// una tarde. Además, una corrección de un dato mal publicado necesita un sitio
// evidente al que escribir; si no, acaba en redes.
//
// Es una página estática a propósito: sin formulario. Un formulario exige
// backend, protección antispam y guardar datos personales —tres cosas que hoy
// no aportan nada frente a un `mailto:`— y encima abre una vía de abuso.

const EMAIL = 'contacto@takasportsmedia.com'

export const metadata: Metadata = {
  title: 'Contacto — TakaSports',
  description:
    'Cómo contactar con TakaSports: correcciones de artículos, derechos de imagen, colaboraciones y prensa. Respondemos por correo.',
  alternates: { canonical: `${SITE_URL}/contacto` },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Contacto — TakaSports',
    description: 'Correcciones, derechos de imagen, colaboraciones y prensa.',
    url: `${SITE_URL}/contacto`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'website',
  },
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Contacto', item: `${SITE_URL}/contacto` },
  ],
}

// ContactPage + los puntos de contacto, referenciando la organización que el
// layout raíz ya declara como #organization (no se redefine aquí).
const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contacto — TakaSports',
  url: `${SITE_URL}/contacto`,
  inLanguage: 'es-ES',
  publisher: { '@id': `${SITE_URL}/#organization` },
  mainEntity: {
    '@id': `${SITE_URL}/#organization`,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'editorial',
        email: EMAIL,
        availableLanguage: ['es'],
        areaServed: 'Worldwide',
      },
    ],
  },
}

const MOTIVOS = [
  {
    titulo: 'Una corrección',
    texto:
      'Si has visto un dato equivocado en un artículo, dinos cuál y dónde. Corregimos y dejamos constancia de la corrección en la propia noticia.',
    asunto: 'Corrección en un artículo',
  },
  {
    titulo: 'Una foto tuya',
    texto:
      'Las fotos de los artículos se enlazan desde su medio de origen y se acreditan. Si eres el titular de una y quieres que deje de mostrarse, escríbenos con el enlace y la retiramos.',
    asunto: 'Derechos sobre una imagen',
  },
  {
    titulo: 'Colaborar o patrocinar',
    texto:
      'TakaSports no tiene publicidad ni muro de pago. Si quieres proponer una colaboración o patrocinar una sección, cuéntanos qué tienes en mente.',
    asunto: 'Colaboración',
  },
  {
    titulo: 'Prensa y datos',
    texto:
      'Para citar nuestros rankings o pedir datos concretos del Índice Taka, escríbenos y te contamos cómo se calculan.',
    asunto: 'Prensa',
  },
]

export default function ContactoPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="section-accent" />
            <span className="section-label">Contacto</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-3">Escríbenos</h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)', maxWidth: '60ch' }}>
            Lee y responde una persona. Solemos contestar en dos o tres días laborables; si es una
            corrección en una noticia publicada, antes.
          </p>
        </div>

        <a
          href={`mailto:${EMAIL}`}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold"
          style={{ background: 'var(--purple)', color: '#fff', textDecoration: 'none' }}
        >
          {EMAIL}
        </a>

        <h2 className="text-2xl font-bold mt-12 mb-4">Con qué podemos ayudarte</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MOTIVOS.map(m => (
            <div
              key={m.titulo}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <h3 className="font-bold mb-1.5">{m.titulo}</h3>
              <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                {m.texto}
              </p>
              <a
                href={`mailto:${EMAIL}?subject=${encodeURIComponent(m.asunto)}`}
                className="text-sm font-semibold"
                style={{ color: 'var(--purple-light)' }}
              >
                Escribir sobre esto →
              </a>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-3">Quiénes somos</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '65ch' }}>
          Los datos del titular del sitio están en el{' '}
          <Link href="/aviso-legal" style={{ color: 'var(--purple-light)' }}>
            aviso legal
          </Link>
          . Cómo elegimos y verificamos lo que publicamos está en la{' '}
          <Link href="/politica-editorial" style={{ color: 'var(--purple-light)' }}>
            política editorial
          </Link>
          , y quién firma, en{' '}
          <Link href="/autor/redaccion" style={{ color: 'var(--purple-light)' }}>
            el equipo editorial
          </Link>
          .
        </p>

        <p className="text-sm mt-8" style={{ color: 'var(--text-faint)' }}>
          Para borrar tu cuenta no hace falta escribirnos: se hace desde{' '}
          <Link href="/eliminar-cuenta" style={{ color: 'var(--purple-light)' }}>
            eliminar cuenta
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
