import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Aviso legal — TakaSports',
  description: 'Datos identificativos del titular de takasportsmedia.com y condiciones de uso del sitio, conforme al artículo 10 de la Ley 34/2002 (LSSI-CE).',
  alternates: { canonical: `${SITE_URL}/aviso-legal` },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = '15 de junio de 2026'

export default function AvisoLegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-black tracking-tight mb-2">Aviso legal</h1>
      <p className="text-sm text-text-muted mb-10">Última actualización: {LAST_UPDATED}</p>

      <div className="prose prose-invert prose-purple max-w-none space-y-6">
        <h2 className="text-2xl font-bold mt-10 mb-3">1. Datos identificativos del titular</h2>
        <p>
          En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la
          Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informan los datos del
          titular de este sitio web:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Titular:</strong> José Tomás Agüero</li>
          <li><strong>NIF/NIE:</strong> 0Y9273277J</li>
          <li><strong>Localidad:</strong> Madrid (Comunidad de Madrid), España</li>
          <li>
            <strong>Correo electrónico de contacto:</strong>{' '}
            <a className="text-purple-light underline" href="mailto:contacto@takasportsmedia.com">
              contacto@takasportsmedia.com
            </a>
          </li>
          <li><strong>Sitio web:</strong> www.takasportsmedia.com</li>
          <li><strong>Actividad:</strong> portal informativo de noticias, datos y estadísticas deportivas.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-3">2. Objeto y aceptación</h2>
        <p>
          El presente Aviso Legal regula el acceso y uso de www.takasportsmedia.com (en adelante,
          «el Sitio»), de carácter meramente informativo. La navegación por el Sitio atribuye la
          condición de usuario e implica la aceptación plena de estas condiciones en la versión
          publicada en cada momento. Si no está de acuerdo con ellas, le rogamos que no utilice el
          Sitio.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">3. Condiciones de acceso y uso</h2>
        <p>
          El acceso al Sitio es libre y gratuito. El usuario se compromete a hacer un uso del Sitio
          conforme a la ley, la buena fe y el orden público, absteniéndose de emplearlo con fines
          ilícitos o lesivos, o de cualquier forma que pueda dañar, inutilizar o sobrecargar el
          Sitio o impedir su normal uso. El titular no garantiza que el Sitio resulte idóneo para
          finalidades distintas de la consulta informativa de contenidos deportivos.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">4. Propiedad intelectual e industrial</h2>
        <p>
          Los contenidos propios del Sitio (textos, diseño, estructura de navegación, código fuente
          y la marca y el logotipo «TakaSports») son titularidad del titular o este cuenta con la
          licencia correspondiente, y quedan protegidos por la normativa de propiedad intelectual e
          industrial. Queda prohibida su reproducción, distribución o transformación sin autorización
          expresa.
        </p>
        <p>
          Los nombres, logotipos, escudos, marcas, fotografías e imágenes de clubes, competiciones,
          deportistas o terceros que puedan aparecer en el Sitio pertenecen a sus respectivos
          titulares y se utilizan exclusivamente con fines informativos, de identificación y de cita.
          El titular no reclama derecho alguno sobre ellos y atenderá la retirada de cualquier
          contenido a solicitud de su legítimo titular a través del correo de contacto.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">5. Exclusión y limitación de responsabilidad</h2>
        <p>
          La información deportiva del Sitio (resultados, estadísticas, clasificaciones, calendarios,
          rankings y predicciones) se ofrece con fines informativos y de entretenimiento, y procede
          tanto de elaboración propia como de fuentes de terceros. Pese al cuidado puesto en su
          elaboración, el titular no garantiza su exactitud, vigencia ni exhaustividad, pudiendo
          contener errores o presentar retrasos respecto a la realidad.
        </p>
        <p>
          Las predicciones, pronósticos o probabilidades que pueda mostrar el Sitio son orientativos,
          no constituyen asesoramiento de ningún tipo ni recomendación de apuesta. El titular no se
          responsabiliza de las decisiones que el usuario adopte basándose en la información del
          Sitio.
        </p>
        <p>
          El titular procura mantener el Sitio disponible y actualizado, pero no garantiza la ausencia
          de interrupciones, errores técnicos o falta de disponibilidad, ni se responsabiliza de los
          daños que pudieran derivarse de tales circunstancias.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">6. Enlaces a sitios externos</h2>
        <p>
          El Sitio puede contener enlaces a páginas de terceros, ofrecidos únicamente para comodidad
          del usuario. El titular no controla ni asume responsabilidad alguna sobre sus contenidos,
          disponibilidad o políticas, y su inclusión no implica recomendación, asociación ni respaldo.
          El titular retirará todo enlace a contenidos ilícitos tan pronto como tenga conocimiento
          efectivo de ello.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">7. Protección de datos y cookies</h2>
        <p>
          El tratamiento de los datos personales de los usuarios y el uso de cookies se rigen,
          respectivamente, por la{' '}
          <a className="text-purple-light underline" href="/privacidad">Política de privacidad</a> y la{' '}
          <a className="text-purple-light underline" href="/cookies">Política de cookies</a> del Sitio,
          que forman parte de este Aviso Legal.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">8. Legislación aplicable y jurisdicción</h2>
        <p>
          El presente Aviso Legal se rige por la legislación española. Para la resolución de cualquier
          controversia relativa al Sitio, las partes se someten a los Juzgados y Tribunales que
          correspondan conforme a Derecho, sin perjuicio del fuero que imperativamente pudiera
          corresponder al usuario en su condición de consumidor.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">9. Modificaciones y vigencia</h2>
        <p>
          El titular se reserva el derecho a modificar en cualquier momento la presentación y
          configuración del Sitio, así como el presente Aviso Legal. Resultará de aplicación la
          versión publicada en el momento de cada acceso.
        </p>
      </div>
    </div>
  )
}
