import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Términos de uso — TakaSports',
  description: 'Términos y condiciones de uso de TakaSports.',
  alternates: { canonical: `${SITE_URL}/terminos` },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = '15 de mayo de 2026'

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-4xl font-black tracking-tight mb-2">Términos de uso</h1>
        <p className="text-sm text-text-muted mb-10">Última actualización: {LAST_UPDATED}</p>

        <div className="prose prose-invert prose-purple max-w-none space-y-6">
          <p>
            Bienvenido a <strong>TakaSports</strong>. Al usar el sitio web takasportsmedia.com
            o la aplicación móvil TakaSports, aceptas estos términos. Si no estás de acuerdo,
            por favor no uses el servicio.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">1. Quiénes somos</h2>
          <p>
            TakaSports es un medio digital de información deportiva que cubre fútbol, baloncesto,
            tenis, Fórmula 1 y otros deportes. Ofrecemos noticias, resultados, estadísticas,
            calendarios y juegos relacionados con el deporte.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">2. Uso del servicio</h2>
          <p>Te comprometes a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Usar el servicio únicamente para fines legales y personales.</li>
            <li>No interferir con el funcionamiento del servicio.</li>
            <li>No intentar acceder a partes no autorizadas del sistema.</li>
            <li>No usar bots, scrapers o herramientas automáticas no autorizadas.</li>
            <li>No suplantar identidad de otros usuarios.</li>
            <li>No publicar contenido ofensivo, discriminatorio, ilegal o spam.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-10 mb-3">3. Cuentas de usuario</h2>
          <p>
            Para usar ciertas funciones (guardar favoritos, participar en quinielas, recibir
            notificaciones personalizadas) puedes crear una cuenta. Eres responsable de:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>La seguridad de tus credenciales.</li>
            <li>Toda la actividad realizada desde tu cuenta.</li>
            <li>Notificarnos si sospechas un uso no autorizado.</li>
          </ul>
          <p className="mt-3">
            Puedes eliminar tu cuenta y todos tus datos en cualquier momento desde tu{' '}
            <a className="text-purple-light underline" href="/perfil">perfil</a> (sección «Zona
            de peligro» → «Eliminar mi cuenta»), o escribiéndonos a{' '}
            <a className="text-purple-light underline" href="mailto:contacto@takasportsmedia.com">
              contacto@takasportsmedia.com
            </a>.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">4. Propiedad intelectual</h2>
          <p>
            El contenido del servicio (artículos, diseño, marca TakaSports) es propiedad de
            TakaSports Media o de sus licenciantes y está protegido por leyes de propiedad
            intelectual. Puedes leer, compartir enlaces y citar fragmentos siempre que
            atribuyas la fuente.
          </p>
          <p>
            Los datos deportivos (resultados, estadísticas, logos de equipos) provienen de
            fuentes públicas (ESPN, ligas oficiales) y se usan con fines informativos.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">5. Contenido generado por usuarios</h2>
          <p>
            Si comentas o participas en juegos, mantienes los derechos sobre tu contenido,
            pero nos otorgas una licencia mundial, gratuita y no exclusiva para mostrar ese
            contenido dentro del servicio.
          </p>
          <p>
            Nos reservamos el derecho de eliminar contenido que viole estos términos o las
            leyes aplicables, sin previo aviso.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">6. Juegos y predicciones</h2>
          <p>
            Las quinielas, CrackQuiz, Mi Once y otros juegos son <strong>gratuitos y sin
            premio monetario</strong>. Las puntuaciones tienen valor exclusivamente lúdico y
            de comunidad. TakaSports no es una plataforma de apuestas.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">7. Disponibilidad y limitación de responsabilidad</h2>
          <p>
            Hacemos lo posible para que el servicio esté disponible 24/7, pero no garantizamos
            funcionamiento ininterrumpido ni libre de errores. No nos hacemos responsables de:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Errores en datos deportivos provenientes de fuentes externas.</li>
            <li>Pérdida de datos por fallos técnicos.</li>
            <li>Daños indirectos derivados del uso del servicio.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-10 mb-3">8. Modificaciones</h2>
          <p>
            Podemos modificar estos términos en cualquier momento. Los cambios significativos
            se notificarán por email o en la app. El uso continuado del servicio tras los
            cambios implica aceptación.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">9. Suspensión y terminación</h2>
          <p>
            Nos reservamos el derecho de suspender o cancelar cuentas que violen estos
            términos, sin previo aviso en casos graves.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">10. Ley aplicable</h2>
          <p>
            Estos términos se rigen por la legislación española. Cualquier disputa se
            resolverá en los tribunales de Madrid, salvo que la ley imperativa imponga otro
            foro al consumidor.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">11. Contacto</h2>
          <p>
            Para dudas sobre estos términos:{' '}
            <a className="text-purple-light underline" href="mailto:contacto@takasportsmedia.com">
              contacto@takasportsmedia.com
            </a>
          </p>
        </div>
    </div>
  )
}
