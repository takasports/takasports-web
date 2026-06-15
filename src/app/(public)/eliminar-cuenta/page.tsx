import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Eliminar tu cuenta — TakaSports',
  description:
    'Cómo eliminar tu cuenta de TakaSports y todos los datos asociados: desde la aplicación, desde la web o por correo electrónico.',
  alternates: { canonical: `${SITE_URL}/eliminar-cuenta` },
  robots: { index: true, follow: true },
}

const LAST_UPDATED = '15 de junio de 2026'

export default function EliminarCuentaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-4xl font-black tracking-tight mb-2">Eliminar tu cuenta</h1>
      <p className="text-sm text-text-muted mb-10">Última actualización: {LAST_UPDATED}</p>

      <div className="prose prose-invert prose-purple max-w-none space-y-6">
        <p>
          En TakaSports puedes eliminar tu cuenta y todos los datos personales asociados en cualquier
          momento y de forma gratuita. Tienes tres maneras de hacerlo.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">1. Desde la aplicación móvil</h2>
        <p>
          Abre la app de TakaSports, entra en la pestaña <strong>Perfil</strong>, baja hasta{' '}
          <strong>Zona de peligro</strong> y pulsa <strong>Eliminar mi cuenta</strong>. Tras
          confirmar, la eliminación es inmediata y permanente.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">2. Desde la web</h2>
        <p>
          Inicia sesión en www.takasportsmedia.com, entra en{' '}
          <a className="text-purple-light underline" href="/perfil">
            tu perfil
          </a>
          , baja hasta <strong>Zona de peligro</strong> y pulsa <strong>Eliminar cuenta</strong>.
          Tendrás que confirmar escribiendo la palabra «ELIMINAR». La eliminación es inmediata y
          permanente.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">3. Por correo electrónico</h2>
        <p>
          Si no puedes acceder a tu cuenta, escríbenos a{' '}
          <a className="text-purple-light underline" href="mailto:contacto@takasportsmedia.com">
            contacto@takasportsmedia.com
          </a>{' '}
          desde la dirección de correo con la que te registraste, indicando que deseas eliminar tu
          cuenta. Atenderemos tu solicitud en un plazo máximo de 30 días.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">Qué datos se eliminan</h2>
        <p>
          Al eliminar tu cuenta se borran de forma permanente todos los datos personales asociados,
          entre ellos:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Tu perfil: nombre, correo electrónico, avatar y preferencias.</li>
          <li>Tu actividad e historial en los juegos y tu posición en la Liga Taka.</li>
          <li>Tus predicciones, quinielas y tu participación en ligas privadas.</li>
          <li>Tus equipos y competiciones favoritos, recordatorios y artículos guardados.</li>
          <li>Tus suscripciones a notificaciones.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-3">Qué conservamos</h2>
        <p>
          Tras la eliminación no conservamos datos que te identifiquen. Únicamente pueden permanecer,
          de forma anónima y desvinculada de tu persona, datos agregados que ya no permiten
          identificarte (por ejemplo, estadísticas globales de juego), así como aquella información
          que la ley nos obligue a conservar durante un plazo determinado. Los contenidos que hayas
          publicado de forma pública (como comentarios o mensajes de liga) pueden anonimizarse en
          lugar de borrarse para no romper las conversaciones; si prefieres su retirada, indícanoslo.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-3">Más información</h2>
        <p>
          El tratamiento de tus datos personales se detalla en nuestra{' '}
          <a className="text-purple-light underline" href="/privacidad">
            Política de privacidad
          </a>
          . Para cualquier duda sobre el borrado de tu cuenta, escríbenos a{' '}
          <a className="text-purple-light underline" href="mailto:contacto@takasportsmedia.com">
            contacto@takasportsmedia.com
          </a>
          .
        </p>
      </div>
    </div>
  )
}
