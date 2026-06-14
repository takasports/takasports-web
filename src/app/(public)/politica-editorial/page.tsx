import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Política editorial — TakaSports',
  description:
    'Política editorial de TakaSports Media: estándares de verificación, uso de herramientas automatizadas, política de correcciones, transparencia y separación entre información y opinión.',
  alternates: { canonical: `${SITE_URL}/politica-editorial` },
  openGraph: {
    title: 'Política editorial — TakaSports',
    description:
      'Cómo trabajamos en TakaSports: verificación, correcciones, transparencia y estándares periodísticos.',
    url: `${SITE_URL}/politica-editorial`,
    siteName: 'TakaSports',
    locale: 'es_ES',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Política editorial — TakaSports',
    description: 'Cómo trabajamos en TakaSports Media.',
    site: '@takasportsx',
  },
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'TakaSports', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Política editorial', item: `${SITE_URL}/politica-editorial` },
  ],
}

const webPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Política editorial — TakaSports',
  url: `${SITE_URL}/politica-editorial`,
  description:
    'Estándares editoriales, política de correcciones, uso de herramientas automatizadas y transparencia en TakaSports Media.',
  inLanguage: 'es-ES',
  publisher: { '@id': `${SITE_URL}/#organization` },
  dateModified: '2026-05-28',
}

function slugifySection(title: string): string {
  // "3. Verificación de la información" → "seccion-3"
  const num = title.match(/^(\d+)\./)
  return num ? `seccion-${num[1]}` : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = slugifySection(title)
  return (
    <section id={id} style={{ marginBottom: '2.25rem', scrollMarginTop: '80px' }}>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.45rem',
        fontWeight: 800,
        color: '#E8E8F4',
        marginBottom: '0.75rem',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>
      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '1.02rem' }}>
        {children}
      </div>
    </section>
  )
}

export default function PoliticaEditorialPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-20">

        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="section-accent" />
            <span className="section-label">Transparencia</span>
          </div>
          <h1
            className="font-black leading-tight mb-4"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.2rem, 5.5vw, 3.4rem)',
              color: '#F8F8FF',
              letterSpacing: '-0.02em',
            }}
          >
            Política editorial
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Cómo trabajamos en TakaSports Media: qué publicamos, qué verificamos, cómo
            corregimos los errores y qué papel tienen las herramientas automatizadas en
            nuestro flujo editorial.
          </p>
          <p className="text-xs mt-3" style={{ color: 'var(--text-faint)' }}>
            Última actualización: 28 de mayo de 2026
          </p>
        </div>

        <Section title="1. Quiénes somos">
          <p>
            TakaSports Media es una publicación digital independiente especializada en
            información deportiva en español. Cubrimos fútbol, baloncesto, Fórmula 1,
            UFC, tenis, MotoGP, WWE, rugby y los principales eventos del calendario
            deportivo internacional. Toda la información publicada es responsabilidad de
            la{' '}
            <Link href="/autor/redaccion" style={{ color: '#7C3AED', textDecoration: 'underline' }}>
              Redacción de TakaSports
            </Link>.
          </p>
        </Section>

        <Section title="2. Misión y compromiso con la audiencia">
          <p>
            Nuestra misión es ofrecer cobertura deportiva de calidad — actualidad,
            contexto y datos — de forma gratuita y sin barreras. No exigimos registro
            para leer noticias, no usamos paywalls y no condicionamos el contenido a
            anunciantes.
          </p>
        </Section>

        <Section title="3. Verificación de la información">
          <p>
            Antes de publicar una noticia exigimos al menos uno de estos requisitos:
          </p>
          <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li>Fuente oficial directa (club, federación, deportista, organismo).</li>
            <li>Confirmación independiente por al menos un medio de referencia.</li>
            <li>Documento, declaración o material audiovisual verificable.</li>
          </ul>
          <p style={{ marginTop: '0.75rem' }}>
            Cuando una información proviene de un único medio o de un rumor, lo señalamos
            explícitamente en el texto y no la presentamos como hecho confirmado.
          </p>
        </Section>

        <Section title="4. Uso de herramientas automatizadas">
          <p>
            En TakaSports utilizamos herramientas de asistencia editorial automatizadas
            (incluyendo modelos de lenguaje) para tareas como redacción inicial, resumen
            de fuentes, generación de titulares, traducción y curación de datos
            estadísticos. <strong style={{ color: '#E8E8F4' }}>Toda pieza pasa por revisión humana</strong>{' '}
            antes de publicarse. La Redacción es responsable final del contenido, los
            hechos y el tono editorial. Las páginas de estadísticas, rankings y datos
            agregados se generan parcialmente de forma automatizada a partir de fuentes
            oficiales y se identifican como tal.
          </p>
        </Section>

        <Section title="5. Política de correcciones">
          <p>
            Si publicamos un error material, lo corregimos lo antes posible y dejamos
            constancia explícita en el artículo afectado, indicando qué se corrigió y
            cuándo. Los cambios menores (tipográficos, ortográficos) se aplican sin
            mención. Si detectas un error, escríbenos a{' '}
            <a href="mailto:contacto@takasportsmedia.com" style={{ color: '#7C3AED', textDecoration: 'underline' }}>
              contacto@takasportsmedia.com
            </a>{' '}
            con el enlace del artículo y nos pondremos en contacto contigo.
          </p>
        </Section>

        <Section title="6. Separación entre información y opinión">
          <p>
            Las noticias se presentan como tal: hechos, contexto y declaraciones. Las
            opiniones, columnas o análisis subjetivos se etiquetan claramente como
            «análisis» u «opinión» y reflejan la postura del autor o de la Redacción, no
            necesariamente la línea de TakaSports Media.
          </p>
        </Section>

        <Section title="7. Fuentes y atribución">
          <p>
            Citamos todas las fuentes utilizadas. Cuando reproducimos información de
            otro medio, lo indicamos con un enlace directo en el texto o en el bloque
            «Fuente» del artículo. No copiamos contenido literalmente: reescribimos con
            valor añadido (contexto, datos, comparativas).
          </p>
        </Section>

        <Section title="8. Anuncios, patrocinios y conflictos de interés">
          <p>
            Cualquier contenido patrocinado o resultado de una colaboración comercial
            está etiquetado como tal de forma visible. Los anuncios programáticos que
            puedan aparecer en la web no influyen en la línea editorial. La Redacción no
            mantiene relaciones comerciales con clubes, federaciones ni deportistas
            cubiertos en la información.
          </p>
        </Section>

        <Section title="9. Imágenes y derechos">
          <p>
            Las imágenes utilizadas en los artículos proceden de fuentes con licencia,
            de redes sociales públicas con atribución, de Wikimedia Commons o se generan
            de forma original. Si eres titular de derechos de una imagen y consideras
            que se ha usado indebidamente, escríbenos y la retiraremos o atribuiremos
            correctamente.
          </p>
        </Section>

        <Section title="10. Privacidad y cookies">
          <p>
            Nuestra política de privacidad y de cookies está disponible en{' '}
            <Link href="/privacidad" style={{ color: '#7C3AED', textDecoration: 'underline' }}>
              /privacidad
            </Link>. Recogemos el mínimo de datos necesarios para operar el servicio y
            nunca vendemos información personal a terceros.
          </p>
        </Section>

        <Section title="11. Contacto editorial">
          <p>
            Para sugerencias, correcciones, propuestas de colaboración o quejas
            editoriales:{' '}
            <a href="mailto:contacto@takasportsmedia.com" style={{ color: '#7C3AED', textDecoration: 'underline' }}>
              contacto@takasportsmedia.com
            </a>.
          </p>
        </Section>

      </div>

    </div>
  )
}
