import type { Metadata } from 'next'
import CookieConsentControl from '@/components/CookieConsentControl'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Política de privacidad — TakaSports',
  description: 'Política de privacidad de TakaSports: qué datos recopilamos, cómo los usamos y tus derechos.',
  alternates: { canonical: `${SITE_URL}/privacidad` },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = '14 de junio de 2026'

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-4xl font-black tracking-tight mb-2">Política de privacidad</h1>
        <p className="text-sm text-text-muted mb-10">Última actualización: {LAST_UPDATED}</p>

        <div className="prose prose-invert prose-purple max-w-none space-y-6">
          <p>
            En <strong>TakaSports Media</strong> respetamos tu privacidad. Esta política explica
            qué información recopilamos cuando usas el sitio web takasportsmedia.com o la aplicación
            móvil TakaSports, cómo la usamos y qué derechos tienes sobre ella.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">1. Datos que recopilamos</h2>

          <h3 className="text-lg font-semibold mt-6 mb-2">1.1 Sin cuenta</h3>
          <p>Cuando usas la app o el web sin iniciar sesión, recopilamos únicamente:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Preferencias locales</strong>: deportes y equipos seguidos, artículos guardados, historial de búsqueda. Se almacenan en tu dispositivo y opcionalmente en tu iCloud privado.</li>
            <li><strong>Datos técnicos anónimos</strong>: tipo de dispositivo, sistema operativo, versión de la app. Sin identificadores personales.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-2">1.2 Con cuenta</h3>
          <p>Si decides crear una cuenta, además recopilamos:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Tu dirección de email (usada para login y comunicaciones esenciales).</li>
            <li>Tu nombre (opcional, mostrado en tu perfil).</li>
            <li>Tu participación en juegos (quinielas, predicciones) para calcular tu puntuación.</li>
          </ul>

          <h3 className="text-lg font-semibold mt-6 mb-2">1.3 Notificaciones push</h3>
          <p>
            Si activas las notificaciones, almacenamos un token anónimo de Apple/Google
            asociado a tu cuenta (si tienes una) para poder enviarte alertas de partidos y noticias.
            Puedes desactivarlas en cualquier momento desde Ajustes del sistema.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-2">1.4 Crash reporting</h3>
          <p>
            Usamos Sentry para capturar errores anónimos de la aplicación. Los reportes incluyen
            el tipo de error, la pantalla donde ocurrió y datos técnicos del dispositivo. No
            incluyen contenido personal ni identificadores que puedan rastrear al usuario.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-2">1.5 Newsletter</h3>
          <p>
            Si te suscribes a la newsletter desde el pie de la web (formulario con casilla de
            consentimiento explícito), guardamos: tu <strong>email</strong>, la <strong>fecha y
            hora del consentimiento</strong>, el <strong>origen</strong> (página de captación),
            tu <strong>user-agent</strong> y un <strong>hash SHA-256 de tu IP</strong> (nunca la
            IP en claro). Estos datos sirven como prueba del consentimiento conforme al RGPD.
          </p>
          <p className="mt-3">
            <strong>Base legal:</strong> consentimiento explícito (Art. 6.1.a RGPD).
            <br />
            <strong>Retención:</strong> hasta que solicites tu baja. Cada email enviado incluye
            un enlace de baja inmediata (un solo click). También puedes pedir la baja escribiendo
            a hola@takasportsmedia.com.
          </p>

          <h3 className="text-lg font-semibold mt-6 mb-2">1.6 Comentarios en artículos</h3>
          <p>
            Si comentas en un artículo (requiere haber iniciado sesión), guardamos: el
            <strong> texto de tu comentario</strong>, tu <strong>nombre público</strong>, tu
            <strong> avatar</strong> (si lo proporcionaste al registrarte), tu <strong>user_id</strong>
            de Supabase, el <strong>slug del artículo</strong> y la <strong>fecha de
            publicación</strong>. Los comentarios son visibles públicamente.
          </p>
          <p className="mt-3">
            Aplicamos un <strong>límite de 5 comentarios por hora</strong> para prevenir spam.
            Cualquier usuario puede <strong>reportar un comentario</strong>; los que acumulen
            varios reportes quedan automáticamente ocultos hasta revisión. Para borrar comentarios
            propios o solicitar la eliminación de tus datos, escribe a hola@takasportsmedia.com.
          </p>
          <p className="mt-3">
            <strong>Base legal:</strong> ejecución de los servicios solicitados (Art. 6.1.b RGPD).
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">2. Cómo usamos tus datos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Personalizar tu feed con los deportes y equipos que sigues.</li>
            <li>Enviarte notificaciones relevantes (si las activas).</li>
            <li>Calcular tu puntuación en juegos y mostrarla en rankings.</li>
            <li>Diagnosticar errores técnicos y mejorar la app.</li>
          </ul>
          <p className="mt-3">
            <strong>No vendemos ni compartimos tus datos personales con terceros</strong>.
            No usamos tus datos para publicidad dirigida.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">3. Almacenamiento y seguridad</h2>
          <p>
            Los datos asociados a tu cuenta se almacenan en infraestructura de Supabase
            (servidores en la Unión Europea). Las contraseñas se guardan con hash criptográfico
            seguro. La comunicación entre tu dispositivo y nuestros servidores está cifrada con TLS.
          </p>
          <p>
            Las preferencias locales se almacenan únicamente en tu dispositivo (AsyncStorage) y
            opcionalmente en tu cuenta privada de iCloud (no accesible para nosotros).
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">4. Servicios de terceros</h2>
          <p>Para funcionar, TakaSports utiliza los siguientes proveedores:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Supabase</strong> — base de datos y autenticación.</li>
            <li><strong>Sanity.io</strong> — gestor de contenidos para artículos.</li>
            <li><strong>Apple/Google Push Notification Service</strong> — entrega de notificaciones.</li>
            <li><strong>Sentry</strong> — crash reporting anónimo.</li>
            <li><strong>ESPN public API</strong> — datos de partidos y resultados.</li>
            <li><strong>Google Analytics 4</strong> — analítica de uso anónima y agregada (sin cookies por defecto; con cookies solo si aceptas).</li>
            <li><strong>Microsoft Clarity</strong> — mapas de calor de uso (solo si aceptas cookies).</li>
            <li><strong>Vercel</strong> — alojamiento y red de entrega del sitio web.</li>
          </ul>
          <p className="mt-3">
            Cada uno tiene su propia política de privacidad. Solo compartimos con ellos lo
            estrictamente necesario para el funcionamiento del servicio.
          </p>
          <h3 className="text-lg font-semibold mt-6 mb-2">4.1 Transferencias internacionales</h3>
          <p>
            Algunos de estos proveedores (<strong>Google</strong>, <strong>Microsoft</strong>,{' '}
            <strong>Vercel</strong> y <strong>Sentry</strong>) tratan datos en{' '}
            <strong>Estados Unidos</strong>. Dichas transferencias se amparan en el{' '}
            <strong>Marco de Privacidad de Datos UE-EE. UU.</strong> (Data Privacy Framework)
            y/o en <strong>Cláusulas Contractuales Tipo</strong> aprobadas por la Comisión
            Europea. Los datos asociados a tu cuenta se alojan en <strong>Supabase</strong>,
            con servidores en la <strong>Unión Europea</strong>.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">5. Tus derechos</h2>
          <p>Conforme al RGPD (UE) y normativas equivalentes, tienes derecho a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Acceder a los datos que tenemos sobre ti.</li>
            <li>Solicitar la corrección de datos inexactos.</li>
            <li>Solicitar la eliminación de tu cuenta y todos los datos asociados.</li>
            <li>Exportar tus datos en un formato portable.</li>
            <li>Revocar consentimientos (notificaciones, etc.) en cualquier momento.</li>
          </ul>
          <p className="mt-3">
            Para ejercer cualquiera de estos derechos, escribe a{' '}
            <a className="text-purple-light underline" href="mailto:hola@takasportsmedia.com">
              hola@takasportsmedia.com
            </a>
            . Responderemos en un plazo máximo de 30 días.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">6. Menores de edad</h2>
          <p>
            TakaSports no está dirigido a menores de 14 años. No recopilamos conscientemente
            datos personales de menores. Si crees que un menor ha creado una cuenta, contáctanos
            y la eliminaremos.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">7. Cookies y almacenamiento local</h2>
          <p>
            El sitio web utiliza cookies y <code>localStorage</code> técnicos esenciales
            para autenticación, preferencias y el funcionamiento de los juegos. Estos no
            requieren consentimiento porque no rastrean comportamiento.
          </p>
          <p className="mt-3">
            Para medir de forma anónima qué contenido funciona, usamos{' '}
            <strong>Google Analytics 4</strong> en modo «sin cookies» (Google Consent Mode v2){' '}
            <strong>desde que entras</strong>: envía mediciones agregadas y anónimas, sin
            cookies ni datos que te identifiquen. Esto funciona aunque rechaces o aún no
            hayas decidido.
          </p>
          <p className="mt-3">
            Si <strong>aceptas</strong> el aviso de cookies, además: (a) Google Analytics 4
            pasa a su modo completo y guarda cookies de medición (<code>_ga</code>,{' '}
            <code>_ga_*</code>); y (b) cargamos <strong>Microsoft Clarity</strong>, que usa
            cookies (<code>_clck</code>, <code>_clsk</code>, <code>CLID</code>) para generar
            mapas de calor de uso. Si <strong>rechazas</strong> o aún no has decidido, no se
            instala ninguna de esas cookies ni se carga Microsoft Clarity.
          </p>
          <p className="mt-3">
            En ningún caso usamos cookies de publicidad ni señales de marketing: las opciones
            de anuncios de Google permanecen desactivadas siempre. Puedes cambiar tu decisión
            cuando quieras desde el control de aquí abajo.
          </p>
          <CookieConsentControl />

          <h2 className="text-2xl font-bold mt-10 mb-3">8. Cambios a esta política</h2>
          <p>
            Si modificamos esta política, actualizaremos la fecha de "Última actualización" en
            esta página y, si los cambios son significativos, te notificaremos por email o en la app.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-3">9. Contacto</h2>
          <p>
            <strong>TakaSports Media</strong><br />
            Email:{' '}
            <a className="text-purple-light underline" href="mailto:hola@takasportsmedia.com">
              hola@takasportsmedia.com
            </a>
          </p>
        </div>
    </div>
  )
}
