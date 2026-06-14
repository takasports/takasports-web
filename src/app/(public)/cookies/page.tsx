import type { Metadata } from 'next'
import CookieConsentControl from '@/components/CookieConsentControl'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Política de cookies — TakaSports',
  description: 'Qué cookies y tecnologías usa la web de TakaSports, para qué sirven, su duración y cómo aceptar, rechazar o retirar tu consentimiento.',
  alternates: { canonical: `${SITE_URL}/cookies` },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = '14 de junio de 2026'

interface Row {
  name: string
  provider: string
  purpose: string
  consent: string
  duration: string
}

// Tabla de cookies y tecnologías reales (verificadas en el código). Las
// duraciones de Clarity no las documenta oficialmente Microsoft → marcadas
// como aproximadas (pendiente de confirmar en producción con DevTools).
const ROWS: Row[] = [
  {
    name: 'sb-…-auth-token',
    provider: 'TakaSports / Supabase (propia)',
    purpose: 'Mantener tu sesión iniciada (guarda tu token de acceso y de refresco para que no tengas que entrar en cada página).',
    consent: 'Esencial — exenta',
    duration: 'De sesión: el token caduca a ~1 h y se renueva solo mientras sigas conectado; se borra al cerrar sesión.',
  },
  {
    name: 'taka-consent-v1 (localStorage)',
    provider: 'TakaSports (propia)',
    purpose: 'Recordar tu decisión sobre las cookies (aceptar o rechazar) para no volver a mostrarte el aviso.',
    consent: 'Esencial — exenta',
    duration: '180 días (después se te vuelve a preguntar).',
  },
  {
    name: '_ga',
    provider: 'Google LLC (tercero, EE. UU.)',
    purpose: 'Analítica: distinguir usuarios para medir de forma agregada cómo se usa el sitio.',
    consent: 'Requiere consentimiento (solo si aceptas)',
    duration: '2 años (el navegador puede acortar la duración real).',
  },
  {
    name: '_ga_<ID>',
    provider: 'Google LLC (tercero, EE. UU.)',
    purpose: 'Analítica: mantener el estado de la sesión de medición de Google Analytics 4.',
    consent: 'Requiere consentimiento (solo si aceptas)',
    duration: '2 años (sujeto a los límites del navegador).',
  },
  {
    name: '_clck',
    provider: 'Microsoft Clarity',
    purpose: 'Conservar tu identificador de Clarity y sus preferencias para asociar tus visitas dentro de este sitio.',
    consent: 'Requiere consentimiento (solo si aceptas)',
    duration: '≈ 1 año (aproximada).',
  },
  {
    name: '_clsk',
    provider: 'Microsoft Clarity',
    purpose: 'Unir las páginas que ves en una única sesión de Clarity.',
    consent: 'Requiere consentimiento (solo si aceptas)',
    duration: '≈ 1 día (aproximada).',
  },
  {
    name: 'CLID',
    provider: 'Microsoft Clarity (tercero)',
    purpose: 'Identificar la primera vez que Clarity vio a este navegador.',
    consent: 'Requiere consentimiento (solo si aceptas)',
    duration: '≈ 1 año (aproximada).',
  },
]

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-black tracking-tight mb-2">Política de cookies</h1>
      <p className="text-sm text-text-muted mb-1">Última actualización: {LAST_UPDATED}</p>
      <p className="text-sm text-text-muted mb-10">Versión del consentimiento: v1</p>

      <div className="prose prose-invert prose-purple max-w-none space-y-6">
        <p>
          Esta política desarrolla la información del aviso de cookies (el banner) conforme
          al artículo 22.2 de la Ley 34/2002 (LSSI) y al Reglamento General de Protección de
          Datos (RGPD). Se refiere al <strong>sitio web takasportsmedia.com</strong>. La app
          móvil de TakaSports no usa cookies de navegador y se rige por la{' '}
          <a className="text-purple-light underline" href="/privacidad">Política de privacidad</a>.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">1. ¿Qué son las cookies y tecnologías similares?</h2>
        <p>
          Las cookies son pequeños archivos que un sitio guarda en tu dispositivo. Junto a
          tecnologías similares (almacenamiento local, píxeles o señales sin cookies),
          permiten almacenar y recuperar información mientras navegas. Son <strong>de primera
          parte</strong> cuando las pone takasportsmedia.com, y <strong>de tercera parte</strong>
          cuando las pone un dominio externo (por ejemplo, Google o Microsoft).
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">2. ¿Quién es el responsable?</h2>
        <p>
          El responsable del tratamiento es <strong>TakaSports Media</strong>, editor de
          takasportsmedia.com (persona física / autónomo en España). Los datos fiscales
          completos (NIF y domicilio) figurarán en el Aviso Legal. Para cualquier consulta
          sobre privacidad o cookies, escribe a{' '}
          <a className="text-purple-light underline" href="mailto:contacto@takasportsmedia.com">
            contacto@takasportsmedia.com
          </a>.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">3. Cómo funciona el consentimiento</h2>
        <p>
          La primera vez que entras te mostramos un aviso con dos botones de igual tamaño y
          peso: <strong>Aceptar</strong> y <strong>Rechazar</strong>. Las cookies de analítica
          (Google Analytics y Microsoft Clarity) <strong>solo se cargan si pulsas «Aceptar»</strong>.
          Si rechazas —o aún no has decidido— la web funciona con total normalidad y no se
          instala ninguna cookie de analítica.
        </p>
        <p>
          Tu decisión se guarda en tu navegador (clave <code>taka-consent-v1</code>) durante
          180 días; pasado ese plazo te volvemos a preguntar. Puedes <strong>cambiarla o
          retirarla cuando quieras</strong> desde el control del final de esta página o el
          enlace «Cookies» del pie. <strong>Retirar el consentimiento es tan fácil como
          otorgarlo.</strong>
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">4. Cookies y tecnologías que usamos</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Las marcadas como «Requiere consentimiento» solo se instalan después de que pulses
          Aceptar.
        </p>
        <div className="not-prose overflow-x-auto my-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Nombre', 'Proveedor', 'Finalidad', 'Consentimiento', 'Duración'].map(h => (
                  <th key={h} className="text-left align-top p-2 font-bold" style={{ color: 'var(--text-primary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => (
                <tr key={r.name} style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <td className="align-top p-2"><code>{r.name}</code></td>
                  <td className="align-top p-2">{r.provider}</td>
                  <td className="align-top p-2">{r.purpose}</td>
                  <td className="align-top p-2">{r.consent}</td>
                  <td className="align-top p-2">{r.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-bold mt-10 mb-3">5. Analítica: Google Analytics 4 y Microsoft Clarity</h2>
        <p>
          Ambas herramientas <strong>solo se cargan si aceptas</strong>. Las usamos para medir
          cómo se usa el sitio y mejorarlo; no para publicidad. En Google Analytics, las
          señales de publicidad (<code>ad_storage</code>, <code>ad_user_data</code>,{' '}
          <code>ad_personalization</code>) permanecen <strong>desactivadas siempre</strong>.
        </p>
        <p>
          Ten en cuenta que, al activarse, estas herramientas tratan datos en Estados Unidos
          y, en el caso de Google Analytics, transmiten tu dirección IP y datos técnicos del
          navegador a Google (lo que constituye una transferencia internacional; ver punto 7).
          <strong> Microsoft Clarity</strong> registra interacciones y mapas de calor y puede
          generar grabaciones de la sesión; aplicamos el enmascaramiento de datos de Clarity
          para no capturar texto sensible. Si prefieres no participar, basta con rechazar el
          aviso de cookies.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">6. Cookies técnicas o esenciales</h2>
        <p>
          No requieren consentimiento porque son necesarias para que el sitio funcione y no
          rastrean tu comportamiento:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong><code>sb-…-auth-token</code></strong> (Supabase): mantiene tu sesión iniciada.
            Sin ella perderías el login. No se puede rechazar.
          </li>
          <li>
            <strong><code>taka-consent-v1</code></strong> (almacenamiento local): guarda tu
            propia decisión sobre las cookies. No rastrea.
          </li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-3">7. Transferencias internacionales</h2>
        <p>
          Algunos proveedores tratan datos fuera del Espacio Económico Europeo. El mecanismo de
          garantía es distinto para cada uno:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Google LLC</strong> (Analytics) — Marco de Privacidad de Datos UE-EE. UU. (Data Privacy Framework).</li>
          <li><strong>Microsoft</strong> (Clarity) — Marco de Privacidad de Datos UE-EE. UU. (Data Privacy Framework).</li>
          <li><strong>Vercel Inc.</strong> (alojamiento) — Cláusulas Contractuales Tipo de la Comisión Europea.</li>
          <li><strong>Sentry</strong> (diagnóstico de errores) — Data Privacy Framework con Cláusulas Contractuales Tipo de respaldo.</li>
          <li><strong>Supabase</strong> (cuenta) — servidores en la Unión Europea: sin transferencia internacional.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-3">8. Cómo gestionar, rechazar o retirar el consentimiento</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Con el control de aquí abajo («Cambiar mi decisión») o el enlace «Cookies» del pie de página.</li>
          <li>Desde tu navegador, borrando o bloqueando cookies (Chrome, Firefox, Safari, Edge tienen su propia ayuda en Ajustes → Privacidad).</li>
          <li>Con las herramientas de los terceros: el complemento de inhabilitación de{' '}
            <a className="text-purple-light underline" href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics</a>.
          </li>
        </ul>

        <CookieConsentControl />

        <h2 className="text-2xl font-bold mt-10 mb-3">9. Caducidad y cambios</h2>
        <p>
          Tu decisión se conserva 180 días. Si en el futuro añadimos una finalidad, una
          herramienta nueva o publicidad, actualizaremos esta política, subiremos la versión
          del consentimiento (de v1 a v2) y te volveremos a preguntar.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">10. Tus derechos y más información</h2>
        <p>
          Tienes el detalle de tus derechos (acceso, rectificación, supresión, etc.), las bases
          jurídicas y los proveedores en nuestra{' '}
          <a className="text-purple-light underline" href="/privacidad">Política de privacidad</a>.
          También puedes reclamar ante la Agencia Española de Protección de Datos
          (<a className="text-purple-light underline" href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>).
        </p>
      </div>
    </div>
  )
}
